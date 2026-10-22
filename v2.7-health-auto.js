/* Additional sourced metrics; all values are project-dependent, never constants. */
(function(){
const prior=derive,valid=x=>typeof x==='number'&&Number.isFinite(x);
derive=function(h,air,elev){
 prior(h,air,elev);
 const T=h.temperature_2m||[],RH=h.relative_humidity_2m||[],DP=h.dew_point_2m||[],G=h.wind_gusts_10m||[],W=h.wind_speed_10m||[],WC=h.weather_code||[],SD=h.snow_depth||[],SF=h.snowfall||[],P=h.precipitation||[];
 const good=a=>a.filter(valid),num=(n,d)=>d>0?n*8760/d:NaN;
 const record=(id,v,source,note)=>{if(valid(v))envHealthExtra[id]=v;(window.healthMetricProvenance??={})[id]={source,note}};
 const events=(a,fn)=>{let n=0,active=false;for(let i=0;i<a.length;i++){let hit=fn(a[i],i);if(hit&&!active)n++;active=hit}return n};
 const rhTime=RH.filter(valid).length; const time=T.filter(valid).length;
 record(13,num(events(G,v=>valid(v)&&v>=25),G.length),'ERA5阵风','代理定义：阵风≥25 m/s，连续小时归为1次事件');
 const frost=WC.filter(x=>x===66||x===67).length;
 record(20,WC.some(x=>x===66||x===67)?1:0,'ERA5天气代码','判定为是否出现冻雨天气代码66/67，非观测验证');
 record(31,good(SD).length?Math.max(...good(SD))*100:NaN,'ERA5雪深','ERA5网格积雪深度，单位m转cm');
 const daily=[];for(let i=0;i<SF.length;i+=24){let a=good(SF.slice(i,i+24));if(a.length>=18)daily.push(a.reduce((x,y)=>x+y,0))}
 record(32,daily.length?Math.max(...daily):NaN,'ERA5降雪','日累计降雪量，Open-Meteo单位cm');
 record(35,num(events(WC,v=>v===66||v===67),WC.length),'ERA5天气代码','连续冻雨小时合并为一次事件，年化估计');
 const wet=RH.filter(v=>valid(v)&&v>80).length;
 record(23,rhTime?wet/rhTime*100:NaN,'ERA5湿润时间代理','RH>80%所占小时百分比，仅湿润时间代理，未用于ISO 9223正式分级');
 const dewProxy=DP.length===T.length&&DP.length>0?DP:T.map((x,i)=>{const r=RH[i];if(!valid(x)||!valid(r)||r<=0)return NaN;const g=Math.log(r/100)+17.625*x/(243.04+x);return 243.04*g/(17.625-g)});
 let n=0,mx=0,run=0,den=0;for(let i=0;i<T.length;i++){if(valid(T[i])&&valid(dewProxy[i])){den++;if(T[i]-dewProxy[i]<=1){n++;run++;mx=Math.max(mx,run)}else run=0}else run=0}
 record(8,den?n/den*100:NaN,'ERA5露点代理','近饱和大气发生率：气温-露点≤1K，不等于设备表面凝露概率');
 record(9,num(n,den),'ERA5露点代理','大气近饱和年化小时，不等于设备实际凝露时长');
 record(10,den?mx:NaN,'ERA5露点代理','大气近饱和最长连续小时，不等于设备表面凝露');
 const salt=good(air.sea_salt_aerosol||[]);
 record(24,salt.length&&rhTime?Math.min(100,Math.max(0,(avg(salt)/20*50)+(wet/rhTime*50))):NaN,'环境风险筛查代理','按海盐浓度与RH>80%比例构造的0-100初筛得分，非ISO腐蚀速率');
 const windDust=good(air.dust||[]);
 record(29,NaN,'需长期逐小时沙尘事件数据','近90天数据不适合推断多年年均沙尘暴频次');
 if(window.healthMetricProvenance)window.healthMetricProvenance[20].note+='；0表示再分析样本未检出';
};
})();