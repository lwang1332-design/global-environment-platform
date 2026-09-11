# 全球海洋大气腐蚀环境评估平台 V3.2.6

本目录沿用 `global-environment-platform` 的 GitHub Pages 发布方式，提供稳定 HTTPS 入口，同时把需要密钥的 ERA5 / CAMS / CMEMS Direct 数据访问留在 Vercel 后端。

## 入口

- GitHub Pages：`https://lwang1332-design.github.io/global-environment-platform/marine-corrosion/`
- Vercel 前端：`https://global-marine-corrosion-engineering-lwang1332-4885.vercel.app/`
- Vercel Direct API：`https://global-marine-corrosion-direct-v322-lwang1332-4885.vercel.app/api/direct`

## 地名搜索

- 在页面顶部输入中英文城市或区县名，点击“搜索地点”或按 Enter。
- 使用 Open-Meteo Geocoding / GeoNames 返回最多10个候选地点，显示行政区、国家和 WGS84 经纬度，选择后同步坐标输入和地图标记。
- 中文名称精确查询无结果时，自动尝试去掉“市 / 县 / 区”后缀；同名地点由用户确认选择。
- 搜索请求限时8秒，支持取消旧请求，失败时可继续手动填写坐标。地名选址不自动触发年度环境数据请求。
- 地名坐标是城市或区县的代表位置；具体风场、近岸设施或海上设备位置可继续通过地图或经纬度微调。
- 地名数据来源：https://open-meteo.com/en/docs/geocoding-api

## 数据链

位置 → ERA5 气象 → CAMS 海盐/污染物 → CMEMS 波浪/盐度 → 海盐气溶胶 → Cl⁻沉降 → 表面盐库存 → 湿润/凝露 → ISO 9223 腐蚀 → 防护设计。

Direct 不可用时，前端只能使用明确标记的 Fallback/EST，不允许把代理数据标记为 RAW。

## 校核

- 附件原始数据：641 行
- 去重后的中国沿海独立校核数据：121 条
- 全球外部 Benchmark：26 点
- ISO 9223 剂量响应公式保持独立，不直接拟合修改。
