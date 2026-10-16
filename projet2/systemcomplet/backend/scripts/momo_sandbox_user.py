"""Provisionne un API User MTN MoMo dans le BAC À SABLE MTN (momodeveloper.mtn.com) — tests locaux réels.

Usage : python scripts/momo_sandbox_user.py [--product collection|disbursement] [--callback-host exemple.cm]

Prérequis : compte développeur MTN MoMo et clé d'abonnement du produit (Profile → Subscriptions), enregistrée dans le
coffre de secrets (ERP → Paramètres → Intégrations) ou la variable MTN_MOMO_<PRODUIT>_SUBSCRIPTION_KEY.
Le script crée l'API User (UUID v4) et sa clé API, puis les enregistre chiffrés dans le coffre : aucune valeur
secrète n'est affichée. En production, ces identifiants sont fournis par le portail partenaire MTN (refusé ici).
"""

from __future__ import annotations

import argparse
import sys
import uuid
from pathlib import Path
from urllib.parse import urlparse

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--product", choices=["collection", "disbursement"], default="collection")
    parser.add_argument(
        "--callback-host", default=None, help="hôte autorisé pour les rappels (défaut : API_PUBLIC_URL)"
    )
    args = parser.parse_args()

    import httpx

    from app.core.config import settings
    from app.core.database import SessionLocal
    from app.core.secrets import get_secret, set_secret
    from app.modules.system.bootstrap import bootstrap

    if settings.is_production or settings.MTN_MOMO_TARGET_ENVIRONMENT != "sandbox":
        print("Refusé : réservé au bac à sable MTN (MTN_MOMO_TARGET_ENVIRONMENT=sandbox, hors production).")
        return 2
    prefix = f"MTN_MOMO_{args.product.upper()}"
    subscription = get_secret(f"{prefix}_SUBSCRIPTION_KEY")
    if not subscription:
        print(f"Clé d'abonnement absente : enregistrez {prefix}_SUBSCRIPTION_KEY puis relancez.")
        return 1
    base = settings.MTN_MOMO_BASE_URL.rstrip("/")
    host = args.callback_host or urlparse(settings.API_PUBLIC_URL).hostname or "localhost"
    user_id = str(uuid.uuid4())
    headers = {"Ocp-Apim-Subscription-Key": subscription, "X-Reference-Id": user_id}
    created = httpx.post(f"{base}/v1_0/apiuser", headers=headers, json={"providerCallbackHost": host}, timeout=30)
    if created.status_code != 201:
        print(f"Création de l'API User refusée par MTN ({created.status_code}).")
        return 1
    key = httpx.post(
        f"{base}/v1_0/apiuser/{user_id}/apikey", headers={"Ocp-Apim-Subscription-Key": subscription}, timeout=30
    )
    api_key = key.json().get("apiKey") if key.status_code == 201 else None
    if not api_key:
        print(f"Génération de la clé API refusée par MTN ({key.status_code}).")
        return 1
    with SessionLocal() as db:
        bootstrap(db)
        set_secret(db, f"{prefix}_USER_ID", user_id, user_id=None)
        set_secret(db, f"{prefix}_API_KEY", api_key, user_id=None)
        db.commit()
    print(f"API User {args.product} créé ({user_id}) et enregistré chiffré dans le coffre de secrets.")
    print("Activez le prestataire : PAYMENT_PROVIDERS=mtn_momo (devise de test imposée par MTN : EUR).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
