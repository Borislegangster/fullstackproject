#!/usr/bin/env bash
# Pilotage du test de production GLOBUS sur AWS, depuis le poste local (AWS CLI v2 configurée par l'utilisateur).
# Aucune clé ni aucun mot de passe ne transite par ce script : rôle IAM du serveur (SES, S3), secrets applicatifs
# générés sur le serveur (init-env.sh), premier administrateur invité par lien e-mail.
#
#   ./infra/aws/globus-aws.sh up <domaine|-> <e-mail-admin> [e-mail-expéditeur]
#                                 crée / met à jour la pile ; « - » = sans domaine : nom <ip>.sslip.io et
#                                 e-mails envoyés depuis l'expéditeur vérifié (AWS envoie les liens de vérification)
#   ./infra/aws/globus-aws.sh dns                                 nom public et enregistrements DNS éventuels
#   ./infra/aws/globus-aws.sh ses                                 état SES (DKIM, bac à sable, destinataire)
#   ./infra/aws/globus-aws.sh push                                envoie le code sur le serveur (archive S3 privée)
#   ./infra/aws/globus-aws.sh init <e-mail-acme>                  génère la configuration et les secrets SUR le serveur
#   ./infra/aws/globus-aws.sh deploy                              vérifie le DNS, construit, certificat TLS, démarre
#   ./infra/aws/globus-aws.sh admin <e-mail> <prénom> <nom>       invite le premier administrateur (lien d'activation)
#   ./infra/aws/globus-aws.sh content                             contenus éditoriaux de base, en brouillon (après l'activation)
#   ./infra/aws/globus-aws.sh status | logs [service]             état des conteneurs / journaux récents
#   ./infra/aws/globus-aws.sh shell                               session interactive (plugin Session Manager requis)
#   ./infra/aws/globus-aws.sh stop | start                        arrêt / redémarrage de la machine (IP conservée)
#   ./infra/aws/globus-aws.sh down                                supprime TOUT (machine, données, IP, bucket, SES)
#
# Variables : AWS_PROFILE (profil CLI), AWS_REGION (défaut eu-west-3), STACK (défaut globus-test),
#             INSTANCE_TYPE (défaut t3.large), ENABLE_CALLS (défaut true).
set -euo pipefail
export MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL="*" LC_ALL=C.UTF-8 PYTHONUTF8=1 PYTHONIOENCODING=utf-8

REGION="${AWS_REGION:-eu-west-3}"
STACK="${STACK:-globus-test}"
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
AWS=(aws --region "$REGION")
APP_DIR=/opt/globus/systemcomplet

die() {
  echo "✖ $*" >&2
  exit 1
}
q() { printf '%q' "$1"; }
winpath() { if command -v cygpath >/dev/null 2>&1; then cygpath -w "$1"; else printf '%s' "$1"; fi; }
output() {
  "${AWS[@]}" cloudformation describe-stacks --stack-name "$STACK" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text
}

# Attend que la machine soit joignable par SSM (agent enregistré), puis la fin de l'amorçage (cloud-init).
wait_online() {
  local iid="$1" state=""
  printf '▶ Attente de la machine %s (SSM)' "$iid"
  for _ in $(seq 1 60); do
    state="$("${AWS[@]}" ssm describe-instance-information \
      --filters "Key=InstanceIds,Values=$iid" --query "InstanceInformationList[0].PingStatus" --output text 2>/dev/null || true)"
    [[ "$state" == "Online" ]] && break
    printf '.'
    sleep 10
  done
  echo
  [[ "$state" == "Online" ]] || die "machine injoignable par SSM (vérifier l'état de l'instance dans la console EC2)"
}

# Exécute sur le serveur (root) le script bash lu sur l'entrée standard, attend la fin, affiche la sortie.
remote() {
  local comment="$1" timeout="${2:-3600}" script b64 params id iid status=""
  script="$(cat)"
  iid="$(output InstanceId)"
  [[ -n "$iid" && "$iid" != "None" ]] || die "pile $STACK introuvable : lancer d'abord « up »"
  b64="$(printf '%s\n' "$script" | base64 | tr -d '\n')"
  params="$(mktemp)"
  printf '{"commands":["echo %s | base64 -d > /root/globus-step.sh && bash /root/globus-step.sh"],"executionTimeout":["%s"]}' \
    "$b64" "$timeout" >"$params"
  id="$("${AWS[@]}" ssm send-command --instance-ids "$iid" --document-name AWS-RunShellScript \
    --comment "globus $comment" --timeout-seconds 600 --parameters "file://$(winpath "$params")" \
    --query Command.CommandId --output text)"
  rm -f "$params"
  printf '▶ %s' "$comment"
  while :; do
    sleep 10
    status="$("${AWS[@]}" ssm get-command-invocation --command-id "$id" --instance-id "$iid" \
      --query Status --output text 2>/dev/null || echo Pending)"
    case "$status" in
      Pending | InProgress | Delayed) printf '.' ;;
      *) break ;;
    esac
  done
  echo
  "${AWS[@]}" ssm get-command-invocation --command-id "$id" --instance-id "$iid" \
    --query StandardOutputContent --output text | tail -n 80
  if [[ "$status" != "Success" ]]; then
    "${AWS[@]}" ssm get-command-invocation --command-id "$id" --instance-id "$iid" \
      --query StandardErrorContent --output text | tail -n 40 >&2
    die "$comment : $status"
  fi
}

cmd_up() {
  local domain="${1:-}" recipient="${2:-}" sender="${3:-}"
  [[ -n "$domain" && -n "$recipient" ]] || die "usage : up <domaine|-> <e-mail-admin> [e-mail-expéditeur]"
  [[ "$domain" == "-" ]] && domain=""
  [[ -n "$domain" || -n "$sender" ]] || die "sans domaine, un e-mail expéditeur vérifié est requis"
  [[ "$sender" != "$recipient" ]] || die "l'expéditeur doit différer de l'e-mail administrateur"
  "${AWS[@]}" sts get-caller-identity --query Arn --output text >/dev/null || die "AWS CLI non configurée (aws configure sso)"
  echo "▶ Pile CloudFormation $STACK ($REGION) pour $domain"
  "${AWS[@]}" cloudformation deploy --stack-name "$STACK" --template-file "$(winpath "$HERE/globus-test.yaml")" \
    --capabilities CAPABILITY_IAM --no-fail-on-empty-changeset \
    --parameter-overrides "DomainName=$domain" "TestRecipientEmail=$recipient" "SenderEmail=$sender" \
    "InstanceType=${INSTANCE_TYPE:-t3.large}" "EnableCalls=${ENABLE_CALLS:-true}" \
    --tags Project=globus-engineering Environment=test
  wait_online "$(output InstanceId)"
  remote "Amorcage du serveur" 1200 <<'REMOTE'
set -euo pipefail
cloud-init status --wait >/dev/null || true
test -f /opt/globus/.bootstrap-done || { echo "Amorçage incomplet : voir /var/log/cloud-init-output.log"; exit 1; }
docker --version
docker compose version
free -h | head -2
REMOTE
  cmd_dns
}

cmd_dns() {
  local key value
  echo "Adresse publique : https://$(output DomainName)  (expéditeur des e-mails : $(output EmailFrom))"
  value="$(output DnsRecordA)"
  if [[ -z "$value" || "$value" == "None" ]]; then
    echo "Aucun enregistrement DNS à créer (nom sslip.io dérivé de l'IP fixe)."
    return
  fi
  echo "Enregistrements DNS à créer chez votre fournisseur de domaine :"
  for key in DnsRecordA DkimRecord1 DkimRecord2 DkimRecord3; do echo "  $(output "$key")"; done
}

cmd_ses() {
  local domain
  domain="$(output DomainName)"
  if [[ "$domain" != *.sslip.io ]]; then
    echo "DKIM $domain : $("${AWS[@]}" sesv2 get-email-identity --email-identity "$domain" \
      --query DkimAttributes.Status --output text)"
  fi
  echo "Accès production SES : $("${AWS[@]}" sesv2 get-account --query ProductionAccessEnabled --output text)" \
    "(False = bac à sable : destinataires vérifiés uniquement)"
  "${AWS[@]}" sesv2 list-email-identities --query "EmailIdentities[?IdentityType=='EMAIL_ADDRESS'].[IdentityName,VerificationStatus]" \
    --output text | sed 's/^/Adresse e-mail : /'
}

cmd_push() {
  local bucket key dir archive
  bucket="$(output TransferBucket)"
  key="releases/globus-$(date -u +%Y%m%d-%H%M%S).tar.gz"
  dir="$(mktemp -d)"
  archive="$dir/release.tar.gz"
  echo "▶ Archive du code (ni dépendances, ni secrets, ni données locales)"
  tar -C "$ROOT" -czf "$archive" \
    --exclude=node_modules --exclude=.venv --exclude=.next --exclude=.next-dev --exclude=__pycache__ \
    --exclude=.ruff_cache --exclude=.pytest_cache --exclude=storage-dev --exclude='*.log' \
    --exclude='.env' --exclude='.env.*' --exclude='*.pem' --exclude='*.key' --exclude=.openapi.json \
    --exclude=tsconfig.tsbuildinfo --exclude=apps/web/public/wasm --exclude=backend/tests --exclude=infra/env \
    .dockerignore README.md backend apps infra
  echo "  $(du -h "$archive" | cut -f1) → s3://$bucket/$key"
  "${AWS[@]}" s3 cp "$(winpath "$archive")" "s3://$bucket/$key" --only-show-errors
  rm -rf "$dir"
  remote "Mise a jour du code" 900 <<REMOTE
set -euo pipefail
export AWS_DEFAULT_REGION=$(q "$REGION")
rm -rf /opt/globus/incoming && mkdir -p /opt/globus/incoming $APP_DIR/infra/env
aws s3 cp $(q "s3://$bucket/$key") /opt/globus/release.tar.gz --only-show-errors
tar -xzf /opt/globus/release.tar.gz -C /opt/globus/incoming
# Les secrets du serveur (infra/env) et les volumes Docker ne sont jamais touchés.
rsync -a --delete --exclude /infra/env/ /opt/globus/incoming/ $APP_DIR/
chmod +x $APP_DIR/infra/scripts/*.sh
rm -rf /opt/globus/incoming /opt/globus/release.tar.gz
echo "Code à jour dans $APP_DIR (\$(find $APP_DIR -type f | wc -l) fichiers)."
REMOTE
}

cmd_init() {
  local acme="${1:-}" domain ip private sender
  [[ -n "$acme" ]] || die "usage : init <e-mail-acme> (compte Let's Encrypt)"
  domain="$(output DomainName)"
  sender="GLOBUS ENGINEERING <$(output EmailFrom)>"
  ip="$(output PublicIp)"
  private="$(output PrivateIp)"
  remote "Configuration du serveur" 300 <<REMOTE
set -euo pipefail
cd $APP_DIR
if [ -f infra/env/api.env ]; then echo "Configuration déjà générée (secrets conservés)."; exit 0; fi
./infra/scripts/init-env.sh --domain $(q "$domain") --no-www --public-ip $(q "$ip") --private-ip $(q "$private") \
  --ses-region $(q "$REGION") --email-from $(q "$sender") --no-payments --acme-email $(q "$acme")
REMOTE
}

cmd_deploy() {
  local domain ip
  domain="$(output DomainName)"
  ip="$(output PublicIp)"
  remote "Construction et demarrage (15 a 25 min)" 3600 <<REMOTE
set -euo pipefail
resolved="\$(dig +short A $(q "$domain") @1.1.1.1 | tail -n 1)"
if [ "\$resolved" != $(q "$ip") ]; then
  echo "DNS : $(q "$domain") -> '\$resolved' (attendu $(q "$ip")). Créez l'enregistrement A puis relancez."
  exit 1
fi
cd $APP_DIR
test -f infra/env/api.env || { echo "Lancer d'abord : globus-aws.sh init <e-mail-acme>"; exit 1; }
WITH_CALLS=\${WITH_CALLS:-1} ./infra/scripts/deploy.sh 2>&1 | tail -n 60
REMOTE
}

cmd_admin() {
  [[ $# -eq 3 ]] || die "usage : admin <e-mail> <prénom> <nom>"
  remote "Invitation du premier administrateur" 300 <<REMOTE
set -euo pipefail
cd $APP_DIR/infra
docker compose --env-file env/compose.env -f docker-compose.yml exec -T api \
  python scripts/create_admin.py --email $(q "$1") --first $(q "$2") --last $(q "$3") --invite
REMOTE
}

cmd_content() {
  remote "Contenus editoriaux de base (brouillons)" 600 <<REMOTE
set -euo pipefail
cd $APP_DIR/infra
docker compose --env-file env/compose.env -f docker-compose.yml exec -T api python scripts/seed_content.py
REMOTE
}

cmd_status() {
  local domain
  domain="$(output DomainName)"
  remote "Etat des services" 120 <<REMOTE
set -euo pipefail
cd $APP_DIR/infra
docker compose --env-file env/compose.env -f docker-compose.yml ps --format 'table {{.Service}}\t{{.Status}}'
echo
curl -fsS --max-time 10 --resolve $(q "$domain"):443:127.0.0.1 https://$(q "$domain")/health/ready && echo
df -h / | tail -1
free -h | head -2
REMOTE
}

cmd_logs() {
  local service="${1:-}"
  remote "Journaux ${service:-tous services}" 120 <<REMOTE
set -euo pipefail
cd $APP_DIR/infra
docker compose --env-file env/compose.env -f docker-compose.yml logs --no-color --tail 80 ${service:+$(q "$service")}
REMOTE
}

cmd_shell() {
  command -v session-manager-plugin >/dev/null 2>&1 || die "installer le plugin Session Manager (winget install -e --id Amazon.SessionManagerPlugin)"
  "${AWS[@]}" ssm start-session --target "$(output InstanceId)"
}

cmd_stop() { "${AWS[@]}" ec2 stop-instances --instance-ids "$(output InstanceId)" --query "StoppingInstances[0].CurrentState.Name" --output text; }
cmd_start() {
  "${AWS[@]}" ec2 start-instances --instance-ids "$(output InstanceId)" --query "StartingInstances[0].CurrentState.Name" --output text
  wait_online "$(output InstanceId)"
}

cmd_down() {
  local answer="${CONFIRM:-}" bucket
  if [[ -z "$answer" ]]; then
    read -r -p "Suppression DÉFINITIVE de la pile $STACK (machine, base, fichiers, IP). Tapez « $STACK » : " answer
  fi
  [[ "$answer" == "$STACK" ]] || die "abandon"
  bucket="$(output TransferBucket)"
  [[ -n "$bucket" && "$bucket" != "None" ]] && "${AWS[@]}" s3 rm "s3://$bucket" --recursive --only-show-errors
  "${AWS[@]}" cloudformation delete-stack --stack-name "$STACK"
  echo "▶ Suppression en cours…"
  "${AWS[@]}" cloudformation wait stack-delete-complete --stack-name "$STACK"
  echo "✔ Pile $STACK supprimée : plus aucune ressource facturée."
}

command="${1:-}"
shift || true
case "$command" in
  up) cmd_up "$@" ;;
  dns) cmd_dns ;;
  ses) cmd_ses ;;
  push) cmd_push ;;
  init) cmd_init "$@" ;;
  deploy) cmd_deploy ;;
  admin) cmd_admin "$@" ;;
  content) cmd_content ;;
  status) cmd_status ;;
  logs) cmd_logs "$@" ;;
  shell) cmd_shell ;;
  stop) cmd_stop ;;
  start) cmd_start ;;
  down) cmd_down ;;
  *) awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0" ;;
esac
