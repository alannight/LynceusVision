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


@pytest.mark.asyncio
async def test_search_query_rejects_invalid_enums(client: httpx.AsyncClient) -> None:
    # Invalid provider
    res1 = await client.post(
        "/api/v1/search-queries",
        json={"title": "Q", "query_text": "target", "provider": "invalid-engine"},
    )
    assert res1.status_code == 422

    # Invalid category
    res2 = await client.post(
        "/api/v1/search-queries",
        json={"title": "Q", "query_text": "target", "category": "invalid-category"},
    )
    assert res2.status_code == 422

    # Invalid status
    res3 = await client.post(
        "/api/v1/search-queries",
        json={"title": "Q", "query_text": "target", "status": "UNKNOWN_STATUS"},
    )
    assert res3.status_code == 422


@pytest.mark.asyncio
async def test_search_query_pagination(client: httpx.AsyncClient) -> None:
    for i in range(5):
        await client.post(
            "/api/v1/search-queries",
            json={"title": f"Search Query {i}", "query_text": f"query {i}"},
        )

    res1 = await client.get("/api/v1/search-queries?limit=2&offset=0")
    assert res1.status_code == 200
    assert len(res1.json()) == 2

    res2 = await client.get("/api/v1/search-queries?limit=2&offset=2")
    assert res2.status_code == 200
    assert len(res2.json()) == 2
    assert res1.json()[0]["id"] != res2.json()[0]["id"]


@pytest.mark.asyncio
async def test_search_query_cross_user_isolation(client: httpx.AsyncClient) -> None:
    from app.database import get_db
    from app.main import app
    from app.models.models import User
    from app.security.auth import create_access_token

    # 1. User A creates query
    created = await client.post(
        "/api/v1/search-queries",
        json={"title": "Secret Search", "query_text": "internal search"},
    )
    query_id = created.json()["id"]

    # 2. User B
    unused_test_hash = "test-only-hash"
    user_b = User(username="user-b-queries", password_hash=unused_test_hash)
    session_override = app.dependency_overrides[get_db]
    async for session in session_override():
        session.add(user_b)
        await session.flush()
        token_b = create_access_token(user_b.id)
        break

    # Get should be 404
    b_res = await client.get(
        f"/api/v1/search-queries/{query_id}",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert b_res.status_code == 404

    # Delete should be 404
    b_del = await client.delete(
        f"/api/v1/search-queries/{query_id}",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert b_del.status_code == 404

