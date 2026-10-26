from flask import Blueprint, request, jsonify
from extensions import db
from models import Entry
from auth_utils import verify_token_and_get_user
from alerts_utils import generate_alerts_for_user   # ✅ import helper

entries_bp = Blueprint("entries", __name__)

# ✅ Get all entries
@entries_bp.route("/entries", methods=["GET"])
def get_entries():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_id = verify_token_and_get_user(token)
    if not user_id:
        return jsonify({"error": "Invalid token"}), 401

    entries = Entry.query.filter_by(user_id=user_id).all()
    return jsonify([e.to_dict() for e in entries])

# ✅ Add new entry (or multiple)
@entries_bp.route("/add", methods=["POST"])
def add_entry():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_id = verify_token_and_get_user(token)
    if not user_id:
        return jsonify({"error": "Invalid token"}), 401

    data = request.json
    if isinstance(data, list):
        for item in data:
            entry = Entry(
                user_id=user_id,
                date=item.get("date"),
                type=item.get("type", "").lower(),
                category=item.get("category"),
                description=item.get("description"),
                amount=item.get("amount")
            )
            db.session.add(entry)
    else:
        entry = Entry(
            user_id=user_id,
            date=data.get("date"),
            type=data.get("type", "").lower(),
            category=data.get("category"),
            description=data.get("description"),
            amount=data.get("amount")
        )
        db.session.add(entry)

    db.session.commit()

    # ✅ Generate alerts after adding entries
    generate_alerts_for_user(user_id)

    return jsonify([e.to_dict() for e in Entry.query.filter_by(user_id=user_id).all()])

# ✅ Edit entry
@entries_bp.route("/edit_entry", methods=["PUT"])
def edit_entry():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_id = verify_token_and_get_user(token)
    if not user_id:
        return jsonify({"error": "Invalid token"}), 401

    data = request.json
    entry = Entry.query.get(data.get("id"))
    if entry and entry.user_id == user_id:
        for field in ["date", "type", "category", "description", "amount"]:
            if field in data:
                value = data[field]
                if field == "type":
                    value = value.lower()
                setattr(entry, field, value)
        db.session.commit()
        return jsonify([e.to_dict() for e in Entry.query.filter_by(user_id=user_id).all()])
    return jsonify({"error": "Entry not found"}), 404

# ✅ Delete entry
@entries_bp.route("/delete_entry", methods=["DELETE"])
def delete_entry():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_id = verify_token_and_get_user(token)
    if not user_id:
        return jsonify({"error": "Invalid token"}), 401

    data = request.json
    entry = Entry.query.get(data.get("id"))
    if entry and entry.user_id == user_id:
        db.session.delete(entry)
        db.session.commit()
        return jsonify([e.to_dict() for e in Entry.query.filter_by(user_id=user_id).all()])
    return jsonify({"error": "Entry not found"}), 404

# ✅ Clear all entries for the logged-in user
@entries_bp.route("/clear_entries", methods=["DELETE"])
def clear_entries():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_id = verify_token_and_get_user(token)
    if not user_id:
        return jsonify({"error": "Invalid token"}), 401

    Entry.query.filter_by(user_id=user_id).delete()
    db.session.commit()
    return jsonify({"message": "All entries cleared"})
