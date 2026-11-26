@echo off
rem Claude-Proto: adds the Excel tool buttons (macros, Tools tab, Sim Results tab)
rem to math\Proto_v2.xlsx and saves it as math\Proto_v2.xlsm. Safe to run again
rem later: it then refreshes the macros in Proto_v2.xlsm.
title Claude-Proto - Install Excel Tools
cd /d "%~dp0"
echo.
echo  This adds the Excel tool buttons to the math workbook.
echo  Save your work and CLOSE EXCEL before continuing.
echo.
pause
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\excel\install-excel-tools.ps1"
echo.
pause
