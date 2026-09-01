param(
  [string]$Target = 'D:\Program Files\GEP goldwind',
  [string]$Branch = 'local-deployment-v3',
  [switch]$NoStart
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function Write-Step([string]$Text) {
  Write-Host "`n==> $Text" -ForegroundColor Cyan
}

function Test-Administrator {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($identity)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Quote-Arg([string]$Value) {
  return '"' + ($Value -replace '"','\"') + '"'
}

if (-not (Test-Administrator)) {
  Write-Step '申请管理员权限'
  $args = @(
    '-NoProfile',
    '-ExecutionPolicy','Bypass',
    '-File', (Quote-Arg $PSCommandPath),
    '-Target', (Quote-Arg $Target),
    '-Branch', (Quote-Arg $Branch)
  )
  if ($NoStart) { $args += '-NoStart' }
  Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList ($args -join ' ')
  exit 0
}

$drive = [System.IO.Path]::GetPathRoot($Target)
if (-not $drive -or -not (Test-Path $drive)) {
  throw "目标磁盘不存在：$drive。请确认 D: 盘可用。"
}

$repo = 'lwang1332-design/global-environment-platform'
$archiveUrl = "https://github.com/$repo/archive/refs/heads/$Branch.zip"
$tempRoot = Join-Path $env:TEMP ("GEP_install_" + [guid]::NewGuid().ToString('N'))
$zipPath = Join-Path $tempRoot 'gep.zip'
$extractPath = Join-Path $tempRoot 'src'
New-Item -ItemType Directory -Force -Path $tempRoot,$extractPath | Out-Null

try {
  Write-Step "下载 GEP 本地工作站版本：$Branch"
  try {
    Invoke-WebRequest -UseBasicParsing -Uri $archiveUrl -OutFile $zipPath -TimeoutSec 90 -Headers @{ 'User-Agent'='GEP-Goldwind-Installer/1.0' }
  } catch {
    if (Get-Command curl.exe -ErrorAction SilentlyContinue) {
      & curl.exe -L --fail --retry 2 --connect-timeout 20 -o $zipPath $archiveUrl
      if ($LASTEXITCODE -ne 0) { throw "GitHub 下载失败，curl exit=$LASTEXITCODE" }
    } else {
      throw
    }
  }

  if (-not (Test-Path $zipPath) -or (Get-Item $zipPath).Length -lt 1024) {
    throw '下载文件异常或为空。'
  }

  Write-Step '解压程序文件'
  Expand-Archive -Force -Path $zipPath -DestinationPath $extractPath
  $source = Get-ChildItem -Path $extractPath -Directory | Select-Object -First 1
  if (-not $source) { throw '无法识别 GitHub 压缩包内容。' }
  $sourcePath = $source.FullName

  if (Test-Path $Target) {
    Write-Step '检测到已有安装，先停止平台并保留用户数据'
    $stopBat = Join-Path $Target '停止平台.bat'
    if (Test-Path $stopBat) {
      try { Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', (Quote-Arg $stopBat) -WorkingDirectory $Target -Wait -WindowStyle Hidden } catch {}
    }
    $stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
    $pre = Join-Path $Target "backup\preinstall_$stamp"
    New-Item -ItemType Directory -Force -Path $pre | Out-Null
    foreach ($f in @('VERSION.json','CHANGELOG.md')) {
      $p = Join-Path $Target $f
      if (Test-Path $p) { Copy-Item -Force $p $pre }
    }
  } else {
    New-Item -ItemType Directory -Force -Path $Target | Out-Null
  }

  Write-Step "部署程序到：$Target"
  $excludeDirs = @('data','cache','projects','reports','logs','backup','runtime')
  $excludeFiles = @('.local_server.pid','.local_server.port','.env','user-config.json')
  $roboArgs = @($sourcePath,$Target,'/E','/COPY:DAT','/DCOPY:DAT','/R:2','/W:1','/NFL','/NDL','/NJH','/NJS','/NP','/XD') + $excludeDirs + @('/XF') + $excludeFiles
  & robocopy @roboArgs | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "文件复制失败，robocopy exit=$LASTEXITCODE" }

  foreach ($d in @('data','cache','projects','reports','logs','backup','runtime','config')) {
    New-Item -ItemType Directory -Force -Path (Join-Path $Target $d) | Out-Null
  }

  $meta = [ordered]@{
    installed_at = (Get-Date).ToString('s')
    install_path = $Target
    repository = $repo
    branch = $Branch
    installer_version = '1.0'
  }
  $meta | ConvertTo-Json -Depth 4 | Set-Content -Encoding UTF8 (Join-Path $Target 'LOCAL_INSTALL.json')

  Write-Step '创建桌面快捷方式'
  $desktop = [Environment]::GetFolderPath('Desktop')
  $shortcutPath = Join-Path $desktop '全球风电环境适应性评估平台.lnk'
  $shell = New-Object -ComObject WScript.Shell
  $shortcut = $shell.CreateShortcut($shortcutPath)
  $shortcut.TargetPath = Join-Path $Target '启动平台.bat'
  $shortcut.WorkingDirectory = $Target
  $shortcut.Description = '全球风电机组环境适应性评估平台 - 本地工作站'
  $shortcut.Save()

  $startMenu = Join-Path ([Environment]::GetFolderPath('Programs')) '全球风电环境适应性评估平台.lnk'
  try {
    $s2 = $shell.CreateShortcut($startMenu)
    $s2.TargetPath = Join-Path $Target '启动平台.bat'
    $s2.WorkingDirectory = $Target
    $s2.Description = '全球风电机组环境适应性评估平台 - 本地工作站'
    $s2.Save()
  } catch {}

  Write-Step '检查关键文件'
  foreach ($required in @('index.html','local_server.py','启动平台.bat','停止平台.bat','VERSION.json')) {
    if (-not (Test-Path (Join-Path $Target $required))) { throw "缺少关键文件：$required" }
  }

  if (-not $NoStart) {
    Write-Step '启动本地平台'
    $startBat = Join-Path $Target '启动平台.bat'
    Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', (Quote-Arg $startBat) -WorkingDirectory $Target

    $portFile = Join-Path $Target '.local_server.port'
    $deadline = (Get-Date).AddSeconds(45)
    while ((Get-Date) -lt $deadline -and -not (Test-Path $portFile)) { Start-Sleep -Milliseconds 500 }
    if (Test-Path $portFile) {
      $port = (Get-Content $portFile -ErrorAction SilentlyContinue | Select-Object -First 1).Trim()
      if ($port) {
        try {
          $health = Invoke-RestMethod -UseBasicParsing -Uri "http://127.0.0.1:$port/local-api/health" -TimeoutSec 8
          if (-not $health.ok) { throw '健康检查返回异常' }
          Write-Host "`n部署成功：GEP 已运行在 http://localhost:$port" -ForegroundColor Green
        } catch {
          Write-Warning "程序已启动，但自动健康检查未通过：$($_.Exception.Message)"
        }
      }
    } else {
      Write-Warning '安装完成，但未检测到端口文件。请双击桌面快捷方式再次启动，并查看 logs 目录。'
    }
  } else {
    Write-Host "`n部署成功：$Target" -ForegroundColor Green
  }

  Write-Host '桌面快捷方式：全球风电环境适应性评估平台' -ForegroundColor Green
  Write-Host '用户数据目录在升级时会保留：data / cache / projects / reports / logs / backup / runtime' -ForegroundColor DarkGray
}
finally {
  try { Remove-Item -Recurse -Force $tempRoot -ErrorAction SilentlyContinue } catch {}
}
