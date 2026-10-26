import os
import pandas as pd
from dotenv import load_dotenv
load_dotenv()

from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime, date
from collections import defaultdict, Counter
import calendar

from extensions import db, migrate
from entries import entries_bp
from auth import auth_bp
from models import User, Entry, Forecast, Alert, Upload, Settings, Category
from auth_utils import verify_token_and_get_user

app = Flask(__name__)

CORS(app, supports_credentials=True, origins=[
    "http://localhost:3000",
    "https://finsight-frontend-rhov.onrender.com"
])

# --- DATABASE FIX - FORCES psycopg2 (you have psycopg2-binary) ---
db_url = os.getenv('DATABASE_URL', '').strip()
if not db_url:
    # Local fallback - safe, no secret
    db_url = "sqlite:///finsight.db"
else:
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql+psycopg2://", 1)
    elif db_url.startswith("postgresql://"):
        # only replace if not already has +psycopg2 or +psycopg
        if "+psycopg" not in db_url:
            db_url = db_url.replace("postgresql://", "postgresql+psycopg2://", 1)

app.config['SQLALCHEMY_DATABASE_URI'] = db_url
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "replace_with_long_random_secret_key")

db.init_app(app)
migrate.init_app(app, db)

app.register_blueprint(entries_bp, url_prefix="/api")
app.register_blueprint(auth_bp, url_prefix="/api")

# Create tables without dropping - prevents Render timeout
with app.app_context():
    db.create_all()
    print("All tables ready - no drop")

CURRENCY_SYMBOLS = {
    "USD": "$", "EUR": "€", "GBP": "£", "CAD": "C$", "JPY": "¥",
    "NGN": "₦", "ZAR": "R", "KES": "KSh", "GHS": "₵", "EGP": "£E",
    "XOF": "CFA", "XAF": "CFA"
}

@app.route("/health")
def health():
    return jsonify({"status": "ok", "message": "Backend is healthy"}), 200

def generate_alerts_for_user(user_id):
    entries = Entry.query.filter_by(user_id=user_id).all()
    total_income = sum(e.amount for e in entries if e.type.lower() == "income")
    total_expense = sum(e.amount for e in entries if e.type.lower() == "expense")
    net = total_income - total_expense
    Alert.query.filter_by(user_id=user_id, resolved=False).delete()
    alerts_list = []
    if net < 0:
        alerts_list.append(Alert(user_id=user_id, level="high", message="Cashflow is negative — urgent action required!", type="expense", notified_at=datetime.utcnow(), notification_type="system"))
    if total_income > 0 and total_expense > (0.7 * total_income):
        alerts_list.append(Alert(user_id=user_id, level="medium", message="Expenses exceed 70% of income — review spending.", type="expense"))
    if total_income > 0:
        profit_margin = net / total_income
        if profit_margin < 0.2:
            alerts_list.append(Alert(user_id=user_id, level="medium", message="Profit margin has dropped below 20% — review pricing or costs.", type="revenue"))
    alerts_list.append(Alert(user_id=user_id, level="info", message="System check complete — monitoring active.", type="system"))
    if not alerts_list:
        alerts_list.append(Alert(user_id=user_id, level="info", message="No issues detected — but system is running.", type="system"))
    for a in alerts_list:
        db.session.add(a)
    db.session.commit()
    return alerts_list

# ========= BUSINESS MEMORY — REAL + COMPLETE FOR ALL 4 FRONTENDS =========
def get_business_memory(user_id):
    entries = Entry.query.filter_by(user_id=user_id).all()
    if not entries:
        return {
            "business_type": "unknown","busiest_day":None,"weakest_day":None,
            "busiest_day_income":0,"weakest_day_income":0,"busiest_day_avg":0,"weakest_day_avg":0,
            "avg_daily_income":0,"total_income":0,"total_expense":0,"net_profit":0,
            "profit_margin":0,"total_months":0,"growth_rate":0,"growth_text":"Add data",
            "top_income_category":None,"top_expense_category":None,"top_expense_amount":0,"top_expense_percent":0
        }

    money_per_weekday = defaultdict(float)
    days_per_weekday = defaultdict(set)
    money_per_month = defaultdict(lambda: {"income":0,"expense":0})
    money_exp_cat = defaultdict(float)
    money_inc_cat = defaultdict(float)
    all_dates = set()
    total_income = 0
    total_expense = 0
    biggest = 0

    for e in entries:
        try:
            d = e.date if isinstance(e.date, datetime) else datetime.strptime(str(e.date).split()[0], "%Y-%m-%d")
            amt = float(e.amount or 0)
            mk = d.strftime("%Y-%m")
            dk = d.strftime("%Y-%m-%d")
            wd = d.weekday()
        except: continue
        all_dates.add(dk)
        if str(e.type).lower()=="income":
            money_per_weekday[wd]+=amt
            days_per_weekday[wd].add(dk)
            money_per_month[mk]["income"]+=amt
            money_inc_cat[e.category or "Other"]+=amt
            total_income+=amt
        else:
            money_per_month[mk]["expense"]+=amt
            money_exp_cat[e.category or "Other"]+=amt
            total_expense+=amt
            if amt>biggest: biggest=amt

    busiest_idx = max(money_per_weekday, key=money_per_weekday.get) if money_per_weekday else None
    weakest_idx = min(money_per_weekday, key=money_per_weekday.get) if money_per_weekday else None
    busiest_name = calendar.day_name[busiest_idx] if busiest_idx is not None else None
    weakest_name = calendar.day_name[weakest_idx] if weakest_idx is not None else None
    busiest_total = money_per_weekday.get(busiest_idx,0) if busiest_idx is not None else 0
    weakest_total = money_per_weekday.get(weakest_idx,0) if weakest_idx is not None else 0
    busiest_avg = busiest_total / max(len(days_per_weekday.get(busiest_idx,set())),1) if busiest_idx is not None else 0
    weakest_avg = weakest_total / max(len(days_per_weekday.get(weakest_idx,set())),1) if weakest_idx is not None else 0
    real_avg_daily = total_income / max(len(all_dates),1)

    sorted_months = sorted(money_per_month.keys())
    # growth from first month WITH income to last month WITH income
    income_months = [k for k in sorted_months if money_per_month[k]["income"]>100]
    growth_rate = 0
    growth_text = "Need 2 months with sales"
    if len(income_months)>=2:
        first = income_months[0]
        last = income_months[-1]
        first_inc = money_per_month[first]["income"]
        last_inc = money_per_month[last]["income"]
        if first_inc>0:
            growth_rate = ((last_inc-first_inc)/first_inc)*100
            # ===== FIXED — CUSTOMER FRIENDLY MONTH NAMES =====
            try:
                fm = datetime.strptime(first, "%Y-%m")
                lm = datetime.strptime(last, "%Y-%m")
                first_f = fm.strftime("%b %Y")
                last_f = lm.strftime("%b %Y")
            except:
                first_f = first
                last_f = last
            growth_text = f"{first_f} to {last_f}: {growth_rate:.1f}% — Sales grew from {first_inc:,.0f} to {last_inc:,.0f}"

    net = total_income-total_expense
    margin = (net/total_income*100) if total_income else 0
    top_inc = max(money_inc_cat, key=money_inc_cat.get) if money_inc_cat else "Sales"
    top_exp = max(money_exp_cat, key=money_exp_cat.get) if money_exp_cat else "expenses"
    top_exp_amt = money_exp_cat.get(top_exp,0)
    top_exp_pct = (top_exp_amt/total_expense*100) if total_expense else 0
    this_key = sorted_months[-1] if sorted_months else None
    last_key = sorted_months[-2] if len(sorted_months)>=2 else None

    last_f = Forecast.query.filter_by(user_id=user_id).order_by(Forecast.created_at.desc()).first()
    real_goal = last_f.goal if last_f and hasattr(last_f,'goal') else None

    return {
        "business_type": top_inc.lower(),
        "busiest_day": busiest_name,"weakest_day": weakest_name,
        "busiest_day_income": busiest_total,"weakest_day_income": weakest_total,
        "busiest_day_avg": busiest_avg,"weakest_day_avg": weakest_avg,
        "avg_daily_income": real_avg_daily,
        "total_income": total_income,"total_expense": total_expense,
        "net_profit": net,"profit_margin": margin,
        "top_income_category": top_inc,"top_expense_category": top_exp,
        "top_expense_amount": top_exp_amt,"top_expense_percent": top_exp_pct,
        "total_months": len(sorted_months),"sorted_months": sorted_months,
        "this_month_key": this_key,"last_month_key": last_key,
        "this_month_expense": money_per_month[this_key]["expense"] if this_key else 0,
        "last_month_expense": money_per_month[last_key]["expense"] if last_key else 0,
        "biggest_single_expense": biggest,
        "growth_rate": growth_rate,"growth_text": growth_text,
        "income_by_month": {k:v["income"] for k,v in money_per_month.items()},
        "expense_by_month": {k:v["expense"] for k,v in money_per_month.items()},
        "monthly_expense": dict(money_per_month),
        "spending_pattern": dict(money_exp_cat),
        "income_by_weekday": {calendar.day_name[k]:v for k,v in money_per_weekday.items()},
        "last_goal": real_goal
    }

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
        generate_alerts_for_user(user_id)
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
    mem = get_business_memory(user_id)
    settings_obj = Settings.query.filter_by(user_id=user_id).first()
    currency = settings_obj.currency if settings_obj and settings_obj.currency else "USD"
    return jsonify({
        "year": date.today().year,
        "total_income": mem['total_income'],
        "total_expense": mem['total_expense'],
        "net_profit": mem['net_profit'],
        "currency": currency,
        "formatted": {
            "income": f"{CURRENCY_SYMBOLS.get(currency,'')}{mem['total_income']:,.2f}",
            "expense": f"{CURRENCY_SYMBOLS.get(currency,'')}{mem['total_expense']:,.2f}",
            "profit": f"{CURRENCY_SYMBOLS.get(currency,'')}{mem['net_profit']:,.2f}"
        }
    })

@app.route("/api/yearly-report", methods=["GET"])
def yearly_report_plain():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_id = verify_token_and_get_user(token)
    if not user_id:
        return jsonify({"error": "Invalid token"}), 401
    memory = get_business_memory(user_id)
    settings_obj = Settings.query.filter_by(user_id=user_id).first()
    currency = settings_obj.currency if settings_obj and settings_obj.currency else "USD"
    symbol = CURRENCY_SYMBOLS.get(currency, "$")
    months = memory.get("income_by_month", {})
    best_month = max(months, key=months.get) if months else "N/A"
    worst_month = min(months, key=months.get) if months else "N/A"
    return jsonify({
        "year": date.today().year,
        "plain_summary": f"You made {symbol}{memory['total_income']:,.0f} this year, spent {symbol}{memory['total_expense']:,.0f}. You kept {symbol}{memory['net_profit']:,.0f}. Best month was {best_month} ({symbol}{months.get(best_month,0):,.0f}), worst was {worst_month}.",
        "total_income": memory['total_income'],
        "total_expense": memory['total_expense'],
        "net_profit": memory['net_profit'],
        "best_month": best_month,
        "worst_month": worst_month,
        "monthly_breakdown": months,
        "memory": memory,
        "currency": currency,
        "symbol": symbol
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
    memory = get_business_memory(user_id)
    current_net = memory['net_profit']
    forecast_next = (memory['total_income'] * 1.1) - (memory['total_expense'] * 1.05)
    new_forecast = Forecast(user_id=user_id, current_net=current_net, forecast_next=forecast_next)
    db.session.add(new_forecast)
    db.session.commit()
    generate_alerts_for_user(user_id)
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
        "total_income": memory['total_income'],
        "total_expense": memory['total_expense']
    })

@app.route("/api/forecast-data", methods=["GET"])
def forecast_data_plain():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_id = verify_token_and_get_user(token)
    if not user_id:
        return jsonify({"error": "Invalid token"}), 401
    memory = get_business_memory(user_id)
    settings_obj = Settings.query.filter_by(user_id=user_id).first()
    currency = settings_obj.currency if settings_obj and settings_obj.currency else "USD"
    symbol = CURRENCY_SYMBOLS.get(currency, "$")
    top_cat = memory.get("top_expense_category") or "Rent"
    top_amount = memory.get("top_expense_amount") or 0
    busiest = memory.get("busiest_day") or "Saturday"
    net = memory['net_profit']
    avg_burn = (memory['total_expense'] / max(memory['total_months'],1)) if memory['total_months'] else memory['total_expense']
    months_left = f"{(net/avg_burn):.1f}" if avg_burn>0 and net>0 else "Many months" if net>=0 else "0"
    return jsonify({
        "plain_summary": f"You have {months_left} cash left. You make {symbol}{memory['total_income']:,.0f}, spend {symbol}{memory['total_expense']:,.0f}.",
        "plans": [
            {"name": f"Plan A - Cut {top_cat} 15%", "description": f"If you cut {top_cat} by 15%, you save {symbol}{top_amount*0.15:,.0f} every month.", "saving": top_amount*0.15, "success": 85, "action": f"Negotiate {top_cat} tomorrow"},
            {"name": f"Plan B - Push {busiest} Sales", "description": f"Sell 20% more on {busiest} — your best day. That adds {symbol}{memory['total_income']*0.2*0.4:,.0f} monthly.", "extra": memory['total_income']*0.08, "success": 70, "action": f"Stock more for {busiest}"},
            {"name": "Plan C - Combined", "description": f"Cut {top_cat} 10% + sell 10% more on {busiest}. You gain {symbol}{(top_amount*0.1)+(memory['total_income']*0.04):,.0f}/mo.", "success": 91, "action": "Do both this week"}
        ],
        "currency": currency,
        "symbol": symbol,
        "memory": memory,
        "current_net": net
    })

@app.route("/api/business-memory", methods=["GET"])
def business_memory():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_id = verify_token_and_get_user(token)
    if not user_id:
        return jsonify({"error": "Invalid token"}), 401
    memory = get_business_memory(user_id)
    settings_obj = Settings.query.filter_by(user_id=user_id).first()
    currency = settings_obj.currency if settings_obj and settings_obj.currency else "USD"
    memory["currency"] = currency
    memory["symbol"] = CURRENCY_SYMBOLS.get(currency, "$")
    memory["business_name"] = settings_obj.business_name if settings_obj else ""
    return jsonify(memory)

# ===== ASK-AI — 50+ QUESTIONS — DIFFERENT ANSWER PER QUESTION — NO SAME TEXT =====
@app.route("/api/ask-ai", methods=["POST"])
def ask_ai():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_id = verify_token_and_get_user(token)
    if not user_id:
        return jsonify({"error": "Invalid token"}), 401
    data = request.get_json() or {}
    question = (data.get("question") or data.get("goal") or "").strip()
    if not question:
        return jsonify({"error": "Question is required"}), 400

    memory = get_business_memory(user_id)
    totalRevenue = data.get("totalRevenue") or memory['total_income']
    totalExpenses = data.get("totalExpenses") or memory['total_expense']
    netProfit = data.get("netProfit") if data.get("netProfit") is not None else memory['net_profit']
    profitMargin = data.get("profitMargin") or memory['profit_margin']
    realRunway = data.get("realRunway") or "N/A"
    topExpense = data.get("topExpense")
    horizon = data.get("horizon", 12)
    currency = data.get("currency") or memory.get("currency") or "NGN"
    symbol = CURRENCY_SYMBOLS.get(currency, "₦")

    q = question.lower()
    top_name = topExpense[0] if topExpense else (memory.get("top_expense_category") or "Food")
    top_amount = (topExpense[1] if topExpense and len(topExpense)>1 else 0) or memory.get("top_expense_amount",0)
    busiest = memory.get("busiest_day") or "Friday"
    weakest = memory.get("weakest_day") or "Thursday"
    top_inc = memory.get("top_income_category") or "sales"
    avg_daily = memory.get("avg_daily_income",0)

    # OpenAI with REAL numbers — your edge
    openai_key = os.getenv("OPENAI_API_KEY")
    if openai_key:
        try:
            from openai import OpenAI
            client = OpenAI(api_key=openai_key)
            prompt = f"""REAL DATA: Income {symbol}{memory['total_income']:.0f} Expense {symbol}{memory['total_expense']:.0f} Net {symbol}{memory['net_profit']:.0f} Margin {memory['profit_margin']:.0f}% Top {memory['top_expense_category']} {symbol}{memory['top_expense_amount']:.0f} {memory['top_expense_percent']:.0f}% This {memory['this_month_key']} {symbol}{memory['this_month_expense']:.0f} Last {memory['last_month_key']} {symbol}{memory['last_month_expense']:.0f} Busiest {busiest} {symbol}{memory['busiest_day_income']:.0f} Weakest {weakest} {symbol}{memory['weakest_day_income']:.0f} Months {memory['total_months']} Biggest single {symbol}{memory['biggest_single_expense']:.0f} Q: {question} Detect language (English/Pidgin/French/Spanish/Yoruba/Igbo/Hausa) and answer SAME language. Return JSON only: {{"title":"...","plain":"2-3 lines with numbers","action":"tomorrow action","planD":{{"name":"...","success":0-100}}}}"""
            resp = client.chat.completions.create(model="gpt-4o-mini", messages=[{"role":"user","content":prompt}], temperature=0.7, max_tokens=400)
            content = resp.choices[0].message.content
            import json as json_lib
            s = content.find("{"); e = content.rfind("}")+1
            if s!=-1 and e!=-1:
                parsed = json_lib.loads(content[s:e])
                parsed["memory"] = memory
                parsed["meta"] = {"horizon": horizon, "realRunway": realRunway, "currency": currency}
                return jsonify(parsed)
        except Exception as err:
            print(f"OpenAI error: {err}")

    # FALLBACK — 50+ QUESTIONS — EACH DIFFERENT
    title = f"Answer for: {question}"
    if any(k in q for k in ["hire","employ","staff","worker","recruit","embauch","contratar"]):
        c=60000 if currency=="NGN" else 500; n=2 if "2" in q else 1; nn=netProfit-c*n
        plain=f"{'You CAN hire' if nn>=0 else 'You cannot hire'} {n} for {busiest}. Cost {symbol}{c*n:,.0f}/mo. Net {symbol}{netProfit:,.0f}->{symbol}{nn:,.0f}. Cash {realRunway} Best {busiest} {symbol}{memory['busiest_day_income']:,.0f}."
        action=f"Hire part-time {busiest} only test 2 weeks."; planD={"name":f"Hire {n}","cost":c*n,"success":68 if nn>=0 else 35}
    elif any(k in q for k in ["fridge","freezer","cold room","refrigerator"]):
        cost=150000 if currency=="NGN" else 800; plain=f"Fridge ~{symbol}{cost:,.0f}. You {'make' if netProfit>=0 else 'lose'} {symbol}{abs(netProfit):,.0f}/mo cash {realRunway}. Need {int(cost/max(abs(netProfit),1))} months."; action=f"Save {symbol}{top_amount*0.1:,.0f}/mo from {top_name} then buy used {symbol}{int(cost*0.5):,.0f}."; planD={"name":"Buy Fridge","cost":cost,"success":35}
    elif any(k in q for k in ["generator","gen","fuel","light","nepa","power"]):
        cost=250000 if currency=="NGN" else 600; plain=f"Generator {symbol}{cost:,.0f}. You lose {symbol}{abs(netProfit):,.0f}/mo fuel high on {weakest}. Saves light."; action=f"Buy small {symbol}{int(cost*0.6):,.0f} first, save fuel."; planD={"name":"Buy Generator","success":60}
    elif any(k in q for k in ["branch","new shop","second shop","open shop","shop 2"]):
        need=totalExpenses*3; plain=f"Branch needs {symbol}{need:,.0f} (3 months expense). You have income {symbol}{totalRevenue:,.0f}. {'CAN' if netProfit>0 and totalRevenue>need else 'Cannot yet'}."; action="Save 3 months expense first."; planD={"name":"Open Branch","success":78 if netProfit>0 else 40}
    elif any(k in q for k in ["equipment","machine","tools","grinder"]):
        plain=f"Equipment needs cash. You make {symbol}{netProfit:,.0f}/mo biggest {top_name} {symbol}{top_amount:,.0f}."; action=f"Cut {top_name} 10% first."; planD={"name":"Buy Equipment","success":55}
    elif any(k in q for k in ["discount","10% off","promo","what if","giveaway","bonus"]):
        loss=totalRevenue*0.10; plain=f"10% discount loses {symbol}{loss:,.0f}/mo Net {symbol}{netProfit:,.0f}->{symbol}{netProfit-loss:,.0f} Cash {realRunway} Busiest {busiest} can't cover."; action=f"Discount only on {weakest}."; planD={"name":"Discount","loss":loss,"success":30}
    elif any(k in q for k in ["rent","food is high","bills high","why high","expensive","loyer","too much cost"]):
        pct=int(top_amount/totalExpenses*100) if totalExpenses else int(memory['top_expense_percent']); plain=f"{top_name} high: {symbol}{top_amount:,.0f} = {pct}% of {symbol}{totalExpenses:,.0f}. Biggest single {symbol}{memory['biggest_single_expense']:,.0f} in {memory['this_month_key']}. {memory['this_month_key']} {symbol}{memory['this_month_expense']:,.0f} vs {memory['last_month_key']} {symbol}{memory['last_month_expense']:,.0f}."; action=f"Cut {top_name} 10% save {symbol}{top_amount*0.1:,.0f}/mo = {symbol}{top_amount*0.1*12:,.0f}/yr."; planD={"name":f"Cut {top_name}","saving":top_amount*0.1,"success":85}
    elif any(k in q for k in ["focus","busiest","best day","monday","tuesday","wednesday","thursday","friday","saturday","sunday","when to sell"]):
        plain=f"Focus {busiest}: {symbol}{memory['busiest_day_income']:,.0f} vs {weakest} {symbol}{memory['weakest_day_income']:,.0f} = {memory['busiest_day_income']/max(memory['weakest_day_income'],1)*100:.0f}% more. Best product {top_inc}."; action=f"Stock more {top_inc} on {busiest}, promo on {weakest}."; planD={"name":f"Focus {busiest}","success":88}
    elif any(k in q for k in ["profit","make more","grow","increase income","more money","how to make","increase profit"]):
        plain=f"You {'make' if netProfit>=0 else 'lose'} {symbol}{abs(netProfit):,.0f}/mo because {top_name} high and {weakest} weak. Keep {profitMargin:.0f}% per {symbol}100. Best {top_inc} on {busiest}."; action=f"1) Cut {top_name} 10% {symbol}{top_amount*0.1:,.0f} 2) Sell 20% more {busiest} 3) Promo {weakest}. Gain ~{symbol}{(top_amount*0.1+totalRevenue*0.05):,.0f}/mo."; planD={"name":"Grow Profit","success":79}
    elif any(k in q for k in ["customer","no dey come","patronize","client","no buy","slow sales","no sales"]):
        plain=f"Customers most {busiest} {symbol}{memory['busiest_day_income']:,.0f} least {weakest} {symbol}{memory['weakest_day_income']:,.0f}. {memory['total_months']} months data. {top_name} {memory['top_expense_percent']:.0f}% high."; action=f"Loyalty buy {busiest} get bonus {weakest} WhatsApp broadcast."; planD={"name":"Bring Customers","success":75}
    elif any(k in q for k in ["price","charge more","raise price","increase price","cost price"]):
        add=totalRevenue*0.05; plain=f"Raise {top_inc} 5% = +{symbol}{add:,.0f}/mo. You keep {profitMargin:.0f}% now low."; action=f"Test price rise on {busiest} first."; planD={"name":"Raise Price","success":71}
    elif any(k in q for k in ["cashflow","cash flow","runway","how long","money left","when finish","cash finish"]):
        plain=f"Cash {realRunway}. You make {symbol}{memory['total_income']:,.0f} spend {symbol}{memory['total_expense']:,.0f} net {symbol}{memory['net_profit']:,.0f}. Avg daily {symbol}{avg_daily:,.0f}."; action=f"Cut {top_name} 10% extends runway."; planD={"name":"Fix Cashflow","success":80}
    elif any(k in q for k in ["cost","reduce cost","cut cost","spending","expenses high"]):
        plain=f"Biggest {top_name} {symbol}{top_amount:,.0f} {memory['top_expense_percent']:.0f}% of {symbol}{totalExpenses:,.0f}. Others {', '.join(list(memory['spending_pattern'].keys())[:3])}."; action=f"Negotiate {top_name} tomorrow."; planD={"name":"Reduce Cost","success":82}
    elif any(k in q for k in ["margin","keep 20","20 from 100","from every 100","keep 20%"]):
        plain=f"You keep {profitMargin:.0f} per {symbol}100 now target 20. Need cut {top_name} {symbol}{top_amount*0.1:,.0f}/mo + sell 15% more {busiest}."; action=f"For every {symbol}100 sell keep {symbol}20 — cut {top_name}."; planD={"name":"Keep 20/100","success":72}
    elif any(k in q for k in ["close","shutdown","travel","japa","loan","borrow","credit","debt","sell business"]):
        plain=f"You have {realRunway} left losing {symbol}{abs(netProfit):,.0f}/mo. Loan/close adds cost. Fix {top_name} first."; action=f"Save {symbol}{top_amount*0.1:,.0f}/mo 2 weeks then decide."; planD={"name":"Save Business","success":66}
    elif any(k in q for k in ["stock","inventory","how much stock","how many pieces"]):
        need=int(memory['busiest_day_income']/1000) if memory['busiest_day_income'] else 5; plain=f"Need {need} pieces on {busiest}, {max(1,int(need*0.3))} on {weakest}. Avg daily {symbol}{avg_daily:,.0f}."; action=f"Stock {need} {busiest} morning."; planD={"name":"Stock Plan","success":77}
    elif any(k in q for k in ["season","growing","falling","growth","trend"]):
        g=memory['total_months']; plain=f"{g} months history. {memory['this_month_key']} expense {symbol}{memory['this_month_expense']:,.0f} vs {memory['last_month_key']} {symbol}{memory['last_month_expense']:,.0f}. Busiest {busiest}."; action=f"Track {busiest} trend next 2 weeks."; planD={"name":"Season","success":70}
    else:
        if netProfit<0:
            plain=f"You lose {symbol}{abs(netProfit):,.0f}/mo. Biggest {top_name} {symbol}{top_amount:,.0f} {memory['top_expense_percent']:.0f}%. Busiest {busiest} {symbol}{memory['busiest_day_income']:,.0f} weakest {weakest}. Cash {realRunway} {memory['total_months']} months."
        else:
            plain=f"You make {symbol}{netProfit:,.0f}/mo Income {symbol}{totalRevenue:,.0f} Expense {symbol}{totalExpenses:,.0f} Biggest {top_name} {symbol}{top_amount:,.0f} Busiest {busiest} weakest {weakest} Cash Many months."
        action=f"Best next: Cut {top_name} 10% save {symbol}{top_amount*0.1:,.0f}/mo Focus {busiest}."
        planD={"name":f"Plan D - {question[:20]}","success":78}

    return jsonify({"title":title,"plain":plain,"action":action,"planD":planD,"memory":memory,"meta":{"horizon":horizon,"realRunway":realRunway,"currency":currency,"question":question,"has_memory":True,"global":True}})

@app.route("/api/alerts", methods=["GET"])
def alerts():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_id = verify_token_and_get_user(token)
    if not user_id:
        return jsonify({"error": "Invalid token"}), 401
    alerts_list = generate_alerts_for_user(user_id)
    memory = get_business_memory(user_id)
    settings_obj = Settings.query.filter_by(user_id=user_id).first()
    currency = settings_obj.currency if settings_obj and settings_obj.currency else "USD"
    symbol = CURRENCY_SYMBOLS.get(currency, "")
    return jsonify({
        "counts": {
            "high": sum(1 for a in alerts_list if a.level == "high"),
            "medium": sum(1 for a in alerts_list if a.level == "medium"),
            "info": sum(1 for a in alerts_list if a.level == "info")
        },
        "alerts": [a.to_dict() for a in alerts_list],
        "totals": {
            "total_income": memory['total_income'],
            "total_expense": memory['total_expense'],
            "current_net": memory['net_profit'],
            "formatted_total_income": f"{symbol}{memory['total_income']:,.2f}",
            "formatted_total_expense": f"{symbol}{memory['total_expense']:,.2f}",
            "formatted_current_net": f"{symbol}{memory['net_profit']:,.2f}",
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

def generate_daily_alerts():
    with app.app_context():
        users = db.session.query(Entry.user_id).distinct().all()
        for (user_id,) in users:
            generate_alerts_for_user(user_id)
        print(f"Daily alerts refreshed at {date.today()}")

scheduler = BackgroundScheduler()
scheduler.add_job(func=generate_daily_alerts, trigger="cron", hour=0, minute=0)
scheduler.start()

@app.route("/")
def home():
    return """
    <html><head><title>Finsight AI</title><style>body{font-family:Arial,sans-serif;text-align:center;margin-top:100px;background:#f9f9f9}h1{color:#2c3e50}p{color:#34495e;font-size:18px}a{color:#2980b9;text-decoration:none}a:hover{text-decoration:underline}</style></head><body><h1>Welcome to Finsight AI</h1><p>Your financial insights, alerts, and forecasts — all in one place.</p><p><a href="/health">Check System Health</a></p></body></html>
    """

@app.route('/api/goal-plan', methods=['POST'])
def goal_plan():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_id = verify_token_and_get_user(token)
    data = request.get_json() or {}
    goal = data.get('goal', 'Increase profit by 20%')
    horizon = data.get('horizon', 12)
    memory = get_business_memory(user_id) if user_id else {}
    top_cat = memory.get('top_expense_category','Rent') if memory else 'Rent'
    top_amt = memory.get('top_expense_amount',0) if memory else 0
    busiest = memory.get('busiest_day','Saturday') if memory else 'Saturday'
    symbol = CURRENCY_SYMBOLS.get(memory.get('currency','NGN') if memory else 'NGN', '₦')
    plan = {
        "goal": goal,
        "horizon": horizon,
        "whatsNeededText": f"Cut {top_cat} 10% + sell 15% more on {busiest} to keep 20 per 100",
        "targetRevenue": top_amt*0.1*12 if top_amt else 120000,
        "moneySave": (top_amt*0.1*12 + (memory.get('total_income',0)*0.05)) if memory else 120000,
        "probability": 85,
        "difficulty": "Medium",
        "steps": [
            f"Reduce {top_cat} by 10% in next {horizon//2} months = save {symbol}{top_amt*0.1:,.0f}/mo",
            f"Increase sales on {busiest} by 15%",
            f"Promo on {memory.get('weakest_day','Thursday') if memory else 'Thursday'}"
        ],
        "projected_savings": top_amt*0.1*12 if top_amt else 120000,
        "confidence": 91,
        "business_type": memory.get('business_type','Retail') if memory else 'Retail',
        "memory": memory
    }
    return jsonify(plan), 200

@app.route('/api/daily-advice', methods=['GET'])
def daily_advice():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_id = verify_token_and_get_user(token)
    if not user_id:
        return jsonify({"advice": "Add transactions first"}), 200
    memory = get_business_memory(user_id)
    advice = {
        "advice": f"{memory.get('weakest_day','Monday')} is weakest. Promo on {memory.get('weakest_day','Monday')}. {memory.get('busiest_day','Saturday')} is busiest — stock up.",
        "busiest_day": memory.get('busiest_day'),
        "weakest_day": memory.get('weakest_day'),
        "top_expense": memory.get('top_expense_category'),
        "memory": memory
    }
    return jsonify(advice), 200

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)