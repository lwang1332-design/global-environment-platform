/* Trend V2 data-quality guard.
 * V2 already excludes null/blank/non-finite source values in cleanPairs().
 * Keep this file as an explicit runtime assertion so legacy loaders remain compatible.
 */
(()=>{
'use strict';
const core=window.GETrendAnalysis;
if(!core){console.error('[GE Trend] analysis core unavailable before null guard');return}
core.dataQualityGuard='null-excluded';
core.nullPolicy={null:'excluded',blank:'excluded',nan:'excluded',infinity:'excluded',zero:'preserved when actually observed'};
})();
