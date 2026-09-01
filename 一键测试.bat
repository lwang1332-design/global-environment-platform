@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul
cd /d "%~dp0"
echo === 全球环境适应性平台 本地工作站验收 ===
call "启动平台.bat"
if not exist ".local_server.port" (
  echo FAIL: 未生成端口文件
  exit /b 1
)
set /p PORT=<.local_server.port
set "BASE=http://127.0.0.1:!PORT!"
set PASS=0
set FAIL=0
call :TEST "健康检查" "!BASE!/local-api/health"
call :TEST "系统诊断" "!BASE!/local-api/diagnostics"
call :TEST "版本信息" "!BASE!/local-api/version"
call :TEST "项目列表" "!BASE!/local-api/projects"
call :TEST "缓存状态" "!BASE!/local-api/cache/status"
call :TEST "主页加载" "!BASE!/"
echo.
echo 总测试: !PASS! 通过 / !FAIL! 失败
call "停止平台.bat"
if !FAIL! GTR 0 exit /b 1
exit /b 0

:TEST
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r=Invoke-WebRequest -UseBasicParsing -TimeoutSec 10 '%~2'; if($r.StatusCode -ge 200 -and $r.StatusCode -lt 400){exit 0}else{exit 1} } catch { exit 1 }"
if errorlevel 1 (
  echo FAIL: %~1
  set /a FAIL+=1
) else (
  echo PASS: %~1
  set /a PASS+=1
)
exit /b 0
