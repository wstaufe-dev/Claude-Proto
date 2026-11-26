@echo off
rem Claude-Proto: starts the game locally and opens it in your browser.
title Claude-Proto - Prototype (close this window to stop)
cd /d "%~dp0"
rem --- Check Node.js is installed and new enough (Vite 8 needs 20.19+ or 22.12+) ---
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js is not installed, or this window can't find it.
  echo  Install the LTS version from https://nodejs.org, accept the defaults,
  echo  then run this file again.
  echo.
  pause
  exit /b 1
)
node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&b>=12)||(a===20&&b>=19)?0:1)"
if errorlevel 1 (
  echo.
  echo  Your Node.js is too old. Install the current LTS version from https://nodejs.org
  echo  and run this file again.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo First run: installing packages...
  call npm install
  if errorlevel 1 ( pause & exit /b 1 )
)
echo.
echo  Starting the prototype. Your browser opens at http://localhost:5173
echo  Keep this window open while you play. Close it to stop the game.
echo  After you export new math from Excel, the browser reloads by itself.
echo.
call npm run dev -- --open
pause
