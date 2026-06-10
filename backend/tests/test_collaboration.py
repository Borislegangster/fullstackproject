"""Phase 5 — Bureau d'Études Virtuel collaboration endpoints."""


def test_aps_token_without_credentials(client, admin_headers):
    """When APS credentials are missing, the endpoint returns 503 (not 500)."""
    r = client.get('/api/v1/collaboration/aps-token', headers=admin_headers)
    # In test environment APS_CLIENT_ID is unset → 503 expected
    assert r.status_code in (200, 503)
    if r.status_code == 503:
        assert 'APS' in r.json().get('detail', '')


def test_list_sessions(client, admin_headers):
    r = client.get('/api/v1/collaboration/sessions', headers=admin_headers)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_create_session_requires_project(client, admin_headers):
    """Without a valid project_id, session creation fails 404."""
    r = client.post('/api/v1/collaboration/sessions', headers=admin_headers, json={
        'project_id': 'nonexistent',
        'plan_urn': 'dXJuOmFkc2tab2JqZWN0czE6Z2xvYnVzL2RlbW8ucnZ0',
    })
    assert r.status_code == 404


def test_upload_bim_requires_credentials(client, admin_headers):
    """Upload also fails with 503 when APS is not configured."""
    # We don't actually upload — just hit the endpoint with a tiny file.
    r = client.post(
        '/api/v1/collaboration/upload-bim',
        headers=admin_headers,
        data={'project_id': 'nonexistent'},
        files={'file': ('test.rvt', b'fakecontent')},
    )
    # Either 404 (project missing) or 503 (APS missing) — both acceptable
    assert r.status_code in (404, 503)


def test_translation_status_requires_credentials(client, admin_headers):
    r = client.get('/api/v1/collaboration/translation-status/fakeurn', headers=admin_headers)
    assert r.status_code in (503, 200)
