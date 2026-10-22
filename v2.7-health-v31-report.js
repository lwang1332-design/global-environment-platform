/* V3.1: enrich report snapshot with evidence and unresolved engineering limits. */
(function(){
const previous=saveReportSnapshot;
saveReportSnapshot=function(){
 const ok=previous();if(!ok)return false;
 try{
 const snap=JSON.parse(localStorage.getItem(REPORT_KEY)||'null');
 if(!snap)return ok;
 const diag=window.envHealthV31;
 if(diag&&diag.context===[$('lat').value,$('lon').value,$('periodYears').value].join('|'))snap.environmentDiagnostic=diag;
 snap.assurance={
 version:'V3.1 safety audit',
 generatedAt:new Date().toISOString(),
 missingLegacyFields:[...(window.__envMissing||[])],
 unverifiedRiskFields:[...(window.__riskUnknown||[])],
 gapCaveat:'Only explicitly approved verifiedCapabilities can raise scheme capacity. Unverified upgrades and packages do not automatically close engineering gaps.',
 statistics:'ERA5 project historical period; CAMS air pollution is most recent 90 days, not the same historical interval.'
 };
 localStorage.setItem(REPORT_KEY,JSON.stringify(snap));
 }catch(e){console.warn('diagnostic snapshot persistence unavailable',e)}
 return ok;
};
})();