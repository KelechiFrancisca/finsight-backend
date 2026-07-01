from extensions import db
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime

class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255))
    email = db.Column(db.String(255), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    # ✅ Automatically create default Settings when a new user is added
    def create_default_settings(self):
        default_settings = Settings(
            user_id=self.id,
            business_name=self.name or "My Business",
            currency="USD"  # default currency
        )
        db.session.add(default_settings)
        db.session.commit()


class Entry(db.Model):
    __tablename__ = "entries"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    date = db.Column(db.String(50), nullable=False)
    type = db.Column(db.String(20), nullable=False)   # "income" or "expense"
    category = db.Column(db.String(50))
    description = db.Column(db.String(200))
    amount = db.Column(db.Float, nullable=False)

    user = db.relationship("User", backref=db.backref("entries", lazy=True))

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "date": self.date,
            "type": self.type,
            "category": self.category,
            "description": self.description,
            "amount": self.amount,
        }


class Forecast(db.Model):
    __tablename__ = "forecast"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    current_net = db.Column(db.Float)
    forecast_next = db.Column(db.Float)
    created_at = db.Column(db.DateTime, default=db.func.now())

    user = db.relationship("User", backref=db.backref("forecasts", lazy=True))

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "current_net": self.current_net,
            "forecast_next": self.forecast_next,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Alert(db.Model):
    __tablename__ = "alerts"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    level = db.Column(db.String(50))   # high, medium, info
    message = db.Column(db.String(255))
    type = db.Column(db.String(50))    # expense, revenue, churn, etc.
    created_at = db.Column(db.DateTime, default=db.func.now())

    # Workflow fields
    resolved = db.Column(db.Boolean, default=False)
    acknowledged = db.Column(db.Boolean, default=False)

    # Audit trail
    resolved_by = db.Column(db.Integer, nullable=True)
    resolved_at = db.Column(db.DateTime, nullable=True)
    acknowledged_at = db.Column(db.DateTime, nullable=True)

    # ✅ Notification fields
    notified_at = db.Column(db.DateTime, nullable=True)
    notification_type = db.Column(db.String(20), nullable=True)  # SMS, Email, Push

    user = db.relationship("User", backref=db.backref("alerts", lazy=True))

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "level": self.level,
            "message": self.message,
            "type": self.type,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "resolved": self.resolved,
            "acknowledged": self.acknowledged,
            "resolved_by": self.resolved_by,
            "resolved_at": str(self.resolved_at) if self.resolved_at else None,
            "acknowledged_at": str(self.acknowledged_at) if self.acknowledged_at else None,
            "notified_at": str(self.notified_at) if self.notified_at else None,
            "notification_type": self.notification_type,
        }


class Upload(db.Model):
    __tablename__ = "uploads"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    filename = db.Column(db.String(255))
    uploaded_at = db.Column(db.DateTime, default=db.func.now())

    user = db.relationship("User", backref=db.backref("uploads", lazy=True))

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "filename": self.filename,
            "uploaded_at": self.uploaded_at.isoformat() if self.uploaded_at else None,
        }


# ✅ New Settings model
class Settings(db.Model):
    __tablename__ = "settings"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    business_name = db.Column(db.String(255), nullable=True)
    currency = db.Column(db.String(50), nullable=True)

    user = db.relationship("User", backref=db.backref("settings", lazy=True))

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "business_name": self.business_name,
            "currency": self.currency,
        }
