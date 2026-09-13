export * from './input-policy-v331.js';
export const APP_VERSION='3.3.2';
export const SCIENCE_MODEL_VERSION='3.3.0';
export const DATA_LAYER_VERSION='3.3.2';
export const SO2_AUTO_POLICY={
  historical:{source:'CAMS EAC4 monthly reanalysis',dataset:'cams-global-reanalysis-eac4-monthly',modelLevel:'60',period:'2003-2025'},
  current:{source:'CAMS Global atmospheric composition forecast',dataset:'cams-global-atmospheric-composition-forecasts',modelLevel:'137',horizonHours:120},
  missing:'MISSING_NOT_ZERO',
  isoConversion:'Pd = 0.8 × Pc'
};
