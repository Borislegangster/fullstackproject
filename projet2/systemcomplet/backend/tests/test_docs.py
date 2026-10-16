"""Documentation intégrée : contenu valide et complet, filtrage strict selon espace, rôle et permissions."""

from __future__ import annotations

import re
from typing import Any

import pytest

from app.core.permissions import DEFAULT_ROLES, PERMISSION_CODES, ROLE_CODES
from app.modules.docs import engine
from tests.conftest import as_role

ROUTE_PREFIX = {"erp": "/erp", "client": "/espace-client", "extranet": "/extranet"}
PARTNER_SPACES = {"erp", "client", "extranet_supplier", "extranet_subcontractor"}


def _gates(blocks: list[engine.Block]) -> list[engine.Gate]:
    out: list[engine.Gate] = []
    for block in blocks:
        if block.gate:
            out.append(block.gate)
        out.extend(_gates(block.children))
    return out


def _texts(blocks: list[engine.Block]) -> list[str]:
    out: list[str] = []
    for block in blocks:
        out.append(block.text)
        out.extend(block.items)
        out.extend(cell for row in block.rows for cell in row)
        out.extend(_texts(block.children))
    return out


def _viewer(role: str) -> engine.Viewer:
    role_def = next(r for r in DEFAULT_ROLES if r.code == role)
    perms = frozenset(role_def.permissions)
    spaces = {"erp"} if role_def.audience == "internal" else set()
    if "client:portal" in perms:
        spaces.add("client")
    if "extranet:supplier" in perms:
        spaces.add("extranet_supplier")
    if "extranet:subcontractor" in perms:
        spaces.add("extranet_subcontractor")
    return engine.Viewer(permissions=perms, roles=frozenset({role}), spaces=frozenset(spaces))


def _ids(viewer: engine.Viewer) -> set[str]:
    return {d.id for d in engine.visible_docs(viewer)}


def _rendered_text(doc_id: str, viewer: engine.Viewer) -> str:
    rendered = engine.render(engine.all_docs()[doc_id], viewer)
    return " ".join(text for _, text in engine._plain(rendered["blocks"]))


# ---------------------------------------------------------------------------- contenu
def test_all_docs_parse_with_unique_ids_and_cover_every_space() -> None:
    docs = engine.all_docs()
    assert len(docs) >= 90
    for space in engine.SPACES:
        sections = {d.section for d in docs.values() if d.space == space}
        assert sections == set(engine.SECTION_ORDER[space]), (space, sections)


def test_references_point_to_existing_permissions_roles_spaces_and_pages() -> None:
    docs = engine.all_docs()
    for doc in docs.values():
        assert doc.id.startswith(f"{doc.space}-"), doc.source
        assert doc.routes, f"{doc.source} : aucun écran couvert"
        for route in doc.routes:
            assert route.split("?")[0].startswith(ROUTE_PREFIX[doc.space]), (doc.source, route)
        assert set(doc.perms) <= PERMISSION_CODES, doc.source
        assert set(doc.roles) <= ROLE_CODES, doc.source
        assert set(doc.spaces) <= PARTNER_SPACES, doc.source
        assert set(doc.features) <= {"referrals", "financing"}, doc.source
        for gate in _gates(doc.blocks):
            known = {"perm": PERMISSION_CODES, "role": ROLE_CODES, "space": PARTNER_SPACES}[gate.kind]
            assert set(gate.values) <= known, (doc.source, gate)
        for target in doc.related:
            assert target in docs, (doc.source, target)
        for text in _texts(doc.blocks):
            for target in re.findall(r"\]\(doc:([a-z0-9-]+)\)", text):
                assert target in docs, (doc.source, target)


def test_malformed_docs_are_rejected() -> None:
    with pytest.raises(engine.DocFormatError):
        engine.parse_doc("---\nid: x\n---\ncorps", "x.md")
    with pytest.raises(engine.DocFormatError):
        engine.parse_doc("---\nid: erp-x\ntitle: X\nspace: erp\nsection: Inconnue\norder: 1\nsummary: s\n---\n", "x.md")
    unclosed = (
        "---\nid: erp-x\ntitle: X\nspace: erp\nsection: Pilotage\norder: 1\nsummary: s\n---\n::: perm x:y\ntexte\n"
    )
    with pytest.raises(engine.DocFormatError):
        engine.parse_doc(unclosed, "x.md")


def test_roles_page_lists_every_role_and_permission() -> None:
    text = " ".join(_texts(engine.all_docs()["erp-roles-permissions"].blocks))
    for code in PERMISSION_CODES:
        assert f"`{code}`" in text, code
    for code in ROLE_CODES:
        assert f"`{code}`" in text, code


# ---------------------------------------------------------------------------- filtrage
def test_each_audience_reads_only_its_own_guide() -> None:
    admin, tech = _viewer("ADMIN"), _viewer("TECHNICIEN")
    customer, supplier, sub = _viewer("CLIENT"), _viewer("FOURNISSEUR"), _viewer("SOUS_TRAITANT")
    docs = engine.all_docs()
    by_space = {s: {i for i, d in docs.items() if d.space == s} for s in engine.SPACES}

    assert _ids(admin) == set(docs)  # administrateur : tout, y compris la vue support client / extranet
    assert _ids(customer) == by_space["client"] - {
        "client-parrainage",
        "client-financement",
    }  # modules fermés par défaut
    opened = engine.Viewer(customer.permissions, customer.roles, customer.spaces, frozenset({"referrals", "financing"}))
    assert _ids(opened) == by_space["client"]
    assert _ids(supplier) <= by_space["extranet"] and _ids(sub) <= by_space["extranet"]
    assert "extranet-commandes" in _ids(supplier) and "extranet-commandes" not in _ids(sub)
    assert "extranet-consultations" in _ids(sub) and "extranet-consultations" not in _ids(supplier)

    tech_ids = _ids(tech)
    assert tech_ids <= by_space["erp"]  # pas de vue support sans relation client / partenaire
    assert {"erp-premiers-pas", "erp-compte", "erp-notifications"} <= tech_ids
    assert not {"erp-rapport-direction", "erp-finances", "erp-utilisateurs", "erp-parametres", "erp-audit"} & tech_ids


def test_gated_procedures_are_removed_server_side() -> None:
    admin, rh = _viewer("ADMIN"), _viewer("RH")
    assert "Réinitialiser la MFA" in _rendered_text("erp-utilisateurs", admin)
    rh_text = _rendered_text("erp-utilisateurs", rh)  # users:read sans users:write ni security:manage
    assert "Onglet « Utilisateurs »" in rh_text
    assert "Nouvel utilisateur" not in rh_text and "Réinitialiser la MFA" not in rh_text

    viewer_only = engine.Viewer(
        permissions=frozenset({"client:portal"}), roles=frozenset({"CLIENT"}), spaces=frozenset({"client"})
    )
    full = _rendered_text("client-finances", _viewer("CLIENT"))
    limited = _rendered_text("client-finances", viewer_only)
    assert "Payer en ligne" in full and "Valider la libération" in full
    assert "Payer en ligne" not in limited and "Valider la libération" not in limited
    assert "Mes échéanciers" in limited

    # Pages communes extranet : chaque partenaire ne voit que la partie de son type.
    supplier_home = _rendered_text("extranet-accueil", _viewer("FOURNISSEUR"))
    assert "Espace fournisseur" in supplier_home and "Espace sous-traitant" not in supplier_home


def test_links_to_unreadable_pages_are_not_exposed() -> None:
    customer = _viewer("CLIENT")
    readable = _ids(customer)
    for doc_id in readable:
        rendered = engine.render(engine.all_docs()[doc_id], customer)
        assert all(r["id"] in readable for r in rendered["related"])
        for block in rendered["blocks"]:
            spans = block.get("spans", []) + [s for item in block.get("items", []) for s in item]
            assert all(s["id"] in readable for s in spans if s["t"] == "doc")


def test_empty_headings_are_dropped() -> None:
    doc = engine.parse_doc(
        "---\nid: erp-t\ntitle: T\nspace: erp\nsection: Pilotage\norder: 1\nsummary: s\nroute: /erp/t\n---\n"
        "## Visible\n\nTexte.\n\n## Réservé\n\n::: perm finance:pay\n### Payer\n\nProcédure.\n:::\n",
        "t.md",
    )
    blocks = engine.render(doc, _viewer("TECHNICIEN"), readable=set())["blocks"]
    assert [b.get("text") for b in blocks if b["type"] in ("h2", "h3")] == ["Visible"]


# ---------------------------------------------------------------------------- recherche et aide contextuelle
def test_search_and_route_lookup_respect_permissions() -> None:
    admin, tech, customer = _viewer("ADMIN"), _viewer("TECHNICIEN"), _viewer("CLIENT")
    assert any(h["id"] == "erp-sequestre" for h in engine.search(admin, "séquestre"))
    assert {h["space"] for h in engine.search(customer, "sequestre")} == {"client"}
    assert not any(h["id"].startswith("erp-rh") for h in engine.search(tech, "paie"))
    assert engine.search(admin, "x") == []

    assert engine.doc_for_route(customer, "/espace-client/finances/paiement/abc").id == "client-finances"
    assert engine.doc_for_route(customer, "/espace-client/dashboard").id == "client-tableau-de-bord"
    assert engine.doc_for_route(_viewer("SOUS_TRAITANT"), "/extranet/marches/123").id == "extranet-marches"
    assert engine.doc_for_route(admin, "/erp/utilisateurs").id == "erp-utilisateurs"
    fallback = engine.doc_for_route(tech, "/erp/utilisateurs")  # page non autorisée : repli sur une page lisible
    assert fallback is not None and fallback.id == "erp-tableau-de-bord"
    assert engine.doc_for_route(customer, "/erp/utilisateurs") is None


# ---------------------------------------------------------------------------- API
def test_api_filters_by_authenticated_user(client: Any, db: Any, admin_headers: dict[str, str]) -> None:
    summary = client.get("/api/v1/documentation", headers=admin_headers).json()
    assert [s["key"] for s in summary["spaces"]] == ["erp", "client", "extranet"]

    _tech, th = as_role(client, db, "TECHNICIEN")
    tech_summary = client.get("/api/v1/documentation", headers=th).json()
    assert [s["key"] for s in tech_summary["spaces"]] == ["erp"]
    tech_ids = {i["id"] for i in tech_summary["items"]}
    assert "erp-finances" not in tech_ids and "erp-premiers-pas" in tech_ids
    # Page non autorisée : même réponse qu'une page inexistante.
    assert client.get("/api/v1/documentation/erp-finances", headers=th).status_code == 404
    assert client.get("/api/v1/documentation/inexistante", headers=th).status_code == 404

    _customer, ch = as_role(client, db, "CLIENT", org_kind="client")
    page = client.get("/api/v1/documentation/client-finances", headers=ch)
    assert page.status_code == 200 and page.json()["toc"]
    assert client.get("/api/v1/documentation/erp-premiers-pas", headers=ch).status_code == 404
    hits = client.get("/api/v1/documentation/search", params={"q": "paiement"}, headers=ch).json()
    assert hits and all(h["space"] == "client" for h in hits)
    found = client.get("/api/v1/documentation/route", params={"path": "/espace-client/sav/42"}, headers=ch)
    assert found.json()["id"] == "client-sav"
    assert client.get("/api/v1/documentation/route", params={"path": "/erp/achats"}, headers=ch).status_code == 404

    _supplier, sh = as_role(client, db, "FOURNISSEUR", org_kind="supplier")
    assert client.get("/api/v1/documentation/extranet-commandes", headers=sh).status_code == 200
    assert client.get("/api/v1/documentation/extranet-consultations", headers=sh).status_code == 404
    assert client.get("/api/v1/documentation").status_code == 401
