"""Icône unique de la plateforme (favicon, PWA, iOS, assistant, pack applications), texte enrichi avec code HTML et
images de la médiathèque, réglages sans JSON ni directive technique, données structurées sans code."""

from __future__ import annotations

import io
import random
import uuid
import zipfile
from typing import Any

from PIL import Image

from tests.conftest import login, make_user

API = "/api/v1"


def _admin(client: Any, db: Any) -> dict[str, str]:
    admin = make_user(db, email=f"admin-brand-{uuid.uuid4().hex[:6]}@example.com", roles=["ADMIN"])
    return login(client, admin.email)


def _image(size: tuple[int, int] = (900, 500), *, transparent: bool = True, fmt: str = "PNG") -> bytes:
    """Pastille de couleur aléatoire (fichier unique : la médiathèque refuse les doublons) au centre d'un fond large."""
    color = (random.randint(20, 200), random.randint(20, 200), random.randint(20, 200), 255)
    img = Image.new("RGBA", size, (0, 0, 0, 0) if transparent else (255, 255, 255, 255))
    w, h = size
    side = min(w, h) // 2
    img.paste(Image.new("RGBA", (side, side), color), ((w - side) // 2, (h - side) // 2))
    buf = io.BytesIO()
    (img if fmt == "PNG" else img.convert("RGB")).save(buf, format=fmt)
    return buf.getvalue()


def _upload(client: Any, headers: dict[str, str], data: bytes, name: str = "icone.png", mime: str = "image/png") -> str:
    res = client.post(f"{API}/cms/media", headers=headers, files={"file": (name, data, mime)}, data={"title": name})
    assert res.status_code == 201, res.text
    return res.json()["id"]


def _png(content: bytes) -> Image.Image:
    return Image.open(io.BytesIO(content))


def test_platform_icon_default_then_custom_everywhere(client: Any, db: Any) -> None:
    ah = _admin(client, db)
    client.put(f"{API}/cms/site-settings", headers=ah, json={"favicon_media_id": None})

    default = client.get(f"{API}/public/brand").json()
    assert default["origin"] == "default" and default["version"].startswith("d")
    assert {i["purpose"] for i in default["icons"]} == {"any", "maskable"}
    res = client.get(f"{API}/public/brand/icon-32.png")
    assert res.status_code == 200 and res.headers["content-type"] == "image/png"
    assert _png(res.content).size == (32, 32)
    assert client.get(f"{API}/public/brand/icon-99.png").status_code == 404

    media_id = _upload(client, ah, _image())
    saved = client.put(f"{API}/cms/site-settings", headers=ah, json={"favicon_media_id": media_id})
    assert saved.status_code == 200, saved.text

    brand = client.get(f"{API}/public/brand").json()
    assert brand["origin"] == "custom" and brand["version"] != default["version"]
    assert brand["favicon"].endswith(f"favicon.ico?v={brand['version']}")
    # Le site public et donc l'assistant reçoivent la même icône versionnée.
    assert client.get(f"{API}/public/site").json()["brand"]["version"] == brand["version"]

    versioned = client.get(f"{API}/public/brand/icon-512.png", params={"v": brand["version"]})
    assert "immutable" in versioned.headers["cache-control"]
    icon = _png(versioned.content).convert("RGBA")
    assert icon.size == (512, 512)
    # Recadrée sur le contenu (marges transparentes retirées) puis centrée : la pastille occupe presque tout le carré.
    assert icon.getpixel((40, 256))[3] == 255 and icon.getpixel((2, 2))[3] == 0
    apple = _png(client.get(f"{API}/public/brand/apple-touch-icon.png").content).convert("RGBA")
    assert apple.size == (180, 180) and apple.getpixel((1, 1)) == (255, 255, 255, 255)  # iOS : fond plein
    maskable = _png(client.get(f"{API}/public/brand/icon-maskable-512.png").content).convert("RGBA")
    assert maskable.getpixel((30, 256)) == (255, 255, 255, 255)  # zone de sécurité Android
    ico = client.get(f"{API}/public/brand/favicon.ico")
    assert ico.status_code == 200 and ico.content[:4] == b"\x00\x00\x01\x00"

    pack = client.get(f"{API}/cms/brand/icon-pack", headers=ah)
    assert pack.status_code == 200 and pack.headers["content-type"] == "application/zip"
    names = zipfile.ZipFile(io.BytesIO(pack.content)).namelist()
    assert {"favicon.ico", "icon-1024.png", "icon-maskable-512.png", "apple-touch-icon.png", "brand.json"} <= set(names)


def test_platform_icon_must_be_a_usable_image(client: Any, db: Any) -> None:
    ah = _admin(client, db)
    svg = _upload(
        client, ah, b'<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>', "i.svg", "image/svg+xml"
    )
    res = client.put(f"{API}/cms/site-settings", headers=ah, json={"favicon_media_id": svg})
    assert res.status_code == 400 and res.json()["error"]["code"] == "INVALID_PLATFORM_ICON"
    tiny = _upload(client, ah, _image((40, 40), transparent=False), "petite.png")
    res = client.put(f"{API}/cms/site-settings", headers=ah, json={"favicon_media_id": tiny})
    assert res.status_code == 400 and "trop petite" in res.json()["error"]["message"]


def test_settings_without_json_or_technical_directives(client: Any, db: Any) -> None:
    ah = _admin(client, db)
    res = client.put(f"{API}/cms/site-settings", headers=ah, json={"consent_texts": {"title": "Cookies", "x": "y"}})
    assert res.status_code == 400 and res.json()["error"]["code"] == "INVALID_CONSENT"
    res = client.put(f"{API}/cms/site-settings", headers=ah, json={"robots_extra": "Allow: /\nDisallow: /ok"})
    assert res.status_code == 400 and res.json()["error"]["code"] == "INVALID_ROBOTS"
    res = client.put(
        f"{API}/cms/site-settings",
        headers=ah,
        json={"consent_texts": {"title": " Vos cookies ", "banner": ""}, "robots_extra": "Disallow: /ancienne-offre\n"},
    )
    assert res.status_code == 200, res.text
    assert res.json()["consent_texts"] == {"title": "Vos cookies"}
    assert res.json()["robots_extra"] == "Disallow: /ancienne-offre"


def test_rich_text_accepts_html_code_and_library_images(client: Any, db: Any) -> None:
    ah = _admin(client, db)
    media_id = _upload(client, ah, _image(fmt="PNG"), "illustration.png")
    html = (
        f'<div class="cols" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;position:fixed">'
        f'<figure class="rt-figure rt-left"><img src="/api/v1/public/media/{media_id}/md" alt="Villa" onerror="x()">'
        f"<figcaption>Villa</figcaption></figure>"
        f'<iframe src="https://www.youtube-nocookie.com/embed/abc123" allowfullscreen></iframe>'
        f'<img src="https://ailleurs.example/x.png"><script>alert(1)</script><button>Ok</button></div>'
    )
    preview = client.post(f"{API}/cms/html/preview", headers=ah, json={"html": html})
    assert preview.status_code == 200, preview.text
    clean, warnings = preview.json()["html"], preview.json()["warnings"]
    assert 'style="display:grid;grid-template-columns:1fr 1fr;gap:16px"' in clean  # position retirée
    assert f'src="/api/v1/public/media/{media_id}/md"' in clean and "onerror" not in clean
    assert "youtube-nocookie.com/embed/abc123" in clean and 'loading="lazy"' in clean
    assert "ailleurs.example" not in clean and "<script" not in clean and "<button" not in clean
    assert any("Scripts" in w or "scripts" in w for w in warnings)
    assert any("médiathèque" in w for w in warnings)

    block = {"kind": "rich_text", "title": "Notre mission", "html": html}
    page = {
        "route_key": "mission",
        "path": "/mission",
        "title": "Mission",
        "sections": [{"key": "s", "blocks": [{"data": block}]}],
    }
    created = client.post(f"{API}/cms/pages", headers=ah, json=page)
    assert created.status_code == 201, created.text
    stored = created.json()["sections"][0]["blocks"][0]["data"]["html"]
    assert "<script" not in stored and f"/public/media/{media_id}/md" in stored

    # L'image insérée compte comme une utilisation : impossible de l'archiver tant qu'elle est affichée.
    archived = client.post(f"{API}/cms/media/{media_id}/archive", headers=ah)
    assert archived.status_code == 409 and archived.json()["error"]["code"] == "MEDIA_IN_USE"

    ghost = f'<p><img src="/api/v1/public/media/{uuid.uuid4()}/md" alt=""></p>'
    page2 = {**page, "route_key": "mission-2", "path": "/mission-2", "body": ghost, "sections": []}
    res = client.post(f"{API}/cms/pages", headers=ah, json=page2)
    assert res.status_code in (400, 404, 422) and res.json()["error"]["code"] == "MEDIA_NOT_FOUND"


def test_structured_data_without_code(client: Any, db: Any) -> None:
    ah = _admin(client, db)
    page = {"route_key": "offre-villa", "path": "/offre-villa", "title": "Offre villa", "sections": []}
    assert client.post(f"{API}/cms/pages", headers=ah, json=page).status_code == 201
    url = f"{API}/cms/schema-markups"
    base = {"schema_type": "Service", "target_type": "page", "target_key": "offre-villa"}
    assert client.post(url, headers=ah, json={**base, "target_type": "site"}).status_code == 400
    assert client.post(url, headers=ah, json={**base, "target_key": "inconnue"}).status_code == 400
    assert client.post(url, headers=ah, json={**base, "data": {"@type": "Thing"}}).status_code == 400
    ok = client.post(url, headers=ah, json={**base, "data": {"name": "Villa clé en main", "areaServed": "Douala"}})
    assert ok.status_code == 201, ok.text
