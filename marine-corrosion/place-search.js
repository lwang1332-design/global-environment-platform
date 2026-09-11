// Explicit, on-demand geocoding. No annual environment data is fetched here.
const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const HELP = '搜索后选择地点，自动填写经纬度；可在地图上微调具体位置。';

export async function searchPlaces(query, signal) {
  async function request(name) {
    const params = new URLSearchParams({name, count: '10', language: 'zh', format: 'json'});
    const response = await fetch(`${GEOCODING_URL}?${params}`, {signal});
    if (!response.ok) throw new Error('地名服务暂不可用，请稍后重试，或直接输入经纬度。');
    const data = await response.json();
    if (data.error || (data.results !== undefined && !Array.isArray(data.results))) {
      throw new Error('地名服务返回异常，请稍后重试。');
    }
    return (data.results || []).filter(p => p && typeof p.name === 'string' && p.name.trim()
      && Number.isFinite(p.latitude) && Math.abs(p.latitude) <= 90
      && Number.isFinite(p.longitude) && Math.abs(p.longitude) <= 180);
  }
  let rows = await request(query);
  // GeoNames often indexes Chinese cities without the administrative suffix.
  if (!rows.length && /^[\u3400-\u9fff]{2,}[市县区]$/.test(query)) {
    rows = await request(query.slice(0, -1));
  }
  const seen = new Set();
  return rows.filter(p => {
    const key = `${p.name}|${p.latitude}|${p.longitude}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map(p => ({
    name: p.name, latitude: p.latitude, longitude: p.longitude,
    label: [...new Set([p.name, p.admin2, p.admin1, p.country].filter(Boolean))].join(' · ')
  }));
}

export function initPlaceSearch({onSelect}) {
  const input = document.getElementById('placeSearch');
  const button = document.getElementById('placeSearchBtn');
  const results = document.getElementById('placeResults');
  const status = document.getElementById('placeSearchStatus');
  const cache = new Map();
  let controller = null;
  let sequence = 0;
  let selected = null;

  function setStatus(message, error = false) {
    status.textContent = message;
    status.classList.toggle('place-search-error', error);
  }
  function closeResults() {
    results.replaceChildren();
    results.hidden = true;
  }
  function setBusy(busy) {
    button.disabled = busy;
    button.textContent = busy ? '搜索中…' : '搜索地点';
    results.setAttribute('aria-busy', String(busy));
  }
  function cancel() {
    sequence++;
    controller?.abort();
    controller = null;
    setBusy(false);
  }
  function render(places) {
    closeResults();
    if (!places.length) {
      setStatus('未找到匹配地点。请尝试城市名、拼音或英文名，也可直接输入经纬度。');
      return;
    }
    for (const place of places) {
      const item = document.createElement('li');
      const choice = document.createElement('button');
      choice.type = 'button';
      choice.className = 'place-result';
      const name = document.createElement('strong');
      name.textContent = place.label;
      const coords = document.createElement('small');
      coords.textContent = `纬度 ${place.latitude.toFixed(4)}° / 经度 ${place.longitude.toFixed(4)}°`;
      choice.append(name, coords);
      choice.addEventListener('click', () => {
        cancel();
        selected = place;
        input.value = place.name;
        closeResults();
        onSelect(place);
        setStatus(`已定位：${place.label}。请确认具体位置后点击计算。`);
        input.focus();
      });
      item.append(choice);
      results.append(item);
    }
    results.hidden = false;
    setStatus(`找到 ${places.length} 个地点，请核对行政区和坐标后选择。`);
  }
  async function search() {
    const query = input.value.trim();
    cancel();
    closeResults();
    if (query.length < 2) {
      setStatus('请输入至少2个字符的地名，例如“三亚”或“Singapore”。', true);
      input.focus();
      return;
    }
    if (cache.has(query)) return render(cache.get(query));
    const requestSequence = sequence;
    const requestController = new AbortController();
    controller = requestController;
    const timeout = setTimeout(() => requestController.abort(), 8000);
    setBusy(true);
    setStatus(`正在搜索“${query}”…`);
    try {
      const places = await searchPlaces(query, requestController.signal);
      if (requestSequence !== sequence) return;
      if (cache.size >= 30) cache.delete(cache.keys().next().value);
      cache.set(query, places);
      render(places);
    } catch (error) {
      if (requestSequence !== sequence) return;
      setStatus(error.name === 'AbortError'
        ? '搜索超时，请重试或直接输入经纬度。'
        : '地名搜索暂不可用，请检查网络后重试，或直接输入经纬度。', true);
    } finally {
      clearTimeout(timeout);
      if (requestSequence === sequence) { controller = null; setBusy(false); }
    }
  }
  button.addEventListener('click', search);
  input.addEventListener('input', () => { cancel(); closeResults(); setStatus(HELP); });
  input.addEventListener('keydown', event => {
    if (event.isComposing) return;
    if (event.key === 'Enter') { event.preventDefault(); search(); }
    if (event.key === 'ArrowDown' && !results.hidden) {
      event.preventDefault(); results.querySelector('button')?.focus();
    }
    if (event.key === 'Escape') { cancel(); closeResults(); setStatus(HELP); }
  });
  results.addEventListener('keydown', event => {
    const choices = [...results.querySelectorAll('button')];
    const index = choices.indexOf(event.target);
    if (event.key === 'Escape') { closeResults(); input.focus(); }
    if (index >= 0 && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
      event.preventDefault();
      choices[(index + (event.key === 'ArrowDown' ? 1 : choices.length - 1)) % choices.length].focus();
    }
  });
  return {
    coordinatesChanged() {
      cancel(); closeResults();
      if (selected) { input.value = ''; selected = null; }
      setStatus('坐标已调整，请确认地图位置后点击计算。');
    }
  };
}
