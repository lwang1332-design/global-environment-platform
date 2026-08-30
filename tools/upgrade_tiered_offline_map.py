from pathlib import Path
import re

# Integration version: tiered-offline-map-v3
idx=Path('index.html')
s=idx.read_text(encoding='utf-8')

# Update visible map description.
s=s.replace('天地图 + 本地开源地图双源','天地图 + 三级离线地图',1)

# Force exactly one executable runtime tag immediately before </body>.
script_tag='<script src="./map-tier.js"></script>'
s=s.replace(script_tag,'')
if '</body>' not in s:
    raise SystemExit('index.html closing body not found')
s=s.replace('</body>',script_tag+'\n</body>',1)
idx.write_text(s,encoding='utf-8')

sw=Path('sw.js')
w=sw.read_text(encoding='utf-8')
w=re.sub(r"const CACHE='[^']+';","const CACHE='global-env-v2.8-map-tier-v3';",w,count=1)
if "'./map-tier.js'" not in w:
    w=w.replace("'./icons/app-icon.svg'","'./icons/app-icon.svg','./map-tier.js','./tiles/manifest.json'",1)
if "'./tiles/manifest.json'" not in w:
    w=w.replace("'./map-tier.js'","'./map-tier.js','./tiles/manifest.json'",1)
sw.write_text(w,encoding='utf-8')

assert s.count(script_tag)==1
assert s.rfind(script_tag)<s.rfind('</body>')
assert '天地图 + 三级离线地图' in s
assert "'./map-tier.js'" in w
assert "'./tiles/manifest.json'" in w
print('Three-tier offline map integration applied')
