@echo off
rem Claude-Proto: one-time setup. Installs the project's packages (run again after updating the project).
title Claude-Proto - Setup
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

echo Installing packages. This takes a minute or two the first time...
echo.
call npm install
if errorlevel 1 (
  echo.
  echo  Setup failed. See the messages above.
  pause
  exit /b 1
)
echo.
echo  Setup finished. You can now use "Play Prototype.bat" and "Run Simulation.bat".
echo.
pause
