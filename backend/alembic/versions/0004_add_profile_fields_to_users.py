"""add profile fields to users

Permite editar peso, altura, objetivo e nível de experiência no perfil,
opcional (ver app/src/screens/ProfileScreen.tsx e backend/app/schemas/auth.py).

Revision ID: 0004_add_profile_fields_to_users
Revises: 0003_add_weight_kg_to_training_sessions
Create Date: 2026-06-14

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0004_add_profile_fields_to_users"
down_revision: Union[str, None] = "0003_add_weight_kg_to_training_sessions"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("weight_kg", sa.Float(), nullable=True))
    op.add_column("users", sa.Column("height_cm", sa.Float(), nullable=True))
    op.add_column("users", sa.Column("goal", sa.String(length=255), nullable=True))
    op.add_column("users", sa.Column("experience_level", sa.String(length=20), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "experience_level")
    op.drop_column("users", "goal")
    op.drop_column("users", "height_cm")
    op.drop_column("users", "weight_kg")
