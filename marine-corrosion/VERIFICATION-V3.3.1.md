# V3.3.1 可计算性修正版验证记录

日期：2026-09-13

## 结论

V3.3.1 在 V3.3.0 科学模型内核上增加输入补齐与计算等级，不恢复任何已取消的伪Fallback。分支级单元回归与浏览器回归已通过，可进入 main 快进发布与 GitHub Pages 公网验收。

## 1. 版本边界

- App / UX release：V3.3.1
- Science model：V3.3.0
- Vietnam 10.9°N / 106.6°E / 46.4：诊断点，`useForCalibration=false`

## 2. 可计算性等级

### L1 Environment Screening

Pd/Sd缺失时仍输出气象、海盐、工程Cl⁻沉降、Surface Cl、湿润状态和GIS结果；整次运行不因ISO输入缺失而判定失败。

### L2 Engineering Corrosion Screening

当Pd可追溯时，允许使用工程Cl⁻沉降作为相对筛查输入，并强制显示 `ENGINEERING SCREENING` 与星号等级。该结果不是ISO 9225湿烛等效Sd驱动的正式ISO 9223结论。

### L3 Formal ISO 9223

要求完整Historical覆盖、可追溯Pd及ISO 9225等效Sd。

## 3. 人工输入

- SO₂ Pc：μg/m³，自动 `Pd=0.8Pc`
- SO₂ Pd：mg/(m²·d)，高级直接输入
- ISO 9225等效 Sd：mg/(m²·d)
- GIS Screening Override：最近距海、上风向海距、Fetch；固定到72个5°方向Bin并标记 `OVERRIDE/SCREENING`
- Wet：只有显式输入 scavenging rate 与 effective column height 时启用

## 4. 防回退守卫

验证以下规则继续成立：

- SO₂ Auto模式不会生成固定 `Pd=1`
- CAMS缺失海盐Bin仍按Proxy逐Bin补齐，缺测不当零
- Wet未配置时保持关闭，不恢复V3.2.8量纲错误公式
- `JCl,equipment` 与 `Sd,ISO` 保持分离
- CAMS RH80干盐质量与粒径修正仍由V3.3.0科学模型执行
- Proxy Distance / Fetch仍为单次作用
- Local Spray 35/75 μm保持独立衰减尺度

## 5. 自动测试

工作流：`.github/workflows/marine-corrosion-v331-calculability.yml`

已通过：

- V3.3.1模块语法检查
- `node --test marine-corrosion/tests/*.test.mjs`
- Pc→Pd
- Auto不造Pd
- ISO Sd输入
- Wet开/关
- GIS人工覆盖
- L1/L2/L3 readiness
- 工程Screening非正式标识
- 全部V3.3.0原有science/gateway/core回归

## 6. 浏览器验证

本地静态服务 + Playwright已通过：

- 页面完成 `DOMContentLoaded`
- 标题与品牌显示 V3.3.1
- “缺失数据补齐与计算级别”面板存在
- L1/L2/L3三层显示正常
- 默认SO₂模式为Auto
- 切换Pc时Pc输入显示、Pd输入隐藏
- `APP_VERSION=3.3.1`
- `MODEL_VERSION=3.3.0`
- `Pc=10 μg/m³ → Pd=8 mg/(m²·d)`
- Pc + ISO Sd 可使正式输入ready
- 无横向页面溢出

早期浏览器测试曾发现observer自触发导致DOMContentLoaded超时；已删除observer版实验补丁，改为 `v331-ui-runtime.js` 的事件 + 轻量定时同步，回归通过。

## 7. GIS与Direct边界

- Browser GIS仍为Natural Earth 1:50m工程Fallback；复杂河口/港池正式评价仍需GSHHG high/full Direct。
- 旧Direct Vercel服务未恢复，公网Live Check需继续把该已知CORS/不可达状态作为外部服务告警，而不是科学模型失败。

## 8. 发布闸门

发布到main后必须继续通过：

1. GitHub Pages部署成功；
2. V3.3.1公网资产哈希与main一致；
3. 公网Playwright显示V3.3.1补齐面板；
4. Science model仍为V3.3.0；
5. SO₂、Wet、Sd、CAMS、Proxy等科学守卫全部保持。

## 9. Main发布验证触发

`main` 已快进到经分支回归验证的V3.3.1提交。本次提交仅用于触发main上的GitHub Pages、V3.3.1 Calculability与公网Live Check发布闸门，不改变科学模型或计算策略。
