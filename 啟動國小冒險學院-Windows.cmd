@echo off
setlocal
cd /d "%~dp0"
title Adventure Academy
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\launcher\bootstrap-windows.ps1"
if errorlevel 1 (
  echo.
  echo Startup failed. Please keep this error message for support.
  pause
)
endlocal
