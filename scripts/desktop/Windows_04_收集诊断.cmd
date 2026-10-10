@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0collect-diagnostics.ps1"
echo Exit code: %errorlevel%
pause
