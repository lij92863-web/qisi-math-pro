@echo off
setlocal
set "QISI_URL=http://127.0.0.1:3000/main.html"

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-qisi.ps1" -ProjectRoot "%~dp0."
if errorlevel 1 (
    echo.
    echo TEX Question Bank failed to start. Keep this window open for diagnosis.
    pause
    exit /b 1
)

start "" "%QISI_URL%"
