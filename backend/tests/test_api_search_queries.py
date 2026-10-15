"""Persistence endpoint tests for Dorking Studio queries."""
from __future__ import annotations

import httpx
import pytest


@pytest.mark.asyncio
async def test_save_and_list_search_query(client: httpx.AsyncClient) -> None:
    investigation_response = await client.post(
        "/api/v1/investigations", json={"title": "Public research"}
    )
    assert investigation_response.status_code == 201
    investigation_id = investigation_response.json()["id"]
    query_text = 'site:example.org "keamanan informasi"'
    payload = {
        "investigation_id": investigation_id,
        "title": "Public documents",
        "query_text": query_text,
        "provider": "google",
        "category": "document",
        "structured_filters": {"searchEngine": "google", "raw_mode": True},
    }

    response = await client.post("/api/v1/search-queries", json=payload)
    assert response.status_code == 201
    saved = response.json()
    assert saved["query_text"] == query_text
    assert saved["provider"] == "google"
    assert saved["investigation_id"] == investigation_id
    assert saved["structured_filters"] == payload["structured_filters"]
    assert saved["created_at"]

    listed = await client.get(
        "/api/v1/search-queries", params={"investigation_id": investigation_id}
    )
    assert listed.status_code == 200
    assert [item["id"] for item in listed.json()] == [saved["id"]]


@pytest.mark.asyncio
async def test_search_query_rejects_missing_investigation(client: httpx.AsyncClient) -> None:
    response = await client.post(
        "/api/v1/search-queries",
        json={
            "investigation_id": "missing-investigation",
            "title": "Query",
            "query_text": "public information",
            "provider": "google",
        },
    )
    assert response.status_code == 404
    assert response.json()["error"] == "Investigation not found"


@pytest.mark.asyncio
async def test_search_query_rejects_empty_query_text(client: httpx.AsyncClient) -> None:
    response = await client.post(
        "/api/v1/search-queries", json={"title": "Empty", "query_text": ""}
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_search_query_read_update_delete_crud(client: httpx.AsyncClient) -> None:
    created = await client.post(
        "/api/v1/search-queries",
        json={"title": "initial", "query_text": "cybersecurity", "provider": "google"},
    )
    assert created.status_code == 201
    query_id = created.json()["id"]

    fetched = await client.get(f"/api/v1/search-queries/{query_id}")
    assert fetched.status_code == 200
    assert fetched.json()["query_text"] == "cybersecurity"

    updated = await client.patch(
        f"/api/v1/search-queries/{query_id}",
        json={"query_text": '"incident response"', "status": "READY_TO_OPEN"},
    )
    assert updated.status_code == 200
    assert updated.json()["query_text"] == '"incident response"'

    deleted = await client.delete(f"/api/v1/search-queries/{query_id}")
    assert deleted.status_code == 204
    assert (await client.get(f"/api/v1/search-queries/{query_id}")).status_code == 404
