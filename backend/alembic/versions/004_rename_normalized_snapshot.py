"""Clarify that stored connector payloads are normalized snapshots.

Revision ID: 004_rename_normalized_snapshot
Revises: 003_users_and_ownership
"""

from collections.abc import Sequence

from alembic import op

revision: str = "004_rename_normalized_snapshot"
down_revision: str | None = "003_users_and_ownership"
branch_labels: str | Sequence[str] | None = None
depends_on: str | None = None


def upgrade() -> None:
    with op.batch_alter_table("observations") as batch:
        batch.alter_column("raw_response", new_column_name="normalized_snapshot")


def downgrade() -> None:
    with op.batch_alter_table("observations") as batch:
        batch.alter_column("normalized_snapshot", new_column_name="raw_response")
