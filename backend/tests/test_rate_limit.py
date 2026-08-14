import pytest
from fastapi.testclient import TestClient

from app.core.rate_limit import AUTH_RATE_LIMIT, limiter
from app.main import app


@pytest.fixture()
def rate_limited_client():
    """`conftest.py` desliga o limiter globalmente para o resto da suíte
    (ver comentário lá) — aqui religamos só para este teste.

    Tudo dentro do `try`: `limiter.reset()` ficava FORA dele, então quando o
    reset falhava (era o caso, porque o storage apontava para um Redis
    inexistente) o `finally` nunca rodava e o limiter continuava LIGADO pelo
    resto da sessão — test_sessions.py e test_users.py quebravam em massa por
    causa de uma falha em test_rate_limit.py. Estado global mutável só é
    aceitável em teste se a restauração for inescapável.
    """
    limiter.enabled = True
    try:
        limiter.reset()
        with TestClient(app) as test_client:
            yield test_client
    finally:
        limiter.enabled = False
        limiter.reset()


def _attempts_allowed() -> int:
    return int(AUTH_RATE_LIMIT.split("/")[0])


def test_login_is_rate_limited_per_ip(rate_limited_client: TestClient):
    payload = {"email": "alguem@example.com", "password": "senha-errada"}
    limit = _attempts_allowed()

    for _ in range(limit):
        response = rate_limited_client.post("/auth/login", json=payload)
        assert response.status_code == 401

    blocked = rate_limited_client.post("/auth/login", json=payload)

    assert blocked.status_code == 429
    assert "rate limit" in blocked.json()["error"].lower()


def test_register_is_rate_limited_per_ip(rate_limited_client: TestClient):
    limit = _attempts_allowed()

    for index in range(limit):
        response = rate_limited_client.post(
            "/auth/register",
            json={"name": f"Usuário {index}", "email": f"user{index}@example.com", "password": "senha-forte-123"},
        )
        assert response.status_code in (201, 409)

    blocked = rate_limited_client.post(
        "/auth/register",
        json={"name": "Bloqueado", "email": "bloqueado@example.com", "password": "senha-forte-123"},
    )

    assert blocked.status_code == 429
