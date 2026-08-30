# 全球风电机组环境适应性评估平台 V2.8 工程报告版

手机/桌面 PWA + Windows 本地部署版本。部署要求：HTTPS 或 localhost。

- Android/Chrome：打开 HTTPS 地址后安装应用或添加到主屏幕。
- iPhone/Safari：分享 → 添加到主屏幕。
- Windows 本地部署：http://127.0.0.1:8765/。
- 管理员参数页密码：123123。
- ERA5、CAMS、Open-Meteo Marine 等数据查询需要联网。
- 地图使用 OpenStreetMap 官方嵌入式地图，不依赖 Leaflet CDN。
- V2.8 新增工程报告输出：PDF（浏览器打印/另存为PDF）与 Word（.doc）。
- V2.8 扩展盐雾、粉尘/沙蚀、凝露数值积分、雨雪高海拔阈值及设计能力管理员参数。
- V2.8 修复过滤效率 ηfilter 未实际进入年吸入颗粒量计算的问题，并加入旁通率与运行时长。
- 凝露模型仍按金属厚度建立面热容 CA=ρ·Cp·δ，默认采用10 min热惯性子步长积分。
