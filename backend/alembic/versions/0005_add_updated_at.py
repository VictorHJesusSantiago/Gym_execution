"""add updated_at to all tables

Revision ID: 0005_add_updated_at
Revises: 0004_add_profile_fields_to_users
Create Date: 2026-06-19
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0005_add_updated_at"
down_revision: Union[str, None] = "0004_add_profile_fields_to_users"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_TABLES = ("users", "exercises", "training_sessions")


def upgrade() -> None:
    for table in _TABLES:
        op.add_column(
            table,
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        )
        op.execute(f"UPDATE {table} SET updated_at = created_at WHERE updated_at IS NULL")


def downgrade() -> None:
    for table in _TABLES:
        op.drop_column(table, "updated_at")
