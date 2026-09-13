# 全球海洋大气腐蚀环境评估平台 V3.3.1

线上目标：<https://lwang1332-design.github.io/global-environment-platform/marine-corrosion/>

V3.3.1 是在 V3.3.0 **科学模型修正版**之上的**可计算性修正版**。科学内核继续保持 V3.3.0 的单位、CAMS RH80、SO₂、ISO Sd、Proxy/Fetch、Wet 等修正；V3.3.1 不退回任何旧Fallback，而是增加用户友好的输入补齐与三层计算等级，使缺失 Pd/Sd 时平台仍然能给出有边界声明的工程结果。

Vietnam 10.9°N / 106.6°E / 46.4 仍只作为诊断回归点，禁止参与参数拟合。

## 1. 三层计算等级

### L1 环境 Screening（默认，始终可算）

即使 SO₂、ISO Sd、Wet 参数、GSHHG Direct 缺失，也继续输出：

- 气温、湿度、风、雨、波浪、盐度；
- CAMS有效粒径 + 缺失粒径逐Bin Proxy；
- Air Salt；
- Dry / Impaction；
- 工程 Cl⁻沉降 `JCl,equipment`；
- Surface Cl；
- TOW / 凝露 / Salt-Wet；
- Browser GIS / 人工GIS Screening。

L1 不输出正式ISO腐蚀率，但不会把整次计算标成失败。

### L2 工程腐蚀 Screening

当 SO₂ `Pd` 可追溯时，可使用：

`Pd + engineering JCl + RH + T`

计算一个**工程相对腐蚀筛查值**。页面等级加 `*`，明确写成 `ENGINEERING SCREENING`：

- 可用于地点比较、模型诊断、参数敏感性；
- 不得作为正式 ISO 9223 等级；
- 因工程 `JCl` 尚未等效到 ISO 9225 湿烛 `Sd`。

### L3 正式 ISO 9223

只有同时满足：

- Historical完整周期满足覆盖率；
- `Pd,ISO` 可追溯；
- `Sd,ISO` 为 ISO 9225湿烛等效值或已验证转换；
- RH / T 等输入有效；

才标记为 `FORMAL ISO 9223`。

## 2. V3.3.1 用户补齐卡

页面新增“缺失数据补齐与计算级别”卡，不要求普通用户进入管理员页输入 `kg/kg`。

### SO₂

三种方式：

1. **自动**：优先使用可用 CAMS SO₂；缺失则停留L1；
2. **人工 Pc（推荐）**：单位 `μg/m³`，系统自动按 `Pd = 0.8 × Pc` 换算；
3. **人工 Pd**：单位 `mg/(m²·d)`，作为高级直接输入。

SO₂缺失时绝不恢复 `Pd=1`。

### ISO Cl⁻ Sd

可选输入：

`ISO 9225 湿烛等效 Sd [mg/(m²·d)]`

未输入时，工程 `JCl,equipment` 仍计算，但只能用于 L1/L2 Screening。

### GIS人工覆盖

复杂河口、港池或用户已有高精度GIS结果时，可以输入：

- 最近距海 km（可选）；
- 上风向海距 km；
- 有效 Fetch km。

该覆盖会明确标记 `OVERRIDE/SCREENING`，并固定应用到全部风向，只用于工程筛查；Production 复杂海岸仍要求 GSHHG high/full Direct。

### Wet deposition

默认关闭。只有用户明确输入：

- `wetScavengingRatePerMm`；
- `wetScavengingHeightM`；

才进入量纲闭合Wet模型。未标定时继续采用 Dry + Impaction，不使用 V3.2.8 的量纲错误公式。

## 3. V3.3.0科学修正继续有效

| 模块 | V3.3.x规则 |
| --- | --- |
| Wet Deposition | `M=C×H×[1-exp(-ΛΔt)]`；Λ/H缺失则不并入 |
| SO₂缺失 | 保持MISSING，绝不固定Pd=1 |
| ISO SO₂ | `Pd≈0.8Pc` 或明确Override |
| CAMS海盐质量 | RH80 `q80/4.3` 转干盐 |
| CAMS粒径 | `d(RH)=d80×GF(RH)/GF(80)` |
| CAMS缺Bin | 逐Bin保留；只补缺失Bin |
| Proxy | Distance与Fetch只作用一次 |
| Local Spray | 35/75 μm 独立衰减尺度 |
| GIS Fallback | Natural Earth 1:50m + 5° bearing + 方向敏感性 |
| Cl⁻ → ISO | `JCl,equipment ≠ Sd,ISO` |
| 旧腐蚀校准 | 不迁移V3.2.8残差校准 |

## 4. 数据源退化规则

Direct未恢复时：

- Weather：Open-Meteo ERA5 / forecast fallback；
- Wave：Open-Meteo Marine fallback；
- CAMS sea salt：缺失Bin使用Proxy；
- SO₂：保持MISSING，用户可补Pc/Pd；
- Salinity：缺失时35 PSU EST；
- GIS：Natural Earth Browser Fallback，用户可做Screening Override。

原则：**缺失数据降低结论等级，不把缺失当零，也不把经验值伪装成RAW。**

## 5. 代码入口

科学内核 V3.3.0：

- `model-v330.js`
- `sources-v330.js`
- `gis-browser-v330.js`
- `run-controller-v330.js`
- `model-worker-v330.js`
- `review-ui-v330.js`

V3.3.1 可计算性层：

- `input-policy-v331.js`：输入规范、Pc→Pd、L1/L2/L3、Wet/GIS策略；
- `v331-ui-runtime.js`：稳定的普通用户补齐卡、Screening显示、版本与输入同步；不使用全DOM MutationObserver；
- `gis-browser-v331.js`：人工GIS Screening Override；
- `review-ui.js`：加载V3.3.1稳定运行层；
- `gis-browser-v328.js`：兼容入口转发到V3.3.1 GIS。

## 6. 测试

```bash
node --test marine-corrosion/tests/*.test.mjs
```

V3.3.1新增回归：

- Pc → `Pd=0.8Pc`；
- Auto模式不造Pd；
- ISO Sd输入；
- Wet启停；
- GIS人工覆盖72个5°方向Bin；
- L1/L2/L3输入就绪逻辑；
- 工程Screening腐蚀率带非正式警告；
- 浏览器首屏、输入切换、版本分离和页面可响应性。

CI：

- `.github/workflows/marine-corrosion-v330-science.yml`
- `.github/workflows/marine-corrosion-v331-calculability.yml`
- `.github/workflows/marine-corrosion-v330-live.yml`（已升级为V3.3.1公网Live Check）

## 7. 版本定位

- **V3.3.0：科学模型修正版** —— 修物理、单位、数据语义；
- **V3.3.1：可计算性修正版** —— 在不牺牲科学边界的前提下恢复工程可用性。

正式发布前必须通过全量单元回归、浏览器UI检查和GitHub Pages在线检查。
