@echo off
echo ============================================================
echo   Smart Anganwadi Monitoring System - Local Startup
echo ============================================================
echo.

REM Check if MongoDB is running
echo Checking MongoDB status...
tasklist /fi "imagename eq mongod.exe" 2>NUL | find /I /N "mongod.exe" >NUL
if "%ERRORLEVEL%"=="0" (
    echo [OK] MongoDB is already running.
) else (
    echo Starting MongoDB...
    start "" /B "C:\Program Files\MongoDB\Server\8.2\bin\mongod.exe" --config "C:\Program Files\MongoDB\Server\8.2\bin\mongod.cfg"
    timeout /t 4 /nobreak >NUL
    echo [OK] MongoDB started.
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
