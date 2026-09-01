@echo off
setlocal EnableExtensions EnableDelayedExpansion
title GEP Goldwind Local Workstation
cd /d "%~dp0"

set "PY_EXE="
set "PY_ARGS="
where py.exe >nul 2>nul && (
  set "PY_EXE=py.exe"
  set "PY_ARGS=-3"
)
if not defined PY_EXE (
  where python.exe >nul 2>nul && set "PY_EXE=python.exe"
)

if not defined PY_EXE (
  set "PY_VER=3.12.6"
  set "PY_ZIP=runtime\python-embed.zip"
  set "PY_DIR=runtime\python"
  if not exist "runtime" mkdir "runtime"
  if not exist "!PY_DIR!\python.exe" (
    echo [1/4] Python not found. Downloading portable Python...
    where curl.exe >nul 2>nul
    if not errorlevel 1 (
      curl.exe -L --fail --retry 2 --connect-timeout 20 -o "!PY_ZIP!" "https://www.python.org/ftp/python/3.12.6/python-3.12.6-embed-amd64.zip"
    ) else (
      powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference='SilentlyContinue'; Invoke-WebRequest -UseBasicParsing 'https://www.python.org/ftp/python/3.12.6/python-3.12.6-embed-amd64.zip' -OutFile '%CD%\!PY_ZIP!'"
    )
    if not exist "!PY_ZIP!" goto :PYFAIL
    powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -Force '%CD%\!PY_ZIP!' '%CD%\!PY_DIR!'"
    if errorlevel 1 goto :PYFAIL
  )
  set "PY_EXE=%CD%\!PY_DIR!\python.exe"
  set "PY_ARGS="
)

echo [2/4] Checking Python and SQLite...
"!PY_EXE!" !PY_ARGS! -c "import sqlite3,sys; print('Python',sys.version.split()[0],'SQLite',sqlite3.sqlite_version)" || goto :PYFAIL

echo [3/4] Starting local server...
if exist ".local_server.pid" del /q ".local_server.pid" >nul 2>nul
if exist ".local_server.port" del /q ".local_server.port" >nul 2>nul
set "SERVER_SCRIPT=local_server.py"
if exist "%CD%\local_server_v2.py" set "SERVER_SCRIPT=local_server_v2.py"
start "GEP_Local_Server" /min "!PY_EXE!" !PY_ARGS! "%CD%\!SERVER_SCRIPT!"

for /L %%i in (1,1,45) do (
  if exist ".local_server.port" goto :OPEN
  ping 127.0.0.1 -n 2 >nul
)
echo ERROR: local server did not create port file.
if exist "logs" start "" explorer.exe "%CD%\logs"
pause
exit /b 1

:OPEN
set /p GE_PORT=<.local_server.port
echo [4/4] GEP is running: http://localhost:!GE_PORT!/
if /I not "%GE_NO_BROWSER%"=="1" start "" "http://localhost:!GE_PORT!/?mode=local"
exit /b 0

:PYFAIL
echo ERROR: Python runtime preparation failed.
pause
exit /b 1
