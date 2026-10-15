"""API tests for Investigations endpoints."""

from __future__ import annotations

import httpx
import pytest


@pytest.mark.asyncio
async def test_create_and_get_investigation(client: httpx.AsyncClient) -> None:
    # 1. Create
    create_payload = {"title": "Operation Apex", "description": "Target analysis"}
    res = await client.post("/api/v1/investigations", json=create_payload)
    assert res.status_code == 201
    data = res.json()
    assert data["title"] == "Operation Apex"
    assert data["status"] == "active"
    assert data["entity_count"] == 0
    inv_id = data["id"]

    # 2. Get by ID
    get_res = await client.get(f"/api/v1/investigations/{inv_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == inv_id

    # 3. List
    list_res = await client.get("/api/v1/investigations")
    assert list_res.status_code == 200
    items = list_res.json()
    assert any(i["id"] == inv_id for i in items)

    # 4. Update
    patch_res = await client.patch(f"/api/v1/investigations/{inv_id}", json={"status": "archived"})
    assert patch_res.status_code == 200
    assert patch_res.json()["status"] == "archived"

    # 5. Delete
    del_res = await client.delete(f"/api/v1/investigations/{inv_id}")
    assert del_res.status_code == 204

    # 6. Verify 404
    get_deleted = await client.get(f"/api/v1/investigations/{inv_id}")
    assert get_deleted.status_code == 404


@pytest.mark.asyncio
async def test_sensitive_api_rejects_missing_auth(client: httpx.AsyncClient) -> None:
    response = await client.get("/api/v1/investigations", headers={"Authorization": ""})
    assert response.status_code == 401
    assert response.json()["error"] == "Authentication required"
    assert response.headers["www-authenticate"] == "Bearer"


@pytest.mark.asyncio
async def test_registration_hashes_password_and_login_issues_token(
    client: httpx.AsyncClient,
) -> None:
    credentials = {"username": "new-account", "password": "a-long-test-password-123"}
    registered = await client.post("/api/v1/auth/register", json=credentials)
    assert registered.status_code == 201
    assert registered.json()["access_token"]
    assert registered.json()["expires_in"] == 1800
    assert credentials["password"] not in registered.text

    logged_in = await client.post("/api/v1/auth/login", json=credentials)
    assert logged_in.status_code == 200
    assert logged_in.json()["access_token"]

    wrong_password = await client.post(
        "/api/v1/auth/login",
        json={"username": "new-account", "password": "wrong-long-password"},
    )
    assert wrong_password.status_code == 401


@pytest.mark.asyncio
async def test_investigation_isolated_between_accounts(client: httpx.AsyncClient) -> None:
    from app.models.models import User
    from app.security.auth import create_access_token

    created = await client.post("/api/v1/investigations", json={"title": "private"})
    investigation_id = created.json()["id"]
    unused_test_hash = "test-only-hash"
    other = User(username="other-user", password_hash=unused_test_hash)
    # The fixture database is shared with the app dependency override.
    from app.database import get_db
    from app.main import app

    session_override = app.dependency_overrides[get_db]
    async for session in session_override():
        session.add(other)
        await session.flush()
        token = create_access_token(other.id)
        break
    response = await client.get(
        f"/api/v1/investigations/{investigation_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 404
