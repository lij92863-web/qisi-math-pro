@echo off
rem ============================================================
rem  Qisi Math Pro - One Click Launcher
rem  ------------------------------------------------------------
rem  Double click this file. It will:
rem    1. Start the local server (if it is not running yet)
rem    2. Wait until the server is really ready
rem    3. Open the app in your web browser
rem
rem  NOTE: This file is intentionally written in pure ASCII
rem  English. The folder name may contain Chinese characters,
rem  so all commands and messages here must stay ASCII to avoid
rem  codepage / mojibake problems.
rem ============================================================

setlocal EnableExtensions

set "PORT=3000"
set "SERVER_JS=qisi-local-server.js"
set "HEALTH_URL=http://127.0.0.1:%PORT%/api/health"
set "APP_URL=http://127.0.0.1:%PORT%/main.html"
set "MAX_WAIT=30"

title Qisi Math Pro Launcher

rem Always work from the folder where THIS file lives.
cd /d "%~dp0"
set "APP_DIR=%CD%"
set "LOG_DIR=%APP_DIR%\tmp"
set "LOG_FILE=%LOG_DIR%\qisi-server.log"

echo.
echo   ==========================================================
echo     Qisi Math Pro  -  starting up, please wait ...
echo   ==========================================================
echo.

rem ------------------------------------------------------------
rem Step 0 - make sure the server program exists
rem ------------------------------------------------------------
if not exist "%APP_DIR%\%SERVER_JS%" goto :no_server_js

rem ------------------------------------------------------------
rem Step 1 - locate node.exe
rem ------------------------------------------------------------
call :find_node
if errorlevel 1 goto :no_node

rem ------------------------------------------------------------
rem Step 2 - is the service already running? (stay idempotent)
rem ------------------------------------------------------------
call :health_check
if not errorlevel 1 goto :already_running
if errorlevel 3 goto :wrong_instance
if not errorlevel 2 goto :start_failed

rem ------------------------------------------------------------
rem Step 3 - not running, so start it in the background
rem ------------------------------------------------------------
echo   [1/3] Service is not running yet. Starting it now ...
echo         Node : %NODE_EXE%
echo         Log  : %LOG_FILE%
echo.

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%" >nul 2>nul

start "Qisi Math Pro Server" /MIN /D "%APP_DIR%" %ComSpec% /C ""%NODE_EXE%" "%APP_DIR%\%SERVER_JS%" 1>>"%LOG_FILE%" 2>&1"

rem ------------------------------------------------------------
rem Step 4 - poll the health endpoint until the server answers
rem ------------------------------------------------------------
echo   [2/3] Waiting for the service to become ready ...
echo.

set "WAITED=0"
:wait_loop
call :health_check
if not errorlevel 1 goto :server_ready
if errorlevel 3 goto :wrong_instance
if not errorlevel 2 goto :start_failed

set /a WAITED+=1
if %WAITED% GEQ %MAX_WAIT% goto :start_failed
rem Print a heartbeat every 5 seconds so the user can see it is alive.
rem (Plain echo is used on purpose: it writes reliably even when this
rem script's output is redirected to a file.)
set /a TICK=%WAITED% %% 5
if "%TICK%"=="0" echo         ... still starting up (%WAITED% s)
timeout /t 1 /nobreak >nul 2>nul
if errorlevel 1 ping -n 2 127.0.0.1 >nul 2>nul
goto :wait_loop

rem ------------------------------------------------------------
rem Success paths
rem ------------------------------------------------------------
:server_ready
echo.
echo   [3/3] Service is ready. Opening your browser ...
goto :open_browser

:already_running
echo   [1/3] Service is already running - reusing it.
echo   [2/3] Nothing to wait for.
echo   [3/3] Opening your browser ...
goto :open_browser

:open_browser
rem Check once more so a different service cannot take the port during startup.
call :health_check
if errorlevel 1 goto :wrong_instance
echo.
echo   ==========================================================
echo     Done!  Qisi Math Pro is opening in your browser.
echo     If the browser does not appear, open this link manually:
echo         %APP_URL%
echo.
echo     Keep the small "Qisi Math Pro Server" window on the
echo     taskbar running while you use the program.
echo     Closing it will shut the program down.
echo.
echo     This black window will close by itself in 5 seconds.
echo   ==========================================================
echo.
start "" "%APP_URL%"
timeout /t 5 /nobreak >nul 2>nul
endlocal
exit /b 0

rem ============================================================
rem  Subroutine: find node.exe
rem  Returns 0 and sets NODE_EXE on success, 1 on failure.
rem ============================================================
:find_node
set "NODE_EXE="

rem (a) normal PATH lookup
for /f "delims=" %%i in ('where node.exe 2^>nul') do if not defined NODE_EXE set "NODE_EXE=%%i"
if defined NODE_EXE if exist "%NODE_EXE%" exit /b 0

rem (b) default installer locations
if exist "%ProgramFiles%\nodejs\node.exe" (
    set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
    exit /b 0
)
if exist "%ProgramFiles(x86)%\nodejs\node.exe" (
    set "NODE_EXE=%ProgramFiles(x86)%\nodejs\node.exe"
    exit /b 0
)
if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" (
    set "NODE_EXE=%LOCALAPPDATA%\Programs\nodejs\node.exe"
    exit /b 0
)

rem (c) WorkBuddy managed runtime
for /d %%d in ("%USERPROFILE%\.workbuddy\binaries\node\versions\*") do if exist "%%d\node.exe" set "NODE_EXE=%%d\node.exe"
if defined NODE_EXE exit /b 0

rem (d) nvm-windows
if exist "%APPDATA%\nvm\nodejs\node.exe" (
    set "NODE_EXE=%APPDATA%\nvm\nodejs\node.exe"
    exit /b 0
)

set "NODE_EXE="
exit /b 1

rem ============================================================
rem  Subroutine: health check
rem  Returns 0 for this installation, 2 for no service, 3 for another service.
rem ============================================================
:health_check
"%NODE_EXE%" "%APP_DIR%\scripts\check-local-instance.js" "%PORT%" >nul 2>nul
exit /b %errorlevel%

:wrong_instance
echo.
echo   Port %PORT% is used by another or older Qisi service.
echo   Close that service, then start this desktop copy again.
echo   No browser page was opened.
echo.
pause
endlocal
exit /b 1

rem ============================================================
rem  Error paths - plain language, ask the user to call for help
rem ============================================================
:no_server_js
echo.
echo   ==========================================================
echo     SORRY - the program could not start.
echo   ==========================================================
echo.
echo     Reason: the server file was not found.
echo     Expected location:
echo         %APP_DIR%\%SERVER_JS%
echo.
echo     What to do: please send a screenshot of THIS black
echo     window to the AI assistant who set up this program.
echo.
pause
endlocal
exit /b 1

:no_node
echo.
echo   ==========================================================
echo     SORRY - the program could not start.
echo   ==========================================================
echo.
echo     Reason: Node.js is not installed (or cannot be found)
echo     on this computer. Qisi Math Pro needs Node.js to run.
echo.
echo     What to do: please send a screenshot of THIS black
echo     window to the AI assistant who set up this program,
echo     and ask them to install Node.js (the LTS version).
echo.
pause
endlocal
exit /b 1

:start_failed
echo.
echo   ==========================================================
echo     SORRY - the program could not start.
echo   ==========================================================
echo.
echo     Reason: the server did not answer within %MAX_WAIT% seconds.
echo.
echo     What to do:
echo       1. Take a screenshot of THIS black window.
echo       2. Also copy the log file below (if it exists):
echo              %LOG_FILE%
echo       3. Send both to the AI assistant who set up this
echo          program. That is enough for them to fix it.
echo.
echo     Quick check: close this window and double click the
echo     launcher icon one more time. If it fails again, please
echo     ask for help as described above.
echo.
pause
endlocal
exit /b 1
