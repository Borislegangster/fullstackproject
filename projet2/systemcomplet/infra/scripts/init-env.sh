#!/usr/bin/env bash
# Génère, SUR LE SERVEUR, les fichiers d'environnement de production GLOBUS avec des secrets aléatoires forts.
# Les secrets ne quittent jamais le serveur : fichiers en 0600 dans infra/env/ (exclus du dépôt git).
#
#   ./infra/scripts/init-env.sh --domain globus-engineering.cm --www www.globus-engineering.cm \
#       --public-ip 203.0.113.10 --acme-email admin@globus-engineering.cm [--force]
#
# Options : --no-www (domaine unique, ex. sous-domaine de test) ; --private-ip 10.0.1.23 (serveur derrière une IP
# publique NAT 1:1, ex. AWS EC2 : coturn annonce l'IP publique) ; --ses-region eu-west-3 (e-mails via Amazon SES
# avec le rôle IAM du serveur, aucun mot de passe) ; --no-payments (aucun opérateur de paiement contractualisé) ;
# --email-from 'Nom <adresse@vérifiée>' (expéditeur des e-mails, défaut : no-reply@<domaine>).
#
# Reste à renseigner ensuite (console d'administration > Paramètres > Intégrations, ou api.env) : SMTP / SendGrid /
# Mailgun, fournisseurs de paiement (CinetPay, Flutterwave, Stripe), WhatsApp Meta, Twilio, APS, Anthropic.
set -euo pipefail

DOMAIN="" WWW="" PUBLIC_IP="" PRIVATE_IP="" ACME_EMAIL="" SES_REGION="" EMAIL_FROM="" NO_WWW=0 NO_PAYMENTS=0 FORCE=0 VERSION="4.0.0"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain) DOMAIN="$2"; shift 2 ;;
    --www) WWW="$2"; shift 2 ;;
    --public-ip) PUBLIC_IP="$2"; shift 2 ;;
    --private-ip) PRIVATE_IP="$2"; shift 2 ;;
    --ses-region) SES_REGION="$2"; shift 2 ;;
    --email-from) EMAIL_FROM="$2"; shift 2 ;;
    --no-www) NO_WWW=1; shift ;;
    --no-payments) NO_PAYMENTS=1; shift ;;
    --acme-email) ACME_EMAIL="$2"; shift 2 ;;
    --version) VERSION="$2"; shift 2 ;;
    --force) FORCE=1; shift ;;
    *) echo "Option inconnue : $1" >&2; exit 2 ;;
  esac
done
[[ -n "$DOMAIN" && -n "$PUBLIC_IP" && -n "$ACME_EMAIL" ]] || { echo "--domain, --public-ip et --acme-email sont requis" >&2; exit 2; }
WWW="${WWW:-www.$DOMAIN}"
# Domaine unique : nom réservé (RFC 2606) jamais résolu, ignoré par deploy.sh pour le certificat.
[[ $NO_WWW -eq 1 ]] && WWW="www-disabled.invalid"
EXTERNAL_IP="$PUBLIC_IP"
[[ -n "$PRIVATE_IP" ]] && EXTERNAL_IP="$PUBLIC_IP/$PRIVATE_IP"
if [[ -n "$SES_REGION" ]]; then
  EMAIL_BLOCK="EMAIL_PROVIDER=ses
SES_REGION=$SES_REGION"
else
  EMAIL_BLOCK="EMAIL_PROVIDER=smtp
SMTP_HOST=
SMTP_PORT=587
SMTP_USER="
fi
EMAIL_FROM="${EMAIL_FROM:-GLOBUS ENGINEERING <no-reply@$DOMAIN>}"
PAYMENTS="mtn_momo,orange_money"
[[ $NO_PAYMENTS -eq 1 ]] && PAYMENTS=""
command -v openssl >/dev/null || { echo "openssl requis" >&2; exit 2; }

ENV_DIR="$(cd "$(dirname "$0")/.." && pwd)/env"
mkdir -p "$ENV_DIR"
umask 077

for f in compose.env postgres.env api.env web.env turnserver.conf; do
  if [[ -e "$ENV_DIR/$f" && $FORCE -ne 1 ]]; then
    echo "$ENV_DIR/$f existe déjà : relancer avec --force pour régénérer (les secrets actuels seraient perdus)." >&2
    exit 1
  fi
done

rand() { openssl rand -base64 "$1" | tr -d '\n=+/' | cut -c1-"$2"; }
PG_PASSWORD="$(rand 48 40)"
SECRET_KEY="$(rand 96 86)"
MASTER_KEY="$(openssl rand -base64 32 | tr -d '\n')"
REVALIDATE_SECRET="$(rand 48 48)"
TURN_SECRET="$(rand 48 48)"

cat >"$ENV_DIR/compose.env" <<EOF
GLOBUS_VERSION=$VERSION
GLOBUS_DOMAIN=$DOMAIN
GLOBUS_WWW_DOMAIN=$WWW
ACME_EMAIL=$ACME_EMAIL
TURN_PUBLIC_IP=$PUBLIC_IP
EOF

cat >"$ENV_DIR/postgres.env" <<EOF
POSTGRES_DB=globus
POSTGRES_USER=globus
POSTGRES_PASSWORD=$PG_PASSWORD
EOF

cat >"$ENV_DIR/api.env" <<EOF
ENV=production
PUBLIC_BASE_URL=https://$DOMAIN
API_PUBLIC_URL=https://$DOMAIN
CORS_ORIGINS=https://$DOMAIN
DATABASE_URL=postgresql+psycopg://globus:$PG_PASSWORD@postgres:5432/globus
REDIS_URL=redis://redis:6379/0
SECRET_KEY=$SECRET_KEY
MASTER_ENCRYPTION_KEY=$MASTER_KEY
MASTER_KEY_ID=k1
COOKIE_SECURE=true
TRUSTED_PROXIES=1
WEBAUTHN_RP_ID=$DOMAIN
MFA_ENFORCEMENT=enforce
WORKER_INLINE=false
WEB_INTERNAL_URL=http://web:3000
REVALIDATE_SECRET=$REVALIDATE_SECRET
TURN_URLS=turn:$DOMAIN:3478?transport=udp,turn:$DOMAIN:3478?transport=tcp,turns:$DOMAIN:5349?transport=tcp
TURN_SHARED_SECRET=$TURN_SECRET
DEMO_SEED_ALLOWED=false
# --- À compléter (ou via l'administration > Intégrations, stockage chiffré) ---
$EMAIL_BLOCK
EMAIL_FROM=$EMAIL_FROM
PAYMENT_PROVIDERS=$PAYMENTS
MTN_MOMO_BASE_URL=https://proxy.momoapi.mtn.com
MTN_MOMO_TARGET_ENVIRONMENT=mtncameroon
ORANGE_OM_COUNTRY=cm
# Clés MTN MoMo / Orange Money : à saisir dans l'administration (coffre chiffré) ou ci-dessous.
WHATSAPP_PROVIDER=console
SMS_PROVIDER=console
AI_PROVIDER=none
# CLAMAV_HOST=clamav   (profil « antivirus »)
EOF

cat >"$ENV_DIR/web.env" <<EOF
API_INTERNAL_URL=http://api:8000
NEXT_PUBLIC_SITE_URL=https://$DOMAIN
REVALIDATE_SECRET=$REVALIDATE_SECRET
EOF

cat >"$ENV_DIR/turnserver.conf" <<EOF
# coturn — relais TURN des appels audio / vidéo (identifiants éphémères HMAC signés par l'API).
listening-port=3478
tls-listening-port=5349
min-port=49160
max-port=49260
external-ip=$EXTERNAL_IP
realm=$DOMAIN
server-name=$DOMAIN
use-auth-secret
static-auth-secret=$TURN_SECRET
cert=/etc/letsencrypt/live/$DOMAIN/fullchain.pem
pkey=/etc/letsencrypt/live/$DOMAIN/privkey.pem
fingerprint
proc-user=nobody
proc-group=nogroup
no-cli
no-multicast-peers
no-tlsv1
no-tlsv1_1
stale-nonce=600
total-quota=300
user-quota=12
denied-peer-ip=0.0.0.0-0.255.255.255
denied-peer-ip=10.0.0.0-10.255.255.255
denied-peer-ip=100.64.0.0-100.127.255.255
denied-peer-ip=127.0.0.0-127.255.255.255
denied-peer-ip=169.254.0.0-169.254.255.255
denied-peer-ip=172.16.0.0-172.31.255.255
denied-peer-ip=192.168.0.0-192.168.255.255
denied-peer-ip=::1
denied-peer-ip=fc00::-fdff:ffff:ffff:ffff:ffff:ffff:ffff:ffff
log-file=stdout
simple-log
EOF

chmod 600 "$ENV_DIR"/*.env "$ENV_DIR/turnserver.conf"
echo "Fichiers générés dans $ENV_DIR (0600). Compléter les intégrations, puis : ./infra/scripts/deploy.sh"
