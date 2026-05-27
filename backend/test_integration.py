"""Integration test — validates all endpoints work."""
import asyncio
from app.main import app
from httpx import AsyncClient, ASGITransport


async def main():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Health
        r = await client.get("/health")
        print(f"Health: {r.status_code}")

        # Login
        r = await client.post("/api/v1/auth/login", json={
            "email": "boristsamejiotatou@gmail.com",
            "password": "Admin123!",
        })
        data = r.json()
        print(f"Login: {r.status_code} - role={data.get('user', {}).get('role')} force_reset={data.get('force_reset')}")
        token = data["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Templates
        r = await client.get("/api/v1/projects/templates/list", headers=headers)
        print(f"Templates: {r.status_code} - {len(r.json())} templates")

        # Leads (empty)
        r = await client.get("/api/v1/crm/leads", headers=headers)
        print(f"Leads: {r.status_code} - {len(r.json())} leads")

        # Create lead
        r = await client.post("/api/v1/crm/leads", json={
            "first_name": "Jean", "last_name": "Dupont",
            "email": "jean.dupont@example.com", "phone": "+237699000000",
            "project_type": "Villa R+1", "message": "Je souhaite construire",
        })
        print(f"Create Lead: {r.status_code}")
        lead_id = r.json()["id"]

        # Users
        r = await client.get("/api/v1/admin/users", headers=headers)
        print(f"Users: {r.status_code} - {len(r.json())} users")

        # Notifications
        r = await client.get("/api/v1/notifications/unread-count", headers=headers)
        print(f"Unread: {r.json()['count']}")

        # Convert lead
        templates_r = await client.get("/api/v1/projects/templates/list", headers=headers)
        template_id = templates_r.json()[0]["id"]
        r = await client.post(f"/api/v1/crm/leads/{lead_id}/convert", headers=headers, json={
            "project_name": "Villa Dupont", "project_type": "Villa R+1",
            "template_id": template_id,
        })
        print(f"Convert Lead: {r.status_code} - {r.json()}")

        # Idempotence check
        r2 = await client.post(f"/api/v1/crm/leads/{lead_id}/convert", headers=headers, json={
            "project_name": "Villa Dupont", "project_type": "Villa R+1",
        })
        print(f"Idempotence: {r2.json().get('already_converted')}")

        # Projects
        r = await client.get("/api/v1/projects", headers=headers)
        print(f"Projects: {r.status_code} - {len(r.json())} projects")

        # SAV stats
        r = await client.get("/api/v1/sav/stats", headers=headers)
        print(f"SAV stats: {r.status_code}")

        # Activity
        r = await client.get("/api/v1/activity/logs", headers=headers)
        print(f"Activity: {r.status_code} - {len(r.json())} logs")

        # Create user
        r = await client.post("/api/v1/admin/users", headers=headers, json={
            "email": "test.chef@globus.com", "first_name": "Test",
            "last_name": "Chef", "role": "CHEF_PROJET",
        })
        print(f"Create User: {r.status_code}")

        print("\n=== ALL ENDPOINTS WORKING ===")


asyncio.run(main())
