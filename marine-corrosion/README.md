# 全球海洋大气腐蚀环境评估平台 V3.3.2

线上前端：<https://lwang1332-design.github.io/global-environment-platform/marine-corrosion/>

V3.3.2 是 **SO₂ Auto 数据接入版**。科学内核继续保持 V3.3.0；V3.3.1 的 L1/L2/L3 可计算性与人工 Pc/Pd/Sd 补齐继续保留。本版不增加 SO₂ 经验Fallback，而是把 CAMS 官方数据接入自动链。

Vietnam 10.9°N / 106.6°E / 46.4 仍只作为诊断回归点，`useForCalibration=false`。

## 1. SO₂ Auto 正式数据链

### Historical

`CAMS EAC4 monthly reanalysis → sulphur_dioxide → lowest model level 60 → kg/kg → 平台空气密度 → Pc [μg/m³] → Pd = 0.8 Pc`

- ADS dataset：`cams-global-reanalysis-eac4-monthly`
- 时间覆盖：2003–2025
- 空间分辨率：0.75°
- 时间分辨率：月平均
- V3.3.2 将每个月的 SO₂ 月平均混合比映射到该月小时气象轴；ISO 年平均 Pc/Pd 因而仍由真实月平均数据加权得到，不制造小时波动。

### Current

`CAMS Global atmospheric composition forecast → sulphur_dioxide → lowest model level 137 → kg/kg → 平台空气密度 → Pc → Pd = 0.8 Pc`

- ADS dataset：`cams-global-atmospheric-composition-forecasts`
- 模式层：137（最低模式层）
- 预报步长：3 h
- 请求窗口：0–120 h
- V3.3.2 只在相邻有效预报点之间做有界小时插值，不外推缺失时段。

## 2. ADS 异步任务

CAMS ADS 请求可能排队，因此后端不再同步阻塞等待：

`POST提交 → 返回jobId → 浏览器轮询 → ADS完成 → 后端下载NetCDF → 最近网格点解析 → 返回SO₂`

任务 ID 保存在浏览器 IndexedDB；如果一次运行超过轮询窗口，下一次计算继续原 ADS 任务，不重复提交。Current 若最近生产周期被ADS拒绝，后端最多自动退回3个更早的12 h生产周期；这属于数据发布时效处理，不是 SO₂ 数值Fallback。

## 3. 安全与凭据

GitHub Pages **不得**保存 Copernicus ADS token。后端仅从服务端环境变量读取：

- `CAMS_ADS_API_KEY`：必需，Copernicus/ECMWF Data Store个人访问令牌；
- `CAMS_ADS_URL`：可选，默认 `https://ads.atmosphere.copernicus.eu/api`。

用户账号还必须在 ADS 网页接受 EAC4 与 CAMS Forecast 对应数据集许可。令牌不进入浏览器、日志、结果JSON或仓库。

## 4. 结果等级

- **L1 Environment Screening**：SO₂仍不可用时继续计算环境、海盐、工程Cl⁻、Surface Cl、TOW、GIS等；
- **L2 Engineering Corrosion Screening**：CAMS SO₂ Auto得到可追溯 Pd，或人工补 Pc/Pd 后可计算工程腐蚀筛查；
- **L3 Formal ISO 9223**：除可追溯 Pd 外，仍必须具备 ISO 9225等效 Sd 与完整 Historical 覆盖。

SO₂ Auto失败时保持 `MISSING`，绝不恢复 `Pd=1`。

## 5. V3.3.0/V3.3.1科学边界继续有效

| 模块 | 规则 |
| --- | --- |
| CAMS海盐 | RH80质量 `/4.3` 转干盐；粒径按 `GF(RH)/GF(80)` 修正 |
| CAMS缺Bin | 仅缺失Bin用Proxy补齐；缺测不当零 |
| Proxy | Distance与Fetch各作用一次 |
| Local Spray | 35/75 μm 独立衰减尺度 |
| Wet | `M=C×H×[1-exp(-ΛΔt)]`；Λ/H未提供则不并入 |
| SO₂ | CAMS Auto或人工Pc/Pd；缺失保持MISSING |
| ISO SO₂ | `Pd ≈ 0.8 Pc` |
| ISO Cl⁻ | `JCl,equipment ≠ Sd,ISO` |
| GIS | Browser Natural Earth为Screening；复杂河口正式评价仍需GSHHG Direct |
| 旧腐蚀校准 | V3.2.8残差校准不迁移 |

## 6. 代码入口

科学内核 V3.3.0：`model-v330.js`。

V3.3.1可计算性层：`input-policy-v331.js`、`v331-ui-runtime.js`、`gis-browser-v331.js`。

V3.3.2 SO₂ Auto层：

- `sources-v332.js`：CAMS SO₂异步任务适配、EAC4月平均映射、Forecast小时对齐；
- `run-controller-v332.js`：任务缓存/续跑、来源与覆盖率状态；
- `input-policy-v332.js`：版本与SO₂ Auto数据策略；
- `v332-ui-runtime.js`：页面来源说明；
- `direct-backend/api/so2.py`：ADS submit/poll/download/NetCDF解析；
- `direct-backend/requirements.txt`：`ecmwf-datastores-client`、xarray/netCDF依赖。

兼容入口 `run-controller.js` 与 `review-ui.js` 已转发至V3.3.2。

## 7. 后端部署

推荐项目名：`global-marine-corrosion-direct-v332`。

Vercel Python Function启用 Fluid Compute，`api/so2.py` 最大执行300 s；ADS排队本身通过异步job处理，不依赖函数一直占用300 s。

发布完成后前端默认请求：

`https://global-marine-corrosion-direct-v332-lwang1332-4885.vercel.app/api/so2`

也可通过浏览器本地配置 `marineCamsSo2Url` 或 `window.__MARINE_CAMS_SO2_URL__` 指向其它受控后端。

## 8. 测试

```bash
node --test marine-corrosion/tests/*.test.mjs
python3 -m unittest marine-corrosion/tests/test_so2_backend.py
```

V3.3.2新增守卫：

- EAC4 dataset / SO₂ / ML60 / 月平均请求契约；
- Forecast dataset / SO₂ / ML137 / 0–120 h请求契约；
- 月平均映射到小时轴；
- 3 h Forecast有界小时对齐；
- 仅替换SO₂、不破坏ss1/ss2/ss3；
- ADS任务ID可安全续跑；
- 未配置后端拒绝请求，不制造Pd；
- ECMWF datastores异步API依赖可用；
- 浏览器V3.3.2来源与版本检查。

CI：`.github/workflows/marine-corrosion-v332-so2.yml`。

## 9. 版本定位

- **V3.3.0：科学模型修正版**；
- **V3.3.1：可计算性修正版**；
- **V3.3.2：SO₂ Auto 数据接入版**。

V3.3.2只有在后端已部署、`CAMS_ADS_API_KEY`有效、数据集条款已接受且公网实测通过后，才允许标记为“SO₂ Auto生产可用”。
