"""Phase 17 — HR + payroll integration tests (employees, attendance, payroll lifecycle)."""
import uuid

import pytest

API = "/api/v1"


@pytest.fixture(scope="module")
def employee_id(client, admin_auth):
    r = client.post(f"{API}/hr/employees", headers=admin_auth, json={
        "first_name": "Paul", "last_name": "Mbarga",
        "email": f"paul-{uuid.uuid4().hex[:6]}@globus.cm",
        "position": "Maçon", "department": "Chantier", "base_salary": 300000,
    })
    assert r.status_code == 200, r.text
    return r.json()["id"]


@pytest.fixture(scope="module")
def temp_worker_id(client, admin_auth):
    r = client.post(f"{API}/hr/temp-workers", headers=admin_auth, json={
        "first_name": "Ali", "last_name": "Temp", "phone": "+237600000000",
        "speciality": "Ferraillage", "daily_rate": 8000,
    })
    assert r.status_code == 200, r.text
    return r.json()["id"]


def test_list_employees(client, admin_headers):
    r = client.get(f"{API}/hr/employees", headers=admin_headers)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_create_then_get_employee(client, admin_headers, employee_id):
    r = client.get(f"{API}/hr/employees/{employee_id}", headers=admin_headers)
    assert r.status_code == 200, r.text
    assert r.json()["first_name"] == "Paul"


def test_update_employee(client, admin_headers, employee_id):
    r = client.patch(f"{API}/hr/employees/{employee_id}", headers=admin_headers,
                     json={"position": "Chef d'équipe"})
    assert r.status_code == 200, r.text


def test_record_attendance(client, admin_headers, temp_worker_id):
    r = client.post(f"{API}/hr/attendance/scan", headers=admin_headers, json={
        "worker_type": "temp", "worker_id": temp_worker_id, "status": "PRESENT",
    })
    assert r.status_code == 200, r.text


def test_attendance_summary(client, admin_headers):
    r = client.get(f"{API}/hr/attendance/summary", headers=admin_headers)
    assert r.status_code == 200, r.text


def test_payroll_generate_validate_pay(client, admin_headers, temp_worker_id):
    g = client.post(f"{API}/hr/payroll/generate", headers=admin_headers, json={
        "worker_type": "temp", "worker_id": temp_worker_id,
        "period": "2026-03", "days_worked": 20,
    })
    assert g.status_code == 200, g.text
    pid = g.json()["id"]

    v = client.patch(f"{API}/hr/payroll/{pid}/validate", headers=admin_headers)
    assert v.status_code == 200, v.text

    p = client.patch(f"{API}/hr/payroll/{pid}/mark-paid", headers=admin_headers)
    assert p.status_code == 200, p.text

    rows = client.get(f"{API}/hr/payroll", headers=admin_headers).json()
    paid = [x for x in rows if x["id"] == pid]
    assert paid and paid[0]["status"] == "PAYE"


def test_delete_employee(client, admin_headers, employee_id):
    r = client.delete(f"{API}/hr/employees/{employee_id}", headers=admin_headers)
    assert r.status_code == 200, r.text


def test_hr_requires_staff(client):
    assert client.get(f"{API}/hr/employees").status_code in (401, 403)


def test_client_cannot_list_employees(client, client_headers):
    assert client.get(f"{API}/hr/employees", headers=client_headers).status_code in (401, 403)
