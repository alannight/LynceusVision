"""Pydantic schemas for LynceusVision API."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

# ─── Common ────────────────────────────────────────────────────────────────────


class ErrorResponse(BaseModel):
    error: str
    code: str
    detail: str | None = None


# ─── Investigation ─────────────────────────────────────────────────────────────


class InvestigationCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: str | None = Field(None, max_length=4000)


class InvestigationUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = Field(None, max_length=4000)
    status: Literal["active", "archived", "closed"] | None = None


class InvestigationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    description: str | None
    status: str
    created_at: datetime
    updated_at: datetime
    entity_count: int = 0


# ─── Entity ────────────────────────────────────────────────────────────────────


VALID_ENTITY_TYPES = {"domain", "ip", "email", "url", "hash", "person", "org", "phone"}


class EntityCreate(BaseModel):
    entity_type: str = Field(..., description="domain | ip | email | url | hash | person | org")
    value: str = Field(..., min_length=1, max_length=2048)
    label: str | None = Field(None, max_length=255)
    notes: str | None = Field(None, max_length=4000)

    @field_validator("entity_type")
    @classmethod
    def validate_entity_type(cls, v: str) -> str:
        if v not in VALID_ENTITY_TYPES:
            raise ValueError(f"entity_type must be one of {sorted(VALID_ENTITY_TYPES)}")
        return v


class EntityUpdate(BaseModel):
    label: str | None = Field(None, max_length=255)
    notes: str | None = Field(None, max_length=4000)


class EntityResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    investigation_id: str
    entity_type: str
    value: str
    label: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime
    observation_count: int = 0


# ─── Source ────────────────────────────────────────────────────────────────────


class SourceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    display_name: str
    description: str | None
    source_url: str | None
    enabled: bool
    status: str
    created_at: datetime


# ─── Observation ───────────────────────────────────────────────────────────────


class ObservationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    entity_id: str
    source_id: str
    query_context: str
    status: str
    collected_at: datetime
    duration_ms: int | None
    normalized_data: dict[str, Any] | None
    error_detail: str | None


# ─── Search / Collect ──────────────────────────────────────────────────────────


class CollectRequest(BaseModel):
    target: str = Field(..., min_length=1, max_length=2048, description="Domain, IP, or URL to investigate")
    connectors: list[str] | None = Field(
        None, description="Connector IDs to use. Null means all enabled connectors."
    )
    save_to_investigation_id: str | None = Field(
        None, description="If provided, results are saved as entities and observations."
    )


class ConnectorResult(BaseModel):
    connector_id: str
    status: Literal["OK", "EMPTY", "TIMEOUT", "RATE_LIMITED", "AUTH_ERROR", "PROVIDER_ERROR", "SSRF_BLOCKED", "VALIDATION_ERROR"]
    query: str
    collected_at: datetime
    duration_ms: int
    data: dict[str, Any] | None = None
    error: str | None = None


class CollectResponse(BaseModel):
    target: str
    results: list[ConnectorResult]
