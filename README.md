# BHEL Smart AI Visitor Management System (BHEL-SVMS)

**Enterprise-grade AI-powered visitor management for BHEL Varanasi**

---

## Overview

BHEL-SVMS automates the complete visitor lifecycle — registration, facial recognition entry/exit, host approval, QR passes, blacklist enforcement, and analytics — replacing manual registers with a real-time, secure, and auditable system.

---

## Architecture

```
┌────────────────────────────────────────────────────────┐
│                     NGINX (Reverse Proxy)               │
│              HTTPS · Rate Limiting · WebSocket          │
└────────┬───────────────────────────┬───────────────────┘
         │                           │
    ┌────▼────┐                 ┌────▼────┐
    │ Next.js │                 │ FastAPI │
    │Frontend │◄──── REST ─────►│Backend  │
    │ Port 3000│                │Port 8000│
    └─────────┘                └────┬────┘
                                    │
              ┌─────────────────────┼──────────────┐
              │                     │              │
         ┌────▼────┐          ┌─────▼────┐  ┌─────▼────┐
         │PostgreSQL│          │  Redis   │  │ Uploads  │
         │Port 5432 │          │Cache/WS  │  │ Storage  │
         └──────────┘          └──────────┘  └──────────┘
```

---

## Technology Stack

| Layer       | Technology                                          |
|-------------|-----------------------------------------------------|
| Frontend    | Next.js 15, React 18, TypeScript, Tailwind CSS      |
| Backend     | FastAPI, Python 3.11, Uvicorn (4 workers)           |
| Database    | PostgreSQL 16 with asyncpg                          |
| AI/CV       | DeepFace, InsightFace (buffalo_l), OpenCV, MediaPipe|
| Auth        | JWT (access + refresh tokens), bcrypt               |
| Real-time   | WebSockets (FastAPI native)                         |
| Cache       | Redis 7                                             |
| Deployment  | Docker, Docker Compose, Nginx                       |
| CI/CD       | GitHub Actions                                      |

---

## Quick Start

### Windows
```powershell
git clone https://github.com/your-org/bhel-vms.git
cd bhel-vms
.\scripts\setup.ps1
```

### Linux / macOS
```bash
git clone https://github.com/your-org/bhel-vms.git
cd bhel-vms
chmod +x scripts/setup.sh && ./scripts/setup.sh
```

After setup:
- **Frontend:** http://localhost:3000
- **API Docs:** http://localhost:8000/api/docs

Default credentials (change immediately):
| Role     | Username   | Password      |
|----------|------------|---------------|
| Admin    | admin      | Admin@BHEL2026|
| Security | security   | Admin@BHEL2026|
| Reception| reception  | Admin@BHEL2026|

---

## Project Structure

```
bhel-vms/
├── backend/
│   ├── app/
│   │   ├── api/v1/endpoints/     # REST API routes
│   │   │   ├── auth.py           # Login, JWT, user management
│   │   │   ├── visitors.py       # Visitor CRUD + face enrollment
│   │   │   ├── face_gate.py      # Entry/exit recognition
│   │   │   ├── dashboard.py      # Analytics endpoints
│   │   │   ├── approvals.py      # Host approval workflow
│   │   │   ├── blacklist.py      # Blacklist management
│   │   │   ├── reports.py        # CSV/Excel generation
│   │   │   └── websocket.py      # Real-time WS push
│   │   ├── ai/
│   │   │   ├── face_recognition/ # InsightFace + DeepFace pipeline
│   │   │   └── liveness/         # Anti-spoofing detection
│   │   ├── core/
│   │   │   ├── config.py         # Settings (pydantic-settings)
│   │   │   ├── database.py       # Async SQLAlchemy engine
│   │   │   ├── security.py       # JWT, bcrypt, password policy
│   │   │   └── deps.py           # FastAPI dependencies, RBAC
│   │   ├── models/               # SQLAlchemy ORM models
│   │   ├── schemas/              # Pydantic request/response schemas
│   │   ├── services/             # Business logic layer
│   │   └── middleware/           # Rate limiting, security headers
│   ├── alembic/                  # Database migrations
│   ├── tests/                    # pytest test suite
│   ├── Dockerfile
│   └── requirements.txt
│
├── frontend/
│   └── src/
│       ├── app/
│       │   ├── (auth)/login/         # Login page
│       │   └── (dashboard)/
│       │       ├── dashboard/        # Analytics dashboard
│       │       ├── registration/     # Visitor registration form
│       │       ├── entry-gate/       # Face scan entry
│       │       ├── exit-gate/        # Face scan exit
│       │       ├── visitors/         # Visitor search & list
│       │       ├── approvals/        # Host approval queue
│       │       ├── blacklist/        # Blacklist management
│       │       └── reports/          # Report generation
│       ├── components/
│       │   ├── dashboard/Sidebar.tsx
│       │   └── face/                 # Camera & liveness components
│       ├── lib/
│       │   ├── api.ts               # Axios client with auto-refresh
│       │   └── utils.ts
│       └── store/auth.ts            # Zustand auth store
│
├── nginx/nginx.conf                 # Reverse proxy + TLS config
├── scripts/
│   ├── setup.sh                     # Linux setup
│   ├── setup.ps1                    # Windows setup
│   └── init_db.sql                  # DB seed data
├── .github/workflows/ci-cd.yml     # GitHub Actions pipeline
└── docker-compose.yml
```

---

## API Reference

### Authentication
| Method | Endpoint                | Description                    |
|--------|-------------------------|--------------------------------|
| POST   | /api/v1/auth/login      | Login, returns JWT tokens      |
| POST   | /api/v1/auth/refresh    | Refresh access token           |
| GET    | /api/v1/auth/me         | Get current user profile       |
| POST   | /api/v1/auth/users      | Create user (Admin only)       |
| POST   | /api/v1/auth/logout     | Logout                         |

### Visitor Management
| Method | Endpoint                              | Description                    |
|--------|---------------------------------------|--------------------------------|
| POST   | /api/v1/visitors/register             | Register new visitor (public)  |
| POST   | /api/v1/visitors/enroll-face          | Enroll visitor face            |
| GET    | /api/v1/visitors                      | List/search visitors           |
| GET    | /api/v1/visitors/{visitor_id}         | Get visitor details            |
| GET    | /api/v1/visitors/{visitor_id}/entry-exit-logs | Visit history         |

### Gate Recognition
| Method | Endpoint                | Description                         |
|--------|-------------------------|-------------------------------------|
| POST   | /api/v1/gate/recognize  | Face recognition (entry or exit)    |
| POST   | /api/v1/gate/qr-verify  | QR code verification                |

### Dashboard
| Method | Endpoint                              | Description              |
|--------|---------------------------------------|--------------------------|
| GET    | /api/v1/dashboard/stats               | Real-time KPIs           |
| GET    | /api/v1/dashboard/daily-trend         | Day-by-day chart data    |
| GET    | /api/v1/dashboard/department-analytics| Dept-wise breakdown      |
| GET    | /api/v1/dashboard/hourly-distribution | Peak hours               |
| GET    | /api/v1/dashboard/active-visitors     | Currently inside campus  |

### Reports
| Method | Endpoint             | Description           |
|--------|----------------------|-----------------------|
| GET    | /api/v1/reports/csv  | Download CSV report   |
| GET    | /api/v1/reports/excel| Download Excel report |
| GET    | /api/v1/reports/summary | Aggregated summary |

---

## Face Recognition Pipeline

```
Camera Frame (JPEG)
      │
      ▼
Face Detection (InsightFace RetinaFace / YOLOv8)
      │
      ▼
Face Alignment & Quality Check
      │
      ▼
Liveness Detection (EAR blink + texture + reflection)
      │
      ▼
Embedding Generation (InsightFace buffalo_l / Facenet512)
      │
      ▼
Cosine Similarity Search against Visitor Database
      │
      ▼
Match Score ≥ 0.60 → Identity Confirmed
      │
      ▼
Blacklist Check → Entry/Exit Logged
```

**Performance targets:**
- Recognition accuracy: > 98%
- Response time: < 2 seconds
- Supports concurrent multi-face scenes

---

## Security

- JWT authentication with short-lived access tokens (8h) + refresh tokens (7d)
- bcrypt password hashing (cost factor 12)
- Role-based access control: Admin / Security Officer / Receptionist / Employee
- Rate limiting: 30 req/s general, 5 req/min for login (Nginx + FastAPI middleware)
- Security headers: HSTS, CSP, X-Frame-Options, nosniff
- Audit log: every login, approval, blacklist action, and gate event
- Face embeddings encrypted at rest (JSON column with DB-level encryption recommended for production)
- Camera snapshots stored separately from embeddings

---

## Database Schema (Key Tables)

| Table               | Purpose                                           |
|---------------------|---------------------------------------------------|
| visitors            | Core visitor data, face embedding, status         |
| entry_exit_logs     | Entry/exit timestamps, duration, recognition data |
| visitor_approvals   | Host approval workflow records                    |
| blacklisted_visitors| Restricted visitor registry                       |
| departments         | BHEL department master                            |
| employees           | Employee directory for host lookup                |
| users               | System users with roles                           |
| audit_logs          | Immutable event trail                             |

---

## Environment Variables

Copy `backend/.env.example` → `backend/.env` and set:

| Variable                    | Required | Description                          |
|-----------------------------|----------|--------------------------------------|
| SECRET_KEY                  | Yes      | App secret (64+ random chars)        |
| JWT_SECRET_KEY              | Yes      | JWT signing key (64+ random chars)   |
| POSTGRES_PASSWORD           | Yes      | PostgreSQL password                  |
| SMTP_USER / SMTP_PASSWORD   | No       | Email notifications                  |
| TWILIO_ACCOUNT_SID          | No       | SMS notifications                    |
| FACE_RECOGNITION_THRESHOLD  | No       | Default: 0.60 (lower = stricter)     |

---

## Production Deployment

1. **Provision Ubuntu 22.04 LTS server** (8 CPU, 16 GB RAM, GPU optional)
2. Install Docker Engine + Docker Compose Plugin
3. Clone repository to `/opt/bhel-vms`
4. Set production secrets in `backend/.env`
5. Place TLS certificates in `nginx/ssl/cert.pem` and `nginx/ssl/key.pem`
6. Run: `docker compose up -d`
7. Apply migrations: `docker compose exec backend alembic upgrade head`
8. Configure GitHub Secrets for CI/CD auto-deploy

---

## License

Proprietary — BHEL Varanasi Internal Use Only  
© 2026 Bharat Heavy Electricals Limited, Varanasi

Contributors: Divyansh Singh
