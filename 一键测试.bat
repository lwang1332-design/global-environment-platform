@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
cd /d "%~dp0"
title 全球环境适应性平台 - 本地工作站一键验收

echo === 全球环境适应性平台 Windows 本地工作站验收 ===
set "GE_NO_BROWSER=1"
call "启动平台.bat"
if errorlevel 1 (
  echo FAIL: 平台启动失败
  exit /b 1
)

if not exist ".local_server.port" (
  echo FAIL: 未生成端口文件
  call "停止平台.bat"
  exit /b 1
)

set "PY_EXE="
set "PY_ARGS="
if exist "%CD%\runtime\python\python.exe" (
  set "PY_EXE=%CD%\runtime\python\python.exe"
) else (
  where py >nul 2>nul && (
    set "PY_EXE=py"
    set "PY_ARGS=-3"
  )
  if not defined PY_EXE where python >nul 2>nul && set "PY_EXE=python"
)

if not defined PY_EXE (
  echo FAIL: 未找到用于测试的 Python
  call "停止平台.bat"
  exit /b 1
)

echo.
echo [验收] 执行本地工作站 Smoke Test...
"!PY_EXE!" !PY_ARGS! "%CD%\tests\local_workstation_smoke.py"
set "TEST_RC=!ERRORLEVEL!"

echo.
call "停止平台.bat"
echo.
if not "!TEST_RC!"=="0" (
  echo === 验收失败，请查看上方 FAIL 项及 logs 目录 ===
  pause
  exit /b !TEST_RC!
)

echo === 验收通过 ===
echo 已验证：启动、动态端口、主页、SQLite、项目保存/读取/删除、Calculation ID、备份、数据源状态、离线缓存行为。
pause
exit /b 0
