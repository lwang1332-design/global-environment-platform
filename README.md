# 全球风电机组环境适应性评估平台 V2.9

**V2.9 = 真实环境数据 + 物理模型 + 参数中央管理 + 本地可靠缓存 + 风温联合统计 + 工程决策。**

现有 GitHub Pages / PWA 前端保持不变，V2.9 采用增量模块扩展，不修改 V2.8 已确认的 ERA5/CAMS/Marine 数据接口、凝露/盐雾/粉尘/沙蚀等物理模型公式、风险评分和环境×设备矩阵逻辑。

## V2.9 新增能力

- 参数中央管理：GitHub Pages → Vercel Serverless API → Supabase PostgreSQL。
- 正式参数版本：`V2.9-P001`、`V2.9-P002`…，每次发布保留历史版本。
- 参数三级容错：云端最新正式参数 → 浏览器最近有效参数 → 程序默认参数。
- 管理员参数流程：**本机调试 → 应用并重算 → 合法性校验 → 发布正式参数（全网同步）**。
- 管理员密码不再由前端 JavaScript 硬编码判断；`POST /api/config/publish` 必须通过服务端会话鉴权。
- 管理员支持：导入 JSON、导出 JSON、放弃修改、读取最新参数、恢复服务器正式参数、恢复系统默认参数、查看历史版本。
- 最近一次完整项目 ERA5/CAMS/Marine 数据保存到 IndexedDB，离线时可恢复最近项目并使用最近有效参数重新计算。
- 新增 **06 风温联合分布分析**；原矩阵和工程决策顺延为 07、08。
- 风温联合统计严格使用同一小时的 `temperature_2m` 与 `wind_speed_10m` 有效样本，不使用月平均值相乘。
- 页面支持自定义 `T ≥/≤ Tlim` 与 `V ≥/≤ Vlim`，直接输出累计小时、共同有效数据小时、联合占比和折算年均小时。
- 默认快捷场景：高温高风 `T≥35℃ & V≥8m/s`、高温低风 `T≥35℃ & V≤3m/s`。
- 二维 Heatmap：温度 2℃/bin、风速 1m/s/bin，显示时间占比并用阈值线/框选区域标识设计工况。
- PDF 报告自动追加风温联合统计公式、共同有效样本、联合占比和高温低风结果。

## 风温联合计算

对每一个温度和风速均有效的同一小时样本：

```text
Ii = 1，当 Ti 满足温度条件 且 Vi 满足风速条件
Ii = 0，其他情况
Hjoint = Σ Ii × Δt，ERA5 小时数据 Δt = 1 h
Pjoint = Hjoint / Hvalid × 100%
```

`Hvalid` 为温度与风速同时有效的共同小时数，不固定使用 8760。多年数据同时输出累计小时、总体占比和按实际时间跨度折算的年均 `h/y`。

## 中央参数 API

- `GET /api/config/latest`：普通用户读取当前正式参数。
- `GET /api/config/history`：读取历史参数版本。
- `POST /api/auth/login`：管理员服务端验证，返回短时 HMAC 会话令牌。
- `POST /api/config/publish`：管理员发布正式参数，必须携带服务端令牌。
- `GET /api/health`：服务健康检查。

数据库结构和原子发布 RPC 位于 `supabase/schema.sql`，首次正式参数种子位于 `supabase/seed.sql`。

## Vercel 环境变量

以下变量只允许配置在 Vercel Serverless 环境中，**禁止写入 GitHub Pages JavaScript**：

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
ADMIN_PASSWORD_HASH
ADMIN_SESSION_SECRET
ALLOWED_ORIGIN=https://lwang1332-design.github.io
ADMIN_TOKEN_TTL_SECONDS=3600   # 可选
```

管理员密码哈希生成：

```bash
node scripts/hash-admin-password.mjs "你的管理员密码"
```

生成的 `scrypt:<salt>:<hash>` 保存为 `ADMIN_PASSWORD_HASH`。

## 部署顺序

1. Supabase SQL Editor 执行 `supabase/schema.sql`。
2. 首次部署执行一次 `supabase/seed.sql`，生成 `V2.9-P001`。
3. 在 Vercel 导入本 GitHub 仓库并配置上述 Serverless 环境变量。
4. 部署后确认 `/api/health`、`/api/config/latest` 正常。
5. 将 Vercel API 地址写入 `assets/v29-runtime-config.js` 的 `configApiBase`，例如 `https://your-config-api.vercel.app/api`。
6. GitHub Pages 自动发布前端；浏览器打开/每次评估前会读取最新正式参数。

详细部署和故障排查见 `docs/V2.9_DEPLOYMENT.md`。

## PWA / 本地部署

- HTTPS 或 localhost 下可安装 PWA。
- Windows 本地部署仍支持 `http://127.0.0.1:8765/`。
- ERA5、CAMS、Open-Meteo Marine 等实时数据需要联网。
- 离线时页面、最近有效参数和最近一次项目数据可从 PWA Cache + IndexedDB 恢复。

## V2.8 保持不变的核心逻辑

- ERA5 小时/日数据请求及多年分段合并方式。
- 凝露模型 `CA = ρ·Cp·δ` 与默认 10 min 热惯性子步长。
- 盐雾/腐蚀、粉尘/积灰、沙蚀、高海拔、雨雪、极端风计算公式。
- 风险评分阈值、设备敏感度、暴露系数和 `R = H × S/100 × E × P`。
- 地点搜索、地图、管理员全部原参数、PDF、PWA 和工程决策功能。
