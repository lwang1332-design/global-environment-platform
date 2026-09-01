@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title 停止全球环境适应性评估平台
if not exist ".local_server.pid" (
  echo 未发现正在运行的本地平台进程。
  if exist ".local_server.port" del /q ".local_server.port" >nul 2>nul
  exit /b 0
)
set /p PID=<.local_server.pid
if "%PID%"=="" goto :CLEAN
echo 正在停止平台进程 PID=%PID% ...
taskkill /PID %PID% /T /F >nul 2>nul
:CLEAN
if exist ".local_server.pid" del /q ".local_server.pid" >nul 2>nul
if exist ".local_server.port" del /q ".local_server.port" >nul 2>nul
echo 平台已停止。
exit /b 0
