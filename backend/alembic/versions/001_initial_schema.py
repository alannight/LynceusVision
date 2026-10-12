"""Initial schema for LynceusVision

Revision ID: 001_initial_schema
Revises: None
Create Date: 2026-10-12 12:00:00.000000

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "001_initial_schema"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. investigations
    op.create_table(
        "investigations",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # 2. entities
    op.create_table(
        "entities",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "investigation_id",
            sa.String(length=36),
            sa.ForeignKey("investigations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("entity_type", sa.String(length=32), nullable=False),
        sa.Column("value", sa.String(length=2048), nullable=False),
        sa.Column("label", sa.String(length=255), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("investigation_id", "entity_type", "value", name="uq_entity_per_investigation"),
    )

    # 3. sources
    op.create_table(
        "sources",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("display_name", sa.String(length=128), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("source_url", sa.String(length=512), nullable=True),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # 4. observations
    op.create_table(
        "observations",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "entity_id",
            sa.String(length=36),
            sa.ForeignKey("entities.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "source_id",
            sa.String(length=64),
            sa.ForeignKey("sources.id"),
            nullable=False,
        ),
        sa.Column("query_context", sa.String(length=2048), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="OK"),
        sa.Column("collected_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column("normalized_data", sa.JSON(), nullable=True),
        sa.Column("raw_response", sa.Text(), nullable=True),
        sa.Column("error_detail", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("observations")
    op.drop_table("sources")
    op.drop_table("entities")
    op.drop_table("investigations")
