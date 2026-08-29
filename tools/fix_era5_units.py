from pathlib import Path
p=Path('index.html')
s=p.read_text(encoding='utf-8')
s=s.replace('dew_point_2m,precipitation,snowfall,wind_speed_10m,wind_gusts_10m,shortwave_radiation','dew_point_2m,precipitation,snowfall,wind_speed_10m,shortwave_radiation')
s=s.replace('&daily=${dv}&timezone=UTC&models=era5`','&daily=${dv}&timezone=UTC&wind_speed_unit=ms&models=era5`')
s=s.replace("gust=(h.wind_gusts_10m||[]).filter(Number.isFinite)","gust=((h.wind_gusts_10m||[]).filter(Number.isFinite).length?(h.wind_gusts_10m||[]).filter(Number.isFinite):(h.wind_speed_10m||[]).filter(Number.isFinite).map(x=>1.5*x))")
s=s.replace('阵风P99 ${num(b.gust99,1)}m/s','阵风P99(估算) ${num(b.gust99,1)}m/s')
p.write_text(s,encoding='utf-8')
print('fixed ERA5 supported variables and wind units')
