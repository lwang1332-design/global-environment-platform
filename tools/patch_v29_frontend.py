from pathlib import Path

p=Path('index.html')
s=p.read_text(encoding='utf-8')

s=s.replace('<title>全球风电机组环境适应性评估平台 V2.8 工程报告版</title>','<title>全球风电机组环境适应性评估平台 V2.9 参数云同步 + 风温联合分布版</title>')
s=s.replace('<div class="ver">V2.8 · 工程报告版</div>','<div class="ver">V2.9 · 参数云同步 + 风温联合版</div>')

legacy="function verifyAdmin(){if($('adminPwd').value==='123123'){adminUnlocked=true;$('loginMask').classList.remove('show');$('adminPwd').value='';$('loginMsg').textContent='';loadAdminInputs();showPage('admin')}else $('loginMsg').textContent='密码错误'}"
secure="function verifyAdmin(){$('loginMsg').textContent='V2.9 管理员验证由安全模块完成，请等待模块加载。'}"
s=s.replace(legacy,secure)

css='<link rel="stylesheet" href="./assets/v29.css?v=20260831-v29">'
if 'assets/v29.css' not in s:
    marker='<link rel="stylesheet" href="./assets/ui-engineering.css?v=20260830-ui1">'
    if marker not in s: raise SystemExit('ui-engineering.css marker not found')
    s=s.replace(marker,marker+'\n'+css)

cockpit_css='<link rel="stylesheet" href="./assets/cockpit-v291.css?v=20260831-v291">'
if 'assets/cockpit-v291.css' not in s:
    marker='<link rel="stylesheet" href="./assets/cockpit-v29.css?v=20260831-cockpit1">'
    if marker not in s: raise SystemExit('cockpit-v29.css marker not found')
    s=s.replace(marker,marker+'\n'+cockpit_css)

scripts='''<script src="./assets/v29-runtime-config.js?v=20260831-v29"></script>\n<script src="./assets/v29-config.js?v=20260831-v29"></script>\n<script src="./assets/v29-joint.js?v=20260831-v29"></script>'''
if 'assets/v29-config.js' not in s:
    marker='<script src="./assets/ui-engineering.js?v=20260830-ui1"></script>'
    if marker not in s: raise SystemExit('ui-engineering.js marker not found')
    s=s.replace(marker,marker+'\n'+scripts)

admin_gate='<script src="./assets/v291-admin-gate.js?v=20260831-v291"></script>'
if 'assets/v291-admin-gate.js' not in s:
    marker='<script src="./assets/v29-config.js?v=20260831-v29"></script>'
    if marker not in s: raise SystemExit('v29-config.js marker not found')
    s=s.replace(marker,marker+'\n'+admin_gate)

scientific_js='<script src="./assets/cockpit-v291.js?v=20260831-v291"></script>'
if 'assets/cockpit-v291.js' not in s:
    marker='<script src="./assets/cockpit-v29.js?v=20260831-cockpit1"></script>'
    if marker not in s: raise SystemExit('cockpit-v29.js marker not found')
    s=s.replace(marker,marker+'\n'+scientific_js)

if "adminPwd').value==='123123'" in s:
    raise SystemExit('legacy front-end admin password check still present')

# Keep V2.8 report/model wording inside historical comments/functions untouched.
p.write_text(s,encoding='utf-8')
print('V2.9/V2.9.1 frontend bootstrap patched; business logic unchanged')
