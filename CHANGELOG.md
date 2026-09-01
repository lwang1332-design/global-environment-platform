# Changelog

## V2.9.0-local-v3 - 2026-09-01

### Added
- Windows 一键启动 `启动平台.bat`，自动探测 8080-8090 可用端口。
- Windows 一键停止 `停止平台.bat`。
- 无第三方 Python 包依赖的 `local_server.py`。
- 无系统 Python 时自动下载项目私有 Windows Embeddable Python。
- Windows 中文路径、空格路径兼容处理。
- SQLite WAL 本地数据库与 `projects/cache/calculations/audit` 表。
- 本地工程项目保存、另存、打开、删除及 JSON 镜像。
- 自动 Calculation ID 与报告追溯信息。
- 一键备份 SQLite、项目、配置、缓存和版本信息。
- 本地工作站 UI：运行状态 / 项目管理 / 数据源 / 系统诊断。
- ERA5、CAMS/Air Quality、Marine、Elevation、Geocoding 的 localhost 白名单代理与 SQLite 缓存。
- 浏览器离线时缓存即时命中；无缓存时明确返回不可用，禁止模拟数据。
- `实时 / 缓存 / 实时+缓存 / 源不可用` 数据状态徽标。
- 数据源并行健康检查：ERA5、CAMS、Marine、DEM、中央参数、OSM。
- `VERSION.json` 模型/参数/数据库/Local API 版本元数据。
- `.env.example` 与运行数据 `.gitignore`。
- `tests/local_workstation_smoke.py` API/SQLite/项目/备份/离线回归。
- `tests/local_ui_smoke.mjs` Playwright localhost 页面回归。
- `.github/workflows/local-workstation-windows.yml` Windows GitHub Actions 自动验收。
- `tests/benchmark_cases.json`：三亚、若羌、Basra、拉萨、North Sea、吐鲁番固定工程回归场景。
- 完整 Windows 本地部署及故障诊断说明。

### Changed
- `assets/v29-runtime-config.js` 在 localhost/127.0.0.1 下自动启用本地工作站和公开数据本地缓存代理；GitHub Pages 不启用该分支逻辑。
- PDF/打印报告在 localhost 模式追加工程可追溯信息块，不改变原报告工程计算内容。
- `一键测试.bat` 升级为完整本地工作站 Smoke Test。

### Unchanged
- 六大物理模型公式与工程判定逻辑。
- GitHub Pages 正式业务页面。
- V2.9 Supabase 正式参数同步机制。
- 风温联合分布算法。
- PDF 工程报告已有模型、公式与结论生成逻辑。

### Benchmark policy
- 固定场景坐标和检查维度，但不人工编造数值基准。
- 首次真实数据工程验收通过后才生成并审批 `tests/benchmark_baseline_approved.json`。
- 模型版本未变化时，超出批准容差的结果变化应视为回归风险。
