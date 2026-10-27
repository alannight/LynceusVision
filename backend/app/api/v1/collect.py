"""Collect router — runs OSINT connectors and optionally persists results.

POST /api/v1/collect
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.connectors import get_all_connectors, get_connector
from app.connectors.base import BaseConnector
from app.database import PersistenceError, get_db
from app.models.models import Entity, Investigation, Observation, Source, User
from app.schemas import CollectRequest, CollectResponse, ConnectorResult
from app.security.auth import get_current_user
from app.security.rate_limiter import collect_limiter

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/collect", tags=["Collect"])

DB = Annotated[AsyncSession, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]
FAILED_CONNECTOR_STATUSES = {
    "TIMEOUT",
    "RATE_LIMITED",
    "AUTH_ERROR",
    "PROVIDER_ERROR",
    "SSRF_BLOCKED",
    "VALIDATION_ERROR",
    "RESPONSE_TOO_LARGE",
}


@router.post("", response_model=CollectResponse, dependencies=[Depends(collect_limiter)])
async def collect(body: CollectRequest, db: DB, user: CurrentUser) -> CollectResponse:
    """
    Run one or more OSINT connectors against a target.

    - If `connectors` is null, all enabled connectors are used.
    - If `save_to_investigation_id` is set, results are persisted as entities + observations.
    """
    if body.connectors is not None:
        if not body.connectors:
            raise HTTPException(
                status_code=422,
                detail=(
                    "Select at least one connector, or omit connectors to use all enabled "
                    "connectors."
                ),
            )
        resolved_connectors = [get_connector(connector_id) for connector_id in body.connectors]
        if any(connector is None for connector in resolved_connectors):
            raise HTTPException(status_code=422, detail="One or more connector IDs are unknown.")
        connectors: list[BaseConnector] = [
            connector for connector in resolved_connectors if connector is not None
        ]
    else:
        connectors = get_all_connectors()

    if body.save_to_investigation_id:
        investigation = await db.scalar(
            select(Investigation).where(
                Investigation.id == body.save_to_investigation_id,
                Investigation.owner_id == user.id,
            )
        )
        if investigation is None:
            raise HTTPException(status_code=404, detail="Investigation not found")

    # Run all connectors concurrently
    tasks = [connector.collect(body.target) for connector in connectors]
    results: list[ConnectorResult] = await asyncio.gather(*tasks)

    # Optionally persist
    if body.save_to_investigation_id:
        await _persist_results(body.target, body.save_to_investigation_id, results, db)
        try:
            await db.commit()
        except SQLAlchemyError as exc:
            await db.rollback()
            raise PersistenceError("Collection results could not be committed") from exc

    logger.info(
        "Collect completed: %d connectors, statuses=%s",
        len(results),
        [r.status for r in results],
    )

    return CollectResponse(
        target=body.target,
        results=results,
        collection_status=(
            "PARTIAL_FAILURE"
            if any(result.status in FAILED_CONNECTOR_STATUSES for result in results)
            else "COMPLETE"
        ),
        persistence_status="SAVED" if body.save_to_investigation_id else "NOT_REQUESTED",
    )


async def _persist_results(
    target: str,
    investigation_id: str,
    results: list[ConnectorResult],
    db: AsyncSession,
) -> None:
    # The caller validates ownership before running external connector requests.
    inv_result = await db.execute(select(Investigation).where(Investigation.id == investigation_id))
    if inv_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Investigation not found")

    # Infer entity type from target
    entity_type = _infer_entity_type(target)

    # Upsert entity
    ent_result = await db.execute(
        select(Entity).where(
            Entity.investigation_id == investigation_id,
            Entity.entity_type == entity_type,
            Entity.value == target,
        )
    )
    entity = ent_result.scalar_one_or_none()
    if entity is None:
        entity = Entity(
            investigation_id=investigation_id,
            entity_type=entity_type,
            value=target,
        )
        db.add(entity)
        await db.flush()

    # Persist observations
    for result in results:
        # Ensure source exists
        src_result = await db.execute(select(Source).where(Source.id == result.connector_id))
        if src_result.scalar_one_or_none() is None:
            # Auto-create source if missing (shouldn't happen after startup seed)
            source = Source(id=result.connector_id, display_name=result.connector_id)
            db.add(source)
            await db.flush()

        obs = Observation(
            entity_id=entity.id,
            source_id=result.connector_id,
            query_context=result.query,
            status=result.status,
            collected_at=result.collected_at,
            duration_ms=result.duration_ms,
            normalized_data=result.data,
            normalized_snapshot=json.dumps(result.data) if result.data else None,
            error_detail=result.error,
        )
        db.add(obs)

    await db.flush()


def _infer_entity_type(target: str) -> str:
    import ipaddress
    import re

    target = target.strip().lower()
    try:
        ipaddress.ip_address(target)
        return "ip"
    except ValueError:
        pass
    if re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", target):
        return "email"
    if target.startswith("http://") or target.startswith("https://"):
        return "url"
    return "domain"
