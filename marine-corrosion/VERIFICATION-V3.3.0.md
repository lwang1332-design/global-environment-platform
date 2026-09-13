# 全球海洋大气腐蚀环境评估平台 V3.3.0 科学模型修正版

## 目标
V3.3.0不以追平任何单个实测点为目标，而是先修复V3.2.8审计发现的科学接口问题，再重新建立同期验证。

## P0修改
1. **Wet deposition量纲闭环**：删除 `Ci*(1-exp(-0.022*rain))*0.65` 直接与表面通量相加的路径。新模型仅在 `wetScavengingRatePerMm` 与 `wetScavengingHeightM` 均明确时，用 `M=C*H*[1-exp(-Lambda*dt)]` 计算；未校准时Wet不并入总沉降并明确标记。
2. **SO2取消Pd=1固定Fallback**：SO2缺失时 `Pd=null`，正式ISO腐蚀率不输出。SO2浓度可用时，ISO接口使用 `Pd≈0.8Pc`；原物理沉降 `C*v*86.4` 单独保留，禁止混为标准输入。
3. **CAMS RH80基准**：CAMS ss1/ss2/ss3质量按RH80表示，模型先 `/4.3` 转为干盐质量；CAMS粒径按RH80代表径并使用 `d(RH)=d80*GF(RH)/GF(80)`，避免二次吸湿。三个CAMS Bin改为逐Bin使用/Proxy补缺，不再All-or-Nothing。
4. **ISO Sd双通道**：工程设备表面 `JCl,equipment` 与 `Sd,ISO` 分离。没有湿烛等效实测Override或经验证转换系数时，正式ISO腐蚀率不输出；工程Cl仅形成screening结果。

## P1修改
5. **Proxy单Fetch**：距离和Fetch拆成两个独立连续因子，各只作用一次；去掉100 km处0.08→0.02跳变。
6. **Local Spray粒径化衰减**：35µm与75µm采用独立衰减尺度参数 `localSprayScale35Km` / `localSprayScale75Km`，默认值仅为待校准CONFIG，不声明全球物理常数。
7. **GIS方向分辨率**：浏览器Fallback由15°提升到5°，边界二分提高到10次，并计算±10°方向距离/Fetch离散度；复杂河口点降低GIS confidence。Production仍要求GSHHG high/full Direct。
8. **旧校准失效**：V3.3.0禁止直接使用V3.2.8腐蚀残差校准。必须补齐准确起止日期、单位、材料、区带、测量方法后重新训练/留出验证。

## 验证规则
- 运行 `node --test marine-corrosion/tests/v330-science.test.mjs`。
- Vietnam 10.9/106.6 / 46.4仅为诊断回归点，`useForCalibration=false`。
- 正式ISO结果只有在关键气象覆盖满足门槛、SO2标准输入存在、ISO等效Cl输入存在时才允许输出。
- 当前Direct尚未恢复时，平台应优先显示数据缺口，而不是伪造精确腐蚀值。

## 后续必须完成
- 湿沉降 `Lambda` 与有效气柱高度的项目/文献标定；
- ISO 9225湿烛同点同期数据，用于建立工程Cl→Sd转换；
- GSHHG Direct部署；
- CAMS/ERA5/CMEMS真实工作服务恢复；
- 26点与Vietnam点在完整同期元数据条件下重新验证。
