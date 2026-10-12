"""Investigations CRUD router — /api/v1/investigations"""
from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.models import Entity, Investigation
from app.schemas import (
    InvestigationCreate,
    InvestigationResponse,
    InvestigationUpdate,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/investigations", tags=["Investigations"])

DB = Annotated[AsyncSession, Depends(get_db)]


def _to_response(inv: Investigation, entity_count: int = 0) -> InvestigationResponse:
    return InvestigationResponse(
        id=inv.id,
        title=inv.title,
        description=inv.description,
        status=inv.status,
        created_at=inv.created_at,
        updated_at=inv.updated_at,
        entity_count=entity_count,
    )


@router.post("", response_model=InvestigationResponse, status_code=status.HTTP_201_CREATED)
async def create_investigation(body: InvestigationCreate, db: DB) -> InvestigationResponse:
    inv = Investigation(title=body.title, description=body.description)
    db.add(inv)
    await db.flush()
    await db.refresh(inv)
    logger.info("Created investigation %s: %r", inv.id, inv.title)
    return _to_response(inv, entity_count=0)


@router.get("", response_model=list[InvestigationResponse])
async def list_investigations(db: DB) -> list[InvestigationResponse]:
    result = await db.execute(select(Investigation).order_by(Investigation.created_at.desc()))
    investigations = result.scalars().all()
    out = []
    for inv in investigations:
        count_result = await db.execute(
            select(func.count()).where(Entity.investigation_id == inv.id)
        )
        count = count_result.scalar() or 0
        out.append(_to_response(inv, entity_count=count))
    return out


@router.get("/{investigation_id}", response_model=InvestigationResponse)
async def get_investigation(investigation_id: str, db: DB) -> InvestigationResponse:
    inv = await _get_or_404(investigation_id, db)
    count_result = await db.execute(
        select(func.count()).where(Entity.investigation_id == inv.id)
    )
    count = count_result.scalar() or 0
    return _to_response(inv, entity_count=count)


@router.patch("/{investigation_id}", response_model=InvestigationResponse)
async def update_investigation(
    investigation_id: str, body: InvestigationUpdate, db: DB
) -> InvestigationResponse:
    inv = await _get_or_404(investigation_id, db)
    if body.title is not None:
        inv.title = body.title
    if body.description is not None:
        inv.description = body.description
    if body.status is not None:
        inv.status = body.status
    await db.flush()
    await db.refresh(inv)
    count_result = await db.execute(
        select(func.count()).where(Entity.investigation_id == inv.id)
    )
    count = count_result.scalar() or 0
    return _to_response(inv, entity_count=count)


@router.delete("/{investigation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_investigation(investigation_id: str, db: DB) -> None:
    inv = await _get_or_404(investigation_id, db)
    await db.delete(inv)
    logger.info("Deleted investigation %s", investigation_id)


async def _get_or_404(investigation_id: str, db: AsyncSession) -> Investigation:
    result = await db.execute(
        select(Investigation).where(Investigation.id == investigation_id)
    )
    inv = result.scalar_one_or_none()
    if inv is None:
        raise HTTPException(status_code=404, detail="Investigation not found")
    return inv
