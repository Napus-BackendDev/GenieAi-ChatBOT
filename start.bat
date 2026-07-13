@echo off
title GenieAI Launcher
cd /d "%~dp0"

echo ==================================================
echo    GenieAI - starting the whole system...
echo    (Backend + Frontend). Please wait.
echo ==================================================
echo.

REM ---------- Backend ----------
cd backend
if not exist "venv\Scripts\python.exe" (
  echo [Setup] First run: creating the Python environment...
  python -m venv venv
  echo [Setup] Installing backend parts ^(a few minutes, first run only^)...
  venv\Scripts\python.exe -m pip install --upgrade pip >nul 2>&1
  venv\Scripts\python.exe -m pip install -r requirements.txt
)
echo [1/2] Starting the backend server (port 8000)...
start "GenieAI Backend  (keep this window open)" cmd /k venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
cd ..

REM ---------- Frontend ----------
cd frontend
if not exist "node_modules" (
  echo [Setup] First run: installing frontend parts ^(a few minutes, first run only^)...
  call npm install
)
echo [2/2] Starting the app (port 5173)...
start "GenieAI App  (keep this window open)" cmd /k npm run dev
cd ..

REM ---------- Open the browser ----------
echo.
echo Waiting for the servers to warm up...
timeout /t 6 /nobreak >nul
start "" http://localhost:5173

echo.
echo ==================================================
echo  GenieAI is running!
echo  - The app opened in your browser: http://localhost:5173
echo  - Two black windows opened (Backend + App). KEEP THEM OPEN.
echo  - To STOP GenieAI: simply close those two windows.
echo ==================================================
echo.
echo (You can close THIS window now.)
pause >nul
