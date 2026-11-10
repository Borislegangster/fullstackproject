"""Géolocalisation des visiteurs et des prospects (continent, pays, région, ville) depuis l'adresse IP.

- Base DB-IP « IP to City Lite » (licence CC BY 4.0, mise à jour mensuelle, sans clé), au format MMDB, lue sur le
  serveur : l'adresse IP ne quitte pas la plateforme et n'est jamais conservée (seul le lieu déduit l'est).
- Précision limitée à la ville, conformément aux recommandations de la CNIL pour la mesure d'audience.
- Téléchargée et renouvelée par le planificateur (job « geoip_update ») ; chaque processus relit le fichier quand il
  change. Sans base (première installation, développement), la géolocalisation est simplement absente.
- Repli pour les contacts sans adresse IP (WhatsApp) : pays déduit de l'indicatif téléphonique international.

Attribution exigée par la licence (écran Analytics) : « IP Geolocation by DB-IP » avec un lien vers db-ip.com.
"""

from __future__ import annotations

import gzip
import ipaddress
import logging
import os
import shutil
import threading
import time
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from app.core.config import settings

log = logging.getLogger("globus.geoip")

DB_FILENAME = "dbip-city-lite.mmdb"
ATTRIBUTION = {"label": "IP Geolocation by DB-IP", "url": "https://db-ip.com"}
CAMEROON = "CM"

CONTINENTS = {
    "AF": "Afrique",
    "AN": "Antarctique",
    "AS": "Asie",
    "EU": "Europe",
    "NA": "Amérique du Nord",
    "OC": "Océanie",
    "SA": "Amérique du Sud",
}


@dataclass(frozen=True)
class GeoInfo:
    country: str | None = None  # code ISO 3166-1 alpha-2
    country_name: str | None = None  # nom français
    continent: str | None = None  # AF / EU / NA / SA / AS / OC / AN
    region: str | None = None
    city: str | None = None
    source: str = "ip"  # ip / phone

    @property
    def is_abroad(self) -> bool | None:
        """Hors Cameroun (diaspora ou international) ; None si le pays est inconnu."""
        return None if not self.country else self.country != CAMEROON

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


# ---------------------------------------------------------------------------- base MMDB
def db_dir() -> Path:
    return Path(settings.GEOIP_DIR or Path(settings.PRIVATE_STORAGE_DIR) / "geoip")


def db_path() -> Path:
    return db_dir() / DB_FILENAME


_lock = threading.Lock()
_state: dict[str, Any] = {"reader": None, "mtime": None, "checked": 0.0}
_RECHECK_SECONDS = 300


def _reader() -> Any:
    """Lecteur MMDB courant, rouvert si le fichier a été remplacé (vérifié au plus toutes les 5 minutes)."""
    now = time.monotonic()
    if _state["reader"] is not None and now - _state["checked"] < _RECHECK_SECONDS:
        return _state["reader"]
    with _lock:
        _state["checked"] = now
        path = db_path()
        try:
            mtime = path.stat().st_mtime
        except OSError:
            mtime = None
        if mtime is None:
            _close()
            return None
        if _state["reader"] is not None and _state["mtime"] == mtime:
            return _state["reader"]
        try:
            reader = _open(path)
        except Exception as exc:  # noqa: BLE001 — base illisible : pas de géolocalisation plutôt qu'une erreur
            log.warning("geoip_open_failed", extra={"error": str(exc)[:200]})
            _close()
            return None
        _close()
        _state.update(reader=reader, mtime=mtime)
        return reader


def _open(path: Path) -> Any:
    """Lecteur rapide (extension C, fichier projeté en mémoire), sinon lecteur Python pur."""
    import maxminddb

    try:
        return maxminddb.open_database(str(path))
    except maxminddb.InvalidDatabaseError:
        return maxminddb.open_database(str(path), maxminddb.MODE_MEMORY)


def _close() -> None:
    reader = _state.get("reader")
    _state.update(reader=None, mtime=None)
    if reader is not None:
        try:
            reader.close()
        except Exception:  # noqa: BLE001
            pass


def reset() -> None:
    """Oublie le lecteur courant (tests, remplacement de la base)."""
    with _lock:
        _close()
        _state["checked"] = 0.0


def _name(node: Any) -> str | None:
    names = (node or {}).get("names") or {}
    value = names.get("fr") or names.get("en")
    return str(value)[:100] if value else None


def lookup(ip: str | None) -> GeoInfo | None:
    """Lieu approximatif d'une adresse IP publique (None : adresse privée, inconnue ou base absente)."""
    if not ip:
        return None
    try:
        address = ipaddress.ip_address(ip.strip())
    except ValueError:
        return None
    if address.is_private or address.is_loopback or address.is_reserved or address.is_link_local:
        return None
    reader = _reader()
    if reader is None:
        return None
    try:
        record = reader.get(str(address))
    except Exception:  # noqa: BLE001 — IPv6 sur une base IPv4, enregistrement corrompu…
        return None
    if not isinstance(record, dict):
        return None
    country = (record.get("country") or {}).get("iso_code")
    continent = (record.get("continent") or {}).get("code") or CONTINENT_OF.get(country or "")
    subdivisions = record.get("subdivisions") or []
    return GeoInfo(
        country=str(country).upper()[:2] if country else None,
        country_name=_name(record.get("country")) or COUNTRY_NAMES.get(country or ""),
        continent=str(continent).upper()[:2] if continent else None,
        region=_name(subdivisions[0]) if subdivisions else None,
        city=_name(record.get("city")),
    )


def status() -> dict[str, Any]:
    """État de la base (écran Analytics) : disponible, édition, attribution."""
    path = db_path()
    reader = _reader()
    edition = None
    if reader is not None:
        try:
            edition = datetime.fromtimestamp(int(reader.metadata().build_epoch), tz=UTC).date().isoformat()
        except Exception:  # noqa: BLE001
            edition = None
    return {
        "available": reader is not None,
        "edition": edition,
        "auto_update": auto_update_enabled(),
        "path": str(path),
        "attribution": ATTRIBUTION,
    }


# ---------------------------------------------------------------------------- mise à jour mensuelle
def auto_update_enabled() -> bool:
    if settings.GEOIP_AUTO_UPDATE is not None:
        return bool(settings.GEOIP_AUTO_UPDATE)
    return settings.ENV == "production"


def _editions(now: datetime) -> list[tuple[int, int]]:
    """Édition du mois puis celle du mois précédent (la nouvelle paraît dans les premiers jours du mois)."""
    previous = (now.year - 1, 12) if now.month == 1 else (now.year, now.month - 1)
    return [(now.year, now.month), previous]


def update_database(db: Any = None, *, force: bool = False, now: datetime | None = None) -> dict[str, Any]:
    """Télécharge l'édition du mois si la base manque ou date d'un mois précédent (job « geoip_update »)."""
    if not force and not auto_update_enabled():
        return {"skipped": "désactivé (hors production)"}
    import httpx

    now = now or datetime.now(UTC)
    path = db_path()
    if not force and path.exists():
        built = datetime.fromtimestamp(path.stat().st_mtime, tz=UTC)
        if (built.year, built.month) == (now.year, now.month):
            return {"skipped": "à jour", "edition": built.date().isoformat()}
    db_dir().mkdir(parents=True, exist_ok=True)
    last_error = None
    for year, month in _editions(now):
        url = settings.GEOIP_DOWNLOAD_URL.format(year=year, month=month)
        tmp_gz = path.with_suffix(".download.gz")
        tmp = path.with_suffix(".download")
        try:
            with httpx.stream("GET", url, timeout=httpx.Timeout(30.0, read=300.0), follow_redirects=True) as resp:
                if resp.status_code == 404:
                    last_error = f"{url} : pas encore publiée"
                    continue
                resp.raise_for_status()
                with tmp_gz.open("wb") as out:
                    for chunk in resp.iter_bytes(1 << 20):
                        out.write(chunk)
            with gzip.open(tmp_gz, "rb") as src, tmp.open("wb") as out:
                shutil.copyfileobj(src, out, 1 << 20)
            _validate(tmp)
            os.replace(tmp, path)  # remplacement atomique : les lecteurs ouverts gardent l'ancienne version
            reset()
            log.info("geoip_updated", extra={"edition": f"{year}-{month:02d}"})
            return {"updated": f"{year}-{month:02d}", "size": path.stat().st_size}
        except Exception as exc:  # noqa: BLE001 — réseau, fichier invalide : on garde la base en place
            last_error = f"{type(exc).__name__}: {str(exc)[:200]}"
            log.warning("geoip_update_failed", extra={"url": url, "error": last_error})
        finally:
            for leftover in (tmp_gz, tmp):
                leftover.unlink(missing_ok=True)
    return {"error": last_error or "téléchargement impossible"}


def _validate(path: Path) -> None:
    """Le fichier doit s'ouvrir et situer une adresse connue avant de remplacer la base en service."""
    with _open(path) as reader:
        record = reader.get("8.8.8.8")
        if not isinstance(record, dict) or not (record.get("country") or {}).get("iso_code"):
            raise ValueError("base de géolocalisation invalide")


# ---------------------------------------------------------------------------- indicatif téléphonique
# Indicatif international → (pays ISO, nom français, continent). Pays de la diaspora camerounaise et d'Afrique.
_PHONE_CODES: dict[str, tuple[str, str, str]] = {
    "237": ("CM", "Cameroun", "AF"),
    "33": ("FR", "France", "EU"),
    "32": ("BE", "Belgique", "EU"),
    "41": ("CH", "Suisse", "EU"),
    "49": ("DE", "Allemagne", "EU"),
    "44": ("GB", "Royaume-Uni", "EU"),
    "39": ("IT", "Italie", "EU"),
    "34": ("ES", "Espagne", "EU"),
    "351": ("PT", "Portugal", "EU"),
    "31": ("NL", "Pays-Bas", "EU"),
    "352": ("LU", "Luxembourg", "EU"),
    "43": ("AT", "Autriche", "EU"),
    "46": ("SE", "Suède", "EU"),
    "47": ("NO", "Norvège", "EU"),
    "45": ("DK", "Danemark", "EU"),
    "353": ("IE", "Irlande", "EU"),
    "48": ("PL", "Pologne", "EU"),
    "7": ("RU", "Russie", "EU"),
    "90": ("TR", "Turquie", "AS"),
    "1": ("US", "États-Unis / Canada", "NA"),
    "55": ("BR", "Brésil", "SA"),
    "971": ("AE", "Émirats arabes unis", "AS"),
    "974": ("QA", "Qatar", "AS"),
    "966": ("SA", "Arabie saoudite", "AS"),
    "86": ("CN", "Chine", "AS"),
    "81": ("JP", "Japon", "AS"),
    "91": ("IN", "Inde", "AS"),
    "61": ("AU", "Australie", "OC"),
    "241": ("GA", "Gabon", "AF"),
    "242": ("CG", "Congo", "AF"),
    "243": ("CD", "RD Congo", "AF"),
    "240": ("GQ", "Guinée équatoriale", "AF"),
    "235": ("TD", "Tchad", "AF"),
    "236": ("CF", "Centrafrique", "AF"),
    "234": ("NG", "Nigeria", "AF"),
    "225": ("CI", "Côte d'Ivoire", "AF"),
    "221": ("SN", "Sénégal", "AF"),
    "233": ("GH", "Ghana", "AF"),
    "229": ("BJ", "Bénin", "AF"),
    "228": ("TG", "Togo", "AF"),
    "226": ("BF", "Burkina Faso", "AF"),
    "223": ("ML", "Mali", "AF"),
    "212": ("MA", "Maroc", "AF"),
    "216": ("TN", "Tunisie", "AF"),
    "213": ("DZ", "Algérie", "AF"),
    "27": ("ZA", "Afrique du Sud", "AF"),
    "254": ("KE", "Kenya", "AF"),
    "250": ("RW", "Rwanda", "AF"),
}
COUNTRY_NAMES = {iso: name for iso, name, _ in _PHONE_CODES.values()} | {"US": "États-Unis", "CA": "Canada"}
CONTINENT_OF = {iso: continent for iso, _, continent in _PHONE_CODES.values()} | {"CA": "NA"}


def from_phone(phone: str | None) -> GeoInfo | None:
    """Pays d'après l'indicatif d'un numéro au format international (+33…, 0033…)."""
    digits = (phone or "").strip().replace(" ", "")
    if digits.startswith("00"):
        digits = "+" + digits[2:]
    if not digits.startswith("+"):
        return None
    digits = "".join(c for c in digits[1:] if c.isdigit())
    for length in (3, 2, 1):
        match = _PHONE_CODES.get(digits[:length])
        if match:
            iso, name, continent = match
            return GeoInfo(country=iso, country_name=name, continent=continent, source="phone")
    return None


def locate(ip: str | None = None, phone: str | None = None) -> GeoInfo | None:
    """Adresse IP d'abord, indicatif téléphonique ensuite."""
    return lookup(ip) or from_phone(phone)


def is_cameroon_name(value: str | None) -> bool:
    return (value or "").strip().lower() in ("cameroun", "cameroon", "cm", "kamerun")
