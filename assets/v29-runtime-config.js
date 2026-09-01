// Public runtime settings only. Do not place passwords, PATs, Service Role Keys or other secrets here.
window.V29_RUNTIME_CONFIG={
  configApiBase:'https://vzlnwrxscufkchxkdjus.supabase.co/functions/v1/v29-config'
};

// Windows localhost workstation adapter. Online GitHub Pages is unchanged.
if(['localhost','127.0.0.1'].includes(location.hostname)){
  const s=document.createElement('script');
  s.src='./assets/local-workstation.js?v=20260901-local-v3-ui2';
  s.async=true;
  document.head.appendChild(s);
}
