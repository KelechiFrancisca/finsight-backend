from models import Entry, Alert
from extensions import db
from datetime import date

def generate_alerts_for_user(user_id):
    entries = Entry.query.filter_by(user_id=user_id).all()
    total_income = sum(e.amount for e in entries if e.type.lower() == "income")
    total_expense = sum(e.amount for e in entries if e.type.lower() == "expense")
    net = total_income - total_expense

    alerts_to_add = []

    if net < 0:
        alerts_to_add.append(Alert(
            user_id=user_id,
            level="High",
            message="Cashflow is negative — urgent action required!",
            type="expense",
            created_at=date.today(),
            resolved=False
        ))

    if total_income > 0 and total_expense > (0.7 * total_income):
        alerts_to_add.append(Alert(
            user_id=user_id,
            level="Medium",
            message="Expenses exceed 70% of income — review spending.",
            type="expense",
            created_at=date.today(),
            resolved=False
        ))

    if total_income > 0 and (net / total_income) < 0.1:
        alerts_to_add.append(Alert(
            user_id=user_id,
            level="Info",
            message="Profit margin below 10%.",
            type="revenue",
            created_at=date.today(),
            resolved=False
        ))

    for alert in alerts_to_add:
        existing = Alert.query.filter_by(
            user_id=user_id,
            message=alert.message,
            resolved=False
        ).first()
        if not existing:
            db.session.add(alert)

    db.session.commit()
