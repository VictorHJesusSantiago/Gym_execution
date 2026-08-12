"""Rotação e revogação de refresh token (POST /auth/refresh, /auth/logout).

Estes dois endpoints existiam sem NENHUM teste — nem sequer um que chamasse a
rota. São o caminho que decide por quanto tempo uma credencial vazada continua
valendo, então merecem a cobertura mais explícita da suíte.
"""


def test_login_returns_a_refresh_token_alongside_the_access_token(client):
    client.post(
        "/auth/register",
        json={"name": "Ana", "email": "ana@example.com", "password": "senha-forte-123"},
    )

    body = client.post("/auth/login", json={"email": "ana@example.com", "password": "senha-forte-123"}).json()

    assert body["token_type"] == "bearer"
    assert len(body["access_token"]) > 0
    assert len(body["refresh_token"]) > 0
    assert body["access_token"] != body["refresh_token"]


def test_refresh_returns_a_new_pair_and_the_access_token_works(client, login_tokens):
    tokens = login_tokens()

    response = client.post("/auth/refresh", json={"refresh_token": tokens["refresh_token"]})

    assert response.status_code == 200
    refreshed = response.json()
    assert refreshed["refresh_token"] != tokens["refresh_token"], "o refresh token deve rotacionar"

    profile = client.get("/users/me", headers={"Authorization": f"Bearer {refreshed['access_token']}"})
    assert profile.status_code == 200


def test_refresh_rejects_an_unknown_token(client):
    response = client.post("/auth/refresh", json={"refresh_token": "nao-existe"})

    assert response.status_code == 401


def test_rotated_refresh_token_stops_working(client, login_tokens):
    tokens = login_tokens()
    client.post("/auth/refresh", json={"refresh_token": tokens["refresh_token"]})

    replay = client.post("/auth/refresh", json={"refresh_token": tokens["refresh_token"]})

    assert replay.status_code == 401


def test_replaying_a_rotated_token_revokes_every_active_session(client, login_tokens):
    """Detecção de reuso: o token antigo reaparecendo significa vazamento até
    prova em contrário, então a família inteira cai (OAuth 2.0 Security BCP).
    Sem isso, quem roubasse um refresh token seguia renovando indefinidamente,
    porque a rotação sozinha invalida o token usado mas não denuncia o ladrão."""
    stolen = login_tokens()
    legitimate = client.post("/auth/refresh", json={"refresh_token": stolen["refresh_token"]}).json()

    # O atacante replica o token que a vítima já rotacionou.
    replay = client.post("/auth/refresh", json={"refresh_token": stolen["refresh_token"]})
    assert replay.status_code == 401

    # O token BOM da vítima também deve ter morrido: na dúvida, derruba tudo.
    after_revocation = client.post("/auth/refresh", json={"refresh_token": legitimate["refresh_token"]})
    assert after_revocation.status_code == 401


def test_logout_revokes_the_refresh_token(client, login_tokens):
    tokens = login_tokens()

    logout = client.post("/auth/logout", json={"refresh_token": tokens["refresh_token"]})

    assert logout.status_code == 204
    assert client.post("/auth/refresh", json={"refresh_token": tokens["refresh_token"]}).status_code == 401


def test_logout_is_idempotent(client, login_tokens):
    """Um retry de rede no logout não pode virar erro nem disparar a revogação
    total por ser confundido com reuso — ver `revoke_refresh_token`."""
    tokens = login_tokens()

    assert client.post("/auth/logout", json={"refresh_token": tokens["refresh_token"]}).status_code == 204
    assert client.post("/auth/logout", json={"refresh_token": tokens["refresh_token"]}).status_code == 204


def test_logout_of_one_device_does_not_sign_out_the_others(client, login_tokens):
    first_device = login_tokens()
    second_device = client.post(
        "/auth/login", json={"email": "rota@example.com", "password": "senha-forte-123"}
    ).json()

    client.post("/auth/logout", json={"refresh_token": first_device["refresh_token"]})

    still_valid = client.post("/auth/refresh", json={"refresh_token": second_device["refresh_token"]})
    assert still_valid.status_code == 200


def test_logout_also_revokes_the_access_token(client, login_tokens):
    """"Sair" precisa encerrar a sessão de verdade.

    Antes o logout só matava o refresh token; o access token seguia aceito por
    até `jwt_expire_minutes` (30 min), então quem tivesse copiado o valor —
    de um log, de um proxy, de um backup — continuava autenticado bem depois
    de o usuário achar que tinha encerrado tudo.
    """
    tokens = login_tokens()
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}
    assert client.get("/users/me", headers=headers).status_code == 200

    client.post("/auth/logout", json={"refresh_token": tokens["refresh_token"]}, headers=headers)

    assert client.get("/users/me", headers=headers).status_code == 401


def test_logout_works_without_an_access_token(client, login_tokens):
    """O Authorization é opcional no logout: com o access token já expirado é
    justamente quando mais se quer encerrar a sessão."""
    tokens = login_tokens()

    assert client.post("/auth/logout", json={"refresh_token": tokens["refresh_token"]}).status_code == 204


def test_logout_of_one_device_does_not_revoke_another_devices_access_token(client, login_tokens):
    first = login_tokens()
    second = client.post(
        "/auth/login", json={"email": "rota@example.com", "password": "senha-forte-123"}
    ).json()

    client.post(
        "/auth/logout",
        json={"refresh_token": first["refresh_token"]},
        headers={"Authorization": f"Bearer {first['access_token']}"},
    )

    still_valid = client.get("/users/me", headers={"Authorization": f"Bearer {second['access_token']}"})
    assert still_valid.status_code == 200


def test_access_token_carries_a_unique_jti(client, login_tokens):
    """Sem `jti` não há como nomear qual token revogar — é o que tornava o
    access token irrevogável."""
    import jwt

    from app.core.config import settings

    first = jwt.decode(
        login_tokens(email="a@example.com")["access_token"],
        settings.jwt_secret_key,
        algorithms=[settings.jwt_algorithm],
    )
    second = jwt.decode(
        login_tokens(email="b@example.com")["access_token"],
        settings.jwt_secret_key,
        algorithms=[settings.jwt_algorithm],
    )

    assert first["jti"] and second["jti"]
    assert first["jti"] != second["jti"]


def test_refresh_token_is_never_stored_in_plaintext(client, login_tokens, fake_redis):
    """O Redis deve guardar só o SHA-256 do token: um dump do storage não pode
    render credenciais utilizáveis de 30 dias (ver `_fingerprint`)."""
    tokens = login_tokens()

    stored = {**fake_redis._strings}
    assert stored, "o refresh token deveria ter sido persistido"
    assert tokens["refresh_token"] not in " ".join(stored.keys())
    assert tokens["refresh_token"] not in " ".join(stored.values())
