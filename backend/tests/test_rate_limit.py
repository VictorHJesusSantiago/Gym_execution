import pytest
from fastapi.testclient import TestClient

from app.core.rate_limit import AUTH_RATE_LIMIT, limiter
from app.main import app


@pytest.fixture()
def rate_limited_client():
    """`conftest.py` desliga o limiter globalmente para o resto da suíte
    (ver comentário lá) — aqui religamos só para este teste e garantimos
    que volta a ficar desligado ao final, mesmo se o teste falhar."""
    limiter.enabled = True
    limiter.reset()
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        limiter.enabled = False


def _attempts_allowed() -> int:
    # AUTH_RATE_LIMIT está no formato "N/minute" — extrai o N.
    return int(AUTH_RATE_LIMIT.split("/")[0])


def test_login_is_rate_limited_per_ip(rate_limited_client: TestClient):
    payload = {"email": "alguem@example.com", "password": "senha-errada"}
    limit = _attempts_allowed()

    for _ in range(limit):
        response = rate_limited_client.post("/auth/login", json=payload)
        assert response.status_code == 401  # credenciais inválidas, mas dentro do limite

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
        assert response.status_code in (201, 409)  # 409 se o e-mail já existir não conta como bloqueio

    blocked = rate_limited_client.post(
        "/auth/register",
        json={"name": "Bloqueado", "email": "bloqueado@example.com", "password": "senha-forte-123"},
    )

    assert blocked.status_code == 429
