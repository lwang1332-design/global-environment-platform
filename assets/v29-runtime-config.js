// Public runtime settings only. Do not place passwords, PATs, Service Role Keys or other secrets here.
window.V29_RUNTIME_CONFIG={
  configApiBase:'https://vzlnwrxscufkchxkdjus.supabase.co/functions/v1/v29-config'
};

// Report presentation layer only. It waits for the existing reportHtml + V29Joint modules,
// then reorganizes the report without changing any engineering calculation logic.
(()=>{
  if(document.querySelector('script[data-v29-report-template]'))return;
  const s=document.createElement('script');
  s.src='./assets/report-v29.js?v=20260901-r1';
  s.dataset.v29ReportTemplate='1';
  s.async=true;
  document.head.appendChild(s);
})();
