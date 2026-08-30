from pathlib import Path
import re

p=Path('index.html')
s=p.read_text(encoding='utf-8')

# 1) Collapse accidental duplicate envCoreData declarations while keeping one.
pattern=r"( const envCoreData=\{.*?\n \};)\n const envCoreData=\{.*?\n \};"
while re.search(pattern,s,flags=re.S):
    s=re.sub(pattern,r"\1",s,count=1,flags=re.S)

# 2) Ensure Chapter 04 table matches the five-column scoreRows structure.
s=s.replace(
    '<section class="page"><h2>04 十大环境风险评估</h2><table><tr><th>环境域</th><th>风险评分</th><th>等级</th><th>主要设计关注</th></tr>${scoreRows}</table>',
    '<section class="page"><h2>04 十大环境风险评估</h2><table><tr><th>环境域</th><th>核心数据</th><th>风险评分</th><th>等级</th><th>主要设计关注</th></tr>${scoreRows}</table>'
)

# 3) Remove duplicated chart sequence caused by repeated patch execution.
seq='${windChart}${rainChart}${radChart}${pressureChart}${snowChart}'
s=s.replace(seq+seq,seq)

# 4) Collapse duplicate report chart CSS blocks if repeated.
css='.riskbar small{display:block;color:#667085;font-size:7.8pt;margin:1px 0 3px}.chart{border:1px solid #d8e3f0;border-radius:8px;padding:7px 8px;margin:8px 0 12px;background:#fff}.chartTitle{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;color:#0a2a59}.chartTitle div{display:flex;gap:10px;font-size:7.5pt;color:#667085}.chartTitle span i{display:inline-block;width:9px;height:2px;margin:0 4px 2px 0}.chart svg{width:100%;height:auto;display:block}.chartAxis{display:flex;justify-content:space-between;font-size:7.2pt;color:#667085;margin-top:-4px}'
s=s.replace(css+css,css)

# 5) Required final state.
checks={
    'single envCoreData': s.count(' const envCoreData={')==1,
    'word hidden': 'id="wordReport"' not in s,
    'equipment priority removed': '设备侧优先级' not in s,
    'temperature curve': '温度 / 露点时序' in s,
    'humidity curve': '相对湿度时序' in s,
    'wind curve': '风速 / 阵风时序' in s,
    'rain curve': '小时降雨时序' in s,
    'radiation curve': '短波辐射时序' in s,
    'pressure curve': '表面气压时序' in s,
    'core data header': '<th>核心数据</th>' in s,
    'conclusion parameters': "${envCoreData[x[0]]||'N/A'}" in s,
    'single met chart sequence': (seq+seq) not in s,
}
failed=[k for k,v in checks.items() if not v]
if failed:
    raise SystemExit('failed checks: '+', '.join(failed))

p.write_text(s,encoding='utf-8')
print('fixed',len(s),checks)
