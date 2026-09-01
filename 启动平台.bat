@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
title 全球风电机组环境适应性评估平台 - 本地工作站
cd /d "%~dp0"

set "PY_EXE="
set "PY_ARGS="
where py >nul 2>nul && (
  set "PY_EXE=py"
  set "PY_ARGS=-3"
)
if not defined PY_EXE (
  where python >nul 2>nul && set "PY_EXE=python"
)

if not defined PY_EXE (
  echo [1/4] 未检测到 Python，准备下载项目专用便携 Python...
  set "PY_VER=3.12.6"
  set "PY_ZIP=runtime\python-embed.zip"
  set "PY_DIR=runtime\python"
  if not exist "runtime" mkdir "runtime"
  if not exist "!PY_DIR!\python.exe" (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference='SilentlyContinue'; Invoke-WebRequest -UseBasicParsing 'https://www.python.org/ftp/python/3.12.6/python-3.12.6-embed-amd64.zip' -OutFile '%CD%\!PY_ZIP!'"
    if errorlevel 1 goto :PYFAIL
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -Force '%CD%\!PY_ZIP!' '%CD%\!PY_DIR!'"
    if errorlevel 1 goto :PYFAIL
  )
  set "PY_EXE=%CD%\!PY_DIR!\python.exe"
  set "PY_ARGS="
)

echo [2/4] 检查本地数据库和目录...
"!PY_EXE!" !PY_ARGS! -c "import sqlite3,sys; print('Python',sys.version.split()[0],'SQLite',sqlite3.sqlite_version)" || goto :PYFAIL

echo [3/4] 启动本地服务（自动寻找 8080-8090 可用端口）...
if exist ".local_server.pid" del /q ".local_server.pid" >nul 2>nul
if exist ".local_server.port" del /q ".local_server.port" >nul 2>nul
start "GEPlatformLocalServer" /min "!PY_EXE!" !PY_ARGS! "%CD%\local_server.py"

for /L %%i in (1,1,30) do (
  if exist ".local_server.port" goto :OPEN
  ping 127.0.0.1 -n 2 >nul
)
echo [错误] 本地服务启动失败，请查看 logs 目录。
pause
exit /b 1

:OPEN
set /p GE_PORT=<.local_server.port
echo [4/4] 平台已启动：http://localhost:!GE_PORT!
start "" "http://localhost:!GE_PORT!/?mode=local"
echo.
echo 关闭本窗口不会停止平台；需要停止时双击“停止平台.bat”。
exit /b 0

:PYFAIL
echo.
echo [错误] Python 运行环境准备失败。
echo 可能原因：公司网络/代理阻止访问 python.org，或 PowerShell 下载被策略限制。
echo 可在已有 Python 3.10+ 的电脑上直接再次双击本文件。
pause
exit /b 1
