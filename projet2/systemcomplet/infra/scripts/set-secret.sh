#!/usr/bin/env bash
# Enregistre un secret d'intégration dans le coffre chiffré de l'API (AES-256-GCM), saisi de façon masquée :
# jamais affiché, journalisé ni écrit dans un fichier. Même coffre que l'ERP (Paramètres › Intégrations › Clés et
# secrets des prestataires), utile avant la création du premier administrateur (ex. mot de passe SMTP).
#
#   ./infra/scripts/set-secret.sh SMTP_PASSWORD
set -euo pipefail
cd "$(dirname "$0")/.."

name="${1:-}"
[[ "$name" =~ ^[A-Z][A-Z0-9_]{2,63}$ ]] || { echo "Usage : $0 NOM_DU_SECRET (ex. SMTP_PASSWORD)" >&2; exit 2; }
[[ -t 0 ]] || { echo "Saisie interactive requise (terminal)" >&2; exit 2; }
read -rsp "Valeur de $name (masquée) : " value
echo
[[ -n "$value" ]] || { echo "Valeur vide : rien n'est modifié." >&2; exit 1; }

PY='
import sys
from app.core.database import SessionLocal
from app.core.secrets import MANAGED_SECRETS, set_secret
name = sys.argv[1]
if name not in MANAGED_SECRETS:
    sys.exit("Secret inconnu : " + name + " (attendus : " + ", ".join(sorted(MANAGED_SECRETS)) + ")")
value = sys.stdin.read()
with SessionLocal() as db:
    set_secret(db, name, value, user_id=None)
    db.commit()
print(MANAGED_SECRETS[name] + " : enregistré (chiffré). Pris en compte par l API et le worker sous une minute.")
'
printf '%s' "$value" | docker compose --env-file env/compose.env -f docker-compose.yml exec -T api python -c "$PY" "$name"
unset value
