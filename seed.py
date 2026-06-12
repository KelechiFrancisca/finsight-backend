from app import app, db
from models import User, Entry

with app.app_context():
    # Clear existing data
    db.drop_all()
    db.create_all()

    # Create demo user
    user = User(name="Francisca", email="demo@example.com")
    user.set_password("password123")
    db.session.add(user)
    db.session.commit()

    # Add sample entries
    entries = [
        Entry(user_id=user.id, date="2026-06-01", type="income",
              category="Sales", description="Product sale", amount=6000),
        Entry(user_id=user.id, date="2026-06-02", type="expense",
              category="Rent", description="Office rent", amount=2000),
        Entry(user_id=user.id, date="2026-06-03", type="expense",
              category="Utilities", description="Electricity bill", amount=500),
        Entry(user_id=user.id, date="2026-06-04", type="income",
              category="Consulting", description="Client project", amount=3000),
    ]

    db.session.add_all(entries)
    db.session.commit()

    print("✅ Seed data inserted successfully!")
