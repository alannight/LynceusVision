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
