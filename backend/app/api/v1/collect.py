"""Collect router — runs OSINT connectors and optionally persists results.

POST /api/v1/collect
"""
from __future__ import annotations

import asyncio
import json
import logging
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.connectors import get_all_connectors, get_connector
from app.database import get_db
from app.models.models import Entity, Investigation, Observation, Source
from app.schemas import CollectRequest, CollectResponse, ConnectorResult

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/collect", tags=["Collect"])

DB = Annotated[AsyncSession, Depends(get_db)]


@router.post("", response_model=CollectResponse)
async def collect(body: CollectRequest, db: DB) -> CollectResponse:
    """
    Run one or more OSINT connectors against a target.

    - If `connectors` is null, all enabled connectors are used.
    - If `save_to_investigation_id` is set, results are persisted as entities + observations.
    """
    if body.connectors:
        connectors = [c for cid in body.connectors if (c := get_connector(cid)) is not None]
    else:
        connectors = get_all_connectors()

    # Run all connectors concurrently
    tasks = [c.collect(body.target) for c in connectors]
    results: list[ConnectorResult] = await asyncio.gather(*tasks)

    # Optionally persist
    if body.save_to_investigation_id:
        await _persist_results(body.target, body.save_to_investigation_id, results, db)

    logger.info(
        "Collect %r: %d connectors, statuses=%s",
        body.target,
        len(results),
        [r.status for r in results],
    )

    return CollectResponse(target=body.target, results=results)


async def _persist_results(
    target: str,
    investigation_id: str,
    results: list[ConnectorResult],
    db: AsyncSession,
) -> None:
    # Verify investigation exists
    inv_result = await db.execute(
        select(Investigation).where(Investigation.id == investigation_id)
    )
    if inv_result.scalar_one_or_none() is None:
        logger.warning("Investigation %s not found, skipping persistence", investigation_id)
        return

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
            raw_response=json.dumps(result.data) if result.data else None,
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
