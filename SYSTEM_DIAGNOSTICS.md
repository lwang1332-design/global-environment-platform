# SYSTEM_DIAGNOSTICS

本地工作站提供：

`GET /local-api/diagnostics`

当前检查项：

- Python 版本；
- SQLite 版本；
- SQLite `PRAGMA integrity_check`；
- 剩余磁盘空间；
- `data/config/cache/projects/reports/logs/backup` 关键目录；
- 服务当前 UTC 时间。

## 推荐排障顺序

1. 双击 `一键测试.bat`。
2. 若启动失败，检查 `logs/app_YYYYMMDD.log`。
3. 若页面正常但环境数据失败，访问 `/local-api/diagnostics`。
4. 检查公司代理、VPN、DNS、SSL 检查和防火墙。
5. 在线 ERA5 失败但已有历史缓存时，接口应返回 `cache=cached`；没有缓存时必须返回“数据源暂不可用”，不得生成模拟数据。
6. 若数据库异常，先停止平台并备份 `data/`，再检查 SQLite integrity 结果。

## 端口

默认 8080。被占用时依次尝试 8081 至 8090。实际端口写入 `.local_server.port`，启动脚本读取该文件后打开浏览器。

## 异常退出

SQLite 使用 WAL 模式。再次启动后可通过 diagnostics 检查数据库完整性。运行时用户数据与程序代码分离，升级代码不应覆盖 `data/`、`projects/`、`backup/`。
