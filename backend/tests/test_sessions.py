from app.models.exercise import Exercise


def _create_exercise(db_session, exercise_id: str = "agachamento") -> None:
    db_session.add(Exercise(id=exercise_id, name="Agachamento", muscle_group="pernas"))
    db_session.commit()


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
    # O contrato não expõe nada além de id/exercise_id/score/executed_at —
    # garante que vídeo bruto nunca faz parte da resposta (ARCHITECTURE.md seção 5).
    assert set(body.keys()) == {"id", "exercise_id", "score", "executed_at"}


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
