# 全球海洋大气腐蚀环境评估平台 V3.3.0

线上目标：<https://lwang1332-design.github.io/global-environment-platform/marine-corrosion/>

V3.3.0 是基于 V3.2.8 模型审计形成的**科学模型修正版**。本版本优先修复标准接口、单位一致性和数据语义问题，不以追平某个实测点为目标。Vietnam 10.9°N / 106.6°E / 46.4 仅作为诊断回归点，禁止参与参数拟合。

## 1. V3.3.0 核心变化

| 模块 | V3.2.8 | V3.3.0 |
| --- | --- | --- |
| Wet Deposition | `Ci × [1-exp(-0.022R)] × 0.65` 直接与表面通量相加 | 改为量纲闭合的 `M=C×H×[1-exp(-ΛΔt)]`；Λ/H 未标定时不并入总沉降 |
| SO₂ 缺失 | 固定 `Pd=1 mg/(m²·d)` | **取消固定值**；缺失即 `Pd=null`，正式 ISO 腐蚀率不输出 |
| ISO SO₂ 输入 | `C×v×86.4` 直接作为 Pd | ISO 接口采用 `Pd≈0.8Pc` 或实测 Override；物理沉降另列 |
| CAMS 海盐质量 | RH80 混合比直接进入质量浓度 | `q80/4.3` 转干盐质量后计算 |
| CAMS 粒径 | 代表粒径后再次完整 κ 吸湿 | 以 RH80 粒径为基准：`d(RH)=d80×GF(RH)/GF(80)` |
| CAMS 缺 Bin | ss1/ss2/ss3 任一缺失则全部改 Proxy | **逐 Bin 使用**；仅缺失 Bin 用 Proxy 补齐 |
| Proxy Fetch | Marine Factor 内一次 + 外层再一次 | 距海与 Fetch 拆开，Fetch **只作用一次** |
| Proxy 距海 | 100 km 处存在 0.08→0.02 跳变 | 连续 `floor+(1-floor)exp(-D/L)` |
| Local Spray | 35/75 μm 共用 12 km | 35 μm / 75 μm 独立衰减尺度，默认仅为待校准 CONFIG |
| GIS Fallback | Natural Earth 1:50m + 15° bearing | Natural Earth 1:50m + **5° bearing** + 方向离散度；复杂河口降级可信度 |
| Cl⁻ → ISO | 工程设备表面 `JCl` 直接作为 `Sd` | **双通道**：`JCl,equipment ≠ Sd,ISO`；Sd 只来自 ISO 9225 等效实测或经验证转换 |
| 旧腐蚀校准 | 可使用 V3.2.8 局地残差修正 | **禁用**；V3.3 必须重新做同期训练/留出验证 |

## 2. 正式 ISO 与工程 Screening 分离

V3.3.0 将结果拆成两个层级：

### 正式 ISO 9223

只有同时满足以下条件才输出：

- Historical 完整周期满足覆盖率要求；
- `Pd,ISO` 可追溯：CAMS SO₂ 浓度换算或实测 Override；
- `Sd,ISO` 可追溯：ISO 9225 湿烛等效实测 Override 或经过验证的等效转换；
- RH、T 等气象输入有效。

否则：

`summary.isoFirstYearCorrosion = null`

页面必须显示缺失原因，而不是伪造一个精确值。

### 工程 Screening

工程海盐链仍计算：

`Air salt → Dry / Impaction / optional Wet → JCl,equipment → screeningFirstYearCorrosion`

Screening 仅用于模型诊断和工程筛查，不得标成 ISO 标准腐蚀率。

## 3. CAMS RH80 处理

CAMS ss1 / ss2 / ss3 的海盐质量和粒径以 RH=80% 表示。V3.3.0：

- 质量：`Cdry = (q80 / 4.3) × rho × 1e9 × Fheight`
- 粒径：用三个 CAMS RH80 半径区间 `0.03–0.5 / 0.5–5 / 5–20 μm` 的几何中心作为代表径；
- 环境 RH 修正：`d(RH)=d80×GF(RH)/GF(80)`；
- 若某个 CAMS Bin 缺失，只补该 Bin，不放弃其他有效 Bin。

## 4. Proxy / Local Spray

Proxy：

`Cproxy = K × FU × FHs × FS × Fdistance × Ffetch × Fheight`

其中：

- `Fdistance = floor + (1-floor) exp(-D/L)`；
- `Ffetch = 0.35 + 0.65 clamp(Fetch/250,0,1)`；
- 距离与 Fetch 各只出现一次。

Local Spray：

- 35 μm：`exp(-D/localSprayScale35Km)`；
- 75 μm：`exp(-D/localSprayScale75Km)`；
- 默认 12 km / 6 km 只是待校准 CONFIG，不声明为全球物理常数。

## 5. Wet Deposition

V3.3.0 不再使用 V3.2.8 的量纲不闭合公式。

当且仅当以下两个参数经过项目/文献标定：

- `wetScavengingRatePerMm`
- `wetScavengingHeightM`

才计算：

`fraction = 1-exp(-Lambda×Δt)`

`Mwet = C × Heff × fraction`

并转换为 `mg/(m²·d)`。

未配置时，降雨 Wet 项不并入总沉降，并在质量原因中明确提示。

## 6. SO₂

- `Cso2 = qso2 × rho × 1e9`，单位 μg/m³；
- ISO 9223 接口：`Pd,ISO ≈ 0.8 × Pc`，或使用明确的实测 `so2Dep` Override；
- 物理沉降 `C×v×86.4` 保留为诊断量 `physicalSo2Dep`；
- CAMS SO₂ 缺失时不再设 `Pd=1`。

## 7. ISO Cl⁻ 双通道

工程量：

`JCl,equipment = Jsalt × chlorideFraction`

标准量：

`Sd,ISO`

默认情况下两者**不等同**。V3.3.0 只有两种方式获得 `Sd,ISO`：

1. 管理员输入 `isoChlorideDep` 实测/标准等效值；
2. 后续完成同点同期 ISO 9225 湿烛校准后启用 `isoChlorideEquivalentFactor`。

在第二种方式完成验证前，该系数默认 `null`。

## 8. GIS

浏览器 Fallback：

- Natural Earth 1:50m；
- 5° bearing，共 72 个方向；
- 海陆转换二分 10 次；
- 计算 ±10° 范围的距海 / Fetch 离散度；
- 方向距离离散过大时标记复杂海岸、可信度降级。

Production 仍建议恢复 GSHHG high/full resolution Direct，特别是河口、港池、小岛和复杂海湾。

## 9. 数据源与 Direct

Direct 网关仍指向原服务地址。若生产 Direct 未恢复：

- Weather：Open-Meteo ERA5 / forecast fallback；
- Wave：Open-Meteo Marine fallback；
- CAMS sea salt：缺失 Bin 使用 Proxy；
- SO₂：保持 MISSING；
- Salinity：缺失时 35 PSU EST；
- GIS：Natural Earth browser fallback。

V3.3.0 的原则是：**缺失数据可以降低结论等级，但不能用未声明的固定值伪装成真实数据。**

## 10. 校准和验证

V3.2.8 的 641 行 CSV 审计、121 条去重记录和高度探索参数仍作为历史证据保留，但由于 V3.3.0 改变了 CAMS 湿基、SO₂ 和 Cl⁻ 标准接口：

- V3.2.8 腐蚀残差校准禁止直接迁移；
- 必须补齐准确测量起止日期、原始单位、材料、区带、测量方法；
- Training / Hold-out 必须按站点区域隔离；
- 26 点 Benchmark 和 Vietnam 46.4 点不得参与拟合。

Vietnam 诊断点见 `diagnostic-points-v330.json`。

## 11. 代码入口

V3.3.0 主文件：

- `model-v330.js`
- `sources-v330.js`
- `gis-browser-v330.js`
- `run-controller-v330.js`
- `model-worker-v330.js`
- `review-ui-v330.js`
- `v330-ui-patch.js`

为减少一次性重写 UI 的风险，旧入口名在 V3.3 分支中作为兼容转发：

- `model-v328.js → model-v330.js`
- `run-controller.js → run-controller-v330.js`
- `gis-browser-v328.js → gis-browser-v330.js`
- `review-ui.js → review-ui-v330.js + V3.3 UI patch`

V3.2.8 原始核心已归档在 `legacy-v328/`。

## 12. 测试

```bash
node --test marine-corrosion/tests/*.test.mjs
```

CI：`.github/workflows/marine-corrosion-v330-science.yml`

测试覆盖：

- Missing / zero / UTC / 插值 / 单位；
- 1 / 3 / 5 年完整序列；
- CAMS RH80 质量与粒径；
- 逐 Bin CAMS / Proxy；
- Wet 量纲闭环；
- SO₂ `Pd=1` 取消；
- `Pd=0.8Pc`；
- 工程 Cl 与 ISO Sd 双通道；
- Proxy 单 Fetch；
- Vietnam 诊断点不参与拟合；
- Gateway CORS / token / async protocol。

详细变更和待办见 `VERIFICATION-V3.3.0.md`。
