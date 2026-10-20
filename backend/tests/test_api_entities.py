"""API tests for Entities and Observations endpoints."""
from __future__ import annotations

import httpx
import pytest


@pytest.mark.asyncio
async def test_entity_crud(client: httpx.AsyncClient) -> None:
    # 1. Create parent investigation
    inv_res = await client.post("/api/v1/investigations", json={"title": "Entity Test"})
    assert inv_res.status_code == 201
    inv_id = inv_res.json()["id"]

    # 2. Create entity
    ent_payload = {
        "entity_type": "domain",
        "value": "threat-domain.com",
        "label": "Primary C2",
        "notes": "Observed in incident 101",
    }
    create_res = await client.post(f"/api/v1/investigations/{inv_id}/entities", json=ent_payload)
    assert create_res.status_code == 201
    entity_data = create_res.json()
    assert entity_data["value"] == "threat-domain.com"
    assert entity_data["entity_type"] == "domain"
    assert entity_data["observation_count"] == 0
    ent_id = entity_data["id"]

    # 3. List entities
    list_res = await client.get(f"/api/v1/investigations/{inv_id}/entities")
    assert list_res.status_code == 200
    assert len(list_res.json()) == 1

    # 4. Get entity
    get_res = await client.get(f"/api/v1/investigations/{inv_id}/entities/{ent_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == ent_id

    # 5. Update entity
    patch_res = await client.patch(
        f"/api/v1/investigations/{inv_id}/entities/{ent_id}",
        json={"notes": "Updated threat notes"},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["notes"] == "Updated threat notes"

    # 6. Delete entity
    del_res = await client.delete(f"/api/v1/investigations/{inv_id}/entities/{ent_id}")
    assert del_res.status_code == 204

    # 7. Verify deletion
    verify_res = await client.get(f"/api/v1/investigations/{inv_id}/entities/{ent_id}")
    assert verify_res.status_code == 404


@pytest.mark.asyncio
async def test_entity_pagination(client: httpx.AsyncClient) -> None:
    inv = await client.post("/api/v1/investigations", json={"title": "Entity Pagination Test"})
    inv_id = inv.json()["id"]

    for i in range(5):
        await client.post(
            f"/api/v1/investigations/{inv_id}/entities",
            json={"entity_type": "domain", "value": f"sub{i}.domain.test"},
        )

    # Test limit=2, offset=0
    res1 = await client.get(f"/api/v1/investigations/{inv_id}/entities?limit=2&offset=0")
    assert res1.status_code == 200
    items1 = res1.json()
    assert len(items1) == 2

    # Test limit=2, offset=2
    res2 = await client.get(f"/api/v1/investigations/{inv_id}/entities?limit=2&offset=2")
    assert res2.status_code == 200
    items2 = res2.json()
    assert len(items2) == 2
    assert items1[0]["id"] != items2[0]["id"]


@pytest.mark.asyncio
async def test_entity_cross_user_isolation(client: httpx.AsyncClient) -> None:
    from app.database import get_db
    from app.main import app
    from app.models.models import User
    from app.security.auth import create_access_token

    # 1. User A creates investigation and entity
    inv = await client.post("/api/v1/investigations", json={"title": "User A Investigation"})
    inv_id = inv.json()["id"]
    ent = await client.post(
        f"/api/v1/investigations/{inv_id}/entities",
        json={"entity_type": "ip", "value": "1.2.3.4"},
    )
    ent_id = ent.json()["id"]

    # 2. User B tries to access User A's entity
    unused_test_hash = "test-only-hash"
    user_b = User(username="user-b-entities", password_hash=unused_test_hash)
    session_override = app.dependency_overrides[get_db]
    async for session in session_override():
        session.add(user_b)
        await session.flush()
        token_b = create_access_token(user_b.id)
        break

    # Get should be 404
    b_res = await client.get(
        f"/api/v1/investigations/{inv_id}/entities/{ent_id}",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert b_res.status_code == 404

    # Patch should be 404
    b_patch = await client.patch(
        f"/api/v1/investigations/{inv_id}/entities/{ent_id}",
        json={"notes": "Hacked"},
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert b_patch.status_code == 404

    # Delete should be 404
    b_del = await client.delete(
        f"/api/v1/investigations/{inv_id}/entities/{ent_id}",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert b_del.status_code == 404

