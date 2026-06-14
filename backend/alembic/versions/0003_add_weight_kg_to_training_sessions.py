"""add weight_kg to training_sessions

Permite registrar a carga (kg) usada em cada série, opcional, para
acompanhar progressão de carga ao longo do tempo (ver app/src/screens/
HistoryScreen.tsx e backend/app/schemas/session.py).

Revision ID: 0003_add_weight_kg_to_training_sessions
Revises: 0002_seed_exercise_catalog
Create Date: 2026-06-14

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0003_add_weight_kg_to_training_sessions"
down_revision: Union[str, None] = "0002_seed_exercise_catalog"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("training_sessions", sa.Column("weight_kg", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("training_sessions", "weight_kg")
