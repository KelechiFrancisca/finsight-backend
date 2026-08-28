from flask import request, jsonify
from datetime import date
from models import Entry, Alert
from auth_utils import verify_token_and_get_user
from app import app, db
from dotenv import load_dotenv
import os

load_dotenv()  # loads variables from .env

account_sid = os.getenv("TWILIO_ACCOUNT_SID")
auth_token = os.getenv("TWILIO_AUTH_TOKEN")
twilio_phone = os.getenv("TWILIO_PHONE")
admin_phone = os.getenv("ADMIN_PHONE")

from twilio.rest import Client

client = Client(account_sid, auth_token)

# ✅ Test WhatsApp notification (can be removed later if not needed)
message = client.messages.create(
    body="🚨 Financial Tracker Alert: Test WhatsApp notification!",
    from_=f"whatsapp:{twilio_phone}",
    to=f"whatsapp:{admin_phone}"
)
print(message.sid)


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

    # -------------------------
    # High Priority
    # -------------------------
    if net < 0:
        alerts_list.append(Alert(
            user_id=user_id,
            level="high",
            message="Cashflow is negative — urgent action required!",
            type="expense",
            resolved=False,
            why="Expenses exceeded income this period",
            actions=[
                "Cut discretionary spending immediately",
                "Negotiate supplier payment terms",
                "Review forecast impact"
            ]
        ))

    # -------------------------
    # Medium Priority: Expenses >70%
    # -------------------------
    if total_income > 0 and total_expense > (0.7 * total_income):
        top_expenses = sorted(
            [e for e in entries if e.type.lower() == "expense"],
            key=lambda x: x.amount,
            reverse=True
        )[:2]
        why_text = "Driven by " + " + ".join([getattr(e, "category", "Unknown") for e in top_expenses])
        alerts_list.append(Alert(
            user_id=user_id,
            level="medium",
            message="Expenses exceed 70% of income — review spending.",
            type="expense",
            resolved=False,
            why=why_text,
            actions=[
                "Review top 3 expense categories",
                "Delay non‑critical purchases",
                "See impact in Forecast"
            ]
        ))

    # -------------------------
    # Medium Priority: Profit margin <20%
    # -------------------------
    if total_income > 0:
        profit_margin = (net / total_income) * 100
        if profit_margin < 20:
            alerts_list.append(Alert(
                user_id=user_id,
                level="medium",
                message="Profit margin has dropped below 20% — review pricing or costs.",
                type="revenue",
                resolved=False,
                why=f"Profit margin dropped to {profit_margin:.1f}%",
                actions=[
                    "Review pricing strategy",
                    "Cut non‑essential costs",
                    "Simulate impact in Forecast"
                ]
            ))

    # -------------------------
    # Informational Alerts
    # -------------------------
    alerts_list.append(Alert(
        user_id=user_id,
        level="info",
        message="Upcoming tax payment due soon.",
        type="revenue",
        resolved=False,
        why="Scheduled tax obligations",
        actions=["Prepare funds", "Check deadlines", "Consult accountant"]
    ))

    alerts_list.append(Alert(
        user_id=user_id,
        level="info",
        message="Cashflow is healthy — keep monitoring.",
        type="revenue",
        resolved=False,
        why="Income exceeds expenses",
        actions=["Maintain reserves", "Track monthly trends", "Plan growth"]
    ))

    alerts_list.append(Alert(
        user_id=user_id,
        level="info",
        message="Consider setting aside reserves for growth opportunities.",
        type="churn",
        resolved=False,
        why="Positive net cashflow",
        actions=["Allocate 10% to reserves", "Explore investment options", "Review forecast"]
    ))

    # ✅ Save alerts to DB
    for a in alerts_list:
        db.session.add(a)
    db.session.commit()

    # ✅ Return alerts in JSON format with context + actions + WhatsApp text
    return jsonify([{
        "id": a.id,
        "level": (a.level or "").lower(),
        "message": a.message,
        "type": a.type,
        "why": a.why or "",
        "actions": a.actions or [],
        "whatsapp_text": f"🚨 Finsight Alert: {a.message}\nWhy: {a.why or ''}\nActions:\n" +
                         "\n".join([f"{i+1}. {step}" for i, step in enumerate(a.actions or [])]),
        "date": str(a.created_at.date() if a.created_at else date.today())
    } for a in alerts_list])
