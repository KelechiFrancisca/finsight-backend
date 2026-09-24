import os, csv, io
import pandas as pd
from dotenv import load_dotenv
load_dotenv()

from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from werkzeug.utils import secure_filename
from datetime import date
from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy import text

from extensions import db, migrate
from entries import entries_bp
from auth import auth_bp
from models import User, Entry, Forecast, Alert, Upload, Settings, Category, Task
from auth_utils import verify_token_and_get_user

app = Flask(__name__)

CORS(app, supports_credentials=True, origins=[
    "http://localhost:3000",
    "https://finsight-frontend-rhov.onrender.com"
])

app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("DATABASE_URL")
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "replace_with_long_random_secret_key")

db.init_app(app)
migrate.init_app(app, db)

app.register_blueprint(entries_bp, url_prefix="/api")
app.register_blueprint(auth_bp, url_prefix="/api")

CURRENCY_SYMBOLS = {
    "USD": "$", "EUR": "€", "GBP": "£", "CAD": "C$", "JPY": "¥",
    "NGN": "₦", "ZAR": "R", "KES": "KSh", "GHS": "₵", "EGP": "£E",
    "XOF": "CFA", "XAF": "CFA"
}

@app.route("/health")
def health():
    return jsonify({"status": "ok", "message": "Backend is healthy"}), 200

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
        for _, row in df.iterrows():
            new_entry = Entry(user_id=user_id, date=row["Date"], type=row["Type"], category=row["Category"], description=row["Description"], amount=row["Amount"])
            db.session.add(new_entry)
        new_upload = Upload(user_id=user_id, filename=filename)
        db.session.add(new_upload)
        db.session.commit()
        return jsonify(new_upload.to_dict())
    uploads = Upload.query.filter_by(user_id=user_id).all()
    return jsonify([u.to_dict() for u in uploads])

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

@app.route("/api/settings", methods=["GET", "POST"])
def settings():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_id = verify_token_and_get_user(token)
    if not user_id:
        return jsonify({"error": "Invalid token"}), 401
    if request.method == "GET":
        settings_obj = Settings.query.filter_by(user_id=user_id).first()
        if settings_obj:
            return jsonify({"business_name": settings_obj.business_name, "currency": settings_obj.currency or "USD"})
        else:
            return jsonify({"business_name": "", "currency": "USD"})
    if request.method == "POST":
        data = request.get_json()
        business_name = data.get("business_name", "")
        currency = data.get("currency", "")
        if currency not in CURRENCY_SYMBOLS.keys():
            return jsonify({"error": "Invalid currency. Allowed: " + ", ".join(CURRENCY_SYMBOLS.keys())}), 400
        settings_obj = Settings.query.filter_by(user_id=user_id).first()
        if not settings_obj:
            settings_obj = Settings(user_id=user_id, business_name=business_name, currency=currency)
            db.session.add(settings_obj)
        else:
            settings_obj.business_name = business_name
            settings_obj.currency = currency
        db.session.commit()
        return jsonify({"message": "Settings saved successfully!"})

@app.route("/api/categories", methods=["GET"])
def get_categories():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_id = verify_token_and_get_user(token)
    if not user_id:
        return jsonify({"error": "Invalid token"}), 401
    cats = Category.query.filter_by(user_id=user_id).order_by(Category.name).all()
    if not cats:
        defaults = [("Sales", "income"), ("Rent", "expense"), ("Food", "expense"), ("Transport", "expense"), ("Utilities", "expense"), ("Marketing", "expense")]
        for name, type_val in defaults:
            db.session.add(Category(user_id=user_id, name=name, type=type_val))
        db.session.commit()
        cats = Category.query.filter_by(user_id=user_id).order_by(Category.name).all()
    return jsonify([c.to_dict() for c in cats])

@app.route("/api/categories", methods=["POST"])
def add_category():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_id = verify_token_and_get_user(token)
    if not user_id:
        return jsonify({"error": "Invalid token"}), 401
    data = request.get_json()
    name = data.get("name", "").strip()
    cat_type = data.get("type", "expense")
    if not name:
        return jsonify({"error": "Name required"}), 400
    exists = Category.query.filter_by(user_id=user_id, name=name).first()
    if exists:
        return jsonify({"error": "Category exists"}), 400
    cat = Category(user_id=user_id, name=name, type=cat_type)
    db.session.add(cat)
    db.session.commit()
    return jsonify(cat.to_dict()), 201

@app.route("/api/categories/<string:cat_name>", methods=["DELETE"])
def delete_category(cat_name):
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_id = verify_token_and_get_user(token)
    if not user_id:
        return jsonify({"error": "Invalid token"}), 401
    cat = Category.query.filter_by(user_id=user_id, name=cat_name).first()
    if not cat:
        return jsonify({"error": "Not found"}), 404
    db.session.delete(cat)
    db.session.commit()
    return jsonify({"message": "Deleted"})

@app.route("/api/year_end_report", methods=["GET"])
def year_end_report():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_id = verify_token_and_get_user(token)
    if not user_id:
        return jsonify({"error": "Invalid token"}), 401
    entries = Entry.query.filter_by(user_id=user_id).all()
    total_income = sum(e.amount for e in entries if e.type.lower() == "income")
    total_expense = sum(e.amount for e in entries if e.type.lower() == "expense")
    settings_obj = Settings.query.filter_by(user_id=user_id).first()
    currency = settings_obj.currency if settings_obj and settings_obj.currency else "USD"
    return jsonify({
        "year": date.today().year,
        "total_income": total_income,
        "total_expense": total_expense,
        "net_profit": total_income - total_expense,
        "currency": currency,
        "formatted": {
            "income": f"{CURRENCY_SYMBOLS.get(currency,'')}{total_income:,.2f}",
            "expense": f"{CURRENCY_SYMBOLS.get(currency,'')}{total_expense:,.2f}",
            "profit": f"{CURRENCY_SYMBOLS.get(currency,'')}{(total_income-total_expense):,.2f}"
        }
    })

@app.route("/api/clear_entries", methods=["DELETE"])
def clear_entries():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_id = verify_token_and_get_user(token)
    if not user_id:
        return jsonify({"error": "Invalid token"}), 401
    Entry.query.filter_by(user_id=user_id).delete()
    db.session.commit()
    return jsonify({"message": "Entries cleared"})

@app.route("/api/clear_all", methods=["DELETE"])
def clear_all():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_id = verify_token_and_get_user(token)
    if not user_id:
        return jsonify({"error": "Invalid token"}), 401
    Entry.query.filter_by(user_id=user_id).delete()
    Alert.query.filter_by(user_id=user_id).delete()
    Settings.query.filter_by(user_id=user_id).delete()
    Upload.query.filter_by(user_id=user_id).delete()
    Category.query.filter_by(user_id=user_id).delete()
    db.session.commit()
    return jsonify({"message": "All data cleared successfully!"})

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
    settings_obj = Settings.query.filter_by(user_id=user_id).first()
    currency = settings_obj.currency if settings_obj and settings_obj.currency else "USD"
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
        "total_income": total_income,
        "total_expense": total_expense
    })

def generate_daily_alerts():
    with app.app_context():
        print(f"Daily check at {date.today()}")

scheduler = BackgroundScheduler()
scheduler.add_job(func=generate_daily_alerts, trigger="cron", hour=0, minute=0)
scheduler.start()

# --- FINAL FIX: DROP OLD ALERTS TABLE AND RECREATE ---
with app.app_context():
    try:
        db.session.execute(text("DROP TABLE IF EXISTS alerts CASCADE"))
        db.session.commit()
        print("Dropped old alerts table")
    except Exception as e:
        print(f"Drop skipped: {e}")
        db.session.rollback()
    db.create_all()
    print("All tables recreated successfully - new alerts schema ready")

# Load your good alerts logic
import alerts

@app.route("/")
def home():
    return """<html><head><title>Finsight AI</title></head><body style="text-align:center;margin-top:100px"><h1>Welcome to Finsight AI</h1><p>Backend is healthy</p><a href="/health">Health</a></body></html>"""

if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)