@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0inject-windows.ps1"
echo Exit code: %errorlevel%
pause
