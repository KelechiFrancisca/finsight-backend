from flask import Blueprint, request, jsonify, current_app
from werkzeug.security import generate_password_hash, check_password_hash
from extensions import db
from models import User
import jwt, datetime

auth_bp = Blueprint("auth", __name__, url_prefix="/api")

@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.json
    # Capture username from frontend/curl and ensure fallback
    username = data.get("username") or data.get("name") or "default_user"
    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return jsonify({"error": "Email and password required"}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({"error": "Email already registered"}), 400

    hashed_pw = generate_password_hash(password)
    # ✅ Populate both name and username safely
    new_user = User(name=username, username=username, email=email, password_hash=hashed_pw)
    db.session.add(new_user)
    db.session.commit()

    token = jwt.encode(
        {"user_id": new_user.id, "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=1)},
        current_app.config["SECRET_KEY"],
        algorithm="HS256"
    )

    return jsonify({"message": "User registered successfully", "token": token}), 201

@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.json
    email = data.get("email")
    password = data.get("password")

    user = User.query.filter_by(email=email).first()
    if user and check_password_hash(user.password_hash, password):
        token = jwt.encode(
            {"user_id": user.id, "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=1)},
            current_app.config["SECRET_KEY"],
            algorithm="HS256"
        )
        return jsonify({"token": token}), 200
    return jsonify({"error": "Invalid credentials"}), 401

@auth_bp.route("/verify_token", methods=["POST"])
def verify_token():
    data = request.json
    token = data.get("token")

    if not token:
        return jsonify({"error": "Token required"}), 400

    try:
        decoded = jwt.decode(token, current_app.config["SECRET_KEY"], algorithms=["HS256"])
        return jsonify({"valid": True, "user_id": decoded["user_id"]})
    except jwt.ExpiredSignatureError:
        return jsonify({"valid": False, "error": "Token expired"}), 401
    except jwt.InvalidTokenError:
        return jsonify({"valid": False, "error": "Invalid token"}), 401

@auth_bp.route("/users/me", methods=["GET"])
def get_profile():
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        return jsonify({"error": "Authorization header required"}), 401

    token = auth_header.split(" ")[1]
    try:
        decoded = jwt.decode(token, current_app.config["SECRET_KEY"], algorithms=["HS256"])
        user = User.query.get(decoded["user_id"])
        if not user:
            return jsonify({"error": "User not found"}), 404
        return jsonify({"name": user.name, "username": user.username, "email": user.email, "role": "owner"})
    except Exception:
        return jsonify({"error": "Invalid token"}), 401

@auth_bp.route("/users/me", methods=["PUT"])
def update_profile():
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        return jsonify({"error": "Authorization header required"}), 401

    token = auth_header.split(" ")[1]
    try:
        decoded = jwt.decode(token, current_app.config["SECRET_KEY"], algorithms=["HS256"])
        user = User.query.get(decoded["user_id"])
        if not user:
            return jsonify({"error": "User not found"}), 404

        data = request.json
        user.name = data.get("name", user.name)
        user.username = data.get("username", user.username)
        user.email = data.get("email", user.email)
        db.session.commit()
        return jsonify({"message": "Profile updated successfully"})
    except Exception:
        return jsonify({"error": "Invalid token"}), 401
