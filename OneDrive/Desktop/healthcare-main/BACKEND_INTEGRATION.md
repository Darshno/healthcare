# Backend Integration Guide

## Architecture Overview

The healthcare system consists of three main services working together:

1. **NestJS Server** (port 3000) - Main API backend
2. **Python Analytics Service** (port 8000) - Analytics and reporting
3. **Client App** (port 8081) - React Native/Expo web client

## What Was Connected

### 1. **Analytics Module in NestJS** (`server/modules/analytics/`)

- `analytics.service.ts` - Service that calls the Python analytics API
- `analytics.controller.ts` - REST endpoints for analytics (protected by JWT)
- `analytics.module.ts` - NestJS module configuration

### 2. **tRPC Analytics Router** (`server/analyticsRouter.ts`)

- Exposes analytics functionality via tRPC for type-safe client calls
- Endpoints:
  - `analytics.facilityDashboard()` - Get facility dashboard metrics
  - `analytics.waitTimes()` - Get queue wait times
  - `analytics.dailyReport()` - Get daily facility report
  - `analytics.weeklyReport()` - Get weekly facility report
  - `analytics.monthlyReport()` - Get monthly facility report
  - `analytics.pythonServiceHealth()` - Check if Python service is running

### 3. **Configuration Files**

- `.env.example` - NestJS environment variables
- `python-service/.env.example` - Python service environment variables
- `docker-compose.yml` - Docker Compose for local development

### 4. **Development Setup Scripts**

- `setup-dev.sh` - Linux/Mac startup script
- `setup-dev.bat` - Windows startup script

## Local Development Setup

### Prerequisites

- Node.js 18+ / npm or pnpm
- Python 3.12+
- Docker & Docker Compose
- PostgreSQL 16+ (via Docker)
- Redis 7+ (via Docker)

### Quick Start

#### Windows:

```powershell
# 1. Run the setup script
.\setup-dev.bat

# 2. In terminal 1: Start NestJS server
pnpm dev:server

# 3. In terminal 2: Start Python service
cd python-service
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn app.main:app --reload

# 4. In terminal 3: Start Metro/Web
pnpm dev:metro
```

#### Linux/Mac:

```bash
# 1. Run the setup script
bash setup-dev.sh

# 2. In terminal 1: Start NestJS server
pnpm dev:server

# 3. In terminal 2: Start Python service
cd python-service
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python -m uvicorn app.main:app --reload

# 4. In terminal 3: Start Metro/Web
pnpm dev:metro
```

### Using Docker Compose

Start all services (except NestJS and Metro, which run locally):

```bash
docker-compose up -d
```

This starts:

- PostgreSQL on port 5432
- Redis on port 6379
- Python Analytics Service on port 8000

## Environment Variables

### `.env` (NestJS Server)

```
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/healthcare
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key-change-in-production
PYTHON_SERVICE_URL=http://localhost:8000
```

### `python-service/.env` (Analytics Service)

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/healthcare
REDIS_URL=redis://localhost:6379
NESTJS_API_URL=http://localhost:3000
CORS_ORIGIN=*
JWT_SECRET=your-secret-key-change-in-production
PORT=8000
```

## API Endpoints

### REST Endpoints (NestJS)

- `GET /api/analytics/facility/:facilityId/dashboard` - Facility dashboard (protected)
- `GET /api/analytics/facility/:facilityId/wait-times?hours=24` - Wait times (protected)
- `GET /api/analytics/health` - Python service health check (protected)

### tRPC Endpoints

Client-side calls:

```typescript
// Get facility dashboard
await trpc.analytics.facilityDashboard.query({ facilityId: 1 });

// Get wait times
await trpc.analytics.waitTimes.query({ facilityId: 1, hours: 24 });

// Get daily report
await trpc.analytics.dailyReport.query({ facilityId: 1, date: "2024-01-15" });

// Check Python service health
await trpc.analytics.pythonServiceHealth.query();
```

### Python Service Endpoints

- `GET /api/analytics/facility/{facility_id}/dashboard` - Dashboard metrics
- `GET /api/analytics/facility/{facility_id}/wait-times?hours=24` - Wait times analysis
- `GET /api/reports/facility/{facility_id}/daily?date=YYYY-MM-DD` - Daily report
- `GET /api/reports/facility/{facility_id}/weekly` - Weekly report
- `GET /api/reports/facility/{facility_id}/monthly` - Monthly report
- `GET /api/health` - Health check
- `GET /docs` - API documentation (Swagger UI)

## Database Schema

Both services share the same PostgreSQL database with these tables:

- `patients` - Patient records
- `queue_entries` - Queue management
- `triage_results` - Triage assessments
- `teleconsult_sessions` - Teleconsult data
- `sync_operations` - Sync tracking

The Python service only reads from these tables to generate analytics.

## Health Checks

### Check Python Service:

```bash
curl http://localhost:8000/api/health
```

### Check NestJS Server:

```bash
curl http://localhost:3000/api/health
```

### Check Analytics Connection via NestJS:

```bash
curl -H "Authorization: Bearer <your-jwt-token>" \
  http://localhost:3000/api/analytics/health
```

## Troubleshooting

### Python Service Not Connecting

1. Verify Python service is running on `http://localhost:8000`
2. Check `PYTHON_SERVICE_URL` in `.env`
3. Check network connectivity: `curl http://localhost:8000/api/health`

### Database Connection Issues

1. Ensure PostgreSQL is running: `docker-compose ps`
2. Verify `DATABASE_URL` in both `.env` files
3. Run migrations: `pnpm db:migration:run`

### CORS Issues

1. Check `CORS_ORIGIN` in Python service `.env`
2. Verify `CORS_ORIGIN` in NestJS `.env` matches your client URL

### Port Conflicts

- NestJS: 3000
- Python: 8000
- Metro/Web: 8081
- PostgreSQL: 5432
- Redis: 6379

## Next Steps

1. **Add more analytics endpoints** in `python-service/app/routers/`
2. **Update UI components** to call analytics via tRPC
3. **Add real-time analytics** using WebSockets or Server-Sent Events
4. **Deploy to production** with proper environment configurations

## Files Modified

- `server/app.module.ts` - Added AnalyticsModule
- `server/routers.ts` - Added analytics router
- `server/analyticsRouter.ts` - New analytics tRPC router
- `server/modules/analytics/` - New analytics module (service + controller)
- `.env.example` - Environment template
- `python-service/.env.example` - Python env template
- `docker-compose.yml` - Docker services
- `setup-dev.sh` - Linux/Mac setup script
- `setup-dev.bat` - Windows setup script
- `python-service/app/main.py` - Enhanced logging
