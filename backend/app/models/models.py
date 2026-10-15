"""SQLAlchemy ORM models for LynceusVision."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import (
    JSON,
    DateTime,
    ForeignKey,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _new_uuid() -> str:
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_uuid)
    username: Mapped[str] = mapped_column(String(128), nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(String(512), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, server_default=func.now()
    )


# ─── Investigation ────────────────────────────────────────────────────────────


class Investigation(Base):
    __tablename__ = "investigations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_uuid)
    owner_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="active",
        server_default="active",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, server_default=func.now()
    )

    entities: Mapped[list[Entity]] = relationship(
        "Entity", back_populates="investigation", cascade="all, delete-orphan"
    )
    search_queries: Mapped[list[SearchQuery]] = relationship(
        "SearchQuery", back_populates="investigation", cascade="all, delete-orphan"
    )


# ─── Entity ───────────────────────────────────────────────────────────────────


class Entity(Base):
    __tablename__ = "entities"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_uuid)
    investigation_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("investigations.id", ondelete="CASCADE"), nullable=False
    )
    entity_type: Mapped[str] = mapped_column(
        String(32), nullable=False
    )  # domain, ip, email, url, hash, person, org
    value: Mapped[str] = mapped_column(String(2048), nullable=False)
    label: Mapped[str | None] = mapped_column(String(255), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, server_default=func.now()
    )

    investigation: Mapped[Investigation] = relationship("Investigation", back_populates="entities")
    observations: Mapped[list[Observation]] = relationship(
        "Observation", back_populates="entity", cascade="all, delete-orphan"
    )

    __table_args__ = (
        UniqueConstraint(
            "investigation_id", "entity_type", "value", name="uq_entity_per_investigation"
        ),
    )


# ─── Source / Connector Registry ──────────────────────────────────────────────


class Source(Base):
    __tablename__ = "sources"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)  # e.g. "rdap", "dns", "crtsh"
    display_name: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    enabled: Mapped[bool] = mapped_column(default=True, server_default="1")
    status: Mapped[str] = mapped_column(String(32), default="active", server_default="active")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, server_default=func.now()
    )

    observations: Mapped[list[Observation]] = relationship("Observation", back_populates="source")


# ─── Observation (Evidence) ────────────────────────────────────────────────────


class Observation(Base):
    """
    A single collection event from a connector.
    Preserves source attribution, query context, timestamp, and raw response.
    """

    __tablename__ = "observations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_uuid)
    entity_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("entities.id", ondelete="CASCADE"), nullable=False
    )
    source_id: Mapped[str] = mapped_column(String(64), ForeignKey("sources.id"), nullable=False)
    query_context: Mapped[str] = mapped_column(
        String(2048), nullable=False
    )  # exact query sent to connector
    status: Mapped[str] = mapped_column(
        String(32), nullable=False, default="OK"
    )  # OK | EMPTY | TIMEOUT | RATE_LIMITED | AUTH_ERROR | PROVIDER_ERROR | SSRF_BLOCKED
    collected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, server_default=func.now()
    )
    duration_ms: Mapped[int | None] = mapped_column(nullable=True)
    normalized_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    normalized_snapshot: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_detail: Mapped[str | None] = mapped_column(Text, nullable=True)

    entity: Mapped[Entity] = relationship("Entity", back_populates="observations")
    source: Mapped[Source] = relationship("Source", back_populates="observations")


# ─── Search Query (Dorking Studio) ────────────────────────────────────────────


class SearchQuery(Base):
    """
    Search queries constructed or executed via Dorking Studio.
    Persists structured filters, finalized query string, target provider,
    and investigation association.
    """

    __tablename__ = "search_queries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_uuid)
    owner_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )
    investigation_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("investigations.id", ondelete="CASCADE"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    query_text: Mapped[str] = mapped_column(Text, nullable=False)
    provider: Mapped[str] = mapped_column(
        String(64), nullable=False, default="google", server_default="google"
    )
    category: Mapped[str] = mapped_column(
        String(64), nullable=False, default="general", server_default="general"
    )
    structured_filters: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="READY_TO_OPEN",
        server_default="READY_TO_OPEN",
    )  # DRAFT | READY_TO_OPEN | OPENED_BY_USER
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, server_default=func.now()
    )

    investigation: Mapped[Investigation | None] = relationship(
        "Investigation", back_populates="search_queries"
    )
