# Changelog

## V3.3.0 - 2026-09-18

### Architecture
- 以 Core Environment Metric Registry 作为核心环境卡片、详情、时序分析的统一数据入口，减少首页与趋势模块重复计算。
- 指标统一增加 OBS / REA / MODEL / DERIVED / ENG / GIS / N/A 数据类型编码。
- 增加请求周期覆盖率、实际数据完整率、数据可信度 A/B/C/D 及接入成熟度 A/B/C/D/E。

### Engineering analysis
- 统一 upper / lower / range / target / boolean Design Gap 判据。
- 增加超限事件识别：次数、累计小时、最长连续时间、最大 Gap、P95 Gap、首次/最近超限。
- 原始时序继续用于过程展示；长期趋势使用月均去季节化异常序列进行 Mann-Kendall / Sen slope 辅助分析。
- 增加当前可视窗口 Mean / P95 / Max / 超限统计。
- 增加 Pearson 相关与 ±24/72/168 h 滞后相关辅助分析。
- 增加绝对值 Y1/Y2/Y3 与 0-1 归一化多量纲组合模式。
- 增加 Shift 框选分析区间和当前窗口 CSV + metadata 导出。

### Data sources
- 阵风优先使用 Open-Meteo 历史/再分析阵风时序，不再将固定 gustFactor 代理值当成真实阵风。
- CAMS 按用户请求周期尽量扩展至其实际可用历史范围，并保留真实覆盖元数据。
- 接入 NASA OBPG / PacIOOS 全球 0.04° 距最近海岸栅格点查询；距海距离作为 GIS 环境元数据，不作为经验盐雾衰减公式。
- 接入 NASA POWER ALLSKY_SFC_UVB 与 TS（日尺度 UV-B / Earth skin temperature）。
- ESA WorldCover、NASA LIS/OTD、NOAA IBTrACS 保留为 B 类“公开数据可接”，在没有稳定点查询链路时不生成伪数据。

### Quality
- 平台静态标题、页面版本、VERSION.json 与报告版本统一升级至 V3.3。
- 新增 V3.3 自动验收，覆盖 12 一级环境、指标追溯、Coverage/Confidence、趋势、三纵轴、归一化、超限统计、CSV 与缺失值策略。

## V2.9.0-local-v3 - 2026-09-01

### Added
- Windows 一键启动 `启动平台.bat`，自动探测 8080-8090 可用端口。
- Windows 一键停止 `停止平台.bat`。
- 无第三方 Python 包依赖的 `local_server.py`。
- 无系统 Python 时自动下载项目私有 Windows Embeddable Python。
- SQLite WAL 本地数据库。
- 本地项目、Calculation ID、缓存、备份、系统诊断 API。
- ERA5 via Open-Meteo 本地代理与在线失败缓存回退。
- `VERSION.json` 与 `config/default-config.json`。
- `一键测试.bat` Smoke Test。
- 本地工作站浏览器适配模块 `assets/local-workstation.js`。
- Windows 本地部署说明。

### Unchanged
- 六大物理模型公式与工程判定逻辑。
- GitHub Pages 正式页面结构。
- V2.9 Supabase 正式参数同步机制。
- 风温联合分布算法。
- PDF 工程报告模板与生成逻辑。
