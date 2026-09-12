import fs from 'node:fs';
import crypto from 'node:crypto';
const path=process.argv[2];if(!path)throw new Error('Usage: node audit-reference.mjs /path/to/corrosionCalcData.csv [output.json]');
const bytes=fs.readFileSync(path),lines=bytes.toString('utf8').replace(/^\uFEFF/,'').trim().split(/\r?\n/),columns=lines.shift().split(',');
const rows=lines.map(l=>Object.fromEntries(l.split(',').map((v,i)=>[columns[i],v]))),unique=new Map(),byRegion={};
for(const r of rows){byRegion[r.Region]=(byRegion[r.Region]||0)+1;const key=columns.filter(k=>!['SourceFile','Region'].includes(k)).map(k=>r[k]).join('|');if(!unique.has(key)||r.Region.startsWith('China'))unique.set(key,r)}
const records=[...unique.values()],sites=new Set(records.map(r=>r.Latitude+','+r.Longitude)),ocean=records.filter(r=>r.Region==='ChinaOcean'),pairs=[],groups=new Map();let ambiguousGroups=0;
for(const r of ocean){const key=[r.Latitude,r.Longitude,r.Stamp].join('|');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r)}
for(const rows of groups.values()){const low=rows.filter(r=>+r.Height===10),high=rows.filter(r=>+r.Height===120);if(low.length>1||high.length>1){ambiguousGroups++;continue}if(low.length===1&&high.length===1)pairs.push({low:low[0],high:high[0]})}
const median=a=>{a.sort((x,y)=>x-y);return a.length?(a[Math.floor((a.length-1)/2)]+a[Math.ceil((a.length-1)/2)])/2:null};
const decay=field=>{const x=pairs.filter(p=>+p.low[field]>0&&+p.high[field]>0).map(p=>-Math.log(+p.high[field]/+p.low[field])/110);return {pairs:x.length,medianPerM:median(x)}};
const audit={file:'corrosionCalcData.csv',sha256:crypto.createHash('sha256').update(bytes).digest('hex'),rawRows:rows.length,uniqueRecords:records.length,duplicateRows:rows.length-records.length,uniqueSites:sites.size,byRegion,stamps:[...new Set(records.map(r=>r.Stamp))],columns,heightDecay:{air:decay('SaltMist'),settlement:decay('SettleRate'),ambiguousGroupsExcluded:ambiguousGroups,rule:'同坐标同年代10m/120m唯一配对；同高度多条不同记录的站点排除，非正数不取对数'},usage:{parameterDerivation:'探索性同坐标同年代高度比值',calibration:'未满足元数据条件，未拟合腐蚀残差',reference:'去重记录仅供参考',independentValidation:'26点另存，不用于拟合；同期日期仍缺失'},missingMetadata:['准确测量起止日期','SaltMist/SettleRate/CorrodeRate原始单位','材料','暴露区带','测量方法'],eligibleContemporaneousValidationRecords:0};
const json=JSON.stringify(audit,null,2);if(process.argv[3])fs.writeFileSync(process.argv[3],json+'\n');console.log(json);
