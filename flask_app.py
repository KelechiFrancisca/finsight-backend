from flask import Flask, request, jsonify
from flask_cors import CORS
import psycopg2
import numpy as np
from sklearn.linear_model import LinearRegression
<<<<<<< HEAD
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from psycopg2 import errors
import os
import secrets
print("********** VERSION JULY-06-2026 **********")

# JWT imports
=======
from werkzeug.security import generate_password_hash, check_password_hash
from psycopg2 import errors
import secrets
>>>>>>> 44fee21 (Initial backend commit)
from flask_jwt_extended import (
    JWTManager, create_access_token,
    jwt_required, get_jwt_identity
)

app = Flask(__name__)
<<<<<<< HEAD
app.config["PROPAGATE_EXCEPTIONS"] = True
CORS(app)

# ---------------- HOME ----------------

@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "message": "NEW VERSION DEPLOYED",
        "version": "July-06-2026"
    }), 200


@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "healthy"
    }), 200


@app.errorhandler(404)
def not_found(error):
    return jsonify({
        "error": "Route not found"
    }), 404


# ---------------- JWT ----------------

app.config["JWT_SECRET_KEY"] = os.getenv(
    "JWT_SECRET_KEY",
    secrets.token_hex(32)
)

jwt = JWTManager(app)

# --- Database connection helper ---
def get_db_connection():
    db_url = os.getenv("DATABASE_URL")
    if db_url:
        if db_url.startswith("postgres://"):
            db_url = db_url.replace("postgres://", "postgresql://", 1)

        return psycopg2.connect(db_url)

    # Fallback for local development
    return psycopg2.connect(
        dbname="founding_mvp",
        user="postgres",
        password="Francisca2026!",
        host="localhost",
        port="5432"
    )
# ---------------- AUTH ROUTES ----------------
@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()

    if not data:
        return jsonify({"error": "Request body must be JSON"}), 400

    required = ["name", "email", "password"]
    for field in required:
        if field not in data:
            return jsonify({"error": f"{field} is required"}), 400

    hashed_pw = generate_password_hash(data["password"])

    conn = None
    cursor = None

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute(
            """
            INSERT INTO users (name, email, password_hash, role)
            VALUES (%s, %s, %s, %s)
            """,
            (
                data["name"],
                data["email"],
                hashed_pw,
                data.get("role", "user"),
            ),
        )

        conn.commit()

        return jsonify({"message": "User registered successfully"}), 201

    except errors.UniqueViolation:
        if conn:
            conn.rollback()
        return jsonify({"error": "Email already exists"}), 400

    except Exception as e:
        import traceback
        traceback.print_exc()

        if conn:
            conn.rollback()

        return jsonify({"error": str(e)}), 500

    finally:
        if cursor:
            cursor.close()

        if conn:
            conn.close()
=======
CORS(app)

app.config["JWT_SECRET_KEY"] = secrets.token_hex(32)
jwt = JWTManager(app)

def get_db_connection():
<<<<<<<< HEAD:backend/flask_app.py
    db_url = os.environ.get("DATABASE_URL")
    if db_url:
        # Use Render’s hosted database
        return psycopg2.connect(db_url)
    else:
        # Fallback for local development
        return psycopg2.connect(
            dbname="founding_mvp",
            user="postgres",
            password="Francisca2026!",
            host="localhost",
            port="5432"
        )
# ---------------- AUTH ROUTES ----------------
========
    return psycopg2.connect(
        dbname="founding_mvp",
        user="postgres",
        password="Francisca2026!",  # replace with your password
        host="localhost",
        port="5432"
    )

# ---------------- AUTH ----------------
>>>>>>>> 44fee21 (Initial backend commit):flask_app.py
@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    hashed_pw = generate_password_hash(data['password'])
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO users (name, email, password_hash, role) VALUES (%s, %s, %s, %s)",
            (data['name'], data['email'], hashed_pw, data.get('role', 'user'))
        )
        conn.commit()
        return jsonify({"message": "User registered successfully"}), 201
    except errors.UniqueViolation:
        conn.rollback()
        return jsonify({"error": "Email already exists"}), 400
    finally:
        cursor.close()
        conn.close()
>>>>>>> 44fee21 (Initial backend commit)

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
<<<<<<< HEAD

    if not data:
        return jsonify({"error": "Request body must be JSON"}), 400

    if "email" not in data or "password" not in data:
        return jsonify({"error": "Email and password are required"}), 400

    conn = None
    cursor = None

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute(
            "SELECT id, password_hash FROM users WHERE email=%s",
            (data["email"],)
        )

        user = cursor.fetchone()

        if user is None or user[1] is None:
            return jsonify({"error": "User not found"}), 404

        if check_password_hash(user[1], data["password"]):
            token = create_access_token(identity=str(user[0]))
            return jsonify({
                "message": "Login successful",
                "token": token
            }), 200

        return jsonify({"error": "Invalid credentials"}), 401

    except Exception as e:
        import traceback
        traceback.print_exc()

        return jsonify({
            "error": str(e)
        }), 500

    finally:
        if cursor:
            cursor.close()

        if conn:
            conn.close()

# ---------------- PROFILE ROUTES ----------------
@app.route('/api/users/me', methods=['GET'])
@jwt_required()
def get_profile():
    user_id = get_jwt_identity()
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT name, email, role FROM users WHERE id=%s", (user_id,))
    user = cursor.fetchone()
    cursor.close()
    conn.close()
    if user:
        return jsonify({"name": user[0], "email": user[1], "role": user[2]})
    return jsonify({"error": "User not found"}), 404

@app.route('/api/users/me', methods=['PUT'])
@jwt_required()
def update_profile():
    user_id = get_jwt_identity()
    data = request.get_json()

    conn = None
    cursor = None

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute(
            """
            UPDATE users
            SET name=%s, email=%s, role=%s
            WHERE id=%s
            """,
            (
                data["name"],
                data["email"],
                data["role"],
                user_id,
            ),
        )

        conn.commit()
        return jsonify({"message": "Profile updated"}), 200

    except errors.UniqueViolation:
        if conn:
            conn.rollback()

        return jsonify({"error": "Email already exists"}), 400

    except Exception as e:
        if conn:
            conn.rollback()

        import traceback
        traceback.print_exc()

        return jsonify({"error": str(e)}), 500

    finally:
        if cursor:
            cursor.close()

        if conn:
            conn.close()

# ---------------- UPLOAD FILE ----------------
@app.route('/upload', methods=['POST'])
@jwt_required()
def upload_file():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    # Save file locally (or to cloud storage)
    os.makedirs("uploads", exist_ok=True)
    filepath = os.path.join("uploads", file.filename)
    file.save(filepath)

    # Save metadata in DB (optional)
    user_id = get_jwt_identity()
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO uploads (user_id, filename, filepath) VALUES (%s, %s, %s)",
        (user_id, file.filename, filepath),
    )
    conn.commit()

    cur.close()
    conn.close()

    return jsonify({"message": "File uploaded successfully", "filename": file.filename}), 201


# ---------------- CASHFLOW ROUTES ----------------
=======
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, password_hash FROM users WHERE email=%s", (data['email'],))
    user = cursor.fetchone()
    cursor.close()
    conn.close()

    if user is None or user[1] is None:
        return jsonify({"error": "User not found"}), 404

    if check_password_hash(user[1], data['password']):
        token = create_access_token(identity=str(user[0]))
        return jsonify({"message": "Login successful", "token": token}), 200
    else:
        return jsonify({"error": "Invalid credentials"}), 401

@app.route("/verify_token", methods=["GET"])
@jwt_required()
def verify_token():
    user_id = get_jwt_identity()
    return jsonify({"valid": True, "user_id": user_id}), 200

# ---------------- ENTRIES ----------------
>>>>>>> 44fee21 (Initial backend commit)
@app.route('/get_entries', methods=['GET'])
@jwt_required()
def get_entries():
    user_id = get_jwt_identity()
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM entries WHERE user_id = %s", (user_id,))
    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    entries = []
    for row in rows:
        entries.append({
            "id": row[0],
            "date": str(row[1]),
            "type": row[2],
            "category": row[3],
            "description": row[4],
<<<<<<< HEAD
            "amount": row[5],
=======
            "amount": float(row[5]),
>>>>>>> 44fee21 (Initial backend commit)
            "user_id": row[6]
        })
    return jsonify(entries)

@app.route('/add', methods=['POST'])
@jwt_required()
def add_entry_detailed():
    user_id = get_jwt_identity()
    data = request.get_json()
    conn = get_db_connection()
    cursor = conn.cursor()
<<<<<<< HEAD
    cursor.execute(
        "INSERT INTO entries (date, type, category, description, amount, user_id) VALUES (%s, %s, %s, %s, %s, %s)",
        (data['date'], data['type'], data['category'], data['description'], data['amount'], user_id)
    )
    conn.commit()
    cursor.close()
    conn.close()
    return jsonify({"message": "Detailed entry added successfully"}), 201
=======

    if isinstance(data, list):
        for entry in data:
            cursor.execute(
                "INSERT INTO entries (date, type, category, description, amount, user_id) VALUES (%s, %s, %s, %s, %s, %s)",
                (entry['date'], entry['type'].lower(), entry['category'], entry['description'], entry['amount'], user_id)
            )
    else:
        cursor.execute(
            "INSERT INTO entries (date, type, category, description, amount, user_id) VALUES (%s, %s, %s, %s, %s, %s)",
            (data['date'], data['type'].lower(), data['category'], data['description'], data['amount'], user_id)
        )

    conn.commit()
    cursor.close()
    conn.close()
    return jsonify({"message": "Entries added successfully"}), 201

@app.route('/delete_entry', methods=['DELETE'])
@jwt_required()
def delete_entry():
    user_id = get_jwt_identity()
    data = request.get_json()
    entry_id = data.get("id")

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM entries WHERE id=%s AND user_id=%s", (entry_id, user_id))
    conn.commit()
    cursor.close()
    conn.close()

    return jsonify({"message": "Entry deleted"}), 200
>>>>>>> 44fee21 (Initial backend commit)

@app.route('/forecast', methods=['GET'])
@jwt_required()
def forecast():
    user_id = get_jwt_identity()
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT date, type, amount FROM entries WHERE user_id=%s", (user_id,))
    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    if not rows:
        return jsonify({"error": "No data available"})

    monthly_net = {}
    for date, type_, amount in rows:
        month = str(date)[:7]
<<<<<<< HEAD
        monthly_net[month] = monthly_net.get(month, 0) + (amount if type_ == "income" else -amount)
=======
        monthly_net[month] = monthly_net.get(month, 0) + (amount if type_.lower() == "income" else -amount)
>>>>>>> 44fee21 (Initial backend commit)

    months = sorted(monthly_net.keys())
    X = np.arange(len(months)).reshape(-1, 1)
    y = np.array([monthly_net[m] for m in months])
    model = LinearRegression().fit(X, y)

    return jsonify({
        "current_net": float(y[-1]),
        "forecast_next": float(model.predict([[len(months)]])[0])
    })

@app.route('/alerts', methods=['GET'])
@jwt_required()
def get_alerts():
    user_id = get_jwt_identity()
    conn = get_db_connection()
    cur = conn.cursor()
<<<<<<< HEAD
    cur.execute("SELECT type, amount FROM entries WHERE user_id = %s", (user_id,))
    entries = cur.fetchall()

    cur.close()
    conn.close()

    income = sum(float(e[1]) for e in entries if e[0] == 'income')
    expenses = sum(float(e[1]) for e in entries if e[0] == 'expense')
    net_cashflow = income - expenses
=======

    cur.execute("SELECT type, amount FROM entries WHERE user_id = %s", (user_id,))
    entries = cur.fetchall()
    conn.close()

<<<<<<<< HEAD:backend/flask_app.py
    income = sum(float(e[1]) for e in entries if e[0] == 'income')
    expenses = sum(float(e[1]) for e in entries if e[0] == 'expense')
    net_cashflow = income - expenses
========
    alerts = []
    total_income = sum(r[1] for r in rows if r[0].lower() == "income")
    total_expenses = sum(r[1] for r in rows if r[0].lower() == "expense")
    net = total_income - total_expenses
>>>>>>>> 44fee21 (Initial backend commit):flask_app.py
>>>>>>> 44fee21 (Initial backend commit)

    alerts = []
    if net_cashflow < 1000:
        alerts.append("⚠ Net cashflow is below $1,000")
    if expenses > income:
        alerts.append("⚠ Expenses exceed income")

    # Add positive signals if no warnings
    if not alerts:
        if net_cashflow >= 5000:
            alerts.append("✅ Strong financial health")
        elif net_cashflow >= 1000:
            alerts.append("ℹ Stable finances")
        else:
            alerts.append("✅ Healthy finance")

    return jsonify(alerts)

<<<<<<< HEAD

# ---------------- MAIN ----------------
print("DATABASE_URL configured:", bool(os.getenv("DATABASE_URL")))
print("Registered Routes:")
print(app.url_map)
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
=======
<<<<<<<< HEAD:backend/flask_app.py

# ---------------- MAIN ----------------
========
>>>>>>>> 44fee21 (Initial backend commit):flask_app.py
if __name__ == "__main__":
    app.run(debug=True)

    print(app.url_map)

print("DATABASE_URL:", os.environ.get("DATABASE_URL"))
>>>>>>> 44fee21 (Initial backend commit)
