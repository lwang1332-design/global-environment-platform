# 全球风电机组环境适应性评估平台｜Windows 本地工作站版

## 1. 目标

本分支在不修改既有六大物理模型公式的前提下，为 V2.9 增加 Windows 10/11 本地运行能力。

运行链路：

```text
浏览器
  ↓
http://localhost:8080（若占用则自动尝试 8081…8090）
  ↓
local_server.py
  ├─ 原有 HTML/CSS/JS/PWA/PDF/地图
  ├─ SQLite 本地数据库
  ├─ 项目/Calculation ID 存储
  ├─ ERA5 via Open-Meteo 本地代理
  ├─ 在线失败→本地缓存降级
  ├─ 系统诊断
  └─ 一键备份
```

## 2. 最简单的使用方法

1. 下载或克隆本仓库 `local-deployment-v3` 分支。
2. 解压到任意目录，支持中文路径和空格路径。
3. 双击 `启动平台.bat`。
4. 浏览器自动打开本地平台。
5. 使用结束后双击 `停止平台.bat`。

不需要手工执行 `python -m http.server`、`npm run dev` 或 PowerShell 命令。

## 3. Python 运行环境

启动器按以下顺序寻找：

1. `py -3`
2. `python`
3. 若均不存在，则尝试从 python.org 下载 Windows Embeddable Python 3.12.6 到项目自己的 `runtime/python/`。

便携 Python 不写注册表、不修改系统 PATH，不污染系统 Python 环境。

若公司代理/防火墙禁止访问 python.org，可在电脑预装 Python 3.10+ 后再次双击启动脚本。

## 4. 数据目录

首次启动自动创建：

```text
data/       SQLite 数据库
config/     本地配置
cache/      预留离线缓存目录
projects/   预留项目文件目录
reports/    PDF/导出报告目录
logs/       运行日志
backup/     一键备份 ZIP
runtime/    可选便携 Python
```

SQLite 主库：`data/environment_platform.sqlite3`。

数据库使用 WAL 模式，降低异常退出时的损坏风险。

## 5. 本地 API

### 健康检查

`GET /local-api/health`

### 系统诊断

`GET /local-api/diagnostics`

检查 Python、SQLite、数据库完整性、磁盘空间和关键目录。

### ERA5 环境数据

`GET /local-api/environment?latitude=18.25&longitude=109.51&start_date=2025-01-01&end_date=2025-01-07`

上游为 Open-Meteo Historical Weather API 的 ERA5 模型。成功后写入 SQLite 缓存；网络失败时若存在缓存则返回最近缓存，并明确标记 `cache=cached`。

严禁生成随机或模拟环境数据。无在线数据且无缓存时返回“数据源暂不可用”。

### 项目

`GET /local-api/projects`

`POST /local-api/projects`

项目数据存储在 SQLite，不依赖浏览器 localStorage。

### 计算记录

`POST /local-api/calculations`

默认生成 `GEA-YYYYMMDD-HHMMSS` Calculation ID。

### 备份

`POST /local-api/backup`

生成：

`backup/EnvironmentPlatform_Backup_YYYYMMDD_HHMMSS.zip`

## 6. 原有 V2.9 能力

本次改造不删除：

- GitHub Pages 在线版；
- PWA；
- IndexedDB 最近项目小时数据；
- 管理员参数；
- Supabase/V2.9 正式参数同步；
- 六大物理模型；
- 风温联合分布；
- PDF 工程报告；
- 在线/离线地图分层逻辑。

现有正式参数同步仍按 V2.9 原机制工作：中央服务失败时继续回退本地最近有效正式参数。

## 7. 本地与线上代码隔离

建议长期保持：

```text
main                  GitHub Pages 稳定正式版
local-deployment-v3   Windows 本地工作站适配版
```

验证完成后再决定是否将通用改动合并回 `main`。

程序代码与用户数据分离。未来升级只替换代码文件，不应覆盖 `data/`、`config/`、`projects/`、`cache/`、`backup/`。

## 8. 一键验收

双击：`一键测试.bat`

当前 Smoke Test 检查：

- 本地服务能否启动；
- 健康接口；
- 系统诊断；
- 版本接口；
- 项目列表；
- 缓存状态；
- 首页 HTTP 加载；
- 停止脚本。

后续模型级 Benchmark 仍应继续使用仓库现有 GitHub Actions/E2E，用三亚、若羌、Basra 等固定输入做回归比较。

## 9. 常见问题

### 8080 被占用

无需处理。服务自动尝试 8081…8090，启动器会读取实际端口并自动打开浏览器。

### 浏览器打开但真实数据失败

先访问 `/local-api/diagnostics`，再检查 `logs/`。常见原因是公司代理、DNS、SSL 检查或上游限流。

### 清除浏览器缓存后项目丢失吗？

写入 SQLite 的本地项目不会因清除 localStorage/浏览器缓存而删除。

### 断网后是否会制造演示数据？

不会。存在有效历史缓存则明确使用缓存；没有缓存则显示数据源不可用。

### PDF 是否仍由原页面逻辑生成？

是。当前阶段不重写 PDF 报告算法和模板，只改变访问方式为 localhost。

## 10. 当前阶段边界

本分支首先完成“本地运行基础设施层”。原页面现有的模型、PDF、地图、管理员 UI 保持原样。SQLite 项目库、Calculation ID、诊断和备份 API 已提供；后续可把这些能力逐步接入主页面管理按钮，而不改物理模型公式。
