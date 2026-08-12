"""Idempotência de POST /sessions.

O app grava resultados numa fila local quando está offline e drena depois. Se a
resposta se perdesse DEPOIS do commit no servidor (rede caindo, timeout de 15s
do apiClient), a mesma série era regravada a cada nova tentativa e o histórico
ganhava duplicatas que o usuário não tem como remover.
"""

from app.models.exercise import Exercise

_PAYLOAD = {"exercise_id": "agachamento", "score": 87, "executed_at": "2026-06-01T10:00:00Z"}


def _seed_exercise(db_session) -> None:
    db_session.add(Exercise(id="agachamento", name="Agachamento", muscle_group="pernas"))
    db_session.commit()


def test_the_same_key_creates_only_one_session(client, auth_headers, db_session):
    _seed_exercise(db_session)
    headers = {**auth_headers(), "Idempotency-Key": "serie-123"}

    first = client.post("/sessions", json=_PAYLOAD, headers=headers)
    second = client.post("/sessions", json=_PAYLOAD, headers=headers)

    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["id"] == second.json()["id"], "o retry deve devolver a MESMA sessão"
    assert len(client.get("/sessions", headers=headers).json()) == 1


def test_different_keys_create_different_sessions(client, auth_headers, db_session):
    """Duas séries iguais feitas de verdade continuam sendo duas séries."""
    _seed_exercise(db_session)
    headers = auth_headers()

    client.post("/sessions", json=_PAYLOAD, headers={**headers, "Idempotency-Key": "serie-1"})
    client.post("/sessions", json=_PAYLOAD, headers={**headers, "Idempotency-Key": "serie-2"})

    assert len(client.get("/sessions", headers=headers).json()) == 2


def test_without_the_header_the_behaviour_is_unchanged(client, auth_headers, db_session):
    """O header é opcional: clientes antigos seguem funcionando."""
    _seed_exercise(db_session)
    headers = auth_headers()

    client.post("/sessions", json=_PAYLOAD, headers=headers)
    client.post("/sessions", json=_PAYLOAD, headers=headers)

    assert len(client.get("/sessions", headers=headers).json()) == 2


def test_the_key_is_scoped_per_user(client, auth_headers, db_session):
    """Chave igual vinda de outra conta não pode devolver a sessão alheia —
    seria vazamento de dado de treino para quem adivinhasse uma chave."""
    _seed_exercise(db_session)
    first_user = {**auth_headers(name="A", email="a@example.com"), "Idempotency-Key": "mesma-chave"}
    second_user = {**auth_headers(name="B", email="b@example.com"), "Idempotency-Key": "mesma-chave"}

    created_by_first = client.post("/sessions", json=_PAYLOAD, headers=first_user).json()
    created_by_second = client.post("/sessions", json=_PAYLOAD, headers=second_user).json()

    assert created_by_first["id"] != created_by_second["id"]
