from pathlib import Path

p=Path('index.html')
s=p.read_text(encoding='utf-8')

# Compact print layout: only cover forces a new page, chapters flow continuously.
s=s.replace('.cover{height:250mm;display:flex;flex-direction:column;justify-content:space-between;padding:18mm 10mm 10mm}',
            '.cover{min-height:246mm;display:flex;flex-direction:column;justify-content:space-between;padding:18mm 10mm 10mm;page-break-after:always;break-after:page}')
s=s.replace('.page{page-break-before:always}', '.page{page-break-before:auto;break-before:auto;margin-bottom:8mm}')

# Add print-flow rules once.
anchor='.noBreak{page-break-inside:avoid}'
extra=(anchor+
       'h2{page-break-after:avoid;break-after:avoid-page}h3{page-break-after:avoid;break-after:avoid-page}'
       'tr{page-break-inside:avoid;break-inside:avoid}.hero,.note,.warn,.formula,.chart,.actionGroup{page-break-inside:avoid;break-inside:avoid}'
       '.reportLogo{position:fixed;left:14mm;top:3.2mm;width:38mm;height:8.5mm;z-index:1000;display:flex;align-items:center}'
       '.reportLogo svg{width:100%;height:100%;display:block}')
if '.reportLogo{position:fixed' not in s:
    s=s.replace(anchor, extra, 1)

# Current Goldwind wordmark used in 2026 official materials: vectorized for reliable PDF printing.
logo=r'''<div class="reportLogo" aria-label="Goldwind 金风科技">
<svg viewBox="0 0 360 80" xmlns="http://www.w3.org/2000/svg" role="img">
  <g fill="#1e2b45">
    <path d="M18 42c0-15 12-27 27-27 9 0 17 4 22 10-4-2-8-3-12-3-13 0-24 10-24 23 0 8 4 15 10 19-13-2-23-11-23-22z"/>
    <path d="M38 18c11-7 25-5 34 4 6 6 9 14 8 22-2-4-5-7-8-10-9-9-24-9-33 0-6 6-8 14-6 21-8-10-6-27 5-37z" opacity=".82"/>
    <path d="M70 30c7 11 5 25-4 34-6 6-14 9-22 8 4-2 7-5 10-8 9-9 9-24 0-33-6-6-14-8-21-6 10-8 27-6 37 5z" opacity=".62"/>
  </g>
  <text x="92" y="38" font-family="Arial,Helvetica,sans-serif" font-size="31" font-weight="700" fill="#1e2b45">Goldwind</text>
  <text x="94" y="64" font-family="Microsoft YaHei,PingFang SC,Arial,sans-serif" font-size="20" font-weight="600" letter-spacing="3" fill="#1e2b45">金风科技</text>
</svg></div>'''

body_marker='<style>'
# insert logo after <body> inside report HTML only
needle='</style></head><body>\n <section class="cover">'
if needle in s and 'aria-label="Goldwind 金风科技"' not in s:
    s=s.replace(needle, '</style></head><body>\n '+logo+'\n <section class="cover">', 1)

# Reduce excessive print margins slightly while preserving room for the fixed logo.
s=s.replace('@page{size:A4;margin:13mm 14mm 15mm}', '@page{size:A4;margin:13mm 13mm 13mm}')

# Safety assertions.
assert '.page{page-break-before:auto' in s
assert 'page-break-after:always;break-after:page' in s
assert 'class="reportLogo"' in s
assert 'Goldwind' in s and '金风科技' in s
assert s.count('aria-label="Goldwind 金风科技"') == 1

p.write_text(s, encoding='utf-8')
print('patched compact PDF layout + Goldwind logo', len(s))
