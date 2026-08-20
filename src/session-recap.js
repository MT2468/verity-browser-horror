(() => {
  const Phaser = window.Phaser;
  if (!Phaser || window.__VERITY_RECAP_RUNTIME__) return;
  window.__VERITY_RECAP_RUNTIME__ = true;

  const KEY = 'verity-browser-horror-recap-v1';
  const qa = new URLSearchParams(location.search).has('qa');
  const state = { startedAt: Date.now(), day: 1, deaths: 0, pulses: 0, interactions: 0, maxSignal: 0, lastCause: '', ending: '' };
  let scene = null;

  const load = () => {
    try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; }
  };
  const save = payload => { if (!qa) try { localStorage.setItem(KEY, JSON.stringify(payload)); } catch {} };
  const formatTime = ms => `${Math.floor(ms / 60000)}m ${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}s`;

  const style = document.createElement('style');
  style.textContent = `#recapCard{margin:14px auto 18px;width:min(520px,90vw);padding:12px 14px;border:1px solid rgba(243,234,56,.2);background:rgba(7,10,7,.82);font:10px/1.7 monospace;color:#98a596;text-align:left}#recapCard strong{color:#f3ea38}#recapCard .recap-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 16px}@media(max-width:520px){#recapCard .recap-grid{grid-template-columns:1fr}}`;
  document.head.appendChild(style);

  const card = document.createElement('div');
  card.id = 'recapCard';
  card.hidden = true;
  document.querySelector('#endingText')?.insertAdjacentElement('afterend', card);

  const render = data => {
    if (!data) return;
    card.innerHTML = `<strong>RELATÓRIO // SUJEITO #001</strong><div class="recap-grid"><span>tempo ${formatTime(data.duration || 0)}</span><span>dia alcançado ${String(data.day || 1).padStart(2,'0')}</span><span>quedas ${data.deaths || 0}</span><span>interações ${data.interactions || 0}</span><span>pulsos ${data.pulses || 0}</span><span>pico de sinal ${Math.round(data.maxSignal || 0)}%</span></div>${data.lastCause ? `<div>última ocorrência: ${data.lastCause}</div>` : ''}`;
    card.hidden = false;
  };

  const snapshot = ending => ({ ...state, ending: ending || state.ending, duration: Date.now() - state.startedAt, recordedAt: Date.now() });

  const attach = s => {
    if (!s?.started || s === scene) return;
    scene = s;
    state.day = Math.max(state.day, Number(s.day || 1));
    if (s.__verityRecapAttached) return;
    s.__verityRecapAttached = true;

    const wrap = (name, after) => {
      const original = s[name];
      if (typeof original !== 'function') return;
      s[name] = function(...args) { const result = original.apply(this, args); after.call(this, args); return result; };
    };
    wrap('completeTarget', () => { state.interactions++; state.day = Math.max(state.day, Number(s.day || 1)); });
    wrap('playerCaught', () => { state.deaths++; state.lastCause = 'contato com uma sombra'; save(snapshot()); });
    wrap('gameOver', args => { state.deaths++; state.lastCause = String(args?.[0] || 'sinal perdido'); save(snapshot()); });
    wrap('showEnding', args => { state.ending = String(args?.[0] || 'ending'); const data = snapshot(state.ending); save(data); setTimeout(() => render(data), 0); });

    s.events.once('shutdown', () => { state.day = Math.max(state.day, Number(s.day || 1)); if (scene === s) scene = null; });
  };

  const poll = setInterval(() => {
    const s = window.__VERITY_GAME__?.scene?.getScene('Game');
    if (s?.started) {
      attach(s);
      state.day = Math.max(state.day, Number(s.day || 1));
      state.maxSignal = Math.max(state.maxSignal, Number(s.signal || 0));
    }
    const pulse = window.__VERITY_PULSE__?.getState?.();
    if (pulse && Number(pulse.count) > state.pulses) state.pulses = Number(pulse.count);
  }, 250);
  window.addEventListener('pagehide', () => { clearInterval(poll); save(snapshot()); }, { once: true });

  const previous = load();
  if (previous && document.querySelector('#ending:not(.hidden)')) render(previous);
  window.__VERITY_RECAP__ = { getState: () => snapshot(), getLast: load, renderLast: () => render(load()) };
  console.info('[VERITY] session recap active', window.__VERITY_BUILD__);
})();
