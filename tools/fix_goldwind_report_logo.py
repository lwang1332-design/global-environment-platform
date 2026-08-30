from pathlib import Path
import re

p=Path('index.html')
s=p.read_text(encoding='utf-8')

# Use the current Goldwind horizontal wordmark (logo as of 2024, still used in 2026 official materials).
s=s.replace('.reportLogo svg{width:100%;height:100%;display:block}', '.reportLogo img{width:100%;height:auto;display:block}')
s=s.replace('.reportLogo{position:fixed;left:14mm;top:3.2mm;width:38mm;height:8.5mm;z-index:1000;display:flex;align-items:center}', '.reportLogo{position:fixed;left:13mm;top:3.0mm;width:34mm;height:7mm;z-index:1000;display:flex;align-items:flex-start}')

pattern=r'<div class=\\?"reportLogo\\?" aria-label=\\?"Goldwind 金风科技\\?">.*?</div>'
replacement='<div class="reportLogo" aria-label="Goldwind"><img src="https://upload.wikimedia.org/wikipedia/commons/e/e5/Goldwind_Updated_Logo.png" alt="Goldwind"></div>'
s2,n=re.subn(pattern,replacement,s,count=1,flags=re.S)
if n!=1:
    # fallback for normal quotes in the source template literal
    pattern2=r'<div class="reportLogo" aria-label="Goldwind 金风科技">.*?</div>'
    s2,n=re.subn(pattern2,replacement,s,count=1,flags=re.S)
if n!=1:
    raise SystemExit('reportLogo block not found exactly once')
s=s2

# Give the external image time to resolve before browser print.
s=s.replace("setTimeout(()=>w.print(),450)", "setTimeout(()=>w.print(),1200)")

assert 'Goldwind_Updated_Logo.png' in s
assert '<svg viewBox="0 0 360 80"' not in s
assert 'left:13mm;top:3.0mm;width:34mm' in s
p.write_text(s,encoding='utf-8')
print('Goldwind report logo corrected and fixed at upper-left')
