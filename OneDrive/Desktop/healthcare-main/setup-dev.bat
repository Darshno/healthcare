@echo off
REM Startup script for local development with both Node and Python services (Windows)

echo =========================================
echo Healthcare System - Local Development Setup
echo =========================================
echo.

REM Check if docker-compose is installed
where docker-compose >nul 2>nul
if errorlevel 1 (
    echo ERROR: docker-compose is not installed
    echo Please install Docker Desktop: https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)

echo [*] Starting Docker services (PostgreSQL, Redis)...
docker-compose up -d postgres redis

echo.
echo [*] Waiting for services to be ready...
timeout /t 5 /nobreak

echo.
echo [OK] Docker services started
echo.

REM Check if environment files exist
if not exist .env (
    echo [*] Creating .env from .env.example...
    copy .env.example .env
)

if not exist python-service\.env (
    echo [*] Creating python-service\.env from .env.example...
    copy python-service\.env.example python-service\.env
)

echo.
echo [OK] Setup complete!
echo.
echo To start the application:
echo.
echo 1. NestJS Server:
echo    pnpm dev:server
echo.
echo 2. Python Analytics Service (in another terminal):
echo    cd python-service
echo    python -m venv venv
echo    venv\Scripts\activate
echo    pip install -r requirements.txt
echo    python -m uvicorn app.main:app --reload
echo.
echo 3. Metro/Web Dev Server (in another terminal):
echo    pnpm dev:metro
echo.
echo Or run everything with:
echo    pnpm dev
echo.
pause
