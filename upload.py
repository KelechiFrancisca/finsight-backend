@app.route("/api/upload", methods=["GET", "POST"])
def upload():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_id = verify_token_and_get_user(token)
    if not user_id:
        return jsonify({"error": "Invalid token"}), 401

    if request.method == "POST":
        if "file" not in request.files:
            return jsonify({"error": "No file provided"}), 400
        file = request.files["file"]
        filename = secure_filename(file.filename)
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        file.save(filepath)

        # ✅ Save upload metadata into Postgres
        new_upload = Upload(user_id=user_id, filename=filename)
        db.session.add(new_upload)
        db.session.commit()

        # -------------------------
        # ✅ Generate Alerts after upload
        # -------------------------
        entries = Entry.query.filter_by(user_id=user_id).all()
        total_income = sum(e.amount for e in entries if e.type.lower() == "income")
        total_expense = sum(e.amount for e in entries if e.type.lower() == "expense")
        net_profit = total_income - total_expense

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

        for a in alerts_to_add:
            db.session.add(a)
        db.session.commit()

        return jsonify(new_upload.to_dict())

    uploads = Upload.query.filter_by(user_id=user_id).all()
    return jsonify([u.to_dict() for u in uploads])
