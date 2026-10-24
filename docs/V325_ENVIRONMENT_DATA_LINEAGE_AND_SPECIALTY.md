# V3.2.5 环境数据联动与专项数据接入说明

## 修订内容
- 同口径 EA 指标由 `v2.7-health-v3.js` 单次计算，并写入03–10旧接口兼容字段：EA01→t99、EA02→tmin、EA06→rhAvg、EA16→rainYear、EA33→snowHours、EA36→alt、EA41→so2。
- 不同统计口径的旧字段由**同一份原始数据**生成，提供 `window.EA_DERIVED_COMPANIONS` 追溯：
  `rh90`=RH≥90%年化小时、`wind95`=风速P95、`rad95`=短波辐照度P95、`pm10`/`dust`/`salt`=CAMS原始浓度均值、`rain1h`=最大小时降雨。
  不得把EA47(P99)直接用于rad95(P95)，或把EA22(P95)直接用于salt(平均浓度)。
- 新版风险对EA指标按批准阈值评判，缺测UNKNOWN、未校准UNRATED。03–10旧引擎仍沿用已公开的旧阈值，由质量提示阻止当做设计冻结值。

## 专项数据导入
- 可导入指标：EA08-10凝露、EA15联合风沙、EA21盐沉积、EA24-25腐蚀、EA29-30沙尘暴事件、EA42-43/45有害气体、EA46植被、EA48台风、EA49雷电、EA50生物。
- 仅接受JSON，1MB上限，必须具有与页面一致的`context`字段：`lat|lon|periodYears`，以及`records`数组。
- 记录字段：`id,value,unit,source,sourceDate,evidenceRef,reviewedBy,reviewStatus,period`。字段单位必须与目录一致，状态APPROVED/DRAFT（只有APPROVED显示）。
- 本地复核资料存于浏览器`ea-health-v3-verified`键。其安全级别**仅为本机数据录入**，不能证明检验机构真实性或云端审核；前台以“本地审核需云端复核”标注，对这些数据不自动判定低风险/已验证。
- 缺少可信专项数据仍显示null/UNKNOWN，未自动接入国际最佳台风路径数据、全球雷电、气体或GIS数据。

## 暂未解决的工程验收项
1. 研究现场温度/露点/壁温时间对齐，凝露联合模拟模型及实测标定。
2. 采用现场盐沉积、材料腐蚀试片和湿润时间构成ISO 9223等级评估。
3. 沙尘暴现象、能见度与风速协同事件库；热带气旋路径与风圈风速；闪电密度、GIS植被与生物附着专项模型。
4. 建立服务器端证据文件上传、身份审核、版本与项目关联；本地JSON不能代表审计留痕。
5. 对九种典型场景输入样本、全部EA指标缺测与模型边界开展独立回归。
6. GitHub Pages最新V3.2.5部署需通过网页复查，仓库已提交不等同网站CDN已刷新。

## 已做验证
- 最新JavaScript脚本语法检查通过。
- 人造48小时样本：EA16与旧rainYear均为2190 mm/y（12mm/48h年化）；wind95=5m/s、CAMS海盐均值=5μg/m³；EA19基于rain而非总降水；EA21无数据保持UNKNOWN。
