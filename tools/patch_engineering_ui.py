from pathlib import Path

p=Path('index.html')
s=p.read_text(encoding='utf-8')
css='<link rel="stylesheet" href="./assets/ui-engineering.css?v=20260830-ui1">'
js='<script src="./assets/ui-engineering.js?v=20260830-ui1"></script>'

if css not in s:
    s=s.replace('</head>',css+'\n</head>',1)
if js not in s:
    anchor='<script src="./map-tier.js"></script>'
    if anchor not in s:
        raise SystemExit('map-tier anchor missing')
    s=s.replace(anchor,anchor+'\n'+js,1)

# Keep core business script untouched; only add independent presentation assets.
if s.count(css)!=1 or s.count(js)!=1:
    raise SystemExit('engineering UI assets inserted more than once')
p.write_text(s,encoding='utf-8')
print('Engineering UI assets linked exactly once')
