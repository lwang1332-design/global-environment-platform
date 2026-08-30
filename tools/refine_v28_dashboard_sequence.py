from pathlib import Path
import re

p=Path('index.html')
h=p.read_text(encoding='utf-8')

# Reorder dashboard DOM so both accessibility order and mobile flow are exactly 01 -> 07.
start_marker='<div id="mainPage" class="page active"><div class="dashboard">\n'
end_marker='\n</div></div>\n<div id="adminPage"'
s=h.find(start_marker)
e=h.find(end_marker,s)
if s<0 or e<0:
    raise SystemExit('dashboard block not found')
content=h[s+len(start_marker):e]
sections=re.findall(r'<section class="card ([A-Za-z]+)">.*?</section>',content,re.S)
if len(sections)!=7:
    raise SystemExit(f'expected 7 dashboard sections, got {len(sections)}')
blocks={}
for m in re.finditer(r'<section class="card ([A-Za-z]+)">.*?</section>',content,re.S):
    blocks[m.group(1)]=m.group(0)
order=['mapCard','summaryCard','envCard','riskCard','physicsCard','matrixCard','decisionCard']
if any(k not in blocks for k in order):
    raise SystemExit(f'missing card: {[k for k in order if k not in blocks]}')
new_content='\n'.join(blocks[k] for k in order)
h=h[:s+len(start_marker)]+new_content+h[e:]

# Desktop layout follows the same visual reading order: top row 01-03, second row 04-05, third row 06-07.
old_dash='.dashboard{height:calc(100vh - 106px);padding:10px;display:grid;grid-template-columns:23% 55% 22%;grid-template-rows:22% 35% 43%;gap:10px}'
new_dash='.dashboard{height:calc(100vh - 106px);padding:10px;display:grid;grid-template-columns:repeat(12,minmax(0,1fr));grid-template-rows:24% 34% 42%;gap:10px}'
if old_dash not in h:
    raise SystemExit('base dashboard grid marker missing')
h=h.replace(old_dash,new_dash,1)

old_pos='.mapCard{grid-column:1;grid-row:1}.envCard{grid-column:1;grid-row:2}.riskCard{grid-column:2;grid-row:1}.summaryCard{grid-column:3;grid-row:1}.matrixCard{grid-column:2;grid-row:2}.decisionCard{grid-column:3;grid-row:2 / span 2}.physicsCard{grid-column:1 / span 2;grid-row:3}'
new_pos='.mapCard{grid-column:1 / span 3;grid-row:1}.summaryCard{grid-column:4 / span 3;grid-row:1}.envCard{grid-column:7 / span 6;grid-row:1}.riskCard{grid-column:1 / span 5;grid-row:2}.physicsCard{grid-column:6 / span 7;grid-row:2}.matrixCard{grid-column:1 / span 8;grid-row:3}.decisionCard{grid-column:9 / span 4;grid-row:3}'
if old_pos not in h:
    raise SystemExit('card position marker missing')
h=h.replace(old_pos,new_pos,1)

old_mid='.dashboard{grid-template-columns:24% 54% 22%;gap:7px;padding:7px}'
new_mid='.dashboard{grid-template-columns:repeat(12,minmax(0,1fr));grid-template-rows:24% 34% 42%;gap:7px;padding:7px}'
if old_mid in h:
    h=h.replace(old_mid,new_mid,1)

h=h.replace('<h2>02 项目综合信息</h2><span>环境 ≠ 适应能力</span>','<h2>02 项目综合信息</h2><span>项目环境与综合风险概览</span>',1)
h=h.replace('<h2>04 环境风险画像</h2><span>点击风险联动</span>','<h2>04 环境风险画像</h2><span>小号文字：真实环境 / 物理模型关键量</span>',1)

p.write_text(h,encoding='utf-8')
print('Dashboard DOM and desktop visual sequence refined')
