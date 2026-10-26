# Application Architecture

## Overview

The AI Business Insights Dashboard is a full-stack web application for financial management and forecasting.

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React)                         │
│                  (localhost:3000)                           │
│                                                             │
│  - Dashboard UI                                             │
│  - User Authentication                                      │
│  - Cashflow Management                                      │
│  - Financial Forecasting Visualization                      │
└─────────────────────────────────────┬─────────────────────────┘
                         │ CORS-enabled HTTP/S
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  Backend (Flask)                            │
│              (Render: onrender.com)                         │
│                                                             │
│  - REST API Endpoints                                       │
│  - JWT Authentication                                       │
│  - Business Logic                                           │
│  - Data Processing (NumPy, Scikit-learn)                    │
└─────────────────────────────────────┬─────────────────────────┘
                         │ Connection Pool (psycopg2)
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              Database (PostgreSQL)                          │
│          (Supabase: aws-1-eu-north-1)                       │
│                                                             │
│  - Users Table                                              │
│  - Entries Table (Cashflow)                                 │
│  - Uploads Table                                            │
└─────────────────────────────────────────────────────────────┘
```

---

## Backend Architecture

### Technology Stack

- **Framework**: Flask 3.1.3
- **Web Server**: Gunicorn (4 workers)
- **Database**: PostgreSQL 15 (Supabase managed)
- **Database Driver**: psycopg2-binary 2.9.11
- **Authentication**: JWT (flask-jwt-extended 4.5.2)
- **CORS**: flask-cors 4.0.0

### Project Structure

```
.
├── flask_app.py                 # Main application file
├── requirements.txt             # Python dependencies
├── runtime.txt                  # Python version (3.11.10)
├── Procfile                     # Gunicorn configuration
├── .env.example                 # Environment variable template
├── .gitignore                   # Git exclusions
│
├── DEPLOYMENT.md                # Render deployment guide
├── ENVIRONMENT_SETUP.md         # Environment configuration
├── ARCHITECTURE.md              # This file
├── README.md                    # Project overview
│
├── .github/
│   └── workflows/
│       └── deploy.yml           # GitHub Actions CI/CD
│
├── uploads/                     # File uploads directory (ephemeral)
├── frontend/                    # React application
│   └── my-app/
│       ├── public/
│       ├── src/
│       ├── package.json
│       └── ...
│
├── docs/                        # Documentation
├── tests/                       # Test files
├── ml/                          # ML models directory
└── backend/                     # Legacy backend files (can be removed)
```

### API Endpoints

#### Authentication

```
POST   /register          Register new user
POST   /login             User login (returns JWT token)
```

#### User Profile

```
GET    /api/users/me      Get current user profile
PUT    /api/users/me      Update user profile
```

#### File Upload

```
POST   /upload            Upload file (requires JWT)
```

#### Cashflow Management

```
GET    /get_entries       Get all entries for user
POST   /add               Add new cashflow entry
GET    /forecast          Get financial forecast
GET    /alerts            Get financial alerts
```

#### Health Check

```
GET    /health            Application health status
```

### Database Schema

#### Users Table

```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Entries Table (Cashflow)

```sql
CREATE TABLE entries (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('income', 'expense')),
    category VARCHAR(100),
    description TEXT,
    amount DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Uploads Table

```sql
CREATE TABLE uploads (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Authentication Flow

1. **Registration**
   - User submits email, name, password
   - Password is hashed with Werkzeug
   - User record created in database

2. **Login**
   - User submits email and password
   - Password verified against stored hash
   - JWT token generated and returned

3. **Request Authentication**
   - Client includes JWT in `Authorization: Bearer <token>` header
   - Flask-JWT-Extended validates token
   - User ID extracted and available in route handlers

### Data Processing Pipeline

1. **Cashflow Entry**
   - User submits date, type (income/expense), amount
   - Entry validated and stored in database
   - Indexed by user_id for fast retrieval

2. **Financial Forecast**
   - Query historical entries for user
   - Aggregate by month (income - expenses)
   - Fit Linear Regression model
   - Predict next month's cashflow

3. **Alerts Generation**
   - Calculate total income and expenses
   - Determine net cashflow
   - Generate alerts based on thresholds

---

## Frontend Architecture

### Technology Stack

- **Framework**: React 18
- **Build Tool**: Create React App
- **HTTP Client**: Fetch API or Axios
- **State Management**: React Hooks

### Key Features

- User registration and login
- Cashflow entry management (CRUD)
- Financial dashboard with charts
- Forecast visualization
- File upload support

---

## Deployment Architecture

### Render (Backend)

- **Service Type**: Web Service
- **Environment**: Python 3.11
- **Workers**: 4 Gunicorn workers
- **Memory**: 512 MB (free tier)
- **Disk**: Ephemeral (files deleted on restart)
- **URL**: `https://ai-business-insights-dashboard.onrender.com`
- **Auto-Deploy**: On push to main branch

### Supabase (Database)

- **Type**: Managed PostgreSQL
- **Region**: EU North 1 (AWS)
- **Version**: PostgreSQL 15
- **Plan**: Free tier (500 MB)
- **Connection**: Connection pooling via pgBouncer
- **Backups**: Daily automated backups

### Environment Variables (Render)

```
DATABASE_URL        → Supabase connection string
SECRET_KEY          → Flask session key
JWT_SECRET_KEY      → JWT signing key
FLASK_ENV           → production
FLASK_DEBUG         → False
LOG_LEVEL           → INFO
```

---

## Security Architecture

### Authentication & Authorization

- JWT tokens for stateless authentication
- Password hashing with Werkzeug (PBKDF2)
- User ID extracted from JWT claims
- Role-based access control (user/admin)

### Data Protection

- HTTPS/SSL enforced (Render + Supabase)
- Database credentials never exposed in code
- Sensitive data in environment variables only
- SQL injection prevention via parameterized queries

### API Security

- CORS enabled for frontend domain
- JWT required for protected endpoints
- Input validation on all endpoints
- Error handling without exposing internals

---

## Scaling Considerations

### Current (Free Tier)

- Render: 512 MB RAM, 1 shared CPU
- Supabase: 500 MB database
- Suitable for MVP with <100 users

### Future Scaling

1. **Database**: Upgrade Supabase plan (1 GB → 2 GB → 10 GB)
2. **Backend**: Upgrade Render to paid tier
3. **Caching**: Add Redis for session/cache layer
4. **CDN**: Add CloudFlare for static assets
5. **Storage**: Integrate AWS S3 for file uploads
6. **Monitoring**: Add Sentry for error tracking

---

## Monitoring & Observability

### Logging

- Python logging module configured
- Log levels: DEBUG, INFO, WARNING, ERROR
- Logs visible in Render dashboard

### Health Checks

- `/health` endpoint checks database connectivity
- Render monitors HTTP status codes
- Auto-restart on failure

### Database Monitoring

- Supabase dashboard shows query performance
- Monitor connection pool usage
- Track database storage quota

---

## Development Workflow

1. **Local Development**
   - Create feature branch
   - Make changes
   - Test locally with `.env` file
   - Run linting and tests

2. **Pull Request**
   - GitHub Actions runs tests
   - Code review required

3. **Deployment**
   - Merge to main
   - GitHub Actions deploys to Render
   - Database migrations (if needed) run manually
   - Verify health endpoint

---

## Troubleshooting

See `DEPLOYMENT.md` for detailed troubleshooting guide.
