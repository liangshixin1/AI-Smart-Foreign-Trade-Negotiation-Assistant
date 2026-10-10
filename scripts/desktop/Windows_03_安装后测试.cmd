@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0smoke-windows.ps1"
echo Exit code: %errorlevel%
pause
