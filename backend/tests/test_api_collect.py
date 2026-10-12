"""API tests for OSINT collect endpoint with persistence and source attribution."""
from __future__ import annotations

import httpx
import pytest
import respx

SYNTHETIC_RDAP = {
    "ldhName": "investigate-target.com",
    "status": ["active"],
    "entities": [
        {"roles": ["registrar"], "vcardArray": ["vcard", [["version", {}, "text", "4.0"], ["fn", {}, "text", "Safe Registrar"]]]}
    ],
    "nameservers": [{"ldhName": "ns1.safe.com"}],
}


@pytest.mark.asyncio
async def test_collect_without_save(client: httpx.AsyncClient) -> None:
    with respx.mock(assert_all_called=False) as respx_mock:
        respx_mock.get("https://rdap.org/domain/example.com").mock(
            return_value=httpx.Response(200, json=SYNTHETIC_RDAP)
        )
        res = await client.post(
            "/api/v1/collect",
            json={"target": "example.com", "connectors": ["rdap"]},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["target"] == "example.com"
        assert len(data["results"]) == 1
        assert data["results"][0]["connector_id"] == "rdap"
        assert data["results"][0]["status"] == "OK"


@pytest.mark.asyncio
async def test_collect_with_save_to_investigation(client: httpx.AsyncClient) -> None:
    # 1. Create investigation
    inv_res = await client.post("/api/v1/investigations", json={"title": "Collect Test Inv"})
    assert inv_res.status_code == 201
    inv_id = inv_res.json()["id"]

    # 2. Collect with save_to_investigation_id
    with respx.mock(assert_all_called=False) as respx_mock:
        respx_mock.get("https://rdap.org/domain/example.com").mock(
            return_value=httpx.Response(200, json=SYNTHETIC_RDAP)
        )
        collect_res = await client.post(
            "/api/v1/collect",
            json={
                "target": "example.com",
                "connectors": ["rdap"],
                "save_to_investigation_id": inv_id,
            },
        )
        assert collect_res.status_code == 200

    # 3. Verify entity was automatically created
    ent_res = await client.get(f"/api/v1/investigations/{inv_id}/entities")
    assert ent_res.status_code == 200
    entities = ent_res.json()
    assert len(entities) == 1
    assert entities[0]["value"] == "example.com"
    ent_id = entities[0]["id"]

    # 4. Verify observation with source attribution
    obs_res = await client.get(f"/api/v1/investigations/{inv_id}/entities/{ent_id}/observations")
    assert obs_res.status_code == 200
    observations = obs_res.json()
    assert len(observations) == 1
    obs = observations[0]
    assert obs["source_id"] == "rdap"
    assert obs["query_context"] == "example.com"
    assert obs["status"] == "OK"
    assert obs["normalized_data"]["registrar"] == "Safe Registrar"
