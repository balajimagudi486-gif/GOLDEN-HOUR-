@echo off
title GoldenHour - Emergency Ambulance Dispatch
setlocal enabledelayedexpansion

echo =======================================================
echo   GoldenHour - Emergency Ambulance Dispatch Platform
echo.
echo   Frontend : http://localhost:5173
echo   Backend  : http://localhost:4000/api/health
echo.
echo   Open the frontend link in your browser after both
echo   servers report they are running.
echo =======================================================
echo.

cd /d "%~dp0"

rem --- Ensure Python is available for the FastAPI backend ---
where python >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Python was not found.
    echo Install Python 3.10+, then close this window and run again:
    echo     winget install --id Python.Python.3.12 --exact
    pause
    exit /b 1
)

rem --- Ensure npm is available for the React frontend ---
where npm.cmd >nul 2>nul
if errorlevel 1 (
    if exist "C:\Program Files\nodejs\npm.cmd" (
        set "PATH=C:\Program Files\nodejs;%PATH%"
    ) else (
        echo [ERROR] npm was not found.
        echo Install Node.js LTS, then close this window and run again:
        echo     winget install --id OpenJS.NodeJS.LTS --exact
        pause
        exit /b 1
    )
)

rem --- Install backend deps if missing ---
python -c "import fastapi, uvicorn, socketio" >nul 2>nul
if errorlevel 1 (
    echo [SETUP] Installing Python backend dependencies...
    pip install -r server\requirements.txt
)

rem --- Install frontend deps if missing ---
if not exist "client\node_modules" (
    echo [SETUP] Installing frontend dependencies...
    call npm.cmd install --prefix client
)

echo [START] Launching backend + frontend together...
echo [INFO] If the frontend link does not load, wait a few seconds and refresh.
echo.
call npm.cmd run dev

endlocal