# Deployment Guide - Render & Supabase

This guide covers deploying the AI Business Insights Dashboard to Render with Supabase PostgreSQL.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Development Setup](#local-development-setup)
3. [Environment Variables](#environment-variables)
4. [Database Setup (Supabase)](#database-setup-supabase)
5. [Deploying to Render](#deploying-to-render)
6. [Post-Deployment](#post-deployment)
7. [Monitoring & Troubleshooting](#monitoring--troubleshooting)

---

## Prerequisites

- Git account (GitHub)
- Render account (render.com)
- Supabase account (supabase.com)
- Python 3.11+ (for local testing)
- Node.js 18+ (for frontend)

---

## Local Development Setup

### 1. Clone the Repository

\`\`\`bash
git clone https://github.com/manicloud111-netizen/ai-business-insights-dashboard.git
cd ai-business-insights-dashboard
\`\`\`

### 2. Create Virtual Environment

\`\`\`bash
python -m venv venv

# Activate (macOS/Linux)
source venv/bin/activate

# Activate (Windows)
venv\\Scripts\\activate
\`\`\`

### 3. Install Dependencies

\`\`\`bash
pip install -r requirements.txt
\`\`\`

### 4. Set Up Environment Variables

\`\`\`bash
cp .env.example .env
\`\`\`

Edit \`.env\` with your local database credentials for development.

### 5. Run Locally

\`\`\`bash
python flask_app.py
\`\`\`

The app will run at \`http://127.0.0.1:5000\`

---

## Environment Variables

All sensitive configuration is managed through environment variables. **Never commit \`.env\` to version control.**

### Required Variables

\`\`\`bash
# Supabase PostgreSQL Connection
DATABASE_URL=postgresql://user:password@host:port/database?sslmode=require

# Security Keys (generate strong random values)
SECRET_KEY=<32+ character random string>
JWT_SECRET_KEY=<32+ character random string>

# Flask Config
FLASK_ENV=production
FLASK_DEBUG=False

# Logging
LOG_LEVEL=INFO
\`\`\`

### Generating Secure Keys

\`\`\`python
import secrets
print(secrets.token_hex(32))  # Run twice, use output for both keys
\`\`\`

Or use the command line:

\`\`\`bash
openssl rand -hex 32
\`\`\`

---

## Database Setup (Supabase)

### 1. Create Supabase Project

- Go to https://supabase.com and create a new project
- Note your connection string (looks like: \`postgresql://postgres.xxx:password@xxx.pooler.supabase.com:6543/postgres?sslmode=require\`)

### 2. Create Database Tables

Run the following SQL in Supabase SQL Editor:

\`\`\`sql
-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Entries (Cashflow) table
CREATE TABLE IF NOT EXISTS entries (
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

-- Uploads table
CREATE TABLE IF NOT EXISTS uploads (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_entries_user_id ON entries(user_id);
CREATE INDEX idx_entries_date ON entries(date);
CREATE INDEX idx_uploads_user_id ON uploads(user_id);
\`\`\`

### 3. Verify Connection

Test the Supabase connection locally:

\`\`\`bash
python -c "import psycopg2; conn = psycopg2.connect(os.environ.get('DATABASE_URL')); print('Connected!')"
\`\`\`

---

## Deploying to Render

### 1. Push Code to GitHub

\`\`\`bash
git add .
git commit -m "chore: Deployment ready for Render"
git push origin main
\`\`\`

### 2. Create Render Web Service

1. Go to https://render.com and sign in
2. Click **New +** → **Web Service**
3. Connect your GitHub repository
4. Select the repository: \`ai-business-insights-dashboard\`
5. Fill in the configuration:

   - **Name**: \`ai-business-insights-dashboard\`
   - **Environment**: \`Python 3\`
   - **Build Command**: \`pip install -r requirements.txt\`
   - **Start Command**: \`gunicorn -w 4 -b 0.0.0.0:\$PORT flask_app:app\`

6. Click **Advanced** and add Environment Variables:

   - \`DATABASE_URL\`: Paste your Supabase connection string
   - \`SECRET_KEY\`: Paste generated secret key
   - \`JWT_SECRET_KEY\`: Paste generated JWT secret
   - \`FLASK_ENV\`: \`production\`
   - \`FLASK_DEBUG\`: \`False\`
   - \`LOG_LEVEL\`: \`INFO\`

7. Click **Create Web Service**

### 3. Monitor Deployment

- Render will automatically build and deploy from the \`main\` branch
- Watch the logs in the Render dashboard
- Your app will be live at: \`https://ai-business-insights-dashboard.onrender.com\`

---

## Post-Deployment

### 1. Verify Health Check

\`\`\`bash
curl https://ai-business-insights-dashboard.onrender.com/health
\`\`\`

Expected response:
\`\`\`json
{"status": "healthy", "database": "connected"}
\`\`\`

### 2. Test Authentication

\`\`\`bash
# Register
curl -X POST https://ai-business-insights-dashboard.onrender.com/register \\
  -H "Content-Type: application/json" \\
  -d '{"name": "Test User", "email": "test@example.com", "password": "secure_password"}'

# Login
curl -X POST https://ai-business-insights-dashboard.onrender.com/login \\
  -H "Content-Type: application/json" \\
  -d '{"email": "test@example.com", "password": "secure_password"}'
\`\`\`

### 3. Set Up Automatic Deployments

Render automatically deploys when you push to \`main\`. To change this:

1. Go to Render dashboard → Select your service
2. Go to **Settings** → **Deploy Hook**
3. Copy the webhook URL
4. (Optional) Add to GitHub Actions for additional control

---

## Monitoring & Troubleshooting

### Check Logs

In Render dashboard:
1. Select your service
2. Go to **Logs** tab
3. View real-time application logs

### Common Issues

#### Issue: Database Connection Failed

\`\`\`
Error: could not connect to database
\`\`\`

**Solution:**
- Verify \`DATABASE_URL\` is correct
- Check Supabase project is running
- Ensure database tables exist
- Test connection locally first

#### Issue: JWT Secret Not Set

\`\`\`
Error: Missing JWT_SECRET_KEY
\`\`\`

**Solution:**
- Add \`JWT_SECRET_KEY\` to Render environment variables
- Use a strong random string (32+ characters)

#### Issue: File Uploads Not Working

\`\`\`
Error: Uploads directory not found
\`\``

**Solution:**
- Render uses ephemeral storage (files deleted on restart)
- For persistent file storage, use AWS S3 or Supabase Storage
- Modify \`upload_file()\` to upload to S3 instead of local filesystem

### Debugging

1. **Increase logging**: Set \`LOG_LEVEL=DEBUG\` in Render environment
2. **Test locally**: Reproduce issues in local environment first
3. **Check database**: Connect to Supabase and verify data
4. **Monitor performance**: Use Render's analytics dashboard

---

## Frontend Deployment (React)

The React frontend can be deployed separately to:
- **Netlify** (recommended for free tier)
- **Vercel**
- **GitHub Pages**
- **Render Static Site**

Update your React \`.env\` to point to the Render backend:

\`\`\`
REACT_APP_API_URL=https://ai-business-insights-dashboard.onrender.com
\`\`\`

---

## Security Checklist

- ✅ Never commit \`.env\` to Git
- ✅ Use strong, random keys for \`SECRET_KEY\` and \`JWT_SECRET_KEY\`
- ✅ Enable HTTPS (Render provides free SSL)
- ✅ Use environment variables for all sensitive data
- ✅ Implement rate limiting for API endpoints
- ✅ Regular database backups (Supabase handles this)
- ✅ Monitor logs for suspicious activity
- ✅ Keep dependencies updated: \`pip install --upgrade -r requirements.txt\`

---

## Useful Links

- [Render Documentation](https://render.com/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Flask Documentation](https://flask.palletsprojects.com)
- [PostgreSQL Documentation](https://www.postgresql.org/docs)

---

## Support

For deployment issues, check:
1. Render logs in dashboard
2. Supabase database status
3. GitHub Actions workflow (if using CI/CD)
4. This guide's Troubleshooting section
