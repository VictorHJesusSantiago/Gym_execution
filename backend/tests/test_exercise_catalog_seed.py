"""Sanidade dos dados do seed inicial do catálogo (migration 0002).

Não testa a migration em si rodando Alembic (faria mais sentido na suíte
de integração contra Postgres real, ver INTEGRATION_TESTING_PLAN.md) —
só garante que a lista de exercícios seedados é internamente consistente,
evitando erros de digitação/duplicação que só apareceriam ao rodar
`alembic upgrade head` contra um banco de verdade.
"""

import importlib.util
from pathlib import Path

# Carrega o módulo da migration diretamente do arquivo (não via `import
# alembic.versions...`): o diretório local `backend/alembic/` não é um
# pacote Python regular (sem `__init__.py` — Alembic carrega migrations
# do seu próprio jeito) e colidiria com o pacote `alembic` instalado.
_MIGRATION_PATH = (
    Path(__file__).resolve().parent.parent / "alembic" / "versions" / "0002_seed_exercise_catalog.py"
)
_spec = importlib.util.spec_from_file_location("seed_migration_0002", _MIGRATION_PATH)
seed_module = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(seed_module)

SEED_EXERCISES = seed_module.SEED_EXERCISES


def test_seed_has_at_least_one_exercise_per_major_muscle_group():
    groups = {exercise["muscle_group"] for exercise in SEED_EXERCISES}

    assert {"pernas", "peito", "core", "posterior"}.issubset(groups)


def test_seed_ids_are_unique_and_url_safe():
    ids = [exercise["id"] for exercise in SEED_EXERCISES]

    assert len(ids) == len(set(ids)), "ids duplicados no seed"
    for exercise_id in ids:
        assert exercise_id == exercise_id.lower(), f"id {exercise_id!r} deveria ser minúsculo"
        assert " " not in exercise_id, f"id {exercise_id!r} não deveria ter espaços (vai para a URL)"


def test_seed_exercises_have_required_fields():
    for exercise in SEED_EXERCISES:
        assert exercise["name"].strip(), f"exercício {exercise['id']!r} sem nome"
        assert exercise["muscle_group"].strip(), f"exercício {exercise['id']!r} sem grupo muscular"
        assert exercise["description"].strip(), f"exercício {exercise['id']!r} sem descrição"
