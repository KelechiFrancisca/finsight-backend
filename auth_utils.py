# auth_utils.py
import jwt
from flask import current_app

def verify_token_and_get_user(token: str):
    """
    Decode JWT token and return the user_id.
    Returns None if token is invalid or expired.
    """
    if not token:
        return None
    try:
        payload = jwt.decode(
            token,
            current_app.config["SECRET_KEY"],
            algorithms=["HS256"]
        )
        return payload.get("user_id")
    except Exception:
        return None
