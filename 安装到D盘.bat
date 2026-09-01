@echo off
setlocal EnableExtensions
chcp 65001 >nul
title GEP Goldwind 一键部署到 D 盘

set "TARGET=D:\Program Files\GEP goldwind"
set "BRANCH=local-deployment-v3"
set "PS1=%TEMP%\gep_install_windows.ps1"
set "URL=https://raw.githubusercontent.com/lwang1332-design/global-environment-platform/%BRANCH%/scripts/install-gep-windows.ps1"

echo ================================================
echo 全球风电机组环境适应性评估平台 - 本地部署
echo 目标目录：%TARGET%
echo ================================================
echo.

echo [1/2] 获取安装程序...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference='SilentlyContinue'; [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -UseBasicParsing -Uri '%URL%' -OutFile '%PS1%' -TimeoutSec 60" >nul 2>nul
if errorlevel 1 (
  where curl.exe >nul 2>nul
  if errorlevel 1 goto :DOWNLOAD_FAIL
  curl.exe -L --fail --retry 2 --connect-timeout 20 -o "%PS1%" "%URL%" >nul 2>nul
  if errorlevel 1 goto :DOWNLOAD_FAIL
)

if not exist "%PS1%" goto :DOWNLOAD_FAIL

echo [2/2] 开始安装。若弹出 Windows 管理员权限窗口，请选择“是”。
powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%" -Target "%TARGET%" -Branch "%BRANCH%"
if errorlevel 1 goto :INSTALL_FAIL

exit /b 0

:DOWNLOAD_FAIL
echo.
echo [失败] 无法从 GitHub 下载安装程序。
echo 请检查网络、VPN、公司代理或 GitHub 访问权限。
pause
exit /b 1

:INSTALL_FAIL
echo.
echo [失败] 部署未完成。
echo 请查看上方错误提示，或把错误截图发给 ChatGPT。
pause
exit /b 1
