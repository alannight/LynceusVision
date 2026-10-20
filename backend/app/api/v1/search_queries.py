"""Search queries (Dorking Studio) endpoints."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated, Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.models import Investigation, SearchQuery, User
from app.security.auth import get_current_user

router = APIRouter(prefix="/search-queries", tags=["search-queries"])
CurrentUser = Annotated[User, Depends(get_current_user)]
DB = Annotated[AsyncSession, Depends(get_db)]

VALID_SEARCH_PROVIDERS = {"google", "bing", "duckduckgo", "brave", "custom"}
VALID_SEARCH_CATEGORIES = {
    "general",
    "website",
    "document",
    "username",
    "person_name",
    "organization",
    "location_place",
    "custom",
}
VALID_SEARCH_STATUSES = {"DRAFT", "READY_TO_OPEN", "OPENED_BY_USER", "OPENED", "SAVED"}


# Pydantic schemas
class SearchQueryBase(BaseModel):
    investigation_id: str | None = None
    title: str = Field(..., min_length=1, max_length=255)
    query_text: str = Field(..., min_length=1)
    provider: str = Field(default="google")
    category: str = Field(default="general")
    structured_filters: dict[str, Any] | None = None
    status: str = Field(default="READY_TO_OPEN")

    @field_validator("provider")
    @classmethod
    def validate_provider(cls, v: str) -> str:
        if v not in VALID_SEARCH_PROVIDERS:
            raise ValueError(f"provider must be one of {sorted(VALID_SEARCH_PROVIDERS)}")
        return v

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        if v not in VALID_SEARCH_CATEGORIES:
            raise ValueError(f"category must be one of {sorted(VALID_SEARCH_CATEGORIES)}")
        return v

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in VALID_SEARCH_STATUSES:
            raise ValueError(f"status must be one of {sorted(VALID_SEARCH_STATUSES)}")
        return v


class SearchQueryCreate(SearchQueryBase):
    pass


class SearchQueryUpdate(BaseModel):
    investigation_id: str | None = None
    title: str | None = Field(None, min_length=1, max_length=255)
    query_text: str | None = Field(None, min_length=1)
    provider: str | None = None
    category: str | None = None
    structured_filters: dict[str, Any] | None = None
    status: str | None = None

    @field_validator("provider")
    @classmethod
    def validate_provider(cls, v: str | None) -> str | None:
        if v is not None and v not in VALID_SEARCH_PROVIDERS:
            raise ValueError(f"provider must be one of {sorted(VALID_SEARCH_PROVIDERS)}")
        return v

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str | None) -> str | None:
        if v is not None and v not in VALID_SEARCH_CATEGORIES:
            raise ValueError(f"category must be one of {sorted(VALID_SEARCH_CATEGORIES)}")
        return v

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str | None) -> str | None:
        if v is not None and v not in VALID_SEARCH_STATUSES:
            raise ValueError(f"status must be one of {sorted(VALID_SEARCH_STATUSES)}")
        return v


class SearchQueryResponse(SearchQueryBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    created_at: datetime
    updated_at: datetime


# CRUD endpoints
@router.get("", response_model=list[SearchQueryResponse])
async def get_search_queries(
    user: CurrentUser,
    session: DB,
    investigation_id: str | None = Query(None, description="Filter by investigation ID"),
    limit: int = Query(50, ge=1, le=100, description="Max search queries to return"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
) -> list[SearchQueryResponse]:
    """Get all search queries, optionally filtered by investigation."""
    query = (
        select(SearchQuery)
        .where(SearchQuery.owner_id == user.id)
        .order_by(SearchQuery.created_at.desc())
        .offset(offset)
        .limit(limit)
    )

    if investigation_id:
        query = query.where(SearchQuery.investigation_id == investigation_id)

    result = await session.execute(query)
    queries = result.scalars().all()
    return [SearchQueryResponse.model_validate(q) for q in queries]


@router.get("/{query_id}", response_model=SearchQueryResponse)
async def get_search_query(
    query_id: str,
    user: CurrentUser,
    session: DB,
) -> SearchQueryResponse:
    """Get a specific search query by ID."""
    query = select(SearchQuery).where(SearchQuery.id == query_id, SearchQuery.owner_id == user.id)
    result = await session.execute(query)
    search_query = result.scalar_one_or_none()

    if not search_query:
        raise HTTPException(status_code=404, detail="Search query not found")

    return SearchQueryResponse.model_validate(search_query)


@router.post("", response_model=SearchQueryResponse, status_code=201)
async def create_search_query(
    data: SearchQueryCreate,
    user: CurrentUser,
    session: DB,
) -> SearchQueryResponse:
    """Create a new search query."""
    # Validate investigation exists if provided
    if data.investigation_id:
        investigation_query = select(Investigation).where(
            Investigation.id == data.investigation_id, Investigation.owner_id == user.id
        )
        investigation_result = await session.execute(investigation_query)
        investigation = investigation_result.scalar_one_or_none()

        if not investigation:
            raise HTTPException(status_code=404, detail="Investigation not found")

    # Create new search query
    search_query = SearchQuery(
        id=str(uuid4()),
        owner_id=user.id,
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
    user: CurrentUser,
    session: DB,
) -> SearchQueryResponse:
    """Update an existing search query."""
    query = select(SearchQuery).where(SearchQuery.id == query_id, SearchQuery.owner_id == user.id)
    result = await session.execute(query)
    search_query = result.scalar_one_or_none()

    if not search_query:
        raise HTTPException(status_code=404, detail="Search query not found")

    # Validate investigation exists if provided
    if data.investigation_id is not None:
        if data.investigation_id:
            investigation_query = select(Investigation).where(
                Investigation.id == data.investigation_id, Investigation.owner_id == user.id
            )
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


@router.delete("/{query_id}", status_code=204, response_model=None)
async def delete_search_query(
    query_id: str,
    user: CurrentUser,
    session: DB,
) -> None:
    """Delete a search query."""
    query = select(SearchQuery).where(SearchQuery.id == query_id, SearchQuery.owner_id == user.id)
    result = await session.execute(query)
    search_query = result.scalar_one_or_none()

    if not search_query:
        raise HTTPException(status_code=404, detail="Search query not found")

    await session.delete(search_query)
    await session.commit()
