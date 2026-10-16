#!/usr/bin/env bash
# Construction des images et mise en ligne de la pile GLOBUS (idempotent, sans coupure de la base).
# À exécuter sur le serveur, depuis n'importe quel répertoire :  ./infra/scripts/deploy.sh
#   WITH_CALLS=0      sans relais TURN (appels limités aux réseaux permissifs)
#   WITH_ANTIVIRUS=1  avec ClamAV (renseigner CLAMAV_HOST=clamav dans env/api.env)
set -euo pipefail
cd "$(dirname "$0")/.."

for f in env/compose.env env/postgres.env env/api.env env/web.env; do
  [[ -f "$f" ]] || { echo "Fichier $f absent : lancer d'abord ./infra/scripts/init-env.sh" >&2; exit 1; }
done
set -a
# shellcheck disable=SC1091
source env/compose.env
set +a

COMPOSE=(docker compose --env-file env/compose.env -f docker-compose.yml)
PROFILES=(--profile tls)
[[ "${WITH_CALLS:-1}" == "1" ]] && PROFILES+=(--profile calls)
[[ "${WITH_ANTIVIRUS:-0}" == "1" ]] && PROFILES+=(--profile antivirus)

echo "▶ Construction des images globus/api et globus/web ${GLOBUS_VERSION}"
"${COMPOSE[@]}" build migrate web

DOMAINS=(-d "${GLOBUS_DOMAIN}")
# Domaine unique (init-env.sh --no-www) : le nom réservé « .invalid » n'entre pas dans le certificat.
[[ "${GLOBUS_WWW_DOMAIN}" != *.invalid ]] && DOMAINS+=(-d "${GLOBUS_WWW_DOMAIN}")
if ! "${COMPOSE[@]}" run --rm --no-deps --entrypoint sh certbot -c "test -s /etc/letsencrypt/live/${GLOBUS_DOMAIN}/fullchain.pem"; then
  echo "▶ Premier certificat TLS Let's Encrypt pour ${DOMAINS[*]}"
  "${COMPOSE[@]}" stop nginx >/dev/null 2>&1 || true
  "${COMPOSE[@]}" run --rm --no-deps -p 80:80 --entrypoint certbot certbot certonly --standalone \
    --non-interactive --agree-tos -m "${ACME_EMAIL}" "${DOMAINS[@]}"
fi

echo "▶ Migrations puis démarrage"
"${COMPOSE[@]}" "${PROFILES[@]}" up -d --remove-orphans
# Compose ne recrée pas toujours un conteneur quand son image vient d'être reconstruite (api / worker utilisent
# l'image construite par « migrate »). On compare l'image en service à l'image fraîchement construite : sinon
# l'ancien code continuerait de tourner après des migrations appliquées.
for pair in api:globus/api worker:globus/api web:globus/web; do
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
"${COMPOSE[@]}" ps
echo "✔ Déployé. Premier lancement : créer l'administrateur avec"
echo "  docker compose --env-file env/compose.env -f docker-compose.yml exec api python scripts/create_admin.py --email <email> --first <prénom> --last <nom>"
