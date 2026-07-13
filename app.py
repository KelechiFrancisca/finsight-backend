import os, csv, io
import pandas as pd
from dotenv import load_dotenv
load_dotenv()

from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from werkzeug.utils import secure_filename
from datetime import datetime, date
from apscheduler.schedulers.background import BackgroundScheduler

from extensions import db, migrate
from entries import entries_bp
from auth import auth_bp
from models import User, Entry, Forecast, Alert, Upload, Settings
from auth_utils import verify_token_and_get_user

app = Flask(__name__)

# ✅ Expanded CORS config for React frontend (local + cloud)
CORS(app, supports_credentials=True, origins=[
    "http://localhost:3000",
    "https://finsight-frontend-rhov.onrender.com"
])

# ✅ Database config (Postgres only)
app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("DATABASE_URL")
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
# ✅ Use a stronger secret key (32+ chars)
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "replace_with_long_random_secret_key")

# ✅ Initialize DB + Migrations
db.init_app(app)
migrate.init_app(app, db)

# Register blueprints
app.register_blueprint(entries_bp, url_prefix="/api")
app.register_blueprint(auth_bp, url_prefix="/api")


# ✅ Currency symbols (global + African majors)
CURRENCY_SYMBOLS = {
    "USD": "$", "EUR": "€", "GBP": "£", "CAD": "C$", "JPY": "¥",
    "NGN": "₦", "ZAR": "R", "KES": "KSh", "GHS": "₵", "EGP": "£E",
    "XOF": "CFA", "XAF": "CFA"
}

# -------------------------
# Centralized Alert Helper
# -------------------------
def generate_alerts_for_user(user_id):
    entries = Entry.query.filter_by(user_id=user_id).all()
    total_income = sum(e.amount for e in entries if e.type.lower() == "income")
    total_expense = sum(e.amount for e in entries if e.type.lower() == "expense")
    net = total_income - total_expense

    # Clear old unresolved alerts
    Alert.query.filter_by(user_id=user_id, resolved=False).delete()

    alerts_list = []

    if net < 0:
        alerts_list.append(Alert(
            user_id=user_id,
            level="high",
            message="Cashflow is negative — urgent action required!",
            type="expense",
            notified_at=datetime.utcnow(),
            notification_type="system"
        ))

    if total_income > 0 and total_expense > (0.7 * total_income):
        alerts_list.append(Alert(
            user_id=user_id,
            level="medium",
            message="Expenses exceed 70% of income — review spending.",
            type="expense"
        ))

    if total_income > 0:
        profit_margin = net / total_income
        if profit_margin < 0.2:
            alerts_list.append(Alert(
                user_id=user_id,
                level="medium",
                message="Profit margin has dropped below 20% — review pricing or costs.",
                type="revenue"
            ))

    alerts_list.append(Alert(
        user_id=user_id,
        level="info",
        message="System check complete — monitoring active.",
        type="system"
    ))

    if not alerts_list:
        alerts_list.append(Alert(
            user_id=user_id,
            level="info",
            message="No issues detected — but system is running.",
            type="system"
        ))

    for a in alerts_list:
        db.session.add(a)
    db.session.commit()

    return alerts_list

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

        if not filename.lower().endswith(".csv"):
            return jsonify({"error": "Invalid file type. Please upload CSV only."}), 400

        df = pd.read_csv(file)
        required_headers = {"Date", "Type", "Category", "Description", "Amount"}
        if not required_headers.issubset(df.columns):
            return jsonify({"error": "CSV missing required headers"}), 400

        filepath = os.path.join(UPLOAD_FOLDER, filename)
        df.to_csv(filepath, index=False)

        # ✅ Insert each CSV row into entries table
        for _, row in df.iterrows():
            new_entry = Entry(
                user_id=user_id,
                date=row["Date"],
                type=row["Type"],
                category=row["Category"],
                description=row["Description"],
                amount=row["Amount"]
            )
            db.session.add(new_entry)

        new_upload = Upload(user_id=user_id, filename=filename)
        db.session.add(new_upload)
        db.session.commit()

        generate_alerts_for_user(user_id)

        return jsonify(new_upload.to_dict())

    # ✅ GET branch (list uploads)
    uploads = Upload.query.filter_by(user_id=user_id).all()
    return jsonify([u.to_dict() for u in uploads])

# ✅ Sample CSV route
@app.route("/api/sample_csv", methods=["GET"])
def sample_csv():
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Date", "Type", "Category", "Description", "Amount"])
    writer.writerow(["2026-06-01", "income", "sales", "Sales revenue", "12000"])
    writer.writerow(["2026-06-02", "expense", "rent", "Office rent", "8500"])
    writer.writerow(["2026-06-03", "income", "consulting", "Consulting fee", "5000"])

    response = Response(output.getvalue(), mimetype="text/csv")
    response.headers["Content-Disposition"] = "attachment; filename=sample.csv"
    return response

# -------------------------
# Settings Routes
# -------------------------
@app.route("/api/settings", methods=["GET", "POST"])
def settings():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_id = verify_token_and_get_user(token)
    if not user_id:
        return jsonify({"error": "Invalid token"}), 401

    if request.method == "GET":
        settings = Settings.query.filter_by(user_id=user_id).first()
        if settings:
            return jsonify({
                "business_name": settings.business_name,
                "currency": settings.currency
            })
        else:
            return jsonify({"business_name": "", "currency": ""})

    if request.method == "POST":
        data = request.get_json()
        business_name = data.get("business_name", "")
        currency = data.get("currency", "")

        # ✅ Validate currency
        if currency not in CURRENCY_SYMBOLS.keys():
            return jsonify({"error": "Invalid currency. Allowed: " + ", ".join(CURRENCY_SYMBOLS.keys())}), 400

        settings = Settings.query.filter_by(user_id=user_id).first()
        if not settings:
            settings = Settings(user_id=user_id, business_name=business_name, currency=currency)
            db.session.add(settings)
        else:
            settings.business_name = business_name
            settings.currency = currency

        db.session.commit()
        return jsonify({"message": "Settings saved successfully!"})

# -------------------------
# Clear Entries Route
# -------------------------
@app.route("/api/clear_entries", methods=["DELETE"])
def clear_entries():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_id = verify_token_and_get_user(token)
    if not user_id:
        return jsonify({"error": "Invalid token"}), 401

    Entry.query.filter_by(user_id=user_id).delete()
    db.session.commit()
    return jsonify({"message": "Entries cleared"})

# -------------------------
# Clear All Route
# -------------------------
@app.route("/api/clear_all", methods=["DELETE"])
def clear_all():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_id = verify_token_and_get_user(token)
    if not user_id:
        return jsonify({"error": "Invalid token"}), 401

    Entry.query.filter_by(user_id=user_id).delete()
    Alert.query.filter_by(user_id=user_id).delete()
    Settings.query.filter_by(user_id=user_id).delete()
    db.session.commit()
    return jsonify({"message": "All data cleared successfully!"})

# -------------------------
# Forecast Route
# -------------------------
@app.route("/api/forecast", methods=["GET"])
def forecast():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_id = verify_token_and_get_user(token)
    if not user_id:
        return jsonify({"error": "Invalid token"}), 401

    # 👇 This must be indented 4 spaces, not 8
    entries = Entry.query.filter_by(user_id=user_id).all()

    total_income = sum(e.amount for e in entries if e.type.lower() == "income")
    total_expense = sum(e.amount for e in entries if e.type.lower() == "expense")
    current_net = total_income - total_expense
    forecast_next = (total_income * 1.1) - (total_expense * 1.05)

    new_forecast = Forecast(user_id=user_id, current_net=current_net, forecast_next=forecast_next)
    db.session.add(new_forecast)
    db.session.commit()

    generate_alerts_for_user(user_id)

    # ✅ Get user settings for currency
    settings = Settings.query.filter_by(user_id=user_id).first()
    currency = settings.currency if settings else "USD"
    symbol = CURRENCY_SYMBOLS.get(currency, "")

    return jsonify({
        "id": new_forecast.id,
        "user_id": new_forecast.user_id,
        "current_net": new_forecast.current_net,
        "forecast_next": new_forecast.forecast_next,
        "created_at": new_forecast.created_at.isoformat() if new_forecast.created_at else None,
        "formatted_current_net": f"{symbol}{new_forecast.current_net:,.2f}",
        "formatted_forecast_next": f"{symbol}{new_forecast.forecast_next:,.2f}",
        "currency": currency,
        # 👇 Optional: include totals for clarity
        "total_income": total_income,
        "total_expense": total_expense
    })



# -------------------------
# Alerts Routes
# -------------------------
@app.route("/api/alerts", methods=["GET"])
def alerts():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_id = verify_token_and_get_user(token)
    if not user_id:
        return jsonify({"error": "Invalid token"}), 401

    alerts_list = generate_alerts_for_user(user_id)

    # ✅ Totals calculation
    entries = Entry.query.filter_by(user_id=user_id).all()
    total_income = sum(e.amount for e in entries if e.type.lower() == "income")
    total_expense = sum(e.amount for e in entries if e.type.lower() == "expense")
    current_net = total_income - total_expense

    # ✅ Currency lookup
    settings = Settings.query.filter_by(user_id=user_id).first()
    currency = settings.currency if settings else "USD"
    symbol = CURRENCY_SYMBOLS.get(currency, "")

    return jsonify({
        "counts": {
            "high": sum(1 for a in alerts_list if a.level == "high"),
            "medium": sum(1 for a in alerts_list if a.level == "medium"),
            "info": sum(1 for a in alerts_list if a.level == "info")
        },
        "alerts": [a.to_dict() for a in alerts_list],
        "totals": {
            "total_income": total_income,
            "total_expense": total_expense,
            "current_net": current_net,
            # 👇 Formatted values
            "formatted_total_income": f"{symbol}{total_income:,.2f}",
            "formatted_total_expense": f"{symbol}{total_expense:,.2f}",
            "formatted_current_net": f"{symbol}{current_net:,.2f}",
            "currency": currency
        }
    })


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
    alert.resolved_by = user_id
    alert.resolved_at = datetime.utcnow()
    db.session.commit()

    return jsonify({"message": "Alert resolved", "alert": alert.to_dict()})


@app.route("/api/alerts/resolve_all", methods=["POST"])
def resolve_all_alerts():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_id = verify_token_and_get_user(token)
    if not user_id:
        return jsonify({"error": "Invalid token"}), 401

    alerts = Alert.query.filter_by(user_id=user_id, resolved=False).all()
    for alert in alerts:
        alert.resolved = True
        alert.resolved_by = user_id
        alert.resolved_at = datetime.utcnow()
    db.session.commit()

    return jsonify({"message": "All alerts resolved"})


@app.route("/api/alerts/<int:alert_id>/acknowledge", methods=["POST"])
def acknowledge_alert(alert_id):
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_id = verify_token_and_get_user(token)
    if not user_id:
        return jsonify({"error": "Invalid token"}), 401

    alert = Alert.query.filter_by(id=alert_id, user_id=user_id).first()
    if not alert:
        return jsonify({"error": "Alert not found"}), 404

    alert.acknowledged = True
    alert.acknowledged_at = datetime.utcnow()
    db.session.commit()

    return jsonify({"message": "Alert acknowledged", "alert": alert.to_dict()})



# -------------------------
# Scheduler: Daily Alerts Refresh
# -------------------------
def generate_daily_alerts():
    with app.app_context():
        users = db.session.query(Entry.user_id).distinct().all()
        for (user_id,) in users:
            generate_alerts_for_user(user_id)
        print(f"✅ Daily alerts refreshed at {date.today()}")

# Schedule the job to run every midnight
scheduler = BackgroundScheduler()
scheduler.add_job(func=generate_daily_alerts, trigger="cron", hour=0, minute=0)
scheduler.start()

@app.route("/")
def home():
    return """
    <html>
        <head>
            <title>Finsight AI</title>
            <style>
                body { font-family: Arial, sans-serif; text-align: center; margin-top: 100px; background-color: #f9f9f9; }
                h1 { color: #2c3e50; }
                p { color: #34495e; font-size: 18px; }
                a { color: #2980b9; text-decoration: none; }
                a:hover { text-decoration: underline; }
            </style>
        </head>
        <body>
            <h1>Welcome to Finsight AI</h1>
            <p>Your financial insights, alerts, and forecasts — all in one place.</p>
            <p><a href="/health">Check System Health</a></p>
            <p><a href="/register">Register a New User</a></p>
            <p><a href="/login">Login</a></p>
        </body>
    </html>
    """


# -------------------------
# Run App

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)

