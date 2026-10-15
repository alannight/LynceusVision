"""Add user accounts and investigation ownership without deleting legacy data.

Revision ID: 003_users_and_ownership
Revises: 002_add_search_queries
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "003_users_and_ownership"
down_revision: str | None = "002_add_search_queries"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("username", sa.String(length=128), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(length=512), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    )
    with op.batch_alter_table("investigations") as batch:
        batch.add_column(sa.Column("owner_id", sa.String(length=36), nullable=True))
        batch.create_foreign_key(
            "fk_investigations_owner_id_users", "users", ["owner_id"], ["id"], ondelete="CASCADE"
        )
        batch.create_index("ix_investigations_owner_id", ["owner_id"])
    with op.batch_alter_table("search_queries") as batch:
        batch.add_column(sa.Column("owner_id", sa.String(length=36), nullable=True))
        batch.create_foreign_key(
            "fk_search_queries_owner_id_users", "users", ["owner_id"], ["id"], ondelete="CASCADE"
        )
        batch.create_index("ix_search_queries_owner_id", ["owner_id"])


def downgrade() -> None:
    with op.batch_alter_table("search_queries") as batch:
        batch.drop_index("ix_search_queries_owner_id")
        batch.drop_constraint("fk_search_queries_owner_id_users", type_="foreignkey")
        batch.drop_column("owner_id")
    with op.batch_alter_table("investigations") as batch:
        batch.drop_index("ix_investigations_owner_id")
        batch.drop_constraint("fk_investigations_owner_id_users", type_="foreignkey")
        batch.drop_column("owner_id")
    op.drop_table("users")
