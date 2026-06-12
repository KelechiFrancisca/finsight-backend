from flask import request, jsonify
from datetime import date
from models import Entry, Alert
from auth_utils import verify_token_and_get_user
from app import app, db

@app.route("/api/alerts", methods=["GET"])
def alerts():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_id = verify_token_and_get_user(token)
    if not user_id:
        return jsonify({"error": "Invalid token"}), 401

    # ✅ Clear old unresolved alerts before regenerating
    Alert.query.filter_by(user_id=user_id, resolved=False).delete()
    db.session.commit()

    # Fetch entries for this user
    entries = Entry.query.filter_by(user_id=user_id).all()
    total_income = sum(e.amount for e in entries if e.type.lower() == "income")
    total_expense = sum(e.amount for e in entries if e.type.lower() == "expense")
    net = total_income - total_expense

    alerts_list = []

    # High Priority
    if net < 0:
        alerts_list.append(Alert(
            user_id=user_id,
            level="high",
            message="Cashflow is negative — urgent action required!",
            type="expense",
            resolved=False
        ))

    # Medium Priority
    if total_income > 0 and total_expense > (0.7 * total_income):
        alerts_list.append(Alert(
            user_id=user_id,
            level="medium",
            message="Expenses exceed 70% of income — review spending.",
            type="expense",
            resolved=False
        ))

    # Informational Alerts
    alerts_list.append(Alert(
        user_id=user_id,
        level="info",
        message="Upcoming tax payment due soon.",
        type="revenue",
        resolved=False
    ))
    alerts_list.append(Alert(
        user_id=user_id,
        level="info",
        message="Cashflow is healthy — keep monitoring.",
        type="revenue",
        resolved=False
    ))
    alerts_list.append(Alert(
        user_id=user_id,
        level="info",
        message="Consider setting aside reserves for growth opportunities.",
        type="churn",
        resolved=False
    ))

    # ✅ Save alerts to DB
    for a in alerts_list:
        db.session.add(a)
    db.session.commit()

    # ✅ Return alerts in JSON format with normalized level + date
    return jsonify([{
        "id": a.id,
        "level": (a.level or "").lower(),   # normalize casing
        "message": a.message,
        "type": a.type,
        "date": str(getattr(a, "created_at", date.today()).date()
                    if hasattr(a, "created_at") else str(date.today()))
    } for a in alerts_list])
