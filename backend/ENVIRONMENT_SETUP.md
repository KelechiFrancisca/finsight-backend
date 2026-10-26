# Environment Setup Guide

This document explains how to configure environment variables for development and production.

## Development Environment

### Step 1: Create `.env` File

```bash
cp .env.example .env
```

### Step 2: Configure for Local Development

Edit `.env` with your local database:

```bash
# For local PostgreSQL
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/founding_mvp
DB_NAME=founding_mvp
DB_USER=postgres
DB_PASSWORD=your_password
DB_HOST=localhost
DB_PORT=5432

# Security (use development values, change in production)
SECRET_KEY=dev-secret-key-change-this
JWT_SECRET_KEY=dev-jwt-secret-change-this

# Flask
FLASK_ENV=development
FLASK_DEBUG=True

# Logging
LOG_LEVEL=DEBUG
```

### Step 3: Load Environment Variables

```bash
# Verify variables are loaded
python -c "import os; print('DATABASE_URL:', os.environ.get('DATABASE_URL'))"
```

---

## Production Environment (Render)

### Step 1: Generate Secure Keys

```python
# Run in Python:
import secrets

secret_key = secrets.token_hex(32)
jwt_secret = secrets.token_hex(32)

print(f"SECRET_KEY={secret_key}")
print(f"JWT_SECRET_KEY={jwt_secret}")
```

### Step 2: Set Variables in Render

1. Go to Render dashboard
2. Select your service
3. Go to **Environment** tab
4. Add the following variables:

```
DATABASE_URL=postgresql://postgres.xxxxx:password@host:6543/postgres?sslmode=require
SECRET_KEY=<paste_generated_secret_key>
JWT_SECRET_KEY=<paste_generated_jwt_secret>
FLASK_ENV=production
FLASK_DEBUG=False
LOG_LEVEL=INFO
```

### Step 3: Verify Deployment

```bash
# Test health endpoint
curl https://your-app.onrender.com/health
```

---

## Environment Variables Reference

### Database Configuration

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | Full PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `DB_NAME` | Database name (fallback) | `founding_mvp` |
| `DB_USER` | Database user (fallback) | `postgres` |
| `DB_PASSWORD` | Database password (fallback) | `secure_password` |
| `DB_HOST` | Database host (fallback) | `localhost` |
| `DB_PORT` | Database port (fallback) | `5432` |

### Security

| Variable | Description | Requirements |
|----------|-------------|---------------|
| `SECRET_KEY` | Flask session key | Min 32 characters, random, unique |
| `JWT_SECRET_KEY` | JWT signing key | Min 32 characters, random, unique |

### Flask Configuration

| Variable | Description | Values |
|----------|-------------|--------|
| `FLASK_ENV` | Environment mode | `development` or `production` |
| `FLASK_DEBUG` | Enable debug mode | `True` (dev) or `False` (prod) |
| `LOG_LEVEL` | Logging verbosity | `DEBUG`, `INFO`, `WARNING`, `ERROR` |

---

## Managing Secrets Securely

### ✅ DO

- ✅ Use `.env.example` as a template (without secrets)
- ✅ Add `.env` to `.gitignore`
- ✅ Generate strong, random keys using `secrets` module
- ✅ Rotate keys periodically
- ✅ Use different keys for dev and production
- ✅ Store secrets in Render's environment variable manager

### ❌ DON'T

- ❌ Commit `.env` to Git
- ❌ Use weak or predictable keys
- ❌ Share secrets in chat, email, or code comments
- ❌ Use the same key for multiple environments
- ❌ Log sensitive values
- ❌ Hardcode secrets in source code

---

## Troubleshooting

### Variables Not Loading

**Problem**: Environment variables not recognized

**Solution**:
```bash
# On Linux/Mac - ensure .env is in the same directory as flask_app.py
# On Windows - check that .env file has no special characters

# Verify with:
python -c "import os; print(os.environ.get('DATABASE_URL'))"
```

### Render Not Picking Up Variables

**Problem**: Environment variables set in Render but not used by app

**Solution**:
1. Check variable names are exactly correct (case-sensitive)
2. Redeploy the service after adding variables
3. Check logs for errors: `os.environ.get('VAR_NAME')`
4. Use `.gitignore` to prevent accidental commits of `.env`

### Connection String Format

**For Supabase**:
```
postgresql://postgres.xxxxx:password@aws-region.pooler.supabase.com:6543/postgres?sslmode=require
```

**For Local PostgreSQL**:
```
postgresql://postgres:password@localhost:5432/founding_mvp
```

---

## .gitignore Configuration

Ensure these patterns are in `.gitignore`:

```
# Environment files
.env
.env.local
.env.*.local

# Don't ignore the example file
!.env.example
```

---

## Quick Reference Commands

```bash
# Generate a new secret key
python -c "import secrets; print(secrets.token_hex(32))"

# Test database connection
python test_psycopg2.py

# Run with custom environment
FLASK_ENV=development FLASK_DEBUG=True python flask_app.py

# View all environment variables
env | grep -E 'FLASK|DATABASE|SECRET|JWT'
```
