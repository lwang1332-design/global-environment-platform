from pathlib import Path
import re

# Integration version: tiered-offline-map-v5
idx=Path('index.html')
s=idx.read_text(encoding='utf-8')

# Update visible map description.
s=s.replace('天地图 + 本地开源地图双源','天地图 + 三级离线地图',1)

# Force exactly one runtime tag before the ACTUAL document closing body.
# reportHtml() contains its own literal </body> inside a JS template string,
# so target the final closing body in the source file.
script_tag='<script src="./map-tier.js"></script>'
s=s.replace(script_tag,'')
head,sep,tail=s.rpartition('</body>')
if not sep:
    raise SystemExit('index.html closing body not found')
s=head.rstrip()+"\n"+script_tag+'\n'+sep+tail
idx.write_text(s,encoding='utf-8')

sw=Path('sw.js')
w=sw.read_text(encoding='utf-8')
w=re.sub(r"const CACHE='[^']+';","const CACHE='global-env-v2.8-map-tier-v5';",w,count=1)
if "'./map-tier.js'" not in w:
    w=w.replace("'./icons/app-icon.svg'","'./icons/app-icon.svg','./map-tier.js','./tiles/manifest.json'",1)
if "'./tiles/manifest.json'" not in w:
    w=w.replace("'./map-tier.js'","'./map-tier.js','./tiles/manifest.json'",1)
sw.write_text(w,encoding='utf-8')

actual_close=s.rfind('</body>')
tag_pos=s.rfind(script_tag)
assert s.count(script_tag)==1
assert tag_pos>=0 and actual_close>tag_pos
assert s[tag_pos:actual_close].strip()==script_tag
assert '天地图 + 三级离线地图' in s
assert "'./map-tier.js'" in w
assert "'./tiles/manifest.json'" in w
print('Three-tier offline map integration applied at document body')
