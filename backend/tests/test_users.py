def test_get_my_profile_requires_authentication(client):
    response = client.get("/users/me")

    assert response.status_code == 403  # HTTPBearer sem credenciais


def test_get_my_profile_returns_current_user(client, auth_headers):
    headers = auth_headers(name="Maria Teste", email="maria@example.com")

    response = client.get("/users/me", headers=headers)

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Maria Teste"
    assert body["email"] == "maria@example.com"


def test_update_my_profile_changes_name(client, auth_headers):
    headers = auth_headers()

    response = client.put("/users/me", json={"name": "Novo Nome"}, headers=headers)

    assert response.status_code == 200
    assert response.json()["name"] == "Novo Nome"

    # A mudança persiste para chamadas seguintes (não é só o retorno do PUT).
    profile = client.get("/users/me", headers=headers)
    assert profile.json()["name"] == "Novo Nome"


def test_update_my_profile_requires_authentication(client):
    response = client.put("/users/me", json={"name": "Novo Nome"})

    assert response.status_code == 403


def test_update_my_profile_sets_physical_profile_fields(client, auth_headers):
    headers = auth_headers()

    response = client.put(
        "/users/me",
        json={
            "name": "Maria Teste",
            "weight_kg": 65.5,
            "height_cm": 168,
            "goal": "Ganhar massa muscular",
            "experience_level": "intermediate",
        },
        headers=headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["weight_kg"] == 65.5
    assert body["height_cm"] == 168
    assert body["goal"] == "Ganhar massa muscular"
    assert body["experience_level"] == "intermediate"

    # A mudança persiste para chamadas seguintes (não é só o retorno do PUT).
    profile = client.get("/users/me", headers=headers)
    assert profile.json()["weight_kg"] == 65.5
    assert profile.json()["experience_level"] == "intermediate"


def test_update_my_profile_rejects_invalid_experience_level(client, auth_headers):
    headers = auth_headers()

    response = client.put(
        "/users/me",
        json={"name": "Maria Teste", "experience_level": "expert"},
        headers=headers,
    )

    assert response.status_code == 422
