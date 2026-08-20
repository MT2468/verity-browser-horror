(() => {
  if (window.__VERITY_PREFS_RUNTIME__) return;
  window.__VERITY_PREFS_RUNTIME__ = true;

  const KEY = 'verity-browser-horror-prefs-v1';
  const defaults = { contrast: false, largeText: false, softenFx: false };
  const qa = new URLSearchParams(location.search).has('qa');
  let prefs = { ...defaults };
  let previousFocus = null;
  let previousPause = null;

  const safeRead = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(KEY) || 'null');
      return parsed && typeof parsed === 'object' ? { ...defaults, ...parsed } : { ...defaults };
    } catch {
      return { ...defaults };
    }
  };

  const safeWrite = () => {
    if (qa) return;
    try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch {}
  };

  const apply = () => {
    const root = document.documentElement;
    root.dataset.verityContrast = prefs.contrast ? 'high' : 'normal';
    root.dataset.verityText = prefs.largeText ? 'large' : 'normal';
    root.dataset.verityFx = prefs.softenFx ? 'soft' : 'normal';
    document.querySelectorAll('[data-pref-key]').forEach(input => {
      input.checked = Boolean(prefs[input.dataset.prefKey]);
    });
    window.dispatchEvent(new CustomEvent('verity:preferences', { detail: { ...prefs } }));
  };

  prefs = safeRead();
  apply();

  const style = document.createElement('style');
  style.textContent = `
    #prefsPanel{width:min(520px,calc(100vw - 32px));max-height:min(620px,calc(100vh - 32px));overflow:auto}
    #prefsPanel .prefs-list{display:grid;gap:10px;margin:18px 0;text-align:left}
    #prefsPanel .pref-row{display:grid;grid-template-columns:1fr auto;gap:18px;align-items:center;padding:12px;border:1px solid rgba(243,234,56,.15);background:rgba(8,12,8,.74)}
    #prefsPanel .pref-row strong{display:block;color:#e7ecdF;font:11px monospace;letter-spacing:.06em}
    #prefsPanel .pref-row small{display:block;margin-top:4px;color:#899486;font:10px/1.45 monospace}
    #prefsPanel input[type=checkbox]{width:22px;height:22px;accent-color:#f3ea36}
    #prefsPanel .prefs-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    #prefsBtn,#pausePrefsBtn{margin-top:8px}
  `;
  document.head.appendChild(style);

  const panel = document.createElement('section');
  panel.id = 'prefsPanel';
  panel.className = 'panel hidden';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'prefsTitle');
  panel.innerHTML = `
    <p class="eyebrow">ACESSIBILIDADE // LOCAL</p>
    <h2 id="prefsTitle">PREFERÊNCIAS</h2>
    <div class="prefs-list">
      <label class="pref-row"><span><strong>CONTRASTE ALTO</strong><small>Reforça HUD, bordas, textos e indicadores importantes.</small></span><input type="checkbox" data-pref-key="contrast" aria-label="Ativar contraste alto"></label>
      <label class="pref-row"><span><strong>TEXTO MAIOR</strong><small>Aumenta HUD, diálogos, menus e avisos sem alterar o mundo do jogo.</small></span><input type="checkbox" data-pref-key="largeText" aria-label="Ativar texto maior"></label>
      <label class="pref-row"><span><strong>SUAVIZAR EFEITOS DE HORROR</strong><small>Reduz scanlines, flashes, vinheta e animações bruscas. Não muda dificuldade.</small></span><input type="checkbox" data-pref-key="softenFx" aria-label="Suavizar efeitos de horror"></label>
    </div>
    <div class="prefs-actions"><button id="prefsReset" class="secondary">RESTAURAR</button><button id="prefsClose" class="primary">FECHAR</button></div>
  `;
  document.querySelector('#app')?.appendChild(panel);

  const addLauncher = (host, id, label) => {
    if (!host || document.querySelector(`#${id}`)) return;
    const button = document.createElement('button');
    button.id = id;
    button.className = 'secondary';
    button.textContent = label;
    host.appendChild(button);
    button.addEventListener('click', () => open(button));
  };
  addLauncher(document.querySelector('#boot'), 'prefsBtn', 'PREFERÊNCIAS');
  addLauncher(document.querySelector('#pause'), 'pausePrefsBtn', 'PREFERÊNCIAS');

  const getScene = () => window.__VERITY_GAME__?.scene?.getScene('Game') || null;
  const focusables = () => [...panel.querySelectorAll('button,input:not([disabled])')];

  function open(source = document.activeElement) {
    if (!panel.classList.contains('hidden')) return;
    previousFocus = source instanceof HTMLElement ? source : document.activeElement;
    const scene = getScene();
    previousPause = scene?.pausedByUI ?? null;
    if (scene?.started) scene.pausedByUI = true;
    panel.classList.remove('hidden');
    apply();
    requestAnimationFrame(() => focusables()[0]?.focus());
  }

  function close() {
    if (panel.classList.contains('hidden')) return;
    panel.classList.add('hidden');
    const scene = getScene();
    if (scene?.started && previousPause !== null) scene.pausedByUI = previousPause;
    previousPause = null;
    if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    previousFocus = null;
  }

  panel.addEventListener('change', event => {
    const input = event.target.closest('input[data-pref-key]');
    if (!input) return;
    prefs = { ...prefs, [input.dataset.prefKey]: input.checked };
    safeWrite();
    apply();
  });
  panel.querySelector('#prefsClose')?.addEventListener('click', close);
  panel.querySelector('#prefsReset')?.addEventListener('click', () => {
    prefs = { ...defaults };
    safeWrite();
    apply();
  });

  document.addEventListener('keydown', event => {
    if (panel.classList.contains('hidden')) return;
    if (event.key === 'Escape') {
      event.preventDefault(); event.stopImmediatePropagation(); close(); return;
    }
    if (event.key !== 'Tab') return;
    const items = focusables();
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }, true);

  window.__VERITY_PREFS__ = {
    getState: () => ({ ...prefs, open: !panel.classList.contains('hidden') }),
    set: patch => {
      const allowed = Object.fromEntries(Object.entries(patch || {}).filter(([key]) => key in defaults));
      prefs = { ...prefs, ...allowed };
      safeWrite(); apply(); return { ...prefs };
    },
    reset: () => { prefs = { ...defaults }; safeWrite(); apply(); return { ...prefs }; },
    open,
    close,
  };
})();
