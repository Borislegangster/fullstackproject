"""LOT A — Project templates seeded + lead conversion pre-fills phases and
auto-generates a contract PDF filed in the GED (Section 5 & 6)."""
API = "/api/v1"


def test_default_templates_seeded(client, admin_headers):
    rows = client.get(f"{API}/projects/templates/list", headers=admin_headers).json()
    names = {t["name"] for t in rows}
    assert {"Villa R+1", "Immeuble R+3", "Rénovation", "Bureau / Commercial"} <= names
    villa = next(t for t in rows if t["name"] == "Villa R+1")
    assert len(villa["phases"]) == 10


def test_convert_with_template_creates_phases_and_contract(client, admin_headers):
    villa = next(
        t for t in client.get(f"{API}/projects/templates/list", headers=admin_headers).json()
        if t["name"] == "Villa R+1"
    )
    lead = client.post(f"{API}/crm/leads", headers=admin_headers, json={
        "first_name": "Awa", "last_name": "Nkeng", "email": "awa.lota@test.com",
        "phone": "650000000", "project_type": "construction", "location": "Douala",
    }).json()
    lead_id = lead["id"]

    conv = client.post(f"{API}/crm/leads/{lead_id}/convert", headers=admin_headers, json={
        "project_name": "Villa Awa", "template_id": villa["id"],
    })
    assert conv.status_code == 200, conv.text
    pid = conv.json()["project_id"]

    # Phases pre-filled from the template (10 for Villa R+1)
    timeline = client.get(f"{API}/projects/{pid}/timeline", headers=admin_headers).json()
    phases = timeline.get("phases", timeline) if isinstance(timeline, dict) else timeline
    assert len(phases) == 10, phases

    # Contract PDF auto-filed in the GED
    docs = client.get(f"{API}/ged/documents/{pid}", headers=admin_headers).json()
    assert any(d.get("category") == "contrat" or "Contrat" in (d.get("name") or "")
               for d in docs), docs

    # Idempotent conversion
    again = client.post(f"{API}/crm/leads/{lead_id}/convert", headers=admin_headers,
                        json={"project_name": "X"})
    assert again.json().get("already_converted") is True
