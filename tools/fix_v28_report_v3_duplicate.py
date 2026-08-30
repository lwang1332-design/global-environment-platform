from pathlib import Path
import re

p=Path('index.html')
s=p.read_text(encoding='utf-8')

# Collapse accidental duplicate envCoreData declarations while keeping one.
pattern=r"( const envCoreData=\{.*?\n \};)\n const envCoreData=\{.*?\n \};"
while re.search(pattern,s,flags=re.S):
    s=re.sub(pattern,r"\1",s,count=1,flags=re.S)

# Required output-state assertions.
assert s.count(' const envCoreData={')==1, s.count(' const envCoreData={')
assert 'id="wordReport"' not in s
assert '设备侧优先级' not in s
assert '温度 / 露点时序' in s
assert '相对湿度时序' in s
assert '风速 / 阵风时序' in s
assert '小时降雨时序' in s
assert '短波辐射时序' in s
assert '表面气压时序' in s
assert '<th>核心数据</th>' in s
assert "${envCoreData[x[0]]||'N/A'}" in s

p.write_text(s,encoding='utf-8')
print('fixed',len(s))
# trigger 2026-08-30
