"""seed initial exercise catalog

Sem isto, uma instalação nova fica com `GET /exercises` vazio — o app
não tem o que listar em `ExerciseListScreen` nem como gravar sessões
(`exercise_id` é uma FK obrigatória). Estes são os exercícios "base"
citados como exemplo em ARCHITECTURE.md/UX_PLAN.md; o catálogo real
cresce depois via processo administrativo (ver
backend/pipeline/publish_reference.py), não por migration.

`reference_model_uri` fica nulo — é preenchido depois pelo pipeline de
ingestão via `PUT /exercises/{id}/reference-model` (endpoint admin).

Revision ID: 0002_seed_exercise_catalog
Revises: 0001_initial_schema
Create Date: 2026-06-07

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0002_seed_exercise_catalog"
down_revision: Union[str, None] = "0001_initial_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Tabela "leve" (só as colunas necessárias para o seed) — evita importar
# os modelos ORM da aplicação dentro de uma migration, prática recomendada
# pelo Alembic para manter migrations estáveis mesmo se os modelos mudarem.
exercises_table = sa.table(
    "exercises",
    sa.column("id", sa.String),
    sa.column("name", sa.String),
    sa.column("muscle_group", sa.String),
    sa.column("description", sa.Text),
)

SEED_EXERCISES = [
    {
        "id": "agachamento",
        "name": "Agachamento",
        "muscle_group": "pernas",
        "description": "Flexão e extensão de joelhos e quadris mantendo a coluna neutra.",
    },
    {
        "id": "flexao-de-braco",
        "name": "Flexão de braço",
        "muscle_group": "peito",
        "description": "Flexão e extensão dos cotovelos em prancha, mantendo o corpo alinhado.",
    },
    {
        "id": "levantamento-terra",
        "name": "Levantamento terra",
        "muscle_group": "posterior",
        "description": "Extensão de quadril e joelhos erguendo a carga do chão com a coluna neutra.",
    },
    {
        "id": "prancha-abdominal",
        "name": "Prancha abdominal",
        "muscle_group": "core",
        "description": "Sustentação isométrica do tronco alinhado, apoiado nos antebraços e pés.",
    },
    {
        "id": "afundo",
        "name": "Afundo (lunge)",
        "muscle_group": "pernas",
        "description": "Passo à frente flexionando ambos os joelhos a ~90°, alternando as pernas.",
    },
]


def upgrade() -> None:
    op.bulk_insert(exercises_table, SEED_EXERCISES)


def downgrade() -> None:
    ids = [exercise["id"] for exercise in SEED_EXERCISES]
    op.execute(exercises_table.delete().where(exercises_table.c.id.in_(ids)))
