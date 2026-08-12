from app.models.exercise import Exercise


def _seed_exercise(db_session, exercise_id: str = "agachamento") -> None:
    db_session.add(Exercise(id=exercise_id, name="Agachamento", muscle_group="pernas"))
    db_session.commit()


def test_list_exercises_returns_catalog(client, db_session):
    _seed_exercise(db_session)

    response = client.get("/exercises")

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["id"] == "agachamento"


def test_get_exercise_returns_404_for_unknown_id(client):
    response = client.get("/exercises/nao-existe")

    assert response.status_code == 404


def test_get_exercise_returns_existing_exercise(client, db_session):
    _seed_exercise(db_session)

    response = client.get("/exercises/agachamento")

    assert response.status_code == 200
    assert response.json()["name"] == "Agachamento"


def test_update_reference_model_requires_admin_key(client, db_session):
    _seed_exercise(db_session)

    response = client.put(
        "/exercises/agachamento/reference-model",
        json={"reference_model_uri": "https://cdn.example.com/agachamento.json"},
    )

    # Credencial ausente é falha de autenticação (401), não de validação de
    # schema: com `Header(...)` obrigatório o FastAPI devolvia 422 com um corpo
    # descrevendo o header esperado. O teste seguinte cobre a chave errada (403).
    assert response.status_code == 401


def test_update_reference_model_rejects_wrong_admin_key(client, db_session):
    _seed_exercise(db_session)

    response = client.put(
        "/exercises/agachamento/reference-model",
        json={"reference_model_uri": "https://cdn.example.com/agachamento.json"},
        headers={"X-Admin-Api-Key": "chave-errada"},
    )

    assert response.status_code == 403


def test_update_reference_model_accepts_correct_admin_key(client, db_session):
    from app.core.config import settings

    _seed_exercise(db_session)

    response = client.put(
        "/exercises/agachamento/reference-model",
        json={"reference_model_uri": "https://cdn.example.com/agachamento.json"},
        headers={"X-Admin-Api-Key": settings.admin_api_key},
    )

    assert response.status_code == 200
    assert response.json()["reference_model_uri"] == "https://cdn.example.com/agachamento.json"
