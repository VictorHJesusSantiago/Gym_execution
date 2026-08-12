"""Fitness function: o catálogo embutido no app não pode divergir do seed.

Por que este teste existe: `app/src/services/exerciseCatalog.ts` mantinha uma
lista própria de ids (`squat`, `pushup`, `deadlift`, `shoulder_press`) que NÃO
existiam no seed do backend (`agachamento`, `flexao-de-braco`, ...). Como
`exercise_id` é FK obrigatória, todo `POST /sessions` disparado pelo app
devolvia 422 — histórico, estatísticas e conquistas ficavam permanentemente
vazios, e cada resultado ia silenciosamente para a fila offline, que nunca
drenava. Nenhuma das duas suítes percebia, porque cada lado testava só a si
mesmo com os seus próprios ids.

Duas listas em repositórios diferentes SEMPRE divergem sem uma verificação
automática ligando as duas. Este é o teste mais barato que fecha esse buraco:
se alguém acrescentar um exercício de um lado só, ele falha.
"""

import re
from pathlib import Path

import pytest

from .test_exercise_catalog_seed import SEED_EXERCISES

_APP_CATALOG = (
    Path(__file__).resolve().parents[2] / "app" / "src" / "services" / "exerciseCatalog.ts"
)

# Casa `id: 'algum-id'` dentro do literal EXERCISES. Regex em vez de parser de
# TypeScript de propósito: a estrutura é uma lista de literais estável, e uma
# dependência nova (ou um Node no CI do backend) custaria mais do que resolve.
_ID_PATTERN = re.compile(r"\bid:\s*'([^']+)'")


def _app_exercise_ids() -> list[str]:
    return _ID_PATTERN.findall(_APP_CATALOG.read_text(encoding="utf-8"))


@pytest.mark.skipif(not _APP_CATALOG.exists(), reason="app/ não está presente neste checkout")
def test_every_exercise_id_bundled_in_the_app_exists_in_the_seed():
    seed_ids = {exercise["id"] for exercise in SEED_EXERCISES}
    app_ids = _app_exercise_ids()

    assert app_ids, f"nenhum id encontrado em {_APP_CATALOG.name} — o formato do arquivo mudou?"

    unknown = sorted(set(app_ids) - seed_ids)
    assert not unknown, (
        f"ids no catálogo do app que não existem no seed do backend: {unknown}. "
        "POST /sessions vai devolver 422 para todos eles (FK de exercise_id)."
    )


@pytest.mark.skipif(not _APP_CATALOG.exists(), reason="app/ não está presente neste checkout")
def test_the_app_offers_every_seeded_exercise():
    """O outro lado da divergência: exercício seedado que o app nunca mostra é
    trabalho de catálogo invisível para o usuário."""
    seed_ids = {exercise["id"] for exercise in SEED_EXERCISES}

    missing = sorted(seed_ids - set(_app_exercise_ids()))
    assert not missing, f"exercícios no seed que o app não lista: {missing}"
