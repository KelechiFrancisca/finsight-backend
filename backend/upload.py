import os, csv
import pandas as pd
from flask import Blueprint, request, jsonify, Response
from werkzeug.utils import secure_filename
from datetime import datetime
from extensions import db
from models import Upload, Entry, Alert
from auth_utils import verify_token_and_get_user

upload_bp = Blueprint("upload", __name__)

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# ✅ Upload route with validation
@upload_bp.route("/upload", methods=["GET", "POST"])
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

        # ✅ Validate file type
        if not filename.lower().endswith(".csv"):
            return jsonify({"error": "Invalid file type. Please upload CSV only."}), 400

        # ✅ Validate headers
        df = pd.read_csv(file)
        required_headers = {"Date", "Type", "Category", "Description", "Amount"}
        if not required_headers.issubset(df.columns):
            return jsonify({"error": "CSV missing required headers"}), 400

        filepath = os.path.join(UPLOAD_FOLDER, filename)
        df.to_csv(filepath, index=False)

        new_upload = Upload(user_id=user_id, filename=filename)
        db.session.add(new_upload)
        db.session.commit()

        # ✅ Generate alerts after upload
        entries = Entry.query.filter_by(user_id=user_id).all()
        total_income = sum(e.amount for e in entries if e.type.lower() == "income")
        total_expense = sum(e.amount for e in entries if e.type.lower() == "expense")
        net = total_income - total_expense

        alerts_list = []
        if net < 0:
            alerts_list.append(Alert(user_id=user_id, level="high",
                                     message="Cashflow is negative — urgent action required!",
                                     type="expense", resolved=False))
        if total_income > 0 and total_expense > (0.7 * total_income):
            alerts_list.append(Alert(user_id=user_id, level="medium",
                                     message="Expenses exceed 70% of income — review spending.",
                                     type="expense", resolved=False))
        alerts_list.append(Alert(user_id=user_id, level="info",
                                 message="System check complete — monitoring active.",
                                 type="system", resolved=False))

        for a in alerts_list:
            db.session.add(a)
        db.session.commit()

        return jsonify(new_upload.to_dict())

    uploads = Upload.query.filter_by(user_id=user_id).all()
    return jsonify([u.to_dict() for u in uploads])


# ✅ Sample CSV route
@upload_bp.route("/sample_csv", methods=["GET"])
def sample_csv():
    sample_data = [
        ["Date", "Type", "Category", "Description", "Amount"],
        ["2026-06-01", "income", "sales", "Sales revenue", "12000"],
        ["2026-06-02", "expense", "rent", "Office rent", "8500"],
        ["2026-06-03", "income", "consulting", "Consulting fee", "5000"],
    ]

    def generate():
        output = []
        writer = csv.writer(output.append)
        for row in sample_data:
            writer(row)
        return "\n".join(output)

    return Response(generate(), mimetype="text/csv",
                    headers={"Content-Disposition": "attachment;filename=sample.csv"})
