import importlib.util
import pathlib
import unittest
from datetime import datetime, timezone

MODULE=pathlib.Path(__file__).parents[1]/'direct-backend'/'api'/'so2.py'
spec=importlib.util.spec_from_file_location('marine_so2',MODULE)
so2=importlib.util.module_from_spec(spec)
spec.loader.exec_module(so2)

class TestCamsSo2Requests(unittest.TestCase):
    def test_eac4_request_contract(self):
        x=so2.build_eac4_request(2025,10.9,106.6)
        self.assertEqual(x['dataset'],'cams-global-reanalysis-eac4-monthly')
        r=x['request']
        self.assertEqual(r['variable'],['sulphur_dioxide'])
        self.assertEqual(r['model_level'],['60'])
        self.assertEqual(r['year'],['2025'])
        self.assertEqual(len(r['month']),12)
        self.assertEqual(r['product_type'],['monthly_mean'])
        self.assertEqual(r['data_format'],'netcdf')
        self.assertEqual(r['download_format'],'unarchived')
        self.assertEqual(len(r['area']),4)

    def test_forecast_request_contract(self):
        cycle=datetime(2026,9,13,0,tzinfo=timezone.utc)
        x=so2.build_forecast_request(10.9,106.6,cycle)
        self.assertEqual(x['dataset'],'cams-global-atmospheric-composition-forecasts')
        r=x['request']
        self.assertEqual(r['variable'],['sulphur_dioxide'])
        self.assertEqual(r['model_level'],['137'])
        self.assertEqual(r['date'],['2026-09-13'])
        self.assertEqual(r['time'],['00:00'])
        self.assertEqual(r['type'],['forecast'])
        self.assertEqual(r['leadtime_hour'][0],'0')
        self.assertEqual(r['leadtime_hour'][-1],'120')
        self.assertTrue(all(int(b)-int(a)==3 for a,b in zip(r['leadtime_hour'],r['leadtime_hour'][1:])))
        self.assertEqual(r['data_format'],'netcdf_zip')

    def test_latest_cycle_has_eight_hour_safety_lag(self):
        now=datetime(2026,9,13,13,30,tzinfo=timezone.utc)
        self.assertEqual(so2._latest_cycle(now),datetime(2026,9,13,0,tzinfo=timezone.utc))
        now=datetime(2026,9,13,22,30,tzinfo=timezone.utc)
        self.assertEqual(so2._latest_cycle(now),datetime(2026,9,13,12,tzinfo=timezone.utc))

if __name__=='__main__':
    unittest.main()
