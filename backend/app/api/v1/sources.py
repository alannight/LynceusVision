"""Sources router — /api/v1/sources"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.models import Source
from app.schemas import SourceResponse

router = APIRouter(prefix="/sources", tags=["Sources"])
DB = Annotated[AsyncSession, Depends(get_db)]


@router.get("", response_model=list[SourceResponse])
async def list_sources(db: DB) -> list[SourceResponse]:
    result = await db.execute(select(Source).order_by(Source.id))
    sources = result.scalars().all()
    return [
        SourceResponse(
            id=s.id,
            display_name=s.display_name,
            description=s.description,
            source_url=s.source_url,
            enabled=s.enabled,
            status=s.status,
            created_at=s.created_at,
        )
        for s in sources
    ]
