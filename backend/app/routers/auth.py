from fastapi import APIRouter, HTTPException, Depends
from app.core.security import verify_google_token, create_jwt
from app.services.users import get_or_create_user, sign_out_user
from app.dependencies import get_current_user

router = APIRouter()

@router.post("/userauth/")
async def user_auth(user_data: dict):
    token = user_data.get("token")
    if not token:
        raise HTTPException(400, "Token required")

    idinfo = verify_google_token(token)
    if not idinfo:
        raise HTTPException(401, "Invalid Google token")

    user_record = await get_or_create_user(idinfo)
    jwt_token = create_jwt(user_record)
    return {"token": jwt_token, "user": user_record}

@router.post("/signout/")
async def user_signout(current_user: dict = Depends(get_current_user)):
    await sign_out_user(current_user["_id"])
    return {"message": "Signed out"}

@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    current_user.pop("jwt_secret", None)
    # Strip raw PDF chunks from response — saves hundreds of KB per request
    if "document" in current_user and isinstance(current_user["document"], dict):
        current_user["document"] = {"name": current_user["document"].get("name", "")}
    return current_user

@router.delete("/messages/clear")
async def clear_messages(current_user: dict = Depends(get_current_user)):
    from app.db.client import get_collection
    users = get_collection("users")
    await users.update_one(
        {"_id": current_user["_id"]},
        {"$set": {"messages": []}}
    )
    return {"message": "History cleared"}
