@echo off
title World Explorer
cd /d "%~dp0"

rem One-click launcher: starts the Vite dev server and opens the game in your browser.
rem (The dev server keeps running while this window is open — close it to stop.)

if not exist "node_modules" (
  echo.
  echo   First run: installing dependencies...
  call npm install
)

echo.
echo   ===== World Explorer =====
echo   Opening http://localhost:3000
echo   Close this window to stop the server.
echo.

call npm run dev -- --open

echo.
echo   Server stopped.
pause
