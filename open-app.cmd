@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:3000/api/health' -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>nul
if errorlevel 1 (
    start "Qisi Server" /D "%~dp0" "%~dp0tmp\start-qisi-server.cmd"
    timeout /t 2 /nobreak >nul
)
start "" "http://127.0.0.1:3000/main.html"
