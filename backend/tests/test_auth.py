from jose import jwt

from app.core.config import settings
from app.routers import auth as auth_router


async def test_requests_without_a_token_are_rejected(api):
    assert (await api.get("/me")).status_code == 401


async def test_malformed_token_is_rejected(api):
    response = await api.get("/me", headers={"Authorization": "Bearer not-a-jwt"})
    assert response.status_code == 401


async def test_me_never_exposes_the_signing_secret(api, make_user):
    _, headers = await make_user()
    body = (await api.get("/me", headers=headers)).json()
    assert body["email"] == "user-1@example.com"
    assert "jwt_secret" not in body


async def test_token_signed_with_another_users_key_is_rejected(api, make_user):
    alice, _ = await make_user("alice")
    await make_user("bob")
    # Alice's key, but claiming to be Bob: the per-user secret must not match
    forged = jwt.encode({"user_id": "bob", "email": "x"}, settings.SECRET_KEY + alice["jwt_secret"], algorithm="HS256")
    response = await api.get("/me", headers={"Authorization": f"Bearer {forged}"})
    assert response.status_code == 401


async def test_signing_out_invalidates_existing_tokens(api, make_user):
    _, headers = await make_user()
    assert (await api.post("/signout/", headers=headers)).status_code == 200
    assert (await api.get("/me", headers=headers)).status_code == 401


async def test_google_sign_in_creates_user_without_leaking_secret(api, monkeypatch):
    monkeypatch.setattr(auth_router, "verify_google_token", lambda token: {
        "sub": "google-123", "email": "new@example.com", "name": "New User", "picture": None,
    })
    response = await api.post("/userauth/", json={"token": "google-id-token"})
    assert response.status_code == 200
    body = response.json()
    assert body["user"]["email"] == "new@example.com"
    assert "jwt_secret" not in body["user"]

    me = await api.get("/me", headers={"Authorization": f"Bearer {body['token']}"})
    assert me.status_code == 200 and me.json()["_id"] == "google-123"


async def test_invalid_google_token_is_rejected(api, monkeypatch):
    monkeypatch.setattr(auth_router, "verify_google_token", lambda token: None)
    assert (await api.post("/userauth/", json={"token": "bad"})).status_code == 401
    assert (await api.post("/userauth/", json={})).status_code == 400
