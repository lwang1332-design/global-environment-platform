const DEFAULT_RISK_RULES={
  t99:{label:'P99最高气温',unit:'℃',direction:'high',medium:40,high:45},
  tmin:{label:'极端最低气温',unit:'℃',direction:'low',medium:-20,high:-30},
  rh90:{label:'RH>90%',unit:'h/y',direction:'high',medium:300,high:1000},
  rainYear:{label:'年降水量',unit:'mm/y',direction:'high',medium:900,high:1800},
  rain1h:{label:'最大1h降水',unit:'mm/h',direction:'high',medium:30,high:80},
  snowHours:{label:'年降雪小时',unit:'h/y',direction:'high',medium:30,high:120},
  alt:{label:'海拔',unit:'m',direction:'high',medium:1500,high:3000},
  pm10:{label:'PM10均值',unit:'μg/m³',direction:'high',medium:45,high:150},
  dust:{label:'Dust均值',unit:'μg/m³',direction:'high',medium:50,high:150},
  so2:{label:'SO₂均值',unit:'μg/m³',direction:'high',medium:5,high:20},
  salt:{label:'Sea Salt Aerosol',unit:'μg/m³',direction:'high',medium:5,high:20},
  wind95:{label:'P95风速',unit:'m/s',direction:'high',medium:10,high:15},
  rad95:{label:'P95太阳辐射',unit:'W/m²',direction:'high',medium:600,high:800}
};
const MATCH_RULE={high:70,medium:45,version:'V2.7-CORE-SUPPORT'};
