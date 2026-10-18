#!/usr/bin/env bash
# Commande imposée de la clé SSH du déploiement continu (authorized_keys « command=… » de l'utilisateur deploy).
# Copiée par vps-bootstrap.sh dans /usr/local/sbin/globus-ci-deploy (propriété root, non modifiable par deploy).
#
#   ssh deploy@serveur "deploy <commit (40 caractères)> <compte GitHub>"   jeton du registre sur l'entrée standard
#
# Seule action possible avec cette clé : mettre en service un commit de la branche main dont les images ont été
# construites et publiées par la CI. Le jeton (GITHUB_TOKEN du job, lecture des paquets) n'est jamais écrit sur
# disque : configuration Docker temporaire, supprimée en fin de déploiement.
set -euo pipefail
umask 027
REPO="${GLOBUS_REPO_DIR:-/opt/globus/repo}"
ROOT="$REPO/projet2/systemcomplet"
REGISTRY_HOST="ghcr.io"

read -r action sha actor extra <<<"${SSH_ORIGINAL_COMMAND:-}" || true
if [[ "${action:-}" != "deploy" || ! "${sha:-}" =~ ^[0-9a-f]{40}$ || ! "${actor:-}" =~ ^[A-Za-z0-9][A-Za-z0-9-]{0,38}$ || -n "${extra:-}" ]]; then
  echo "Commande refusée (attendu : deploy <commit> <compte>)" >&2
  exit 2
fi

exec 9>"${REPO%/*}/deploy.lock"
flock -w 900 9 || { echo "Un autre déploiement est en cours" >&2; exit 75; }

token="$(head -c 8192)"
[[ -n "$token" ]] || { echo "Jeton du registre absent (entrée standard)" >&2; exit 2; }

git -C "$REPO" fetch --quiet --no-tags origin main
if ! git -C "$REPO" merge-base --is-ancestor "$sha" origin/main; then
  echo "Le commit $sha n'appartient pas à la branche main" >&2
  exit 3
fi
# Exécutions CI parallèles : une version plus ancienne que celle en service n'est jamais remise en ligne.
current="$(sed -n 's/^GLOBUS_VERSION=//p' "$ROOT/infra/env/compose.env" 2>/dev/null || true)"
if [[ "$current" =~ ^[0-9a-f]{40}$ && "$current" != "$sha" ]] \
  && git -C "$REPO" merge-base --is-ancestor "$sha" "$current" 2>/dev/null; then
  echo "Commit ${sha:0:12} plus ancien que la version en service ${current:0:12} : déploiement ignoré"
  exit 0
fi
git -C "$REPO" -c advice.detachedHead=false checkout --quiet --force --detach "$sha"

DOCKER_CONFIG="$(mktemp -d)"
export DOCKER_CONFIG
trap 'rm -rf "$DOCKER_CONFIG"' EXIT
printf '%s' "$token" | docker login "$REGISTRY_HOST" -u "$actor" --password-stdin >/dev/null
unset token

echo "▶ Déploiement du commit ${sha:0:12}"
GLOBUS_RELEASE="$sha" "$ROOT/infra/scripts/deploy.sh"
