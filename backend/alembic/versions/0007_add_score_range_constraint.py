"""add CHECK constraint on training_sessions.score (0-100)

A faixa 0-100 (RN03/DOM06 do README.md raiz) era garantida apenas por
`Field(ge=0, le=100)` no Pydantic — ou seja, só no caminho HTTP. Qualquer
escrita fora do router (migration de dados, script de manutenção, correção
manual) podia gravar um score fora da faixa, e o app renderiza esse número
direto como porcentagem.

Espelha `__table_args__` em app/models/training_session.py — os dois precisam
mudar juntos.

A migration limpa linhas já fora da faixa antes de criar a constraint: sem
isso, `ALTER TABLE ... ADD CONSTRAINT` falha em bancos existentes e o deploy
trava no `alembic upgrade head` do entrypoint.

Revision ID: 0007_add_score_range_constraint
Revises: 0006_add_composite_index_sessions
Create Date: 2026-08-04
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0007_add_score_range_constraint"
down_revision: Union[str, None] = "0006_add_composite_index_sessions"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_CONSTRAINT_NAME = "ck_training_sessions_score_range"


def upgrade() -> None:
    op.execute("UPDATE training_sessions SET score = 0 WHERE score < 0")
    op.execute("UPDATE training_sessions SET score = 100 WHERE score > 100")
    op.create_check_constraint(
        _CONSTRAINT_NAME,
        "training_sessions",
        "score >= 0 AND score <= 100",
    )


def downgrade() -> None:
    op.drop_constraint(_CONSTRAINT_NAME, "training_sessions", type_="check")
