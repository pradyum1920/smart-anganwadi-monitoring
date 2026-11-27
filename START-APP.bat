@echo off
echo ============================================================
echo   Smart Anganwadi Monitoring System - Local Startup
echo ============================================================
echo.

REM Start the local Supabase stack and apply pending schema migrations.
echo Starting local Supabase Postgres...
call npx supabase start
if errorlevel 1 (
    echo [ERROR] Supabase could not start. Make sure Docker Desktop is running.
    exit /b 1
)
call npx supabase db push
if errorlevel 1 (
    echo [ERROR] Could not apply Supabase database migrations.
    exit /b 1
)

echo.
echo Starting backend (port 5000) and frontend (port 5173)...
echo.
echo   Frontend: http://localhost:5173
echo   Backend:  http://localhost:5000
echo   Health:   http://localhost:5000/api/health
echo.
echo   Default Admin Login: username="administration"  password="123"
echo   School Login: Select school from dropdown, password="123"
echo.
echo Press Ctrl+C to stop all servers.
echo ============================================================
echo.

cd /d "%~dp0"
npm run start:local
