const DEFAULT_RISK_RULES={
  t99:{label:'P99最高气温',unit:'℃',direction:'high',medium:40,high:45},
  tmin:{label:'极端最低气温',unit:'℃',direction:'low',medium:-20,high:-30},
  rhAvg:{label:'年均相对湿度',unit:'%',direction:'high',medium:75,high:85},
  rh90:{label:'相对湿度>90%小时数',unit:'h/y',direction:'high',medium:300,high:1000},
  rainYear:{label:'年降水量',unit:'mm/y',direction:'high',medium:900,high:1800},
  rain1h:{label:'最大1小时降水',unit:'mm/h',direction:'high',medium:30,high:80},
  snowHours:{label:'年降雪小时',unit:'h/y',direction:'high',medium:30,high:120},
  alt:{label:'海拔',unit:'m',direction:'high',medium:1500,high:3000},
  pm10:{label:'PM10平均浓度',unit:'μg/m³',direction:'high',medium:45,high:150},
  dust:{label:'沙尘（Dust）平均浓度',unit:'μg/m³',direction:'high',medium:50,high:150},
  so2:{label:'二氧化硫（SO₂）平均浓度',unit:'μg/m³',direction:'high',medium:5,high:20},
  salt:{label:'海盐气溶胶平均浓度',unit:'μg/m³',direction:'high',medium:5,high:20},
  wind95:{label:'P95风速',unit:'m/s',direction:'high',medium:10,high:15},
  rad95:{label:'P95太阳辐射',unit:'W/m²',direction:'high',medium:600,high:800}
};

const RISK_PARAM_CN={
  t99:'P99最高气温',
  tmin:'极端最低气温',
  rhAvg:'年均相对湿度',
  rh90:'相对湿度>90%小时数',
  rainYear:'年降水量',
  rain1h:'最大1小时降水',
  snowHours:'年降雪小时',
  alt:'海拔',
  pm10:'PM10平均浓度',
  dust:'沙尘（Dust）平均浓度',
  so2:'二氧化硫（SO₂）平均浓度',
  salt:'海盐气溶胶平均浓度',
  wind95:'P95风速',
  rad95:'P95太阳辐射'
};

const MATCH_RULE={high:70,medium:45,version:'V2.7-CORE-SUPPORT'};

function localizeAdminRiskRuleUI(){
  const body=document.getElementById('riskRuleBody');
  if(!body)return;
  const table=body.closest('table');
  const firstHead=table?.querySelector('thead th:first-child');
  if(firstHead&&firstHead.textContent!=='参数标识（中文）')firstHead.textContent='参数标识（中文）';
  body.querySelectorAll('tr').forEach(tr=>{
    const b=tr.querySelector('td:first-child b');
    if(!b)return;
    const key=b.dataset.ruleKey||b.textContent.trim();
    const cn=RISK_PARAM_CN[key]||key;
    b.dataset.ruleKey=key;
    if(b.textContent!==cn)b.textContent=cn;
    b.title=`内部参数标识：${key}`;
  });
}

(function bootstrapV27Cloud(){
  const path=location.pathname||'';
  if(/admin/i.test(path)){
    window.addEventListener('load',()=>{
      localizeAdminRiskRuleUI();
      const body=document.getElementById('riskRuleBody');
      if(body){
        const ob=new MutationObserver(()=>localizeAdminRiskRuleUI());
        ob.observe(body,{childList:true,subtree:true});
      }
    },{once:true});
  }
  if(/\/v2\.5-admin\.html$/.test(path)){
    location.replace('v2.5-admin-cloud.html'+(location.search||'?v=20260905-cloud1'));
    return;
  }
  if(/\/v2\.5\.html$/.test(path)){
    window.addEventListener('load',()=>{
      if(document.querySelector('script[data-v27-cloud]'))return;
      const s=document.createElement('script');
      s.src='v2.5-cloud.js?v=20260905-cloud1';
      s.dataset.v27Cloud='1';
      document.body.appendChild(s);
    },{once:true});
  }
})();
