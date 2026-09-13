# V3.3.2 SO₂ Auto 数据接入版验证记录

日期：2026-09-13

## 结论

V3.3.2 已完成 CAMS SO₂ Auto 的代码、异步任务、数据契约、科学边界、单元回归、浏览器回归，并已完成 **CAMS EAC4 + CAMS Forecast 真实生产数据端到端验证**。

当前状态：

- 代码实现：PASS
- JavaScript全量回归：PASS
- Python CAMS请求契约：PASS
- `ecmwf-datastores-client`异步API依赖：PASS
- 本地浏览器V3.3.2 UI/来源说明：PASS
- CAMS ADS真实凭据认证：PASS
- Vercel V3.3.2后端生产部署：PASS
- EAC4真实任务提交、轮询、下载、NetCDF解析：PASS
- Forecast真实任务提交、轮询、下载、NetCDF解析：PASS
- 稳定生产API公网访问：PASS
- GitHub Pages公网V3.3.2最终烟测：PENDING（合并 `main` 后执行）

生产SO₂后端稳定地址：

`https://global-marine-corrosion-direct-v332.vercel.app/api/so2`

完整 LIVE E2E：GitHub Actions Run `34761756817`，结论 `SUCCESS`。

## 1. 版本边界

- App / UX：V3.3.2
- Data layer：V3.3.2
- Science model：V3.3.0
- V3.3.1 L1/L2/L3与人工Pc/Pd/Sd：继续保留
- Vietnam 10.9°N / 106.6°E / 46.4：仅诊断，`useForCalibration=false`

V3.3.2不修改ISO 9223剂量响应函数，也不恢复任何V3.2.8经验Fallback。

## 2. Historical SO₂ Auto

数据源：CAMS EAC4 monthly reanalysis。

请求契约：

- dataset：`cams-global-reanalysis-eac4-monthly`
- variable：`sulphur_dioxide`
- model level：60（最低模式层）
- year：2003–2025
- months：01–12
- product type：monthly mean
- spatial：项目点附近小范围bbox，下载后取最近网格点
- output：NetCDF

处理：

1. CAMS返回SO₂质量混合比 `qSO2 [kg/kg]`；
2. 每月月平均值映射到同月平台小时轴，不制造月内SO₂小时波动；
3. V3.3.0科学内核逐小时使用空气密度换算：`Pc = qSO2 × rho_air × 1e9 [μg/m³]`；
4. ISO接口使用：`Pd = 0.8 × Pc [mg/(m²·d)]`；
5. 年平均Pd仍由完整统计周期加权得到。

### LIVE验证结果

诊断点：10.9°N / 106.6°E，年份：2025。

- source：`CAMS EAC4 monthly reanalysis`
- dataset：`cams-global-reanalysis-eac4-monthly`
- modelLevel：`60`
- samples：12
- finiteSamples：12
- coverage：1.0
- 最近网格点：11.25°N / 106.5°E
- 输出统一单位：`kg/kg`
- upstream unit：`kg kg**-1`

结论：真实ADS任务已完成 `submit → poll → download → NetCDF parse` 全链路，12个月数据全部为有限非负值。

## 3. Current SO₂ Auto

数据源：CAMS Global Atmospheric Composition Forecast。

请求契约：

- dataset：`cams-global-atmospheric-composition-forecasts`
- variable：`sulphur_dioxide`
- model level：137（最低模式层）
- type：forecast
- lead time：0–120 h，每3 h
- current cycle：采用至少8 h安全滞后的最近00/12 UTC周期
- 如最近周期被ADS拒绝，可按12 h回退最多3个生产周期；这只是数据发布时间处理，不是数值Fallback。

3 h数据只在相邻有效点之间有界插值到平台小时轴，不外推缺失时段。

### LIVE验证结果

诊断点：10.9°N / 106.6°E。

- source：`CAMS Global atmospheric composition forecast`
- dataset：`cams-global-atmospheric-composition-forecasts`
- modelLevel：`137`
- cycle：`2026-09-13T00:00:00Z`
- samples：41
- finiteSamples：41
- coverage：1.0
- 最近网格点：10.8°N / 106.8°E
- 输出统一单位：`kg/kg`
- upstream unit：`kg kg**-1`

结论：真实Forecast任务已完成 `submit → poll → download → NetCDF parse` 全链路，0–120 h共41个3 h样本全部为有限非负值。

## 4. ADS异步任务

后端采用 `ecmwf-datastores-client` 异步模式：

`submit → requestId → opaque job token → GET poll → result ready → download → xarray解析`

原因：ADS请求可能排队，不应让Serverless函数同步占用整个排队时长。

平台策略：

- 浏览器轮询窗口：300 s；
- 未完成任务jobId保存在现有IndexedDB缓存；
- 下次计算继续同一任务，避免重复提交；
- Historical结果缓存30 d；
- Current结果缓存3 h；
- ADS任务续跑信息缓存24 h。

job token不包含ADS密钥。

## 5. 安全边界

必需服务器环境变量：

- `CAMS_ADS_API_KEY`
- 可选 `CAMS_ADS_URL`，默认 `https://ads.atmosphere.copernicus.eu/api`

原则：

- ADS Token不得写入GitHub Pages；
- 不得写入仓库；
- 不得进入浏览器localStorage；
- 不得进入结果JSON或日志；
- CAMS账号需事先接受EAC4与Forecast对应数据集许可。

LIVE验证已确认服务器端凭据可以对EAC4与Forecast完成真实任务认证；验证记录不保存Token值。

## 6. SO₂缺失行为

如果以下任一情况发生：

- 后端未部署；
- `CAMS_ADS_API_KEY`未配置；
- ADS账号未接受数据许可；
- ADS临时不可用；
- 请求最终失败；

平台必须：

- 保持SO₂ `MISSING`；
- 不把缺失当零；
- 不恢复 `Pd=1`；
- L1环境Screening继续；
- 可允许用户显式补充Pc/Pd进入L2；
- 没有ISO 9225等效Sd仍不得冒充L3 Formal ISO。

## 7. 与CAMS海盐链隔离

SO₂ Auto只替换 `cams.so2` 字段。

原有：

- `ss1`
- `ss2`
- `ss3`
- CAMS RH80质量/粒径语义
- 缺Bin逐BinProxy

全部保持V3.3.0规则，不因SO₂ Auto改变。

## 8. 自动验证

GitHub Actions：`Marine Corrosion V3.3.2 CAMS SO2`。

已覆盖：

- JS/Python语法检查；
- V3.3.0全部原有科学回归；
- V3.3.1可计算性回归；
- V3.3.2 EAC4月平均映射；
- Forecast 3 h有界小时对齐；
- 只替换SO₂、不破坏ss1/ss2/ss3；
- 未配置后端拒绝且不造Pd；
- EAC4请求dataset/variable/ML60/月平均契约；
- Forecast请求dataset/variable/ML137/0–120 h契约；
- 最新周期8 h安全滞后；
- ADS job token round-trip与非法token拒绝；
- 安装后的 `ecmwf.datastores.Client` 具备 `submit / get_remote / get_results`；
- Playwright页面显示V3.3.2、EAC4、Forecast、ML60、ML137且无横向溢出。

真实生产E2E另由 `Deploy Marine CAMS SO2 Backend` 工作流验证，Run `34761756817` 已PASS。

## 9. 部署工作流

`.github/workflows/deploy-marine-cams-so2-backend.yml` 保持手动触发。

要求GitHub Actions Secrets：

- `VERCEL_TOKEN`
- `CAMS_ADS_API_KEY`

工作流会：

1. 检查Secret是否存在但不打印值；
2. `vercel link` 创建/链接 `global-marine-corrosion-direct-v332`；
3. 部署 `marine-corrosion/direct-backend`；
4. 只在Vercel运行时注入 `CAMS_ADS_API_KEY`；
5. 在稳定生产域名提交EAC4真实任务并持续轮询到下载/解析完成；
6. 校验EAC4 dataset、ML60、单位、时间序列、有限值与coverage；
7. 提交Forecast真实任务并持续轮询到下载/解析完成；
8. 校验Forecast dataset、ML137、cycle、单位、时间序列、有限值与coverage；
9. 只有两条真实数据链全部通过才输出 `CAMS SO2 V3.3.2 LIVE E2E PASS`。

## 10. 发布闸门

### 合并前闸门

以下已全部满足：

1. ADS账号已接受EAC4与Forecast许可：PASS；
2. `CAMS_ADS_API_KEY`有效：PASS；
3. Vercel生产后端部署成功：PASS；
4. Historical EAC4真实任务完成并成功解析NetCDF：PASS；
5. Current Forecast真实任务完成并成功解析NetCDF：PASS；
6. 返回qSO₂进入V3.3.0既有Pc/Pd科学链的单元/回归验证：PASS；
7. SO₂失败时L1仍可计算且没有Pd=1回退：PASS；
8. 最新V3.3.2回归CI必须为绿灯：待本文件提交后的最终CI确认。

### 合并后公网烟测

合并 `main` 后立即执行：

- GitHub Pages加载V3.3.2；
- Auto模式调用稳定生产SO₂ API；
- Historical能够读取EAC4结果；
- Current能够读取Forecast结果；
- 页面来源/版本显示正确；
- 无CORS、控制台致命错误或旧端点残留。

只有该公网烟测通过，V3.3.2才最终标记为“生产发布完成”。
