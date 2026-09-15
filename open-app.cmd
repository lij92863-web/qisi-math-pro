@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-qisi.ps1" -ProjectRoot "%~dp0." -OpenBrowser
if errorlevel 1 (
    echo.
    echo TEX Question Bank failed to start. Keep this window open for diagnosis.
    pause
    exit /b 1
)
