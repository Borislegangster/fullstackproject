"""Robot de recette des formulaires : pour chaque endpoint de création (POST) et de modification (PATCH / PUT) de l'API,
remplit TOUS les champs comme le ferait un utilisateur (valeurs plausibles, listes de choix, fiches liées réelles de la
base de démonstration), enregistre, relit la fiche et signale :
  - les erreurs serveur (500) ;
  - les refus (4xx) avec leur message ;
  - les valeurs envoyées mais non enregistrées (relues différentes ou absentes).

À lancer contre une API locale peuplée par la démonstration (jamais la production : le robot crée des fiches).

Usage (depuis backend/, API locale démarrée) :
    python scripts/recette_formulaires.py ../apps/web/.openapi.json ../apps/web/src/lib/refs.ts [filtre] [as=e-mail]
    GLOBUS_API=http://127.0.0.1:8010/api/v1 par défaut ; as=client@globus.demo pour l'espace client, etc.
"""

from __future__ import annotations

import json
import os
import pathlib
import random
import re
import string
import sys
import uuid
from datetime import UTC, date, datetime, timedelta
from typing import Any

import httpx

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from app.seeds.demo import DEMO_PASSWORD

BASE = os.environ.get("GLOBUS_API", "http://127.0.0.1:8010/api/v1")
if not re.match(r"https?://(127\.0\.0\.1|localhost)[:/]", BASE):
    sys.exit("Robot réservé à une API locale de démonstration.")
spec = json.loads(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8"))
refs_ts = pathlib.Path(sys.argv[2]).read_text(encoding="utf-8")
FILTER = sys.argv[3] if len(sys.argv) > 3 and not sys.argv[3].startswith("as=") else ""
AS = next((a[3:] for a in sys.argv[3:] if a.startswith("as=")), "admin@globus.demo")
SCHEMAS = spec["components"]["schemas"]
PATHS = spec["paths"]
RUN = "".join(random.choices(string.ascii_lowercase, k=5))

# --------------------------------------------------------------------------- référentiels (lib/refs.ts)
REF_SOURCES: dict[str, dict[str, Any]] = {}
for m in re.finditer(r"^  (\w+): \{ path: \"([^\"]+)\"(.*)$", refs_ts, re.M):
    name, path, rest = m.groups()
    query = {}
    q = re.search(r"query: \{([^}]*)\}", rest)
    if q:
        for k, v in re.findall(r"(\w+): \"?([\w-]+)\"?", q.group(1)):
            query[k] = v
    deps = re.findall(r"\"(\w+)\"", (re.search(r"dependsOn: \[([^\]]*)\]", rest) or [None, ""])[1] or "")
    REF_SOURCES[name] = {"path": path, "query": query, "deps": deps}
REF_SOURCES["users"] = {"path": "/users/directory", "query": {}, "deps": []}
FIELD_REFS = dict(
    re.findall(r"^  (\w+): \"(\w+)\",$", refs_ts.split("export const FIELD_REFS")[1].split("};")[0], re.M)
)
LIST_REFS = (
    dict(re.findall(r"^  (\w+): \"(\w+)\",$", refs_ts.split("export const LIST_REFS")[1].split("};")[0], re.M))
    if "LIST_REFS" in refs_ts
    else {}
)

client = httpx.Client(timeout=60, headers={"X-Client-App": "desktop"})
tok = client.post(f"{BASE}/auth/login", json={"email": AS, "password": DEMO_PASSWORD}).json()
H = {"Authorization": f"Bearer {tok['access_token']}"}

_cache: dict[str, list[dict[str, Any]]] = {}


def rows(path: str, query: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    key = path + json.dumps(query or {}, sort_keys=True)
    if key not in _cache:
        r = client.get(f"{BASE}{path}", headers=H, params={"page_size": 20, **(query or {})})
        data = r.json() if r.status_code == 200 else []
        _cache[key] = data if isinstance(data, list) else data.get("items", []) if isinstance(data, dict) else []
    return _cache[key]


projects = rows("/projects") or rows("/client/projects")
CTX: dict[str, Any] = {"project_id": projects[0]["id"] if projects else None}


def ref_value(field: str, values: dict[str, Any]) -> str | None:
    src = REF_SOURCES.get(FIELD_REFS.get(field, ""))
    if not src:
        return None
    path, query = src["path"], dict(src["query"])
    for dep in src["deps"]:
        v = values.get(dep) or CTX.get(dep)
        if not v:
            if "{" + dep + "}" in path:
                return None
            continue
        if "{" + dep + "}" in path:
            path = path.replace("{" + dep + "}", str(v))
        else:
            query[dep] = v
    found = rows(path, query)
    return str(found[0]["id"]) if found and "id" in found[0] else None


# --------------------------------------------------------------------------- génération des valeurs
def resolve(sch: dict[str, Any]) -> dict[str, Any]:
    if "$ref" in sch:
        return resolve(SCHEMAS[sch["$ref"].split("/")[-1]])
    for k in ("anyOf", "oneOf"):
        if k in sch:
            opts = [s for s in sch[k] if s.get("type") != "null"]
            if opts:
                merged = resolve(opts[0])
                return {**{x: y for x, y in sch.items() if x not in (k,)}, **merged}
    if "allOf" in sch and len(sch["allOf"]) == 1:
        return {**sch, **resolve(sch["allOf"][0])}
    return sch


def rand(n: int = 6) -> str:
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=n))


def gen(name: str, sch: dict[str, Any], values: dict[str, Any]) -> Any:
    s = resolve(sch)
    t = s.get("type")
    if "enum" in s:
        return s["enum"][0]
    if "const" in s:
        return s["const"]
    lname = name.lower()
    if lname in ("trade",) and t == "string":
        return "maconnerie"
    if lname in ("discipline",) and t == "string":
        return "architecture"
    if lname in ("trades",):
        return ["electricite"]
    if lname in ("disciplines",):
        return ["architecture"]
    if lname == "pct" or lname == "weight":
        return 100
    if t == "string" and s.get("format") == "time":
        return "08:00:00"
    if t == "string":
        fmt = s.get("format")
        pat = s.get("pattern")
        if pat:
            alt = re.fullmatch(r"\^\(([^()]+)\)\$", pat)
            if alt:
                return alt.group(1).split("|")[0]
        if fmt == "uuid":
            return ref_value(name, values)
        if fmt == "email" or lname.endswith("email"):
            return f"robot+{RUN}{rand(3)}@example.com"
        if fmt == "date":
            if any(k in lname for k in ("end", "until", "due", "expir", "deadline", "valid")):
                return (date.today() + timedelta(days=60)).isoformat()
            if "birth" in lname:
                return "1990-05-17"
            return (date.today() + timedelta(days=7)).isoformat()
        if fmt == "date-time":
            delta = (
                timedelta(days=30)
                if any(k in lname for k in ("end", "until", "deadline", "due"))
                else timedelta(days=2)
            )
            return (datetime.now(UTC) + delta).replace(microsecond=0).isoformat()
        if fmt == "binary":
            return None
        if fmt in ("uri", "url") or any(k in lname for k in ("url", "website", "link")):
            return "https://example.com/robot"
        if any(k in lname for k in ("phone", "whatsapp", "mobile_money", "sms_number", "msisdn")):
            return "690" + "".join(random.choices(string.digits, k=6))
        if "color" in lname or "colour" in lname:
            return "#1F4E79"
        if "currency" in lname:
            return "XAF"
        if "password" in lname or "secret" in lname or "token" in lname:
            return None
        if lname in ("slug", "key", "code", "sku") or lname.endswith(("_slug", "_key", "_code")):
            return f"robot-{RUN}-{rand(4)}"
        if "time" in lname and pat and ":" in pat:
            return "08:00"
        if pat:
            for cand in ("Robot2026", "ROBOT_2026", "robot_2026", "robot-2026", "R2026", "08:00", "2026-10", "robot"):
                if re.fullmatch(pat.strip("^$") if pat.startswith("^") else pat, cand):
                    return cand
            return None  # motif particulier : laissé vide (s'il est obligatoire, l'erreur le dira)
        mx = s.get("maxLength") or 40
        mn = s.get("minLength") or 0
        base = f"Robot {name.replace('_', ' ')} {RUN}"
        if mn > len(base):
            base = (base + " — texte de recette automatique.") * (mn // 20 + 1)
        return base[:mx]
    if t in ("integer", "number"):
        lo = s.get("minimum", s.get("exclusiveMinimum", 0))
        hi = s.get("maximum", s.get("exclusiveMaximum", 1_000_000))
        if "pct" in lname or "rate" in lname or "percent" in lname:
            v = min(max(10, lo), hi)
        elif lname[:3] == "lat":
            v = 4.05
        elif lname.startswith("lon") or lname == "lng":
            v = 9.70
        elif "year" in lname:
            v = 2026
        else:
            v = min(max(3, lo + 1 if "exclusiveMinimum" in s else lo), hi)
            if any(k in lname for k in ("amount", "price", "cost", "budget", "salary", "value")):
                v = min(max(250000, lo), hi)
        return int(v) if t == "integer" else v
    if t == "boolean":
        return True
    if t == "array":
        item = resolve(s.get("items", {}))
        if item.get("type") == "object" or "properties" in item:
            row = gen_object(item, values)
            return [row] if row is not None else []
        if item.get("format") == "uuid":
            src = REF_SOURCES.get(LIST_REFS.get(name, ""))
            if not src:
                return []
            v = ref_value_list(src)
            return [v] if v else []
        if item.get("type") == "string":
            if "enum" in item:
                return [item["enum"][0]]
            alt = re.fullmatch(r"\^\(([^()]+)\)\$", item.get("pattern") or "")
            return [alt.group(1).split("|")[0]] if alt else ["robot"]
        return []
    if t == "object" or "properties" in s:
        if "properties" in s:
            return gen_object(s, values)
        return None
    return None


def ref_value_list(src: dict[str, Any]) -> str | None:
    path, query = src["path"], dict(src["query"])
    for dep in src["deps"]:
        v = CTX.get(dep)
        if v:
            if "{" + dep + "}" in path:
                path = path.replace("{" + dep + "}", str(v))
            else:
                query[dep] = v
    found = rows(path, query)
    return str(found[0]["id"]) if found and "id" in found[0] else None


def gen_object(sch: dict[str, Any], parent: dict[str, Any]) -> dict[str, Any] | None:
    s = resolve(sch)
    out: dict[str, Any] = {}
    for name, prop in (s.get("properties") or {}).items():
        v = gen(name, prop, {**parent, **out})
        if v is not None:
            out[name] = v
    return out


def body_schema(op: dict[str, Any]) -> tuple[str | None, dict[str, Any] | None]:
    content = (op.get("requestBody") or {}).get("content") or {}
    if "application/json" in content:
        return "json", resolve(content["application/json"]["schema"])
    if "multipart/form-data" in content:
        return "multipart", resolve(content["multipart/form-data"]["schema"])
    return None, None


# --------------------------------------------------------------------------- comparaison
def same(sent: Any, got: Any) -> bool:
    if isinstance(sent, bool) or isinstance(got, bool):
        return bool(sent) == bool(got)
    if isinstance(sent, (int, float)):
        try:
            return abs(float(got) - float(sent)) < 0.01
        except (TypeError, ValueError):
            return False
    if isinstance(sent, str):
        if got is None:
            return False
        g = str(got)
        if re.fullmatch(r"\d{4}-\d\d-\d\dT.*", sent):
            return g[:16].replace(" ", "T") == sent[:16] or g[:10] == sent[:10]
        if "@" in sent:
            return g.lower() == sent.lower()
        if re.fullmatch(r"690\d{6}", sent):
            return g.endswith(sent)
        return g.strip() == sent.strip() or g.lower() == sent.lower()
    if isinstance(sent, list):
        if not isinstance(got, list):
            return False
        if all(not isinstance(x, dict) for x in sent):
            return {str(x) for x in sent} <= {str(x.get("id") if isinstance(x, dict) else x) for x in got}
        return len(got) >= len(sent)
    if isinstance(sent, dict):
        return isinstance(got, dict)
    return True


SKIP_PREFIXES = (
    "/api/v1/auth",
    "/api/v1/admin/reset",
    "/api/v1/admin/break-glass",
    "/api/v1/admin/backups",
    "/api/v1/webhooks",
    "/api/v1/extranet",
    "/api/v1/client/",
    "/api/v1/sync",
    "/api/v1/calls",
    "/api/v1/me",
    "/api/v1/account",
    "/api/v1/payments/callback",
)
SKIP_WORDS = (
    "purge",
    "restore",
    "hard-delete",
    "secret",
    "reset-mfa",
    "impersonat",
    "rotate",
    "test-send",
    "send-test",
)


def item_path(collection: str) -> str | None:
    for p in PATHS:
        if re.fullmatch(re.escape(collection) + r"/\{[a-z_]+\}", p) and "get" in PATHS[p]:
            return p
    return None


report: dict[str, list[str]] = {"500": [], "refus": [], "perdu": [], "absent": [], "ok": [], "ignoré": []}
created_ids: dict[str, str] = {}

for path, ops in PATHS.items():
    if FILTER and FILTER not in path:
        continue
    own = ("/api/v1/client/", "/api/v1/extranet") if AS != "admin@globus.demo" else ()
    if (path.startswith(SKIP_PREFIXES) and not path.startswith(own)) or any(w in path for w in SKIP_WORDS):
        continue
    if own and not path.startswith(own):
        continue
    for method in ("post", "put", "patch"):
        if method not in ops:
            continue
        kind, sch = body_schema(ops[method])
        if not sch or kind != "json":
            continue
        params = re.findall(r"\{(\w+)\}", path)
        # Création : collection (paramètre projet admis) ; modification : élément d'une collection créée juste avant.
        url = path.replace("/api/v1", "")
        if method == "post":
            if any(p != "project_id" for p in params):
                continue
            url = url.replace("{project_id}", str(CTX["project_id"]))
        else:
            if len(params) != 1:
                continue
            collection = path[: path.rindex("/{")]
            target = created_ids.get(collection)
            if not target:
                continue
            url = url.replace("{" + params[0] + "}", target)
        body = gen_object(sch, CTX) or {}
        label = f"{method.upper()} {path.replace('/api/v1', '')}"
        missing_required = [r for r in sch.get("required", []) if r not in body]
        if missing_required:
            report["ignoré"].append(
                f"{label} : champ obligatoire sans valeur générable ({', '.join(missing_required)})"
            )
            continue
        print("→", label, flush=True, file=sys.stderr)
        try:
            r = client.request(
                method.upper(), f"{BASE}{url}", headers={**H, "Idempotency-Key": str(uuid.uuid4())}, json=body
            )
        except httpx.HTTPError as exc:
            report["500"].append(f"{label} → connexion coupée ({exc.__class__.__name__})")
            continue
        if r.status_code >= 500:
            report["500"].append(f"{label} → {r.status_code} {r.text[:200]}")
            continue
        if r.status_code >= 400:
            try:
                err = r.json().get("error", {})
                msg = err.get("message", "")
                det = err.get("details") or err.get("fields") or ""
            except ValueError:
                msg, det = r.text[:150], ""
            report["refus"].append(
                f"{label} → {r.status_code} {msg} {json.dumps(det, ensure_ascii=False)[:250] if det else ''}"
            )
            continue
        try:
            out = r.json()
        except ValueError:
            out = {}
        if not isinstance(out, dict):
            report["ok"].append(label)
            continue
        oid = out.get("id")
        if method == "post" and oid:
            created_ids[path] = str(oid)
        fetched = out
        ip = item_path(path) if method == "post" else path
        if oid and ip and "get" in PATHS.get(ip, {}):
            last = re.findall(r"{(\w+)}", ip)[-1]
            item_url = ip.replace("/api/v1", "").replace("{" + last + "}", str(oid))
            g = client.get(
                f"{BASE}{item_url}".replace("{project_id}", str(CTX["project_id"])),
                headers=H,
            )
            if g.status_code == 200 and isinstance(g.json(), dict):
                fetched = {**out, **g.json()}
        lost, absent = [], []
        for k, v in body.items():
            if k in ("password", "confirmation") or v in (None, "", []):
                continue
            if k not in fetched:
                # Clé renommée (ex. bank_account → bank_account_masked) ou champ d'écriture seule.
                if not any(key.startswith(k) for key in fetched):
                    absent.append(k)
                continue
            if not same(v, fetched[k]):
                lost.append(
                    f"{k}={json.dumps(v, ensure_ascii=False)[:40]}→{json.dumps(fetched[k], ensure_ascii=False)[:40]}"
                )
        if lost:
            report["perdu"].append(f"{label} : {'; '.join(lost)}")
        if absent:
            report["absent"].append(f"{label} : {', '.join(absent)}")
        if not lost:
            report["ok"].append(label)

for k in ("500", "perdu", "absent", "refus", "ignoré"):
    print(f"\n===== {k.upper()} ({len(report[k])})")
    for line in report[k]:
        print("  " + line)
print(f"\n===== OK : {len(report['ok'])} formulaires enregistrés et relus conformes")
