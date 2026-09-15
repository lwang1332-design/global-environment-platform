import importlib.util
from pathlib import Path

P=Path(__file__).parents[1]/'direct-backend'/'api'/'salt_flux.py'
spec=importlib.util.spec_from_file_location('salt_flux_backend',P)
flux=importlib.util.module_from_spec(spec);spec.loader.exec_module(flux)


def test_historical_flux_contract_is_quarterly_and_complete():
    expected={
        1:'2025-01-01/2025-03-31',
        2:'2025-04-01/2025-06-30',
        3:'2025-07-01/2025-09-30',
        4:'2025-10-01/2025-12-31',
    }
    for chunk,date_range in expected.items():
        x=flux.build_historical_request(2025,18.3,109.26,chunk)
        assert x['dataset']=='cams-global-atmospheric-composition-forecasts'
        assert x['request']['date']==[date_range]
        assert x['request']['time']==['00:00']
        assert x['request']['type']==['forecast']
        assert x['request']['leadtime_hour']==[str(h) for h in range(0,24,3)]
        assert 'model_level' not in x['request']
        assert x['history_basis']=='ARCHIVED_FORECAST_FLUX'
        assert x['chunk']==chunk
        assert x['chunk_range']==date_range


def test_historical_flux_rejects_invalid_chunk():
    for chunk in (0,5):
        try:
            flux.build_historical_request(2025,18.3,109.26,chunk)
        except ValueError:
            pass
        else:
            raise AssertionError('invalid chunk must reject')


def test_current_flux_contract():
    x=flux.build_current_request(18.3,109.26)
    assert x['dataset']=='cams-global-atmospheric-composition-forecasts'
    assert x['request']['type']==['forecast']
    assert x['request']['leadtime_hour'][0]=='0'
    assert x['request']['leadtime_hour'][-1]=='120'
    assert len(x['request']['leadtime_hour'])==41
    assert 'model_level' not in x['request']


def test_official_flux_variable_groups_are_complete():
    assert len(flux.DRY)==3 and len(flux.SED)==3 and len(flux.WET_CONV)==3 and len(flux.WET_LS)==3
    assert len(flux.VARIABLES)==12
    assert flux.DRY==[
        'dry_deposition_of_sea_salt_aerosol_0.03-0.5um',
        'dry_deposition_of_sea_salt_aerosol_0.5-5um',
        'dry_deposition_of_sea_salt_aerosol_5-20um',
    ]
    assert flux.SED==[
        'sedimentation_of_sea_salt_aerosol_0.03-0.5um',
        'sedimentation_of_sea_salt_aerosol_0.5-5um',
        'sedimentation_of_sea_salt_aerosol_5-20um',
    ]
    assert flux.WET_CONV==[
        'wet_deposition_of_sea_salt_aerosol_0.03-0.5um_by_convective_precipitation',
        'wet_deposition_of_sea_salt_aerosol_0.5-5um_by_convective_precipitation',
        'wet_deposition_of_sea_salt_aerosol_5-20um_by_convective_precipitation',
    ]
    assert flux.WET_LS==[
        'wet_deposition_of_sea_salt_aerosol_0.03-0.5um_by_large_scale_precipitation',
        'wet_deposition_of_sea_salt_aerosol_0.5-5um_by_large_scale_precipitation',
        'wet_deposition_of_sea_salt_aerosol_5-20um_by_large_scale_precipitation',
    ]
    assert set(flux.SHORTS)==set(flux.FIELD_VARIABLES)


def test_flux_short_names_are_explicit():
    assert flux.SHORTS['ssDry1']=='aerddpsss'
    assert flux.SHORTS['ssDry2']=='aerddpssm'
    assert flux.SHORTS['ssDry3']=='aerddpssl'
    assert flux.SHORTS['ssSed1']=='aersdmsss'
    assert flux.SHORTS['ssSed2']=='aersdmssm'
    assert flux.SHORTS['ssSed3']=='aersdmssl'
    assert flux.SHORTS['ssWetConv1']=='aerwdccsss'
    assert flux.SHORTS['ssWetConv2']=='aerwdccssm'
    assert flux.SHORTS['ssWetConv3']=='aerwdccssl'
    assert flux.SHORTS['ssWetLs1']=='aerwdlssss'
    assert flux.SHORTS['ssWetLs2']=='aerwdlsssm'
    assert flux.SHORTS['ssWetLs3']=='aerwdlsssl'


def test_job_round_trip_has_no_secret_and_keeps_chunk():
    token=flux._encode_job({'requestId':'abcde-12345','lat':18.3,'lon':109.26,'mode':'historical','year':2025,'dataset':'x','resolution':'x','historyBasis':'ARCHIVED_FORECAST_FLUX','back':0,'chunk':2,'chunkRange':'2025-04-01/2025-06-30'})
    x=flux._decode_job(token)
    assert x['lat']==18.3 and x['year']==2025 and x['chunk']==2
    assert 'CAMS_ADS_API_KEY' not in token
