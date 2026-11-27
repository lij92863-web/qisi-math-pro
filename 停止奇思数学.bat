@echo off
powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "%~dp0scripts\stop-local-server.ps1"
if errorlevel 1 pause
