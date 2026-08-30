from pathlib import Path

p=Path('assets/ui-engineering.js')
s=p.read_text(encoding='utf-8')
old="}).sort((a,b)=>({P0:0,P1:1,P2:2}[a.pri]-{P0:0,P1:1,P2:2}[b.pri]||b.R-a.R);body.innerHTML="
new="}).sort((a,b)=>({P0:0,P1:1,P2:2}[a.pri]-{P0:0,P1:1,P2:2}[b.pri]||b.R-a.R));body.innerHTML="
if old in s:
    s=s.replace(old,new,1)
elif new not in s:
    raise SystemExit('target syntax pattern not found')
p.write_text(s,encoding='utf-8')
print('Engineering UI sort syntax is valid pattern')
