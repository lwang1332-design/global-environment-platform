# 全球海洋大气腐蚀环境评估平台 V3.2.2

本目录沿用 `global-environment-platform` 的 GitHub Pages 发布方式，提供稳定 HTTPS 入口，同时把需要密钥的 ERA5 / CAMS / CMEMS Direct 数据访问留在 Vercel 后端。

## 入口

- GitHub Pages：`https://lwang1332-design.github.io/global-environment-platform/marine-corrosion/`
- Vercel 前端：`https://global-marine-corrosion-engineering-lwang1332-4885.vercel.app/`
- Vercel Direct API：`https://global-marine-corrosion-direct-v322-lwang1332-4885.vercel.app/api/direct`

## 数据链

位置 → ERA5 气象 → CAMS 海盐/污染物 → CMEMS 波浪/盐度 → 海盐气溶胶 → Cl⁻沉降 → 表面盐库存 → 湿润/凝露 → ISO 9223 腐蚀 → 防护设计。

Direct 不可用时，前端只能使用明确标记的 Fallback/EST，不允许把代理数据标记为 RAW。

## 校核

- 附件原始数据：641 行
- 去重后的中国沿海独立校核数据：121 条
- 全球外部 Benchmark：26 点
- ISO 9223 剂量响应公式保持独立，不直接拟合修改。
