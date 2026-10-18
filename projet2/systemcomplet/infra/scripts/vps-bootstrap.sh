#!/usr/bin/env bash
# Préparation d'un VPS Ubuntu (Hostinger KVM ou équivalent) pour GLOBUS. Idempotent, à lancer en root :
#
#   bash vps-bootstrap.sh --repo https://github.com/<compte>/<dépôt>.git [--ci-key "ssh-ed25519 AAAA… ci"]
#
# - Docker Engine + Compose v2 (si absents), git, fail2ban, mises à jour de sécurité automatiques, swap ;
# - utilisateur « deploy » (groupe docker) propriétaire de /opt/globus ; dépôt cloné en extraction partielle
#   (seul projet2/systemcomplet est extrait) dans /opt/globus/repo ;
# - clé SSH de la CI limitée à la commande /usr/local/sbin/globus-ci-deploy (aucun shell, aucun tunnel).
# À relancer après une modification de infra/scripts/ci-deploy.sh (copie root de la commande imposée).
set -euo pipefail

REPO_URL="" CI_KEY="" BRANCH="main" SWAP_GB=4
while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo) REPO_URL="$2"; shift 2 ;;
    --ci-key) CI_KEY="$2"; shift 2 ;;
    --branch) BRANCH="$2"; shift 2 ;;
    --swap-gb) SWAP_GB="$2"; shift 2 ;;
    *) echo "Option inconnue : $1" >&2; exit 2 ;;
  esac
done
[[ $EUID -eq 0 ]] || { echo "À lancer en root" >&2; exit 2; }
[[ -n "$REPO_URL" ]] || { echo "--repo requis" >&2; exit 2; }
[[ -z "$CI_KEY" || "$CI_KEY" =~ ^ssh-(ed25519|rsa)\ [A-Za-z0-9+/=]+( [^\"]*)?$ ]] || { echo "--ci-key invalide" >&2; exit 2; }

BASE=/opt/globus
REPO="$BASE/repo"
export DEBIAN_FRONTEND=noninteractive

echo "▶ Paquets système"
apt-get update -qq
apt-get install -y -qq git fail2ban unattended-upgrades ca-certificates curl util-linux >/dev/null
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
docker compose version >/dev/null
systemctl enable --now docker fail2ban unattended-upgrades >/dev/null 2>&1

echo "▶ Mémoire d'échange et réglages noyau"
if ! swapon --show=NAME --noheadings | grep -qx /swapfile; then
  [[ -f /swapfile ]] || { fallocate -l "${SWAP_GB}G" /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null; }
  swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >>/etc/fstab
fi
cat >/etc/sysctl.d/90-globus.conf <<'EOF'
# GLOBUS : swap en dernier recours, Redis (fork des sauvegardes AOF), files d'attente réseau.
vm.swappiness=10
vm.overcommit_memory=1
net.core.somaxconn=1024
EOF
sysctl --quiet --system
mkdir -p /etc/systemd/journald.conf.d
printf '[Journal]\nSystemMaxUse=500M\n' >/etc/systemd/journald.conf.d/90-globus.conf
systemctl restart systemd-journald

echo "▶ Utilisateur deploy et dépôt"
id deploy >/dev/null 2>&1 || useradd --create-home --shell /bin/bash deploy
usermod -aG docker deploy
install -d -o deploy -g deploy -m 750 "$BASE"
if [[ ! -d "$REPO/.git" ]]; then
  runuser -u deploy -- git clone --quiet --filter=blob:none --no-checkout "$REPO_URL" "$REPO"
  runuser -u deploy -- git -C "$REPO" sparse-checkout set --no-cone '/projet2/systemcomplet/'
  runuser -u deploy -- git -C "$REPO" checkout --quiet "$BRANCH"
fi
install -o root -g root -m 755 "$REPO/projet2/systemcomplet/infra/scripts/ci-deploy.sh" /usr/local/sbin/globus-ci-deploy

if [[ -n "$CI_KEY" ]]; then
  echo "▶ Clé SSH du déploiement continu (commande imposée)"
  install -d -o deploy -g deploy -m 700 /home/deploy/.ssh
  printf 'command="/usr/local/sbin/globus-ci-deploy",no-port-forwarding,no-X11-forwarding,no-agent-forwarding,no-pty,no-user-rc %s\n' \
    "$CI_KEY" >/home/deploy/.ssh/authorized_keys
  chown deploy:deploy /home/deploy/.ssh/authorized_keys
  chmod 600 /home/deploy/.ssh/authorized_keys
fi

echo "✔ Serveur prêt. Suite (en tant que deploy) :"
echo "  runuser -u deploy -- $REPO/projet2/systemcomplet/infra/scripts/init-env.sh --domain <domaine> --public-ip <ip> --acme-email <email> …"
