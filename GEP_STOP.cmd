@echo off
setlocal EnableExtensions
cd /d "%~dp0"
if not exist ".local_server.pid" (
  echo GEP local server PID file not found.
  exit /b 0
)
set /p GE_PID=<.local_server.pid
if not defined GE_PID exit /b 0
taskkill /PID %GE_PID% /F >nul 2>nul
if exist ".local_server.pid" del /q ".local_server.pid" >nul 2>nul
if exist ".local_server.port" del /q ".local_server.port" >nul 2>nul
echo GEP local server stopped.
exit /b 0
