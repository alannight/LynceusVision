"""Add search_queries table for Dorking Studio

Revision ID: 002_add_search_queries
Revises: 001_initial_schema
Create Date: 2026-10-12 12:00:01.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "002_add_search_queries"
down_revision: str | None = "001_initial_schema"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Create search_queries table
    op.create_table(
        "search_queries",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "investigation_id",
            sa.String(length=36),
            sa.ForeignKey("investigations.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("query_text", sa.Text(), nullable=False),
        sa.Column("provider", sa.String(length=64), nullable=False, server_default="google"),
        sa.Column("category", sa.String(length=64), nullable=False, server_default="general"),
        sa.Column("structured_filters", sa.JSON(), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="READY_TO_OPEN"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    )


def downgrade() -> None:
    op.drop_table("search_queries")
