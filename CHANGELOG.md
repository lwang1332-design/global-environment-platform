# Changelog

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
