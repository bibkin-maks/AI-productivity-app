from google.oauth2 import id_token
from google.auth.transport import requests
from jose import jwt, JWTError
from datetime import datetime, timedelta, timezone
from app.core.config import settings

def verify_google_token(token: str):
    try:
        idinfo = id_token.verify_oauth2_token(
            token, requests.Request(), settings.GOOGLE_CLIENT_ID
        )
        return {
            "sub": idinfo["sub"],
            "email": idinfo["email"],
            "name": idinfo.get("name"),
            "picture": idinfo.get("picture"),
        }
    except ValueError as e:
        # Do NOT log the full token — it is a credential
        print(f"Invalid Google token (first 10 chars): {token[:10]}... — {e}")
        return None

def create_jwt(user: dict):
    # User dict must contain _id, email, jwt_secret
    signing_key = settings.SECRET_KEY + user["jwt_secret"]
    payload = {
        "user_id": user["_id"],
        "email": user["email"],
        "exp": datetime.now(timezone.utc) + timedelta(days=settings.ACCESS_TOKEN_EXPIRE_DAYS),
        "iat": datetime.now(timezone.utc)
    }
    return jwt.encode(payload, signing_key, algorithm=settings.ALGORITHM)
