"""Signature des APK Android avec la clé permanente de GLOBUS ENGINEERING (CI « GLOBUS V4 », job mobile).

Les quatre secrets du dépôt (docs/SIGNATURE_ANDROID.md) arrivent en variables d'environnement :
ANDROID_KEYSTORE_BASE64, ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS, ANDROID_KEY_PASSWORD.

- Aucun secret : avertissement ; les APK restent signés avec la clé de débogage jetable du runner (ancien comportement).
- Secrets incomplets ou invalides : échec explicite (jamais d'APK signé par erreur avec une clé jetable).
- Secrets valides : la clé est décodée hors du dépôt ($RUNNER_TEMP), contrôlée avec keytool (mot de passe, alias), puis
  chaque application reçoit son android/key.properties, lu par android/app/build.gradle.kts.

Aucune valeur n'est affichée ; seule l'empreinte SHA-256 du certificat (publique : elle figure dans chaque APK) l'est,
pour vérification. `--clean` (fin de job) supprime la clé décodée et les key.properties écrits par ce script.

Usage (depuis systemcomplet/) : python3 packages/globus_core/tool/android_signing.py [--clean]
"""

from __future__ import annotations

import base64
import binascii
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
APPS = ("mobile-client", "mobile-field", "mobile-direction")
SECRETS = ("ANDROID_KEYSTORE_BASE64", "ANDROID_KEYSTORE_PASSWORD", "ANDROID_KEY_ALIAS", "ANDROID_KEY_PASSWORD")
DOC = "docs/SIGNATURE_ANDROID.md"
# Première ligne des key.properties écrits ici : --clean ne supprime jamais un fichier local d'un développeur.
MARK = "# Ecrit par packages/globus_core/tool/android_signing.py (CI) : fichier temporaire, supprime en fin de job\n"


def keystore_path() -> Path:
    return Path(os.environ.get("RUNNER_TEMP") or tempfile.gettempdir()) / "globus-release.jks"


def properties_files() -> list[Path]:
    return [ROOT / "apps" / app / "android" / "key.properties" for app in APPS]


def escape(value: str) -> str:
    """Valeur au format .properties (lu en ISO-8859-1 par java.util.Properties) : barre oblique inverse, espace initial,
    caractères de contrôle et hors ASCII échappés (\\uXXXX, paires de substitution UTF-16 au-delà du plan de base)."""
    out: list[str] = []
    for i, ch in enumerate(value):
        if ch == "\\":
            out.append("\\\\")
        elif ch == " " and i == 0:
            out.append("\\ ")
        elif " " <= ch <= "~":
            out.append(ch)
        else:
            data = ch.encode("utf-16-be")
            out.extend(f"\\u{data[j]:02x}{data[j + 1]:02x}" for j in range(0, len(data), 2))
    return "".join(out)


def annotate(level: str, message: str) -> None:
    """Annotation GitHub Actions (visible sur la page de l'exécution) ; texte simple en dehors de la CI."""
    print(f"::{level} title=Signature Android::{message}", flush=True)


def summary(text: str) -> None:
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    if path:
        with open(path, "a", encoding="utf-8") as fh:
            fh.write(text + "\n")


def ours(path: Path) -> bool:
    return path.is_file() and path.read_text(encoding="latin-1").startswith(MARK)


def clean() -> int:
    keystore_path().unlink(missing_ok=True)
    for target in properties_files():
        if ours(target):
            target.unlink()
    return 0


def write_private(path: Path, data: bytes) -> None:
    """Fichier lisible par le seul utilisateur du runner (0600), créé ou remplacé."""
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "wb") as fh:
        fh.write(data)


def keytool_reason(output: str) -> str:
    if "password was incorrect" in output:
        return "mot de passe ANDROID_KEYSTORE_PASSWORD incorrect"
    if "does not exist" in output:
        return "alias ANDROID_KEY_ALIAS absent de la clé"
    return "fichier de clé illisible (ANDROID_KEYSTORE_BASE64 ne contient pas un fichier .jks complet)"


def main() -> int:
    if sys.argv[1:] == ["--clean"]:
        return clean()
    values = {name: os.environ.get(name, "") for name in SECRETS}
    missing = [name for name, value in values.items() if not value.strip()]
    if len(missing) == len(SECRETS):
        annotate(
            "warning",
            "secrets absents : APK signés avec une clé de débogage jetable. Un téléphone où l'application est déjà "
            f"installée ne pourra pas la mettre à jour (désinstallation nécessaire). Voir {DOC}.",
        )
        summary("**Signature Android** : ⚠️ clé de débogage jetable (secrets `ANDROID_*` absents), voir " + DOC + ".")
        return 0
    if missing:
        annotate("error", f"secrets incomplets, il manque : {', '.join(missing)}. Voir {DOC}, étape 3.")
        return 1

    try:
        raw = base64.b64decode(re.sub(r"\s+", "", values["ANDROID_KEYSTORE_BASE64"]), validate=True)
    except (binascii.Error, ValueError):
        annotate("error", f"ANDROID_KEYSTORE_BASE64 n'est pas un texte base64 valide (à recopier en entier, {DOC}).")
        return 1
    conflicts = [p.relative_to(ROOT).as_posix() for p in properties_files() if p.exists() and not ours(p)]
    if conflicts:
        annotate("error", f"fichier local déjà présent, non écrit par la CI : {', '.join(conflicts)}.")
        return 1

    store = keystore_path()
    store.parent.mkdir(parents=True, exist_ok=True)
    write_private(store, raw)
    java_home = os.environ.get("JAVA_HOME")
    keytool = str(Path(java_home, "bin", "keytool")) if java_home else "keytool"
    # Mot de passe transmis par variable d'environnement (-storepass:env), jamais sur la ligne de commande.
    listing = subprocess.run(  # noqa: S603
        [
            keytool,
            "-J-Duser.language=en",
            "-list",
            "-v",
            "-keystore",
            str(store),
            "-storepass:env",
            "ANDROID_KEYSTORE_PASSWORD",
            "-alias",
            values["ANDROID_KEY_ALIAS"],
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    if listing.returncode != 0:
        store.unlink(missing_ok=True)
        annotate("error", f"la clé ne s'ouvre pas : {keytool_reason(listing.stdout + listing.stderr)}. Voir {DOC}.")
        return 1
    # PKCS12 (format par défaut de keytool) = structure DER (0x30) ; JKS commence par 0xFEEDFEED.
    if raw[:1] == b"\x30" and values["ANDROID_KEY_PASSWORD"] != values["ANDROID_KEYSTORE_PASSWORD"]:
        annotate(
            "warning",
            "ANDROID_KEY_PASSWORD diffère de ANDROID_KEYSTORE_PASSWORD : pour une clé créée comme dans la "
            "documentation (format PKCS12), les deux mots de passe sont identiques, sinon la compilation échouera.",
        )
    found = re.search(r"SHA256:\s*([0-9A-F]{2}(?::[0-9A-F]{2}){31})", listing.stdout)
    fingerprint = found.group(1) if found else "inconnue"

    content = MARK + "".join(
        f"{key}={escape(value)}\n"
        for key, value in (
            ("storeFile", store.as_posix()),
            ("storePassword", values["ANDROID_KEYSTORE_PASSWORD"]),
            ("keyAlias", values["ANDROID_KEY_ALIAS"]),
            ("keyPassword", values["ANDROID_KEY_PASSWORD"]),
        )
    )
    for target in properties_files():
        write_private(target, content.encode("ascii"))
    annotate("notice", f"APK signés avec la clé permanente (empreinte SHA-256 du certificat : {fingerprint}).")
    summary(f"**Signature Android** : ✅ clé permanente, empreinte SHA-256 `{fingerprint}`.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
