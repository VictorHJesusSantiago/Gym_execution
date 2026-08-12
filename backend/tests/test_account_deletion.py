"""Exclusão de conta (LGPD art. 18 / GDPR art. 17).

Não existia caminho algum para o titular eliminar os próprios dados, apesar de
o cadastro guardar e-mail, peso, altura, objetivo e histórico de treino.
"""

from app.models.exercise import Exercise
from app.models.training_session import TrainingSession
from app.models.user import User


def _seed_exercise(db_session) -> None:
    db_session.add(Exercise(id="agachamento", name="Agachamento", muscle_group="pernas"))
    db_session.commit()


def test_delete_requires_authentication(client):
    assert client.delete("/users/me").status_code == 403


def test_delete_removes_the_user_row(client, auth_headers, db_session):
    headers = auth_headers(email="apagar@example.com")

    response = client.delete("/users/me", headers=headers)

    assert response.status_code == 204
    assert db_session.query(User).filter_by(email="apagar@example.com").first() is None


def test_delete_removes_the_training_history(client, auth_headers, db_session):
    _seed_exercise(db_session)
    headers = auth_headers(email="apagar@example.com")
    client.post(
        "/sessions",
        json={"exercise_id": "agachamento", "score": 80, "executed_at": "2026-06-01T10:00:00Z"},
        headers=headers,
    )
    assert db_session.query(TrainingSession).count() == 1

    client.delete("/users/me", headers=headers)

    db_session.expire_all()
    assert db_session.query(TrainingSession).count() == 0


def test_the_access_token_stops_working_after_deletion(client, auth_headers):
    headers = auth_headers(email="apagar@example.com")

    client.delete("/users/me", headers=headers)

    assert client.get("/users/me", headers=headers).status_code == 401


def test_refresh_tokens_are_revoked_after_deletion(client, login_tokens):
    tokens = login_tokens(email="apagar@example.com")
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    client.delete("/users/me", headers=headers)

    assert client.post("/auth/refresh", json={"refresh_token": tokens["refresh_token"]}).status_code == 401


def test_the_email_can_be_reused_after_deletion(client, auth_headers):
    """Eliminação de verdade, não soft delete: se a linha continuasse no banco,
    a constraint de unicidade impediria o novo cadastro e denunciaria que o dado
    nunca foi apagado."""
    headers = auth_headers(email="apagar@example.com")
    client.delete("/users/me", headers=headers)

    again = client.post(
        "/auth/register",
        json={"name": "Outra Pessoa", "email": "apagar@example.com", "password": "senha-forte-123"},
    )

    assert again.status_code == 201


def test_deleting_one_account_leaves_other_users_untouched(client, auth_headers, db_session):
    _seed_exercise(db_session)
    victim = auth_headers(name="A", email="a@example.com")
    bystander = auth_headers(name="B", email="b@example.com")
    client.post(
        "/sessions",
        json={"exercise_id": "agachamento", "score": 90, "executed_at": "2026-06-01T10:00:00Z"},
        headers=bystander,
    )

    client.delete("/users/me", headers=victim)

    assert client.get("/users/me", headers=bystander).status_code == 200
    assert len(client.get("/sessions", headers=bystander).json()) == 1
