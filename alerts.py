from flask import request, jsonify
from datetime import date
from models import Entry, Alert, Settings
from auth_utils import verify_token_and_get_user
from app import app, db
from dotenv import load_dotenv
import os

load_dotenv()  # loads variables from .env

# REMOVED TWILIO COMPLETELY

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

    # ✅ REMOVED: Clear old unresolved alerts before regenerating
    # Alert.query.filter_by(user_id=user_id, resolved=False).delete()
    # db.session.commit()
    # We keep existing alerts so "Resolve" button works

    # Fetch entries for this user
    entries = Entry.query.filter_by(user_id=user_id).all()
    total_income = sum(e.amount for e in entries if e.type.lower() == "income")
    total_expense = sum(e.amount for e in entries if e.type.lower() == "expense")
    net = total_income - total_expense

    # ✅ Currency lookup
    settings = Settings.query.filter_by(user_id=user_id).first()
    currency = settings.currency if settings else "NGN"
    symbol = CURRENCY_SYMBOLS.get(currency, "₦")

    # Check existing alerts to avoid duplicates
    existing_alerts = Alert.query.filter_by(user_id=user_id, resolved=False).all()
    existing_messages = [a.message for a in existing_alerts]
    alerts_list = existing_alerts.copy()

    # -------------------------
    # High Priority
    # -------------------------
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

    # -------------------------
    # Medium Priority: Expenses >70%
    # -------------------------
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

    # -------------------------
    # Medium Priority: Profit margin <20%
    # -------------------------
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

    # -------------------------
    # Informational Alerts
    # -------------------------
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

    # Only show reserves alert if we actually have profit
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

    # ✅ Save new alerts to DB
    db.session.commit()

    # ✅ Return alerts in NEW FORMAT with counts + totals for frontend
    return jsonify({
        "counts": {
            "high": sum(1 for a in alerts_list if a.level == "high"),
            "medium": sum(1 for a in alerts_list if a.level == "medium"),
            "info": sum(1 for a in alerts_list if a.level == "info")
        },
        "alerts": [{
            "id": a.id,
            "level": (a.level or "").lower(),
            "message": a.message,
            "type": a.type,
            "why": a.why or "",
            "actions": a.actions or [],
            "income": total_income,        # ADDED for frontend
            "expenses": total_expense,     # ADDED for frontend
            "net": net,                    # ADDED for frontend
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