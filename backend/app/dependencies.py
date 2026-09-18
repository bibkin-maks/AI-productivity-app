from fastapi import Header, HTTPException
from jose import jwt, JWTError
from app.core.config import settings
from app.services.users import get_user_by_id

async def get_current_user(authorization: str = Header(None)):
    if not authorization:
        raise HTTPException(401, "Missing Authorization header")

    token = authorization.replace("Bearer ", "")

    # Phase 1: Extract user_id from unverified claims to look up the per-user
    # signing key (SECRET_KEY + jwt_secret). This is required because the signing
    # key is user-specific. The signature is fully verified in Phase 2.
    try:
        unverified = jwt.get_unverified_claims(token)
    except JWTError:
        raise HTTPException(401, "Invalid token format")

    user_id = unverified.get("user_id")
    if not user_id:
        raise HTTPException(401, "Token missing user_id claim")

    user = await get_user_by_id(user_id)
    if not user:
        raise HTTPException(401, "User not found")

    # Phase 2: Full cryptographic signature + expiry verification
    signing_key = settings.SECRET_KEY + user["jwt_secret"]
    try:
        jwt.decode(
            token,
            signing_key,
            algorithms=[settings.ALGORITHM],  # explicit — prevents algorithm confusion attacks
        )
    except JWTError:
        raise HTTPException(401, "Token invalid or expired")

    return user
