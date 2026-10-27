"""API tests for OSINT collect endpoint with persistence and source attribution."""

from __future__ import annotations

import httpx
import pytest
import respx
from sqlalchemy.ext.asyncio import AsyncSession

SYNTHETIC_RDAP = {
    "ldhName": "investigate-target.com",
    "status": ["active"],
    "entities": [
        {
            "roles": ["registrar"],
            "vcardArray": [
                "vcard",
                [["version", {}, "text", "4.0"], ["fn", {}, "text", "Safe Registrar"]],
            ],
        }
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
        assert data["collection_status"] == "COMPLETE"
        assert data["persistence_status"] == "NOT_REQUESTED"
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
        assert collect_res.json()["persistence_status"] == "SAVED"

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


@pytest.mark.asyncio
async def test_collect_rejects_unknown_connector_before_network(client: httpx.AsyncClient) -> None:
    response = await client.post(
        "/api/v1/collect", json={"target": "example.com", "connectors": ["unknown"]}
    )
    assert response.status_code == 422
    assert "unknown" in response.json()["error"].lower()


@pytest.mark.asyncio
async def test_collect_rejects_empty_connector_list(client: httpx.AsyncClient) -> None:
    response = await client.post(
        "/api/v1/collect", json={"target": "example.com", "connectors": []}
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_collect_rejects_duplicate_connector_ids(client: httpx.AsyncClient) -> None:
    response = await client.post(
        "/api/v1/collect",
        json={"target": "example.com", "connectors": ["rdap", "rdap"]},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_collect_rejects_connector_fanout_over_limit(client: httpx.AsyncClient) -> None:
    response = await client.post(
        "/api/v1/collect",
        json={"target": "example.com", "connectors": ["a", "b", "c", "d", "e"]},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_collect_rejects_missing_investigation_before_network(
    client: httpx.AsyncClient,
) -> None:
    response = await client.post(
        "/api/v1/collect",
        json={
            "target": "example.com",
            "connectors": ["rdap"],
            "save_to_investigation_id": "missing",
        },
    )
    assert response.status_code == 404
    assert response.json()["error"] == "Investigation not found"


@pytest.mark.asyncio
async def test_collect_reports_partial_connector_failure(client: httpx.AsyncClient) -> None:
    with respx.mock(assert_all_called=False) as respx_mock:
        respx_mock.get("https://rdap.org/domain/example.com").mock(return_value=httpx.Response(429))
        response = await client.post(
            "/api/v1/collect",
            json={"target": "example.com", "connectors": ["rdap"]},
        )
    assert response.status_code == 200
    assert response.json()["collection_status"] == "PARTIAL_FAILURE"
    assert response.json()["results"][0]["status"] == "RATE_LIMITED"


@pytest.mark.asyncio
async def test_collect_commit_failure_returns_persistence_error(
    client: httpx.AsyncClient,
    test_db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from sqlalchemy.exc import SQLAlchemyError

    async def failed_commit() -> None:
        raise SQLAlchemyError("injected commit failure")

    monkeypatch.setattr(test_db_session, "commit", failed_commit)
    investigation = await client.post(
        "/api/v1/investigations", json={"title": "commit failure case"}
    )
    investigation_id = investigation.json()["id"]
    with respx.mock(assert_all_called=False) as respx_mock:
        respx_mock.get("https://rdap.org/domain/example.com").mock(
            return_value=httpx.Response(200, json=SYNTHETIC_RDAP)
        )
        response = await client.post(
            "/api/v1/collect",
            json={
                "target": "example.com",
                "connectors": ["rdap"],
                "save_to_investigation_id": investigation_id,
            },
        )
    assert response.status_code == 500
    assert response.json()["code"] == "PERSISTENCE_FAILED"
