from extensions import db
from werkzeug.security import generate_password_hash, check_password_hash

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
    level = db.Column(db.String(50))
    message = db.Column(db.String(255))
    type = db.Column(db.String(50))   # ✅ added type field
    created_at = db.Column(db.DateTime, default=db.func.now())
    resolved = db.Column(db.Boolean, default=False)   # ✅ added resolved field

    user = db.relationship("User", backref=db.backref("alerts", lazy=True))

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "level": self.level,
            "message": self.message,
            "type": self.type,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "resolved": self.resolved
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
