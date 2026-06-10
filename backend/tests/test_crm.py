"""CRM router — leads CRUD + lifecycle."""


def test_create_lead_public(client):
    """Lead creation is public (used by the ContactPage)."""
    r = client.post("/api/v1/crm/leads", json={
        "first_name": "Marie",
        "last_name": "Dupont",
        "email": "marie@example.com",
        "phone": "+237699000000",
        "project_type": "Villa R+1",
        "message": "Devis svp",
        "source": "website",
    })
    assert r.status_code == 200, r.text
    assert r.json()["email"] == "marie@example.com"


def test_list_leads_requires_staff(client):
    r = client.get("/api/v1/crm/leads")
    assert r.status_code in (401, 403)


def test_list_leads_admin(client, admin_headers):
    r = client.get("/api/v1/crm/leads", headers=admin_headers)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_update_lead_status(client, admin_headers):
    # Create then update
    created = client.post("/api/v1/crm/leads", json={
        "first_name": "Pierre", "last_name": "Test",
        "email": "pierre@example.com",
    }).json()
    lead_id = created["id"]
    r = client.patch(f"/api/v1/crm/leads/{lead_id}", headers=admin_headers,
                     json={"status": "QUALIFICATION"})
    assert r.status_code == 200
    assert r.json()["status"] == "QUALIFICATION"
