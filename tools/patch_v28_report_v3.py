from pathlib import Path

p=Path('index.html')
s=p.read_text(encoding='utf-8')

s=s.replace('<button class="reportBtn ghostReport" id="wordReport" onclick="exportWord()">生成Word</button>','')
s=s.replace('.toolbar{height:48px;padding:7px 12px;display:grid;grid-template-columns:300px 120px 96px 1fr;', '.toolbar{height:48px;padding:7px 12px;display:grid;grid-template-columns:300px 120px 96px 96px 1fr;')
s=s.replace('@media(max-width:900px){.toolbar{grid-template-columns:minmax(180px,1fr) 90px 92px 84px 84px}.reportBtn{padding:0 6px;font-size:9px}}', '@media(max-width:900px){.toolbar{grid-template-columns:minmax(180px,1fr) 90px 92px 84px}.reportBtn{padding:0 6px;font-size:9px}}')

replacement=r''' const envCoreData={
  '高温':`P99 ${fmt(b.t99,1,'℃')} · Max ${fmt(max(T),1,'℃')}`,
  '低温':`Min ${fmt(b.tmin,1,'℃')} · P1 ${fmt(q(T,.01),1,'℃')}`,
  '凝露':`${fmt(c.annualCondHours,0,' h/y')} · 最低露点裕量 ${fmt(c.minMargin,2,' K')}`,
  '盐雾':`Cl⁻ ${fmt(s.jcl,2,' mg/m²·d')} · TOW ${fmt(s.towPct,1,'%')}`,
  '粉尘积灰':`PM10 P95 ${fmt(d.pm95,1,' μg/m³')} · 年进入 ${fmt(d.annualIn,2,' kg/y')}`,
  '沙蚀':`EI ${fmt(d.erosionIndex,2,'/y')} · 撞击速度 ${fmt(d.vimpact,1,' m/s')}`,
  '强降雨':`Max日 ${fmt(b.rainMax,1,' mm/d')} · P99小时 ${fmt(b.rainP99h,2,' mm/h')}`,
  '冰雪':`Max日降雪 ${fmt(b.snowMax,1,' cm/d')} · 冻融 ${fmt(b.freezeThawAnnual,0,' 次/y')}`,
  '高海拔':`${fmt(b.elev,0,' m')} · ρ ${fmt(rhoAir,3,' kg/m³')}`,
  '极端风':`P99阵风 ${fmt(b.gust99,1,' m/s')} · Max ${fmt(max(gust),1,' m/s')}`
 };
 const riskBars=topEnv.map(([k,v])=>`<div class="riskbar"><div><b>${esc(k)}</b><span>${v}/100 · ${level(v)}</span></div><small>${esc(envCoreData[k]||'')}</small><i><em style="width:${v}%"></em></i></div>`).join('');
 const chart=(title,series,unit='')=>{
   const valid=(series||[]).map(x=>({name:x.name||'',data:(x.data||[]).map(Number)})).filter(x=>x.data.some(Number.isFinite));
   if(!valid.length)return '';
   let all=[];valid.forEach(x=>all.push(...x.data.filter(Number.isFinite)));if(!all.length)return '';
   let lo=Math.min(...all),hi=Math.max(...all);if(hi===lo){hi+=1;lo-=1}
   const Wd=760,Hd=180,padL=48,padR=12,padT=24,padB=28,plotW=Wd-padL-padR,plotH=Hd-padT-padB;
   const sample=data=>{let step=Math.max(1,Math.ceil(data.length/420)),out=[];for(let i=0;i<data.length;i+=step){let v=data[i];if(Number.isFinite(v))out.push([i,v])}return out};
   const paths=valid.map((x,si)=>{let pts=sample(x.data);let d=pts.map(([i,v],j)=>`${j?'L':'M'}${(padL+(i/Math.max(1,x.data.length-1))*plotW).toFixed(1)},${(padT+(hi-v)/(hi-lo)*plotH).toFixed(1)}`).join(' ');return `<path d="${d}" fill="none" stroke="${si===0?'#1769e0':si===1?'#d92d20':'#0f9d68'}" stroke-width="1.5"/>`}).join('');
   const legend=valid.map((x,si)=>`<span><i style="background:${si===0?'#1769e0':si===1?'#d92d20':'#0f9d68'}"></i>${esc(x.name)}</span>`).join('');
   return `<div class="chart noBreak"><div class="chartTitle"><b>${esc(title)}</b><div>${legend}</div></div><svg viewBox="0 0 ${Wd} ${Hd}" xmlns="http://www.w3.org/2000/svg"><line x1="${padL}" y1="${padT}" x2="${padL}" y2="${Hd-padB}" stroke="#aeb9c8"/><line x1="${padL}" y1="${Hd-padB}" x2="${Wd-padR}" y2="${Hd-padB}" stroke="#aeb9c8"/><text x="4" y="${padT+5}" font-size="10" fill="#667085">${hi.toFixed(1)}${esc(unit)}</text><text x="4" y="${Hd-padB}" font-size="10" fill="#667085">${lo.toFixed(1)}${esc(unit)}</text>${paths}</svg><div class="chartAxis"><span>${esc(cache.w?.start||'')}</span><span>${esc(cache.w?.end||'')}</span></div></div>`;
 };
 const tempChart=chart('温度 / 露点时序',[{name:'空气温度',data:h.temperature_2m||[]},{name:'露点温度',data:h.dew_point_2m||[]}],'℃');
 const rhChart=chart('相对湿度时序',[{name:'RH',data:h.relative_humidity_2m||[]}],'%');
 const windChart=chart('风速 / 阵风时序',[{name:'10m风速',data:h.wind_speed_10m||[]},{name:(h.wind_gusts_10m||[]).some(Number.isFinite)?'阵风':'阵风估算',data:gust}],' m/s');
 const rainChart=chart('小时降雨时序',[{name:'降雨',data:h.precipitation||[]}],' mm/h');
 const radChart=chart('短波辐射时序',[{name:'短波辐射',data:h.shortwave_radiation||[]}],' W/m²');
 const pressureChart=chart('表面气压时序',[{name:'表面气压',data:(h.surface_pressure||[]).map(v=>Number.isFinite(v)?v/10:NaN)}],' kPa');
 const snowChart=chart('日降雪时序',[{name:'日降雪',data:day.snowfall_sum||[]}],' cm/d');
'''
start=s.find(' const riskBars=')
end=s.find(' const scoreRows=',start)
if start==-1 or end==-1:
    raise SystemExit('riskBars block not found')
s=s[:start]+replacement+s[end:]

css_anchor='.riskbar em{height:100%;display:block;background:#1769e0}'
css_repl=css_anchor+'''.riskbar small{display:block;color:#667085;font-size:7.8pt;margin:1px 0 3px}.chart{border:1px solid #d8e3f0;border-radius:8px;padding:7px 8px;margin:8px 0 12px;background:#fff}.chartTitle{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;color:#0a2a59}.chartTitle div{display:flex;gap:10px;font-size:7.5pt;color:#667085}.chartTitle span i{display:inline-block;width:9px;height:2px;margin:0 4px 2px 0}.chart svg{width:100%;height:auto;display:block}.chartAxis{display:flex;justify-content:space-between;font-size:7.2pt;color:#667085;margin-top:-4px}'''
s=s.replace(css_anchor,css_repl,1)

s=s.replace('</tr></table><h3>3.2 湿度与露点</h3>', '</tr></table>${tempChart}<h3>3.2 湿度与露点</h3>',1)
s=s.replace('</tr></table><h3>3.3 风、降水、辐射与气压</h3>', '</tr></table>${rhChart}<h3>3.3 风、降水、辐射与气压</h3>',1)
needle='<div class="small">阵风说明：ERA5当前请求若无直接阵风序列，报告按10 m风速 × ${params.gustFactor}进行工程估算，属于估算值而非现场实测阵风。</div></section>'
if needle in s:
    s=s.replace(needle, '<div class="small">阵风说明：ERA5当前请求若无直接阵风序列，报告按10 m风速 × ${params.gustFactor}进行工程估算，属于估算值而非现场实测阵风。</div>${windChart}${rainChart}${radChart}${pressureChart}${snowChart}</section>',1)
else:
    marker='</section>\n\n <section class="page"><h2>04 十大环境风险评估</h2>'
    if marker in s:
        s=s.replace(marker, '${windChart}${rainChart}${radChart}${pressureChart}${snowChart}</section>\n\n <section class="page"><h2>04 十大环境风险评估</h2>',1)

old="const scoreRows=topEnv.map(([k,v])=>`<tr><td>${esc(k)}</td><td>${v}</td><td><span class=\"tag ${lvlClass(v)}\">${level(v)}</span></td><td>${esc(actionMap[k]||'结合设备风险进行专项复核')}</td></tr>`).join('');"
new="const scoreRows=topEnv.map(([k,v])=>`<tr><td>${esc(k)}</td><td>${esc(envCoreData[k]||'')}</td><td>${v}</td><td><span class=\"tag ${lvlClass(v)}\">${level(v)}</span></td><td>${esc(actionMap[k]||'结合设备风险进行专项复核')}</td></tr>`).join('');"
s=s.replace(old,new,1)
s=s.replace('<tr><th>环境域</th><th>风险评分</th><th>等级</th><th>工程关注</th></tr>${scoreRows}', '<tr><th>环境域</th><th>核心数据</th><th>风险评分</th><th>等级</th><th>工程关注</th></tr>${scoreRows}',1)

start=s.find('<h3>设备侧优先级</h3>')
if start!=-1:
    end=s.find('</table>',start)
    if end!=-1:
        s=s[:start]+s[end+8:]

s=s.replace("${topEnv.slice(0,5).map((x,i)=>`${i+1}. ${x[0]} ${x[1]}/100`).join('　')}", "${topEnv.slice(0,5).map((x,i)=>`${i+1}. ${x[0]}：${envCoreData[x[0]]||'N/A'}（风险 ${x[1]}/100）`).join('<br>')}",1)

p.write_text(s,encoding='utf-8')
print('patched', len(s))
