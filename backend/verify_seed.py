from app import app, db
from models import User, Entry
from werkzeug.security import check_password_hash

with app.app_context():
    # List all users
    users = User.query.all()
    for u in users:
        print("User:", u.id, u.name, u.email)
        print("Stored hash:", u.password_hash)
        print("Password check (demo123):", check_password_hash(u.password_hash, "demo123"))
        print("----")

    # List all entries
    entries = Entry.query.all()
    for e in entries:
        print("Entry:", e.id, e.type, e.category, e.amount, "User:", e.user_id)
