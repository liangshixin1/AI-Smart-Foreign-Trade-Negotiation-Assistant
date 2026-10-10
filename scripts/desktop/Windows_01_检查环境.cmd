@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0check-windows.ps1"
echo Exit code: %errorlevel%
pause
