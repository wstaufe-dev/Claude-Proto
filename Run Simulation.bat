@echo off
rem Claude-Proto: runs the Monte Carlo simulation on the current math config.
title Claude-Proto - Simulation
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
echo  Simulates the math in math\proto_v2.config.json (export it from Excel first).
echo  Press Enter to accept the value in [brackets].
echo.
set "ROUNDS=10000000"
set /p "ROUNDS=Rounds to play [10000000]: "
set "ROUNDS=%ROUNDS:,=%"
set "SEED=1"
set /p "SEED=Random seed [1]: "
echo.
call npm run sim -- --rounds %ROUNDS% --seed %SEED%
if errorlevel 1 (
  echo.
  echo  The simulation failed. See the messages above.
  pause
  exit /b 1
)
echo.
echo  Done. To see the results in Excel, click "Import Sim Results" on the Tools tab.
echo.
pause
