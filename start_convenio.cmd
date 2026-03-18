@echo off
setlocal enabledelayedexpansion

REM ============================================================
REM CONVENIO FULL STACK LAUNCHER (Windows CMD)
REM Order:
REM   1) Docker check
REM   2) Start DB via docker compose
REM   3) Free backend port
REM   4) Backend (uvicorn)
REM   5) Stripe listener
REM   6) Frontend
REM ============================================================

REM ===== CONFIG =====
set PROJECT_ROOT=C:\Users\Dwealibob\Desktop\convenio
set BACKEND_DIR=%PROJECT_ROOT%\backend
set FRONTEND_DIR=%PROJECT_ROOT%\frontend
set BACKEND_HOST=127.0.0.1
set BACKEND_PORT=9000
set DB_SERVICE=db
set STRIPE_FORWARD=http://%BACKEND_HOST%:%BACKEND_PORT%/payments/stripe/webhook

echo.
echo ================================
echo      CONVENIO STARTUP
echo ================================
echo.

REM ===== STEP 1: Docker =====
echo [1/6] Checking Docker engine...
docker version >nul 2>nul
if errorlevel 1 (
    echo.
    echo [FAIL] Docker is not running.
    echo Start Docker Desktop and wait until it says RUNNING.
    echo.
    pause
    exit /b 1
)
echo [OK] Docker reachable.

REM ===== STEP 2: Database =====
echo.
echo [2/6] Starting database...
cd /d "%PROJECT_ROOT%"

docker compose up -d %DB_SERVICE% >nul 2>nul
if errorlevel 1 (
    echo [INFO] DB service name not found, starting full compose...
    docker compose up -d
    if errorlevel 1 (
        echo [FAIL] docker compose failed. Missing docker-compose.yml?
        pause
        exit /b 1
    )
)

echo [OK] Docker compose started.

REM ===== STEP 3: Free port =====
echo.
echo [3/6] Freeing backend port %BACKEND_PORT%...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr :%BACKEND_PORT% ^| findstr LISTENING') do (
    echo Killing PID %%P
    taskkill /PID %%P /F >nul 2>nul
)

REM ===== STEP 4: Backend =====
echo.
echo [4/6] Starting backend...
if not exist "%BACKEND_DIR%" (
    echo Backend folder missing: %BACKEND_DIR%
    pause
    exit /b 1
)

start "CONVENIO BACKEND" cmd /k "cd /d %BACKEND_DIR% && .\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host %BACKEND_HOST% --port %BACKEND_PORT%"

REM ===== STEP 5: Stripe =====
echo.
echo [5/6] Starting Stripe listener...
where stripe >nul 2>nul
if errorlevel 1 (
    echo Stripe CLI not installed — skipping listener
) else (
    start "CONVENIO STRIPE" cmd /k "cd /d %PROJECT_ROOT% && stripe listen --forward-to %STRIPE_FORWARD%"
)

REM ===== STEP 6: Frontend =====
echo.
echo [6/6] Starting frontend...
if not exist "%FRONTEND_DIR%" (
    echo Frontend folder missing: %FRONTEND_DIR%
    pause
    exit /b 1
)

start "CONVENIO FRONTEND" cmd /k "cd /d %FRONTEND_DIR% && npm run dev"

echo.
echo =====================================
echo All services launched.
echo Backend:  http://127.0.0.1:9000/docs
echo Frontend: http://localhost:3000
echo =====================================
echo.

pause
endlocal