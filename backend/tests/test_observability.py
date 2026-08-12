"""Correlação de logs e métricas RED.

Antes não havia NADA disto: um erro relatado por um usuário não era rastreável
até uma linha de log, e não existia forma de medir taxa/erro/latência por rota.
"""

from app.core.config import settings
from app.core.logging import REQUEST_ID_HEADER, reset_metrics


def test_every_response_carries_a_request_id(client):
    response = client.get("/health/live")

    assert response.headers.get(REQUEST_ID_HEADER)


def test_a_client_supplied_request_id_is_preserved(client):
    """Permite seguir um rastro que começou no app até a linha de log da API."""
    response = client.get("/health/live", headers={REQUEST_ID_HEADER: "rastro-do-app-123"})

    assert response.headers[REQUEST_ID_HEADER] == "rastro-do-app-123"


def test_each_request_gets_its_own_id(client):
    first = client.get("/health/live").headers[REQUEST_ID_HEADER]
    second = client.get("/health/live").headers[REQUEST_ID_HEADER]

    assert first != second


def test_metrics_require_the_admin_key(client):
    assert client.get("/metrics").status_code == 401
    assert client.get("/metrics", headers={"X-Admin-Api-Key": "errada"}).status_code == 403


def test_metrics_expose_rate_and_duration_per_route(client):
    reset_metrics()
    client.get("/health/live")

    body = client.get("/metrics", headers={"X-Admin-Api-Key": settings.admin_api_key}).text

    assert 'http_requests_total{method="GET",route="/health/live",status="200"} 1' in body
    assert 'http_request_duration_ms_count{method="GET",route="/health/live"}' in body


def test_metrics_label_routes_by_template_not_by_concrete_path(client, db_session):
    """Rotular pelo caminho concreto criaria uma série temporal por id — custo
    explosivo e identificadores de usuário virando rótulo de métrica."""
    reset_metrics()
    client.get("/exercises/agachamento")
    client.get("/exercises/flexao-de-braco")

    body = client.get("/metrics", headers={"X-Admin-Api-Key": settings.admin_api_key}).text

    assert 'route="/exercises/{exercise_id}"' in body
    assert "agachamento" not in body
