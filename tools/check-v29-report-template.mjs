import fs from 'node:fs';
const s=fs.readFileSync('assets/report-v29.js','utf8');
const required=[
  'Executive Summary｜项目综合结论',
  '01 项目与计算依据',
  '02 核心环境数据',
  '03 环境风险画像',
  '04 六大物理模型计算',
  '05 风温联合分布分析',
  '06 环境 × 设备风险与 Design Gap',
  '07 工程决策与验证要求',
  '08 数据、参数与模型适用边界',
  '附录A｜计算公式及变量',
  '附录B｜完整物理模型计算结果',
  '附录C｜完整风险矩阵',
  '附录D｜数据来源及参数快照'
];
for(const x of required) if(!s.includes(x)) throw new Error('Missing report section: '+x);
for(const x of ['V29JointResult','capabilityChecks','configVersion()','heatmapImage()','reportHtml=wrapped']) if(!s.includes(x)) throw new Error('Missing report integration marker: '+x);
if(/V2\.8 工程报告版/.test(s)) throw new Error('New report template still contains V2.8 report label');
console.log('V29_REPORT_TEMPLATE_OK',required.length,'sections');
