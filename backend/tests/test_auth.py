def test_register_creates_user(client):
    response = client.post(
        "/auth/register",
        json={"name": "Ana", "email": "ana@example.com", "password": "senha-forte-123"},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Ana"
    assert body["email"] == "ana@example.com"
    assert "password" not in body
    assert "password_hash" not in body


def test_register_rejects_duplicate_email(client):
    payload = {"name": "Ana", "email": "ana@example.com", "password": "senha-forte-123"}
    client.post("/auth/register", json=payload)

    response = client.post("/auth/register", json={**payload, "name": "Outra Ana"})

    assert response.status_code == 409


def test_login_returns_token_for_valid_credentials(client):
    client.post(
        "/auth/register",
        json={"name": "Ana", "email": "ana@example.com", "password": "senha-forte-123"},
    )

    response = client.post("/auth/login", json={"email": "ana@example.com", "password": "senha-forte-123"})

    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert len(body["access_token"]) > 0


def test_login_rejects_wrong_password(client):
    client.post(
        "/auth/register",
        json={"name": "Ana", "email": "ana@example.com", "password": "senha-forte-123"},
    )

    response = client.post("/auth/login", json={"email": "ana@example.com", "password": "senha-errada"})

    assert response.status_code == 401


def test_login_rejects_unknown_email(client):
    response = client.post("/auth/login", json={"email": "fantasma@example.com", "password": "qualquer"})

    assert response.status_code == 401
