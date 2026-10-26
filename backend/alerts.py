from flask import request, jsonify
from datetime import date, datetime
from models import Entry, Alert, Settings, Task
from auth_utils import verify_token_and_get_user
from app import app, db
from dotenv import load_dotenv
import os

load_dotenv()

CURRENCY_SYMBOLS = {
    "USD": "$", "EUR": "€", "GBP": "£", "CAD": "C$", "JPY": "¥",
    "NGN": "₦", "ZAR": "R", "KES": "KSh", "GHS": "₵", "EGP": "£E",
    "XOF": "CFA", "XAF": "CFA"
}

@app.route("/api/alerts", methods=["GET"])
def alerts():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_id = verify_token_and_get_user(token)
    if not user_id:
        return jsonify({"error": "Invalid token"}), 401

    entries = Entry.query.filter_by(user_id=user_id).all()
    total_income = sum(e.amount for e in entries if e.type.lower() == "income")
    total_expense = sum(e.amount for e in entries if e.type.lower() == "expense")
    net = total_income - total_expense

    settings = Settings.query.filter_by(user_id=user_id).first()
    currency = settings.currency if settings else "NGN"
    symbol = CURRENCY_SYMBOLS.get(currency, "₦")

    # Only unresolved = active alerts
    existing_alerts = Alert.query.filter_by(user_id=user_id, resolved=False).all()
    existing_messages = [a.message for a in existing_alerts]
    alerts_list = existing_alerts.copy()

    # High Priority: Negative cashflow
    if net < 0 and "Cashflow is negative — urgent action required!" not in existing_messages:
        why_text = f"Net cashflow is {symbol}{net:,.2f}. Expenses {symbol}{total_expense:,.2f} exceeded Income {symbol}{total_income:,.2f}"
        new_alert = Alert(
            user_id=user_id,
            level="high",
            message="Cashflow is negative — urgent action required!",
            type="expense",
            resolved=False,
            why=why_text,
            actions=[
                "Cut discretionary spending immediately",
                "Negotiate supplier payment terms",
                "Review forecast impact"
            ]
        )
        db.session.add(new_alert)
        alerts_list.append(new_alert)

    # Medium: Expenses >70%
    if total_income > 0 and total_expense > (0.7 * total_income) and "Expenses exceed 70% of income — review spending." not in existing_messages:
        percent = (total_expense / total_income) * 100
        top_expenses = sorted(
            [e for e in entries if e.type.lower() == "expense"],
            key=lambda x: x.amount,
            reverse=True
        )[:2]
        top_cats = " + ".join([getattr(e, "category", "Unknown") for e in top_expenses])
        why_text = f"Expenses are {symbol}{total_expense:,.2f} which is {percent:.1f}% of income {symbol}{total_income:,.2f}. Driven by {top_cats}"
        new_alert = Alert(
            user_id=user_id,
            level="medium",
            message="Expenses exceed 70% of income — review spending.",
            type="expense",
            resolved=False,
            why=why_text,
            actions=[
                "Review top 3 expense categories",
                "Delay non-critical purchases",
                "See impact in Forecast"
            ]
        )
        db.session.add(new_alert)
        alerts_list.append(new_alert)

    # Medium: Profit margin <20%
    if total_income > 0:
        profit_margin = (net / total_income) * 100
        if profit_margin < 20 and "Profit margin has dropped below 20% — review pricing or costs." not in existing_messages:
            why_text = f"Current profit margin is {profit_margin:.1f}%. Net {symbol}{net:,.2f} / Revenue {symbol}{total_income:,.2f}"
            new_alert = Alert(
                user_id=user_id,
                level="medium",
                message="Profit margin has dropped below 20% — review pricing or costs.",
                type="revenue",
                resolved=False,
                why=why_text,
                actions=[
                    "Review pricing strategy",
                    "Cut non-essential costs",
                    "Simulate impact in Forecast"
                ]
            )
            db.session.add(new_alert)
            alerts_list.append(new_alert)

    # Info: Healthy
    if net >= 0 and "Cashflow is healthy — keep monitoring." not in existing_messages:
        why_text = f"Income {symbol}{total_income:,.2f} exceeds Expenses {symbol}{total_expense:,.2f}. Net: {symbol}{net:,.2f}"
        new_alert = Alert(
            user_id=user_id,
            level="info",
            message="Cashflow is healthy — keep monitoring.",
            type="revenue",
            resolved=False,
            why=why_text,
            actions=["Maintain reserves", "Track monthly trends", "Plan growth"]
        )
        db.session.add(new_alert)
        alerts_list.append(new_alert)

    if net > 0 and "Consider setting aside reserves for growth opportunities." not in existing_messages:
        reserve_amount = net * 0.1
        why_text = f"Positive net cashflow of {symbol}{net:,.2f}. Suggested reserve: {symbol}{reserve_amount:,.2f}"
        new_alert = Alert(
            user_id=user_id,
            level="info",
            message="Consider setting aside reserves for growth opportunities.",
            type="churn",
            resolved=False,
            why=why_text,
            actions=["Allocate 10% to reserves", "Explore investment options", "Review forecast"]
        )
        db.session.add(new_alert)
        alerts_list.append(new_alert)

    db.session.commit()

    # Refresh list after commit to get IDs
    alerts_list = Alert.query.filter_by(user_id=user_id, resolved=False).all()

    return jsonify({
        "counts": {
            "high": sum(1 for a in alerts_list if (a.level or "").lower() == "high"),
            "medium": sum(1 for a in alerts_list if (a.level or "").lower() == "medium"),
            "info": sum(1 for a in alerts_list if (a.level or "").lower() == "info")
        },
        "alerts": [{
            "id": a.id,
            "level": (a.level or "").lower(),
            "message": a.message,
            "type": a.type,
            "why": a.why or "",
            "actions": a.actions or [],
            "income": total_income,
            "expenses": total_expense,
            "net": net,
            "amount": total_expense if a.type == "expense" else total_income,
            "date": str(a.created_at.date() if a.created_at else date.today())
        } for a in alerts_list],
        "totals": {
            "total_income": total_income,
            "total_expense": total_expense,
            "current_net": net,
            "formatted_total_income": f"{symbol}{total_income:,.2f}",
            "formatted_total_expense": f"{symbol}{total_expense:,.2f}",
            "formatted_current_net": f"{symbol}{net:,.2f}",
            "currency": currency,
            "currency_symbol": symbol
        }
    })

# --- NEW ENDPOINTS FOR $199/mo REAL FUNCTIONALITY ---

@app.route("/api/alerts/<int:alert_id>/acknowledge", methods=["POST"])
def acknowledge_alert(alert_id):
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_id = verify_token_and_get_user(token)
    if not user_id:
        return jsonify({"error": "Invalid token"}), 401

    alert = Alert.query.filter_by(id=alert_id, user_id=user_id).first()
    if not alert:
        return jsonify({"error": "Alert not found"}), 404

    alert.resolved = True
    alert.resolved_at = datetime.utcnow()
    alert.acknowledged = True
    db.session.commit()

    return jsonify({"status": "acknowledged", "id": alert_id})

@app.route("/api/alerts/<int:alert_id>/resolve", methods=["POST"])
def resolve_alert(alert_id):
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_id = verify_token_and_get_user(token)
    if not user_id:
        return jsonify({"error": "Invalid token"}), 401

    alert = Alert.query.filter_by(id=alert_id, user_id=user_id).first()
    if not alert:
        return jsonify({"error": "Alert not found"}), 404

    alert.resolved = True
    alert.resolved_at = datetime.utcnow()
    db.session.commit()

    return jsonify({"status": "resolved", "id": alert_id})

@app.route("/api/tasks", methods=["POST"])
def create_task():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_id = verify_token_and_get_user(token)
    if not user_id:
        return jsonify({"error": "Invalid token"}), 401

    data = request.get_json() or {}
    alert_id = data.get("alert_id")
    title = data.get("title", "CFO Task from Alert")
    description = data.get("description", "")

    try:
        task = Task(
            user_id=user_id,
            alert_id=alert_id,
            title=title,
            description=description,
            status="pending",
            created_at=datetime.utcnow()
        )
        db.session.add(task)
        db.session.commit()
        return jsonify({"status": "created", "task_id": task.id}), 201
    except Exception as e:
        # If Task model doesn't exist yet, fallback to just success response
        db.session.rollback()
        print(f"Task creation fallback (no Task table): {e}")
        return jsonify({"status": "created_fallback", "message": "Task logged - create Task model for persistence"}), 201