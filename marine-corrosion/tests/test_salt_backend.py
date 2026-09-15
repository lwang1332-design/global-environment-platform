import importlib.util
from pathlib import Path

P=Path(__file__).parents[1]/'direct-backend'/'api'/'salt.py'
spec=importlib.util.spec_from_file_location('salt_backend',P)
salt=importlib.util.module_from_spec(spec);spec.loader.exec_module(salt)

def test_eac4_sea_salt_contract():
    x=salt.build_eac4_request(2025,10.9,106.6)
    assert x['dataset']=='cams-global-reanalysis-eac4-monthly'
    assert x['model_level']=='60'
    assert x['request']['model_level']==['60']
    assert x['request']['product_type']==['monthly_mean']
    assert x['request']['variable']==salt.VARIABLES
    assert len(x['request']['month'])==12

def test_forecast_sea_salt_contract():
    x=salt.build_forecast_request(10.9,106.6)
    assert x['dataset']=='cams-global-atmospheric-composition-forecasts'
    assert x['model_level']=='137'
    assert x['request']['model_level']==['137']
    assert x['request']['type']==['forecast']
    assert x['request']['leadtime_hour'][0]=='0'
    assert x['request']['leadtime_hour'][-1]=='120'
    assert len(x['request']['leadtime_hour'])==41

def test_variables_are_three_official_cams_sea_salt_bins():
    assert salt.VARIABLES==[
        'sea_salt_aerosol_0.03-0.5um_mixing_ratio',
        'sea_salt_aerosol_0.5-5um_mixing_ratio',
        'sea_salt_aerosol_5-20um_mixing_ratio',
    ]
    assert salt.SHORTS==['aermr01','aermr02','aermr03']

def test_job_round_trip_has_no_secret():
    token=salt._encode_job({'requestId':'abcde-12345','lat':10.9,'lon':106.6,'mode':'historical','year':2025,'dataset':'x','modelLevel':'60','resolution':'x','back':0})
    x=salt._decode_job(token)
    assert x['lat']==10.9 and x['year']==2025
    assert 'CAMS_ADS_API_KEY' not in token
