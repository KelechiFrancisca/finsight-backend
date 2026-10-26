@forecast_bp.route("/forecast", methods=["GET"])
def get_forecast():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_id = verify_token_and_get_user(token)
    if not user_id:
        return jsonify({"error": "Invalid token"}), 401

    incomes = Entry.query.filter_by(user_id=user_id, type="income").all()
    expenses = Entry.query.filter_by(user_id=user_id, type="expense").all()

    total_income = sum(e.amount for e in incomes)
    total_expense = sum(e.amount for e in expenses)
    net_profit = total_income - total_expense

    # Simple forecast logic
    expense_trend = "high" if total_expense > 4000 else "normal"
    forecast_msg = "🔮 Cash reserves may drop below safe levels in 45 days." if net_profit < 2000 else "🔮 Cashflow looks stable for the next 2 months."
    suggestion = "💡 Consider renegotiating supplier contracts or cutting non‑essential costs." if expense_trend == "high" else "💡 Maintain current expense levels to keep profit steady."

    # -------------------------
    # ✅ Generate Alerts
    # -------------------------
    alerts_to_add = []

    if net_profit < 0:
        alerts_to_add.append(Alert(
            user_id=user_id,
            level="high",
            message="Cashflow is negative — urgent action required!",
            type="expense",
            resolved=False
        ))

    if total_income > 0 and total_expense > (0.7 * total_income):
        alerts_to_add.append(Alert(
            user_id=user_id,
            level="medium",
            message="Expenses exceed 70% of income — review spending.",
            type="expense",
            resolved=False
        ))

    # Informational alerts
    alerts_to_add.append(Alert(
        user_id=user_id,
        level="info",
        message="Upcoming tax payment due soon.",
        type="revenue",
        resolved=False
    ))
    alerts_to_add.append(Alert(
        user_id=user_id,
        level="info",
        message="Cashflow is healthy — keep monitoring.",
        type="revenue",
        resolved=False
    ))

    # Save alerts to DB
    for a in alerts_to_add:
        db.session.add(a)
    db.session.commit()

    # -------------------------
    # ✅ Keep your forecast response
    # -------------------------
    return jsonify({
        "expenses": f"📊 Expenses are currently {expense_trend} compared to typical levels.",
        "forecast": forecast_msg,
        "suggestion": suggestion,
        "net_profit": f"📈 Net Profit: ${net_profit:.2f}"
    })
