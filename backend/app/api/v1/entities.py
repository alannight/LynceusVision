"""Entities CRUD router — /api/v1/investigations/{id}/entities"""
from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.models import Entity, Investigation, Observation
from app.schemas import EntityCreate, EntityResponse, EntityUpdate, ObservationResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/investigations/{investigation_id}/entities", tags=["Entities"])

DB = Annotated[AsyncSession, Depends(get_db)]


def _to_entity_response(entity: Entity, observation_count: int = 0) -> EntityResponse:
    return EntityResponse(
        id=entity.id,
        investigation_id=entity.investigation_id,
        entity_type=entity.entity_type,
        value=entity.value,
        label=entity.label,
        notes=entity.notes,
        created_at=entity.created_at,
        updated_at=entity.updated_at,
        observation_count=observation_count,
    )


def _to_obs_response(obs: Observation) -> ObservationResponse:
    return ObservationResponse(
        id=obs.id,
        entity_id=obs.entity_id,
        source_id=obs.source_id,
        query_context=obs.query_context,
        status=obs.status,
        collected_at=obs.collected_at,
        duration_ms=obs.duration_ms,
        normalized_data=obs.normalized_data,
        error_detail=obs.error_detail,
    )


async def _inv_or_404(investigation_id: str, db: AsyncSession) -> Investigation:
    result = await db.execute(
        select(Investigation).where(Investigation.id == investigation_id)
    )
    inv = result.scalar_one_or_none()
    if inv is None:
        raise HTTPException(status_code=404, detail="Investigation not found")
    return inv


async def _entity_or_404(entity_id: str, investigation_id: str, db: AsyncSession) -> Entity:
    result = await db.execute(
        select(Entity).where(
            Entity.id == entity_id, Entity.investigation_id == investigation_id
        )
    )
    entity = result.scalar_one_or_none()
    if entity is None:
        raise HTTPException(status_code=404, detail="Entity not found")
    return entity


@router.post("", response_model=EntityResponse, status_code=status.HTTP_201_CREATED)
async def create_entity(
    investigation_id: str, body: EntityCreate, db: DB
) -> EntityResponse:
    await _inv_or_404(investigation_id, db)
    entity = Entity(
        investigation_id=investigation_id,
        entity_type=body.entity_type,
        value=body.value,
        label=body.label,
        notes=body.notes,
    )
    db.add(entity)
    await db.flush()
    await db.refresh(entity)
    logger.info("Created entity %s (%s: %s)", entity.id, entity.entity_type, entity.value)
    return _to_entity_response(entity, observation_count=0)


@router.get("", response_model=list[EntityResponse])
async def list_entities(investigation_id: str, db: DB) -> list[EntityResponse]:
    await _inv_or_404(investigation_id, db)
    result = await db.execute(
        select(Entity)
        .where(Entity.investigation_id == investigation_id)
        .order_by(Entity.created_at.desc())
    )
    entities = result.scalars().all()
    out = []
    for entity in entities:
        count_result = await db.execute(
            select(func.count()).where(Observation.entity_id == entity.id)
        )
        count = count_result.scalar() or 0
        out.append(_to_entity_response(entity, observation_count=count))
    return out


@router.get("/{entity_id}", response_model=EntityResponse)
async def get_entity(investigation_id: str, entity_id: str, db: DB) -> EntityResponse:
    entity = await _entity_or_404(entity_id, investigation_id, db)
    count_result = await db.execute(
        select(func.count()).where(Observation.entity_id == entity.id)
    )
    count = count_result.scalar() or 0
    return _to_entity_response(entity, observation_count=count)


@router.patch("/{entity_id}", response_model=EntityResponse)
async def update_entity(
    investigation_id: str, entity_id: str, body: EntityUpdate, db: DB
) -> EntityResponse:
    entity = await _entity_or_404(entity_id, investigation_id, db)
    if body.label is not None:
        entity.label = body.label
    if body.notes is not None:
        entity.notes = body.notes
    await db.flush()
    await db.refresh(entity)
    count_result = await db.execute(
        select(func.count()).where(Observation.entity_id == entity.id)
    )
    count = count_result.scalar() or 0
    return _to_entity_response(entity, observation_count=count)


@router.delete("/{entity_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_entity(investigation_id: str, entity_id: str, db: DB) -> None:
    entity = await _entity_or_404(entity_id, investigation_id, db)
    await db.delete(entity)


@router.get("/{entity_id}/observations", response_model=list[ObservationResponse])
async def list_observations(
    investigation_id: str, entity_id: str, db: DB
) -> list[ObservationResponse]:
    await _entity_or_404(entity_id, investigation_id, db)
    result = await db.execute(
        select(Observation)
        .where(Observation.entity_id == entity_id)
        .order_by(Observation.collected_at.desc())
    )
    observations = result.scalars().all()
    return [_to_obs_response(obs) for obs in observations]
