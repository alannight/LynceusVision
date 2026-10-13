"""Search queries (Dorking Studio) endpoints."""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, List, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.models import Investigation, SearchQuery

router = APIRouter(prefix="/search-queries", tags=["search-queries"])


# Pydantic schemas
class SearchQueryBase(BaseModel):
    investigation_id: Optional[str] = None
    title: str = Field(..., min_length=1, max_length=255)
    query_text: str = Field(..., min_length=1)
    provider: str = Field(default="google")
    category: str = Field(default="general")
    structured_filters: Optional[dict[str, Any]] = None
    status: str = Field(default="READY_TO_OPEN")


class SearchQueryCreate(SearchQueryBase):
    pass


class SearchQueryUpdate(BaseModel):
    investigation_id: Optional[str] = None
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    query_text: Optional[str] = Field(None, min_length=1)
    provider: Optional[str] = None
    category: Optional[str] = None
    structured_filters: Optional[dict[str, Any]] = None
    status: Optional[str] = None


class SearchQueryResponse(SearchQueryBase):
    id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# CRUD endpoints
@router.get("/", response_model=List[SearchQueryResponse])
async def get_search_queries(
    investigation_id: Optional[str] = Query(None, description="Filter by investigation ID"),
    session: AsyncSession = Depends(get_db),
) -> List[SearchQueryResponse]:
    """Get all search queries, optionally filtered by investigation."""
    query = select(SearchQuery).order_by(SearchQuery.created_at.desc())
    
    if investigation_id:
        query = query.where(SearchQuery.investigation_id == investigation_id)
    
    result = await session.execute(query)
    queries = result.scalars().all()
    return [SearchQueryResponse.model_validate(q) for q in queries]


@router.get("/{query_id}", response_model=SearchQueryResponse)
async def get_search_query(
    query_id: str,
    session: AsyncSession = Depends(get_db),
) -> SearchQueryResponse:
    """Get a specific search query by ID."""
    query = select(SearchQuery).where(SearchQuery.id == query_id)
    result = await session.execute(query)
    search_query = result.scalar_one_or_none()
    
    if not search_query:
        raise HTTPException(status_code=404, detail="Search query not found")
    
    return SearchQueryResponse.model_validate(search_query)


@router.post("/", response_model=SearchQueryResponse, status_code=201)
async def create_search_query(
    data: SearchQueryCreate,
    session: AsyncSession = Depends(get_db),
) -> SearchQueryResponse:
    """Create a new search query."""
    # Validate investigation exists if provided
    if data.investigation_id:
        investigation_query = select(Investigation).where(Investigation.id == data.investigation_id)
        investigation_result = await session.execute(investigation_query)
        investigation = investigation_result.scalar_one_or_none()
        
        if not investigation:
            raise HTTPException(status_code=404, detail="Investigation not found")
    
    # Create new search query
    search_query = SearchQuery(
        id=str(uuid4()),
        investigation_id=data.investigation_id,
        title=data.title,
        query_text=data.query_text,
        provider=data.provider,
        category=data.category,
        structured_filters=data.structured_filters,
        status=data.status,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    
    session.add(search_query)
    await session.commit()
    await session.refresh(search_query)
    
    return SearchQueryResponse.model_validate(search_query)


@router.patch("/{query_id}", response_model=SearchQueryResponse)
async def update_search_query(
    query_id: str,
    data: SearchQueryUpdate,
    session: AsyncSession = Depends(get_db),
) -> SearchQueryResponse:
    """Update an existing search query."""
    query = select(SearchQuery).where(SearchQuery.id == query_id)
    result = await session.execute(query)
    search_query = result.scalar_one_or_none()
    
    if not search_query:
        raise HTTPException(status_code=404, detail="Search query not found")
    
    # Validate investigation exists if provided
    if data.investigation_id is not None:
        if data.investigation_id:
            investigation_query = select(Investigation).where(Investigation.id == data.investigation_id)
            investigation_result = await session.execute(investigation_query)
            investigation = investigation_result.scalar_one_or_none()
            
            if not investigation:
                raise HTTPException(status_code=404, detail="Investigation not found")
        search_query.investigation_id = data.investigation_id
    
    # Update fields
    if data.title is not None:
        search_query.title = data.title
    if data.query_text is not None:
        search_query.query_text = data.query_text
    if data.provider is not None:
        search_query.provider = data.provider
    if data.category is not None:
        search_query.category = data.category
    if data.structured_filters is not None:
        search_query.structured_filters = data.structured_filters
    if data.status is not None:
        search_query.status = data.status
    
    search_query.updated_at = datetime.now(UTC)
    
    await session.commit()
    await session.refresh(search_query)
    
    return SearchQueryResponse.model_validate(search_query)


@router.delete("/{query_id}", status_code=204)
async def delete_search_query(
    query_id: str,
    session: AsyncSession = Depends(get_db),
) -> None:
    """Delete a search query."""
    query = select(SearchQuery).where(SearchQuery.id == query_id)
    result = await session.execute(query)
    search_query = result.scalar_one_or_none()
    
    if not search_query:
        raise HTTPException(status_code=404, detail="Search query not found")
    
    await session.delete(search_query)
    await session.commit()