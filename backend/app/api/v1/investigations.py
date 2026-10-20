"""Investigations CRUD router — /api/v1/investigations"""

from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.models import Entity, Investigation, User
from app.schemas import (
    InvestigationCreate,
    InvestigationResponse,
    InvestigationUpdate,
)
from app.security.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/investigations", tags=["Investigations"])

DB = Annotated[AsyncSession, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]


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
async def create_investigation(
    body: InvestigationCreate, db: DB, user: CurrentUser
) -> InvestigationResponse:
    inv = Investigation(owner_id=user.id, title=body.title, description=body.description)
    db.add(inv)
    await db.flush()
    await db.refresh(inv)
    logger.info("Created investigation %s: %r", inv.id, inv.title)
    return _to_response(inv, entity_count=0)


@router.get("", response_model=list[InvestigationResponse])
async def list_investigations(
    db: DB,
    user: CurrentUser,
    limit: int = Query(50, ge=1, le=100, description="Max investigations to return"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
) -> list[InvestigationResponse]:
    entity_counts = (
        select(Entity.investigation_id, func.count(Entity.id).label("count"))
        .group_by(Entity.investigation_id)
        .subquery()
    )
    stmt = (
        select(Investigation, func.coalesce(entity_counts.c.count, 0).label("entity_count"))
        .outerjoin(entity_counts, Investigation.id == entity_counts.c.investigation_id)
        .where(Investigation.owner_id == user.id)
        .order_by(Investigation.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(stmt)
    rows = result.all()
    return [_to_response(inv, entity_count=count) for inv, count in rows]


@router.get("/{investigation_id}", response_model=InvestigationResponse)
async def get_investigation(
    investigation_id: str, db: DB, user: CurrentUser
) -> InvestigationResponse:
    inv = await _get_or_404(investigation_id, db, user.id)
    count_result = await db.execute(select(func.count()).where(Entity.investigation_id == inv.id))
    count = count_result.scalar() or 0
    return _to_response(inv, entity_count=count)


@router.patch("/{investigation_id}", response_model=InvestigationResponse)
async def update_investigation(
    investigation_id: str, body: InvestigationUpdate, db: DB, user: CurrentUser
) -> InvestigationResponse:
    inv = await _get_or_404(investigation_id, db, user.id)
    if body.title is not None:
        inv.title = body.title
    if body.description is not None:
        inv.description = body.description
    if body.status is not None:
        inv.status = body.status
    await db.flush()
    await db.refresh(inv)
    count_result = await db.execute(select(func.count()).where(Entity.investigation_id == inv.id))
    count = count_result.scalar() or 0
    return _to_response(inv, entity_count=count)


@router.delete("/{investigation_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_investigation(investigation_id: str, db: DB, user: CurrentUser) -> None:
    inv = await _get_or_404(investigation_id, db, user.id)
    await db.delete(inv)
    logger.info("Deleted investigation %s", investigation_id)


async def _get_or_404(investigation_id: str, db: AsyncSession, owner_id: str) -> Investigation:
    result = await db.execute(
        select(Investigation).where(
            Investigation.id == investigation_id, Investigation.owner_id == owner_id
        )
    )
    inv = result.scalar_one_or_none()
    if inv is None:
        raise HTTPException(status_code=404, detail="Investigation not found")
    return inv
