from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename
import os
from datetime import date
from apscheduler.schedulers.background import BackgroundScheduler

from extensions import db, migrate
from entries import entries_bp
from auth import auth_bp
from models import User, Entry, Forecast, Alert, Upload
from auth_utils import verify_token_and_get_user

app = Flask(__name__)
CORS(app)

# ✅ Database config (Postgres only)
app.config["SQLALCHEMY_DATABASE_URI"] = "postgresql://postgres:Francisca2026!@localhost:5432/founding_mvp"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["SECRET_KEY"] = "your_secret_key_here"

# ✅ Initialize DB + Migrations
db.init_app(app)
migrate.init_app(app, db)

# Register blueprints
app.register_blueprint(entries_bp, url_prefix="/api")
app.register_blueprint(auth_bp, url_prefix="/api")

# -------------------------
# Upload Routes
# -------------------------
UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

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

        # ✅ Generate alerts after upload
        entries = Entry.query.filter_by(user_id=user_id).all()
        total_income = sum(e.amount for e in entries if e.type.lower() == "income")
        total_expense = sum(e.amount for e in entries if e.type.lower() == "expense")
        net_profit = total_income - total_expense

        Alert.query.filter_by(user_id=user_id, resolved=False).delete()

        if net_profit < 0:
            db.session.add(Alert(user_id=user_id, level="high",
                                 message="Cashflow is negative — urgent action required!",
                                 type="expense", resolved=False))
        if total_income > 0 and total_expense > (0.7 * total_income):
            db.session.add(Alert(user_id=user_id, level="medium",
                                 message="Expenses exceed 70% of income — review spending.",
                                 type="expense", resolved=False))

        db.session.add(Alert(user_id=user_id, level="info",
                             message="Upcoming tax payment due soon.",
                             type="revenue", resolved=False))
        db.session.add(Alert(user_id=user_id, level="info",
                             message="Cashflow is healthy — keep monitoring.",
                             type="revenue", resolved=False))

        db.session.commit()

        return jsonify(new_upload.to_dict())

    uploads = Upload.query.filter_by(user_id=user_id).all()
    return jsonify([u.to_dict() for u in uploads])

# -------------------------
# Forecast Route
# -------------------------
@app.route("/api/forecast", methods=["GET"])
def forecast():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_id = verify_token_and_get_user(token)
    if not user_id:
        return jsonify({"error": "Invalid token"}), 401

    entries = Entry.query.filter_by(user_id=user_id).all()
    total_income = sum(e.amount for e in entries if e.type.lower() == "income")
    total_expense = sum(e.amount for e in entries if e.type.lower() == "expense")
    current_net = total_income - total_expense
    forecast_next = (total_income * 1.1) - (total_expense * 1.05)

    new_forecast = Forecast(user_id=user_id, current_net=current_net, forecast_next=forecast_next)
    db.session.add(new_forecast)
    db.session.commit()

    # ✅ Generate alerts during forecast
    Alert.query.filter_by(user_id=user_id, resolved=False).delete()

    if current_net < 0:
        db.session.add(Alert(user_id=user_id, level="high",
                             message="Cashflow is negative — urgent action required!",
                             type="expense", resolved=False))
    if total_income > 0 and total_expense > (0.7 * total_income):
        db.session.add(Alert(user_id=user_id, level="medium",
                             message="Expenses exceed 70% of income — review spending.",
                             type="expense", resolved=False))

    db.session.add(Alert(user_id=user_id, level="info",
                         message="Upcoming tax payment due soon.",
                         type="revenue", resolved=False))
    db.session.add(Alert(user_id=user_id, level="info",
                         message="Cashflow is healthy — keep monitoring.",
                         type="revenue", resolved=False))

    db.session.commit()

    return jsonify(new_forecast.to_dict())

# -------------------------
# Alerts Routes
# -------------------------
@app.route("/api/alerts", methods=["GET"])
def alerts():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_id = verify_token_and_get_user(token)
    if not user_id:
        return jsonify({"error": "Invalid token"}), 401

    alerts = Alert.query.filter_by(user_id=user_id, resolved=False).all()
    return jsonify([{
        "id": a.id,
        "level": a.level.lower(),  # ✅ normalize here
        "message": a.message,
        "type": a.type,
        "date": str(a.created_at.date()) if hasattr(a, "created_at") else str(date.today())
    } for a in alerts])


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
    db.session.commit()
    return jsonify({"message": "Alert resolved", "alert": alert.to_dict()})

@app.route("/api/alerts/resolve_all", methods=["POST"])
def resolve_all_alerts():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_id = verify_token_and_get_user(token)
    if not user_id:
        return jsonify({"error": "Invalid token"}), 401

    Alert.query.filter_by(user_id=user_id, resolved=False).update({"resolved": True})
    db.session.commit()
    return jsonify({"message": "All alerts resolved"})

# -------------------------
# Scheduler: Daily Alerts Refresh
# -------------------------
def generate_daily_alerts():
    with app.app_context():
        users = db.session.query(Entry.user_id).distinct().all()
        for (user_id,) in users:
            entries = Entry.query.filter_by(user_id=user_id).all()
            total_income = sum(e.amount for e in entries if e.type.lower() == "income")
            total_expense = sum(e.amount for e in entries if e.type.lower() == "expense")
            net = total_income - total_expense

            Alert.query.filter_by(user_id=user_id, resolved=False).delete()

            if net < 0:
                db.session.add(Alert(user_id=user_id, level="high",
                                     message="Cashflow is negative — urgent action required!",
                                     type="expense", resolved=False))
            if total_income > 0 and total_expense > (0.7 * total_income):
                db.session.add(Alert(user_id=user_id, level="medium",
                                     message="Expenses exceed 70% of income — review spending.",
                                     type="expense", resolved=False))

            db.session.add(Alert(user_id=user_id, level="info",
                                 message="Upcoming tax payment due soon.",
                                 type="revenue", resolved=False))
            db.session.add(Alert(user_id=user_id, level="info",
                                 message="Cashflow is healthy — keep monitoring.",
                                 type="revenue", resolved=False))

        db.session.commit()
        print(f"✅ Daily alerts refreshed at {date.today()}")

scheduler = BackgroundScheduler()
scheduler.add_job(func=generate_daily_alerts, trigger="cron", hour=0, minute=0)  # runs daily at midnight
scheduler.start()

# -------------------------
# Run App
# -------------------------
if __name__ == "__main__":
    app.run(debug=True)
