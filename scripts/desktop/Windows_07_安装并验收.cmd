@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-and-test-windows.ps1"
echo Exit code: %errorlevel%
pause
