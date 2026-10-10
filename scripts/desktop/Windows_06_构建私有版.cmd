@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0bootstrap-windows.ps1" -Private
echo Exit code: %errorlevel%
pause
