from pathlib import Path
import re

# Integration version: tiered-offline-map-v2
idx=Path('index.html')
s=idx.read_text(encoding='utf-8')

# Update visible map description.
s=s.replace('天地图 + 本地开源地图双源','天地图 + 三级离线地图',1)

# Load the tier runtime after the existing inline application script.
script_tag='<script src="./map-tier.js"></script>'
if script_tag not in s:
    if '</body>' not in s:
        raise SystemExit('index.html closing body not found')
    s=s.replace('</body>',script_tag+'\n</body>',1)

idx.write_text(s,encoding='utf-8')

sw=Path('sw.js')
w=sw.read_text(encoding='utf-8')
w=re.sub(r"const CACHE='[^']+';","const CACHE='global-env-v2.8-map-tier-v2';",w,count=1)
if "'./map-tier.js'" not in w:
    w=w.replace("'./icons/app-icon.svg'","'./icons/app-icon.svg','./map-tier.js','./tiles/manifest.json'",1)
if "'./tiles/manifest.json'" not in w:
    w=w.replace("'./map-tier.js'","'./map-tier.js','./tiles/manifest.json'",1)
sw.write_text(w,encoding='utf-8')

assert script_tag in s
assert '天地图 + 三级离线地图' in s
assert "'./map-tier.js'" in w
assert "'./tiles/manifest.json'" in w
print('Three-tier offline map integration applied')
