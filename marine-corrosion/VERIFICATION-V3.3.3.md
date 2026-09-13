# V3.3.3 偏差诊断 / 误差瀑布版 — Verification

## 版本边界

- App / diagnostic layer: **3.3.3**
- Data layer: **3.3.2**
- Science kernel: **3.3.0**
- 不修改 V3.3.0 公式、默认参数或 ISO 9223 剂量响应。
- 实测 / Benchmark 值只用于输出偏差，不进入 `computeModel()` 输入。
- 不增加固定倍率、固定 Pd、固定 Sd、距离海岸经验校准。

## 新增能力

1. `RAW/EST → Air Salt → Dry/Impaction/Wet → Total Salt → Cl⁻ → Pd → RH/T → corrosion` 诊断链。
2. ISO / Screening 腐蚀拆成 `SO₂ term + chloride term`，并检查公式闭合误差。
3. 有参考值时输出 `reference = SO₂ term + Cl term + unexplained residual` 瀑布；Residual 明确不是校准系数。
4. 121 条空间参考与 26 点 Benchmark 经统一 RunCoordinator 计算后自动累计诊断记录。
5. 当前点支持同一环境数据快照上的模型参数 ±20% 单因素复算；不重新联网，不使用参考值。
6. 结构缺项自动标记：Wet deposition disabled、wetness not coupled、Proxy sea salt、ISO Sd missing、通用 impaction length 等。

## 自动测试门槛

- [x] V3.3.3 模块语法检查。
- [x] `doseTerms()` 与 V3.3.0 `doseResponse()` 严格闭合。
- [x] 实测值只进入 bias waterfall，不改变平台预测。
- [x] Wet deposition 缺失与 Wetness 未耦合可被自动识别。
- [x] 全量 JavaScript regression。
- [ ] Browser：V3.3.3 页面、版本三层分离与“只诊断不校准”文案。
- [ ] 真实点 E2E：越南 10.9/106.6、海南/福建高腐蚀点至少各 1 个。
- [ ] 121 点顺序诊断导出完整性。
- [ ] 26 点 Benchmark 诊断导出完整性。

## 解释规则

### 可称为“精确贡献”的量

- SO₂ 剂量响应项。
- Cl⁻ 剂量响应项。
- 平台预测与参考值之间的算术残差。
- Dry / Impaction / Wet 在当前盐沉降计算中的直接输出。

### 只能称为“敏感性”，不能称为已证明偏差贡献

- Proxy 系数 / 风速指数。
- Local Spray 系数 / 衰减长度。
- `characteristicLength`。
- `genericImpactionOrientation`。
- capture / wash / height / kappa 等单参数扰动。

只有获得独立实测证据后，才允许把某项敏感性升级为已确认原因。

## V3.3.4 进入条件

进入“金属表面湿润物理版”前，至少应完成：

1. 典型低估点逐级链路诊断；
2. Wet deposition 缺项量级确认；
3. 试片/设备构件特征尺度和表面方向确认；
4. 表面温度 / RH / 凝露或 ACM/ER 湿润数据至少一组；
5. 对 DRH/ERH、水膜保持、雨后残膜的建模边界达成一致。
