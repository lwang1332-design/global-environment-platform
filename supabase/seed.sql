-- 首次部署后执行一次。若 config_versions 已有正式版本，请不要重复执行。
select * from public.publish_config(
  $json${
    "delta":10,"rho":7850,"cp":500,"eps":0.85,"alpha":0.6,"sky":6,"dewMargin":3,
    "Q":100000,"D":1.5,"rpm":900,"impactEta":0.5,"filterEta":0.9,"ne":2.5,"eiMass":10,"eiVel":50,
    "capHigh":45,"capLow":-40,"capDew":3,"capCondHours":0,"capCl":10,"capPm":150,"capEi":1,"capHeatLoss":20,
    "hiA":35,"hiB":50,"loA":10,"loB":40,"windA":20,"windB":55,
    "w1":0.4,"w2":0.25,"w3":0.15,"wavg":0.2,"protect":1,
    "marineKm":20,"coastalKm":100,"camsDays":90,
    "saltVd":0.005,"saltClFrac":0.55,"towRh":80,"towTmin":0,"towTmax":40,"saltWSea":0.55,"saltWTow":0.30,"saltWSo2":0.15,
    "filterBypass":0.03,"opHours":8760,"particleD50":50,"particleRho":2650,"impactAngle":45,"materialK":1,
    "condDtMin":10,"condFilmMargin":0,"condMassK":1,"gustFactor":1.5,
    "rainA":20,"rainB":150,"snowA":1,"snowB":30,"altA":1500,"altB":4500,
    "capRh":100,"capDayRange":25,"capTempRate":8,"capRainDay":150,"capRainHour":50,"capWind":55,"capSnow":30,"capAltitude":4500,"capSo2":100,"capNo2":100,"capTow":60
  }$json$::jsonb,
  'V2.9 首次部署：继承 V2.8 已确认默认参数',
  'system-seed',
  '2.9'
);
