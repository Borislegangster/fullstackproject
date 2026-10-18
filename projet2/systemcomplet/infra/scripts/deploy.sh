#!/usr/bin/env bash
# Mise en ligne de la pile GLOBUS (idempotent, sans coupure de la base). À exécuter sur le serveur :
#   ./infra/scripts/deploy.sh                             construit les images sur le serveur ; en mode registre,
#                                                         remet en service la version publiée en cours
#   GLOBUS_RELEASE=<commit> ./infra/scripts/deploy.sh     version précise (déploiement continu, retour arrière)
#   WITH_CALLS=0      sans relais TURN (appels limités aux réseaux permissifs)
#   WITH_ANTIVIRUS=1  avec ClamAV (renseigner CLAMAV_HOST=clamav dans env/api.env)
#
# Mode registre (GLOBUS_API_IMAGE et GLOBUS_WEB_IMAGE dans env/compose.env) : les images construites et testées par
# la CI sont tirées du registre (connexion : infra/scripts/ci-deploy.sh). La version en service est mémorisée dans
# env/compose.env (GLOBUS_VERSION, historique : env/releases.log) ; les trois dernières versions restent en cache
# pour un retour arrière immédiat.
set -euo pipefail
cd "$(dirname "$0")/.."
# Lancé en root sur un serveur préparé par vps-bootstrap.sh : on agit en tant que propriétaire des fichiers (deploy),
# sinon les fichiers de env/ modifiés ici appartiendraient à root et le déploiement continu ne pourrait plus les lire.
if [[ $EUID -eq 0 && -d env && "$(stat -c %U env)" != "root" ]]; then
  exec runuser -u "$(stat -c %U env)" -- "$PWD/scripts/deploy.sh" "$@"
fi

for f in env/compose.env env/postgres.env env/api.env env/web.env; do
  [[ -f "$f" ]] || { echo "Fichier $f absent : lancer d'abord ./infra/scripts/init-env.sh" >&2; exit 1; }
done
set -a
# shellcheck disable=SC1091
source env/compose.env
set +a

REGISTRY=0
[[ -n "${GLOBUS_API_IMAGE:-}" && -n "${GLOBUS_WEB_IMAGE:-}" ]] && REGISTRY=1
if [[ -n "${GLOBUS_RELEASE:-}" ]]; then
  [[ "$GLOBUS_RELEASE" =~ ^[A-Za-z0-9._-]{1,128}$ ]] || { echo "GLOBUS_RELEASE invalide : $GLOBUS_RELEASE" >&2; exit 2; }
  export GLOBUS_VERSION="$GLOBUS_RELEASE"
fi
API_IMAGE="${GLOBUS_API_IMAGE:-globus/api}"
WEB_IMAGE="${GLOBUS_WEB_IMAGE:-globus/web}"

COMPOSE=(docker compose --env-file env/compose.env -f docker-compose.yml)
PROFILES=(--profile tls)
[[ "${WITH_CALLS:-1}" == "1" ]] && PROFILES+=(--profile calls)
[[ "${WITH_ANTIVIRUS:-0}" == "1" ]] && PROFILES+=(--profile antivirus)

if [[ $REGISTRY -eq 1 ]]; then
  for img in "$API_IMAGE:$GLOBUS_VERSION" "$WEB_IMAGE:$GLOBUS_VERSION"; do
    if ! docker image inspect "$img" >/dev/null 2>&1; then
      echo "▶ Téléchargement de $img"
      docker pull --quiet "$img" || { echo "Image $img introuvable : déployer une version publiée par la CI (GLOBUS_RELEASE=<commit>)." >&2; exit 1; }
    fi
  done
else
  echo "▶ Construction des images $API_IMAGE et $WEB_IMAGE ${GLOBUS_VERSION}"
  "${COMPOSE[@]}" build migrate web
fi

DOMAINS=(-d "${GLOBUS_DOMAIN}")
# Domaine unique (init-env.sh --no-www) : le nom réservé « .invalid » n'entre pas dans le certificat.
[[ "${GLOBUS_WWW_DOMAIN}" != *.invalid ]] && DOMAINS+=(-d "${GLOBUS_WWW_DOMAIN}")
if ! "${COMPOSE[@]}" run --rm --no-deps --entrypoint sh certbot -c "test -s /etc/letsencrypt/live/${GLOBUS_DOMAIN}/fullchain.pem"; then
  echo "▶ Premier certificat TLS Let's Encrypt pour ${DOMAINS[*]}"
  "${COMPOSE[@]}" stop nginx >/dev/null 2>&1 || true
  "${COMPOSE[@]}" run --rm --no-deps -p 80:80 --entrypoint certbot certbot certonly --standalone \
    --non-interactive --agree-tos -m "${ACME_EMAIL}" "${DOMAINS[@]}"
fi

echo "▶ Migrations puis démarrage (version ${GLOBUS_VERSION})"
"${COMPOSE[@]}" "${PROFILES[@]}" up -d --remove-orphans
# Compose ne recrée pas toujours un conteneur quand son image vient d'être reconstruite (api / worker utilisent
# l'image construite par « migrate »). On compare l'image en service à l'image attendue : sinon l'ancien code
# continuerait de tourner après des migrations appliquées.
for pair in "api:$API_IMAGE" "worker:$API_IMAGE" "web:$WEB_IMAGE"; do
  svc="${pair%%:*}"
  NEW_IMAGE="$(docker image inspect --format '{{.Id}}' "${pair#*:}:${GLOBUS_VERSION}")"
  cid="$("${COMPOSE[@]}" ps -q "$svc")"
  if [[ -n "$cid" && "$(docker inspect --format '{{.Image}}' "$cid")" != "$NEW_IMAGE" ]]; then
    echo "▶ Redémarrage de $svc sur la nouvelle image"
    "${COMPOSE[@]}" "${PROFILES[@]}" up -d --no-deps --force-recreate "$svc"
  fi
done
# nginx résout « api » / « web » au chargement de sa configuration : après la recréation d'un conteneur (nouvelle
# adresse IP sur le réseau Docker), il faut recharger nginx, sinon il vise l'ancienne adresse (erreurs 502).
if [[ -n "$("${COMPOSE[@]}" ps -q nginx)" ]]; then
  echo "▶ Rechargement de nginx (nouvelles adresses des services)"
  "${COMPOSE[@]}" exec -T nginx nginx -s reload || "${COMPOSE[@]}" restart nginx
fi

echo "▶ Vérification de l'état des services"
for svc in api web nginx; do
  status="absent"
  for _ in $(seq 1 60); do
    cid="$("${COMPOSE[@]}" ps -q "$svc")"
    status="$( [[ -n "$cid" ]] && docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$cid" || echo absent)"
    [[ "$status" == "healthy" ]] && break
    sleep 3
  done
  if [[ "$status" != "healthy" ]]; then
    echo "✖ $svc non opérationnel (état : $status)" >&2
    "${COMPOSE[@]}" logs --tail 80 "$svc" >&2 || true
    exit 1
  fi
done

if [[ $REGISTRY -eq 1 ]]; then
  sed -i "s/^GLOBUS_VERSION=.*/GLOBUS_VERSION=${GLOBUS_VERSION}/" env/compose.env
  printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$GLOBUS_VERSION" >>env/releases.log
  # Purge : version en service + deux précédentes conservées.
  for repo in "$API_IMAGE" "$WEB_IMAGE"; do
    { docker image ls "$repo" --format '{{.Tag}}' | grep -vx "$GLOBUS_VERSION" || true; } | tail -n +3 \
      | while read -r tag; do docker image rm "$repo:$tag" >/dev/null 2>&1 || true; done
  done
  docker image prune -f >/dev/null 2>&1 || true
fi

"${COMPOSE[@]}" ps
echo "✔ Déployé (version ${GLOBUS_VERSION}). Premier lancement : créer l'administrateur avec"
echo "  docker compose --env-file env/compose.env -f docker-compose.yml exec api python scripts/create_admin.py --email <email> --first <prénom> --last <nom> --invite"
