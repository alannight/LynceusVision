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
