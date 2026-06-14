from datetime import datetime, timedelta, timezone

from app.models.exercise import Exercise


def _create_exercise(db_session, exercise_id: str = "agachamento") -> None:
    db_session.add(Exercise(id=exercise_id, name="Agachamento", muscle_group="pernas"))
    db_session.commit()


def _days_ago(days: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()


def test_record_session_requires_authentication(client):
    response = client.post(
        "/sessions",
        json={"exercise_id": "agachamento", "score": 80, "executed_at": "2026-06-01T10:00:00Z"},
    )

    assert response.status_code == 403


def test_record_session_stores_only_score_and_metadata(client, auth_headers, db_session):
    _create_exercise(db_session)
    headers = auth_headers()

    response = client.post(
        "/sessions",
        json={"exercise_id": "agachamento", "score": 87, "executed_at": "2026-06-01T10:00:00Z"},
        headers=headers,
    )

    assert response.status_code == 201
    body = response.json()
    assert body["exercise_id"] == "agachamento"
    assert body["score"] == 87
    assert body["weight_kg"] is None
    # O contrato não expõe nada além de id/exercise_id/score/executed_at/
    # weight_kg — garante que vídeo bruto nunca faz parte da resposta
    # (README.md seção 5).
    assert set(body.keys()) == {"id", "exercise_id", "score", "executed_at", "weight_kg"}


def test_record_session_accepts_optional_weight_kg(client, auth_headers, db_session):
    _create_exercise(db_session)
    headers = auth_headers()

    response = client.post(
        "/sessions",
        json={
            "exercise_id": "agachamento",
            "score": 87,
            "executed_at": "2026-06-01T10:00:00Z",
            "weight_kg": 42.5,
        },
        headers=headers,
    )

    assert response.status_code == 201
    assert response.json()["weight_kg"] == 42.5


def test_record_session_rejects_negative_weight_kg(client, auth_headers, db_session):
    _create_exercise(db_session)
    headers = auth_headers()

    response = client.post(
        "/sessions",
        json={
            "exercise_id": "agachamento",
            "score": 87,
            "executed_at": "2026-06-01T10:00:00Z",
            "weight_kg": -5,
        },
        headers=headers,
    )

    assert response.status_code == 422


def test_record_session_rejects_score_out_of_range(client, auth_headers, db_session):
    _create_exercise(db_session)
    headers = auth_headers()

    response = client.post(
        "/sessions",
        json={"exercise_id": "agachamento", "score": 150, "executed_at": "2026-06-01T10:00:00Z"},
        headers=headers,
    )

    assert response.status_code == 422


def test_list_my_sessions_returns_only_own_sessions_newest_first(client, auth_headers, db_session):
    _create_exercise(db_session)
    headers_a = auth_headers(name="Usuária A", email="a@example.com")
    headers_b = auth_headers(name="Usuário B", email="b@example.com")

    client.post(
        "/sessions",
        json={"exercise_id": "agachamento", "score": 70, "executed_at": "2026-06-01T10:00:00Z"},
        headers=headers_a,
    )
    client.post(
        "/sessions",
        json={"exercise_id": "agachamento", "score": 90, "executed_at": "2026-06-03T10:00:00Z"},
        headers=headers_a,
    )
    client.post(
        "/sessions",
        json={"exercise_id": "agachamento", "score": 50, "executed_at": "2026-06-02T10:00:00Z"},
        headers=headers_b,
    )

    response = client.get("/sessions", headers=headers_a)

    assert response.status_code == 200
    scores = [item["score"] for item in response.json()]
    assert scores == [90, 70]  # só as sessões da usuária A, da mais recente para a mais antiga


def test_list_my_sessions_supports_pagination(client, auth_headers, db_session):
    _create_exercise(db_session)
    headers = auth_headers()

    for day, score in enumerate([60, 70, 80, 90, 100], start=1):
        client.post(
            "/sessions",
            json={"exercise_id": "agachamento", "score": score, "executed_at": f"2026-06-0{day}T10:00:00Z"},
            headers=headers,
        )

    first_page = client.get("/sessions", params={"limit": 2, "offset": 0}, headers=headers)
    second_page = client.get("/sessions", params={"limit": 2, "offset": 2}, headers=headers)

    assert [item["score"] for item in first_page.json()] == [100, 90]
    assert [item["score"] for item in second_page.json()] == [80, 70]


def test_list_my_sessions_rejects_out_of_range_pagination_params(client, auth_headers):
    headers = auth_headers()

    assert client.get("/sessions", params={"limit": 0}, headers=headers).status_code == 422
    assert client.get("/sessions", params={"limit": 101}, headers=headers).status_code == 422
    assert client.get("/sessions", params={"offset": -1}, headers=headers).status_code == 422


def test_list_my_sessions_defaults_to_first_twenty(client, auth_headers, db_session):
    _create_exercise(db_session)
    headers = auth_headers()

    for day in range(1, 26):
        client.post(
            "/sessions",
            json={"exercise_id": "agachamento", "score": 50, "executed_at": _days_ago(day)},
            headers=headers,
        )

    response = client.get("/sessions", headers=headers)

    assert len(response.json()) == 20
