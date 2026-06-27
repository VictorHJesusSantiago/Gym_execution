"""add composite index on training_sessions(user_id, executed_at DESC)

Revision ID: 0006_add_composite_index_sessions
Revises: 0005_add_updated_at
Create Date: 2026-06-19

O Postgres usava o índice simples em user_id para filtrar e depois ordenava
em disco — o índice composto (user_id, executed_at DESC) elimina o sort,
tornando a query de histórico paginado um Index-Only Scan.
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0006_add_composite_index_sessions"
down_revision: Union[str, None] = "0005_add_updated_at"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "ix_training_sessions_user_executed",
        "training_sessions",
        ["user_id", "executed_at"],
        postgresql_ops={"executed_at": "DESC"},
    )


def downgrade() -> None:
    op.drop_index("ix_training_sessions_user_executed", table_name="training_sessions")
