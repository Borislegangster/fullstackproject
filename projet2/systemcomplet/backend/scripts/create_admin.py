"""Crée (ou réinitialise le rôle) du premier compte administrateur.

Usage : python scripts/create_admin.py --email admin@exemple.cm --first Prénom --last Nom [--invite]
Sans --invite : le mot de passe est demandé de façon masquée (ou lu dans la variable GLOBUS_ADMIN_PASSWORD) ; il
n'est jamais affiché ni journalisé. Avec --invite : aucun mot de passe ne circule, un lien d'activation à usage
unique est envoyé par e-mail (l'administrateur choisit son mot de passe puis sa double authentification).
"""

from __future__ import annotations

import argparse
import getpass
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--email", required=True)
    parser.add_argument("--first", required=True)
    parser.add_argument("--last", required=True)
    parser.add_argument("--invite", action="store_true", help="envoyer un lien d'activation au lieu d'un mot de passe")
    args = parser.parse_args()
    if args.invite:
        return _invite(args.email, args.first, args.last)
    from sqlalchemy import select

    from app.core.database import SessionLocal
    from app.core.security import hash_password, validate_password_strength
    from app.core.utils import utcnow
    from app.modules.identity.models import Organization, User
    from app.modules.identity.service import assign_roles
    from app.modules.system.bootstrap import bootstrap

    password = os.environ.get("GLOBUS_ADMIN_PASSWORD") or getpass.getpass("Mot de passe (min. 12 caractères) : ")
    issues = validate_password_strength(password, email=args.email.lower())
    if issues:
        print("Mot de passe refusé : " + " ; ".join(issues))
        return 1
    with SessionLocal() as db:
        bootstrap(db)
        org = db.execute(select(Organization).where(Organization.kind == "internal")).scalars().first()
        user = db.execute(select(User).where(User.email == args.email.lower())).scalar_one_or_none()
        if user is None:
            user = User(
                email=args.email.lower(),
                first_name=args.first,
                last_name=args.last,
                password_hash=hash_password(password),
                organization_id=org.id,
                email_verified_at=utcnow(),
            )
            db.add(user)
            db.flush()
        else:
            user.password_hash = hash_password(password)
        assign_roles(db, user, ["ADMIN"], granted_by=None)
        db.commit()
    print(f"Administrateur prêt : {args.email.lower()} — activez le MFA à la première connexion.")
    return 0


def _invite(email: str, first: str, last: str) -> int:
    from sqlalchemy import select

    from app.core.database import SessionLocal
    from app.modules.identity.models import Organization, User
    from app.modules.identity.service import invite_user
    from app.modules.system.bootstrap import bootstrap

    with SessionLocal() as db:
        bootstrap(db)
        if db.execute(select(User.id).where(User.email == email.lower())).first():
            print(f"Un compte existe déjà pour {email.lower()} : utilisez la réinitialisation du mot de passe.")
            return 1
        org = db.execute(select(Organization).where(Organization.kind == "internal")).scalars().first()
        invitation, _token = invite_user(
            db,
            inviter=None,
            email=email,
            first_name=first,
            last_name=last,
            role_codes=["ADMIN"],
            organization_id=org.id if org else None,
            project_ids=[],
            message=None,
            channels=("email",),
        )
        db.commit()
        expires = invitation.expires_at
    print(f"Invitation administrateur envoyée à {email.lower()} (lien valable jusqu'au {expires:%d/%m/%Y}).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
