from app import app, db
from models import User, Entry
from werkzeug.security import generate_password_hash

with app.app_context():
    # Reset database
    db.drop_all()
    db.create_all()

    # Create demo user with proper password hashing
    hashed_pw = generate_password_hash("demo123", method="pbkdf2:sha256")
    user = User(name="Francisca", email="demo_user@mail.com", password_hash=hashed_pw)
    db.session.add(user)
    db.session.commit()

    # Add sample entries (negative cashflow scenario)
    entries = [
        # Income
        Entry(user_id=user.id, date="2026-06-01", type="income",
              category="Sales", description="Product sale", amount=6000),
        Entry(user_id=user.id, date="2026-06-04", type="income",
              category="Consulting", description="Client project", amount=3000),

        # Expenses (deliberately much higher than income)
        Entry(user_id=user.id, date="2026-06-02", type="expense",
              category="Rent", description="Office rent", amount=20000),
        Entry(user_id=user.id, date="2026-06-03", type="expense",
              category="Utilities", description="Electricity bill", amount=5000),
        Entry(user_id=user.id, date="2026-06-05", type="expense",
              category="Marketing", description="Ad campaign overspend", amount=10000),
    ]

    db.session.add_all(entries)
    db.session.commit()

    print("✅ Seed data inserted successfully with negative cashflow scenario!")
