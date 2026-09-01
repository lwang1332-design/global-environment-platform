# 全球风电机组环境适应性评估平台｜Windows 本地工作站版

## 1. 目标

本分支在不修改既有六大物理模型公式的前提下，为 V2.9 增加 Windows 10/11 本地工程工作站能力。

运行链路：

```text
浏览器
  ↓
http://localhost:8080（占用时自动尝试 8081…8090）
  ↓
local_server.py
  ├─ 原有 HTML/CSS/JS/PWA/PDF/地图
  ├─ SQLite 本地数据库
  ├─ 项目管理 / Calculation ID
  ├─ ERA5 / CAMS / Marine / Elevation / Geocoding 本地代理
  ├─ 在线成功 → SQLite 缓存
  ├─ 在线失败 / 断网 → 本地缓存降级
  ├─ 数据源健康检查
  ├─ 系统诊断
  └─ 一键备份
```

GitHub Pages 在线版保持原行为；只有 `localhost` / `127.0.0.1` 自动启用本地工作站适配层。

## 2. 最简单的使用方法

1. 下载或克隆本仓库 `local-deployment-v3` 分支。
2. 解压到任意目录，支持中文路径和空格路径，例如：
   `C:\Users\王工\Desktop\全球环境评估平台\`
3. 双击 `启动平台.bat`。
4. 浏览器自动打开实际 localhost 端口。
5. 页面顶部导航/右下角可进入“本地工作站”。
6. 使用结束后双击 `停止平台.bat`。

不需要手工执行 `python -m http.server`、`npm run dev` 或 PowerShell 启动命令。

## 3. Python 运行环境

启动器按以下顺序寻找：

1. `py -3`
2. `python`
3. 若均不存在，则尝试从 python.org 下载 Windows Embeddable Python 3.12.6 到项目自己的 `runtime/python/`。

便携 Python 不写注册表、不修改系统 PATH，不污染系统 Python 环境。

若公司代理/防火墙禁止访问 python.org，可在电脑预装 Python 3.10+ 后再次双击启动脚本。

## 4. 本地工作站页面

本地模式新增四个功能页签：

### 4.1 运行状态

显示：

- 平台版本；
- 模型版本；
- 参数版本；
- 数据库版本；
- 当前项目；
- 当前 Calculation ID；
- SQLite 完整性；
- 项目/缓存/计算记录数量；
- 剩余磁盘空间；
- Local Online / Local Offline 状态。

页面右下角同时显示数据状态：

- `数据：实时`
- `数据：缓存`
- `数据：实时 + 缓存`
- `数据：源不可用`

### 4.2 项目管理

支持：

- 保存当前项目；
- 另存项目；
- 打开项目；
- 删除项目。

项目快照保存：

- 项目名称、经纬度；
- 环境原始/处理后数据；
- 当前工程参数；
- 六大模型结果；
- 风险矩阵及综合结果；
- 风温联合设置；
- 平台/模型/参数版本；
- Calculation ID。

打开历史项目时优先恢复当时保存的结果快照。如果模型版本已变化，会先提示，不悄悄用新模型覆盖历史结果。

### 4.3 数据源状态

并行检测当前项目点位相关的：

- ERA5 / Open-Meteo Historical Weather；
- CAMS / Open-Meteo Air Quality；
- Open-Meteo Marine；
- Elevation / DEM；
- V2.9 中央参数服务；
- OpenStreetMap。

每项显示：正常/异常、响应时间、失败原因。

Marine 在内陆点位可能没有有效海洋业务数据，这与“网络不可达”是两类问题；项目实际结果仍以当前数据返回值判断。

### 4.4 系统诊断

检查：

- Python；
- SQLite；
- SQLite integrity check；
- 数据目录；
- 项目/缓存/Calculation/Audit 记录；
- 磁盘空间。

## 5. 数据目录

首次启动自动创建：

```text
data/       SQLite 数据库
config/     本地配置
cache/      文件缓存预留
projects/   可读 JSON 项目镜像
reports/    报告目录预留
logs/       运行日志
backup/     一键备份 ZIP
runtime/    可选便携 Python
```

SQLite 主库：`data/environment_platform.sqlite3`。

数据库使用 WAL 模式，降低异常退出时损坏风险。

运行数据已加入 `.gitignore`，不会随普通 Git 提交上传。

## 6. Local Online / Local Offline 数据链路

现有 V2.9 页面原本直接访问 Open-Meteo 系列公开接口。localhost 模式下，`assets/v29-runtime-config.js` 仅针对当前 V2.9 已使用的五类公开数据源做白名单改写：

```text
archive-api.open-meteo.com    → /local-api/openmeteo?_kind=archive
air-quality-api.open-meteo.com→ /local-api/openmeteo?_kind=air
marine-api.open-meteo.com     → /local-api/openmeteo?_kind=marine
api.open-meteo.com/elevation  → /local-api/openmeteo?_kind=elevation
geocoding-api.open-meteo.com  → /local-api/openmeteo?_kind=geocode
```

不允许把任意 URL 交给本地服务器代理，避免形成开放代理。

### 在线

```text
浏览器 → Local API → 真实公开数据源 → 返回原始 JSON → 写 SQLite 缓存
```

### 断网/上游失败

```text
浏览器 → Local API → 同一请求缓存
                        ↓存在
                    返回缓存
                        ↓不存在
                  明确返回不可用
```

禁止生成随机/模拟环境数据。

如果浏览器已经处于离线状态，会直接请求本地缓存，不先等待外部 DNS/API 超时。

## 7. Calculation ID 与报告追溯

本地模式在每次 `calculate()` 完成后记录计算摘要并生成：

`GEA-YYYYMMDD-HHMMSS-mmm`

记录至少包括：

- 项目 ID / 项目名；
- 经纬度；
- 数据周期；
- 综合环境严酷度；
- 设计适应度 / Design Gap；
- 各环境评分；
- 综合风险；
- 平台/模型/参数版本。

本地模式会在原 PDF/打印报告封面加入“工程可追溯信息”，包括 Calculation ID、Local Project ID、模型版本、参数版本和平台版本。原工程报告内容和公式不因此改变。

## 8. 本地 API

主要接口：

```text
GET    /local-api/health
GET    /local-api/version
GET    /local-api/diagnostics
GET    /local-api/sources
GET    /local-api/cache/status
GET    /local-api/projects
GET    /local-api/projects/{id}
POST   /local-api/projects
DELETE /local-api/projects/{id}
GET    /local-api/calculations
POST   /local-api/calculations
GET    /local-api/config/user
POST   /local-api/config/user
POST   /local-api/backup
GET    /local-api/openmeteo?_kind=...
```

`/local-api/openmeteo` 仅允许已定义的 Open-Meteo 数据类别。

## 9. 原有 V2.9 能力

本次改造不删除或替换：

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

## 10. 一键备份

“本地工作站 → 一键备份”或调用：

`POST /local-api/backup`

生成：

`backup/EnvironmentPlatform_Backup_YYYYMMDD_HHMMSS.zip`

包含 SQLite、本地项目、配置、缓存及版本文件。

## 11. 一键验收

双击：`一键测试.bat`

当前测试覆盖：

- Windows 启动；
- 自动端口；
- 主页加载；
- localhost 工作站 JS/CSS；
- SQLite integrity；
- 项目保存/读取/列表/删除；
- Calculation ID；
- 备份 ZIP；
- 数据源健康检查结构；
- 离线缓存命中 / 无缓存明确失败。

仓库还新增 Windows GitHub Actions：

`.github/workflows/local-workstation-windows.yml`

在 `windows-latest` 上运行 Python API Smoke Test 和 Playwright 浏览器 Smoke Test。

## 12. 固定工程 Benchmark

`tests/benchmark_cases.json` 固定六个工程场景：

- CASE-001 三亚；
- CASE-002 新疆若羌；
- CASE-003 Basra Iraq；
- CASE-004 拉萨；
- CASE-005 North Sea Offshore；
- CASE-006 吐鲁番。

这些场景的坐标和关注模型固定，用于以后升级回归。

**数值基准不人工编造。** 第一次使用真实数据完成工程验收后，才生成并审批 `tests/benchmark_baseline_approved.json`。模型版本未变化时，如果以后计算结果超出已批准容差，应阻止合并；模型升级则需要重新审批基准。

## 13. 本地与线上代码隔离

当前建议保持：

```text
main                  GitHub Pages 稳定正式版
local-deployment-v3   Windows 本地工作站改造版
```

PR 验证完成后再决定是否合并。

长期建议：程序代码与用户数据彻底分离。升级代码不覆盖 `data/`、`config/`、`projects/`、`cache/`、`backup/`。

## 14. 常见问题

### 8080 被占用

无需处理。服务自动尝试后续端口，并把实际端口写入 `.local_server.port` 后自动打开。

### 浏览器打开但真实数据失败

进入“本地工作站 → 数据源”检查各上游状态，再到“系统诊断”确认 SQLite 和本地服务。详细错误同时写入 `logs/`。

### 清除浏览器缓存后项目丢失吗？

不会影响已保存到 SQLite 的本地工程项目。

### 断网后第一次查询一个从未缓存过的新地点会怎样？

明确显示数据源不可用，不制造数据；以前保存的工程项目仍可以打开。

### PDF 是否仍由原页面逻辑生成？

是。沿用原 V2.9 报告模板，本地版只追加工程追溯块，不重写报告的模型、公式和结论生成逻辑。

## 15. 当前边界

当前已经完成“本地工作站基础设施 + 页面管理 UI + 真实数据本地代理缓存 + 追溯 + 自动验收”。

尚不等同于真正的全球全量完全离线数据库：若某个地点从未在线查询/预下载过，完全断网时无法凭空获得 ERA5/CAMS/Marine 数据。后续若要实现真正全离线，应另外建设区域/全球离线数据包，而不是用模拟数据替代。
