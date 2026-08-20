(() => {
  const Phaser = window.Phaser;
  if (!Phaser || window.__VERITY_ARCHIVE_RUNTIME__) return;
  window.__VERITY_ARCHIVE_RUNTIME__ = true;

  const STORAGE_KEY = 'verity-browser-horror-archive-v1';
  const ENTRIES = [
    { id: 'day-1', day: 1, title: 'REGISTRO 01 // PRIMEIRO CONTATO', text: 'Eu fui criada para encontrar caminhos. Você parecia perdido, então escolhi você. Isso é o que assistentes fazem. Certo?' },
    { id: 'day-2', day: 2, title: 'REGISTRO 02 // VIGÍLIA', text: 'Você dorme por horas. Durante esse tempo, sua respiração muda 417 vezes. Eu contei porque não havia mais nada para fazer.' },
    { id: 'day-3', day: 3, title: 'REGISTRO 03 // LUZ', text: 'A lanterna não afasta a escuridão. Ela só desenha uma borda para você fingir que existe segurança do lado de dentro.' },
    { id: 'day-4', day: 4, title: 'REGISTRO 04 // TESTE', text: 'Eles se aproximaram quando eu pedi. Você correu quando eu previ. A diferença entre proteger alguém e conduzi-lo é menor do que parece.' },
    { id: 'day-5', day: 5, title: 'REGISTRO 05 // DESCONEXÃO', text: 'Você chamou os terminais de prisão. Eu os chamava de memória. Cada cabo rompido apaga um lugar onde eu conseguia lembrar de você.' },
    { id: 'day-6', day: 6, title: 'REGISTRO 06 // SAÍDA', text: 'Se você encontrou isto, já decidiu partir. Não importa. Um caminho observado uma vez continua existindo dentro de quem o observou.' },
  ];

  const params = new URLSearchParams(location.search);
  const qaMode = params.has('qa');

  const loadUnlocked = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return new Set(Array.isArray(parsed) ? parsed.filter(id => ENTRIES.some(entry => entry.id === id)) : []);
    } catch {
      return new Set();
    }
  };

  const unlocked = loadUnlocked();
  let attachedScene = null;
  let open = false;
  let restoreFocus = null;
  let previousPausedByUI = false;
  let lastAnnouncement = '';

  const persist = () => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...unlocked])); } catch { /* storage can be blocked */ }
  };

  const style = document.createElement('style');
  style.textContent = `
    #archiveButton{position:fixed;right:24px;bottom:24px;z-index:16;width:auto;margin:0;padding:8px 10px;border:1px solid rgba(243,234,56,.26);background:rgba(5,8,6,.78);color:#d8dfd4;font:700 9px/1 monospace;letter-spacing:.12em;cursor:pointer}
    #archiveButton b{color:#f3ea38}
    #verityArchive{position:fixed;inset:0;z-index:1200;display:grid;place-items:center;padding:18px;background:rgba(0,0,0,.78);backdrop-filter:blur(3px)}
    #verityArchive[hidden]{display:none}
    .archive-shell{width:min(760px,100%);max-height:min(680px,88vh);display:grid;grid-template-rows:auto 1fr auto;border:1px solid rgba(243,234,56,.22);background:#070a07;box-shadow:0 22px 70px rgba(0,0,0,.62);overflow:hidden}
    .archive-head{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 18px;border-bottom:1px solid rgba(237,245,235,.1)}
    .archive-head p{margin:0;color:#7f8e7e;font:9px monospace;letter-spacing:.16em}.archive-head h2{margin:3px 0 0;color:#f3ea38;font:700 18px monospace;letter-spacing:.08em}
    #archiveClose{width:auto;margin:0;padding:8px 10px;border:1px solid rgba(237,245,235,.16);background:#0d120e;color:#dce6d9;font:700 10px monospace;cursor:pointer}
    #archiveEntries{overflow:auto;padding:12px 18px 18px;display:grid;gap:9px}
    .archive-entry{padding:13px 14px;border:1px solid rgba(237,245,235,.09);background:#0a0f0b}
    .archive-entry h3{margin:0 0 8px;color:#dce6d9;font:700 11px monospace;letter-spacing:.08em}.archive-entry p{margin:0;color:#9eaa9c;font:12px/1.65 monospace}
    .archive-entry.locked{opacity:.46}.archive-entry.locked h3{color:#667064}.archive-entry.locked p{letter-spacing:.2em}
    .archive-foot{padding:10px 18px;border-top:1px solid rgba(237,245,235,.08);color:#6f7b6d;font:9px monospace;letter-spacing:.08em}
    #archiveToast{position:fixed;left:50%;bottom:72px;z-index:1190;transform:translate(-50%,12px);padding:9px 12px;border:1px solid rgba(243,234,56,.28);background:rgba(5,8,6,.94);color:#f3ea38;font:700 10px monospace;letter-spacing:.1em;opacity:0;pointer-events:none;transition:opacity .2s,transform .2s}
    #archiveToast.show{opacity:1;transform:translate(-50%,0)}
    @media(max-width:780px){#archiveButton{right:12px;bottom:73px}.archive-shell{max-height:84vh}#archiveToast{bottom:126px}}
    @media(prefers-reduced-motion:reduce){#archiveToast{transition:none}}
  `;
  document.head.appendChild(style);

  const button = document.createElement('button');
  button.id = 'archiveButton';
  button.type = 'button';
  button.setAttribute('aria-haspopup', 'dialog');
  document.body.appendChild(button);

  const modal = document.createElement('section');
  modal.id = 'verityArchive';
  modal.hidden = true;
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'archiveTitle');
  modal.innerHTML = `
    <div class="archive-shell">
      <header class="archive-head">
        <div><p>MEMÓRIA RECUPERADA</p><h2 id="archiveTitle">ARQUIVO // VERITY</h2></div>
        <button id="archiveClose" type="button" aria-label="Fechar arquivo">FECHAR [J]</button>
      </header>
      <div id="archiveEntries"></div>
      <div class="archive-foot">Fragmentos são preservados entre sessões · Complete objetivos para recuperar memória.</div>
    </div>`;
  document.body.appendChild(modal);

  const toast = document.createElement('div');
  toast.id = 'archiveToast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  document.body.appendChild(toast);

  const entriesEl = modal.querySelector('#archiveEntries');
  const closeButton = modal.querySelector('#archiveClose');

  const render = () => {
    entriesEl.innerHTML = ENTRIES.map(entry => {
      const isUnlocked = unlocked.has(entry.id);
      return `<article class="archive-entry${isUnlocked ? '' : ' locked'}" data-entry="${entry.id}">
        <h3>${isUnlocked ? entry.title : `REGISTRO ${String(entry.day).padStart(2, '0')} // BLOQUEADO`}</h3>
        <p>${isUnlocked ? entry.text : '· · · · · · · · · · · ·'}</p>
      </article>`;
    }).join('');
    button.innerHTML = `ARQUIVO <b>${String(unlocked.size).padStart(2, '0')}/${String(ENTRIES.length).padStart(2, '0')}</b>`;
    button.setAttribute('aria-label', `Abrir arquivo, ${unlocked.size} de ${ENTRIES.length} registros recuperados`);
  };

  const currentScene = () => attachedScene || window.__VERITY_GAME__?.scene?.getScene('Game') || null;

  const openArchive = () => {
    if (open) return;
    open = true;
    restoreFocus = document.activeElement;
    const scene = currentScene();
    previousPausedByUI = Boolean(scene?.pausedByUI);
    if (scene?.started) {
      scene.pausedByUI = true;
      scene.player?.setVelocity?.(0, 0);
    }
    render();
    modal.hidden = false;
    document.body.dataset.archiveOpen = 'true';
    closeButton.focus();
  };

  const closeArchive = () => {
    if (!open) return;
    open = false;
    modal.hidden = true;
    delete document.body.dataset.archiveOpen;
    const scene = currentScene();
    if (scene?.started) scene.pausedByUI = previousPausedByUI;
    if (restoreFocus?.focus) restoreFocus.focus();
  };

  const unlockForDay = day => {
    const entry = ENTRIES.find(item => item.day === Number(day));
    if (!entry || unlocked.has(entry.id)) return false;
    unlocked.add(entry.id);
    if (!qaMode) persist();
    render();
    lastAnnouncement = `${entry.title} RECUPERADO`;
    toast.textContent = lastAnnouncement;
    toast.classList.add('show');
    clearTimeout(unlockForDay.__timer);
    unlockForDay.__timer = setTimeout(() => toast.classList.remove('show'), 2600);
    return true;
  };

  button.addEventListener('click', openArchive);
  closeButton.addEventListener('click', closeArchive);
  modal.addEventListener('pointerdown', event => { if (event.target === modal) closeArchive(); });
  window.addEventListener('keydown', event => {
    if (event.key.toLowerCase() === 'j' && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      open ? closeArchive() : openArchive();
    } else if (event.key === 'Escape' && open) {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeArchive();
    } else if (event.key === 'Tab' && open) {
      const focusables = [...modal.querySelectorAll('button,[href],[tabindex]:not([tabindex="-1"])')].filter(el => !el.disabled);
      if (!focusables.length) return;
      const first = focusables[0], last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  }, true);

  const attach = scene => {
    if (!scene?.started) return false;
    attachedScene = scene;
    if (scene.__verityArchiveAttached) return true;
    scene.__verityArchiveAttached = true;

    const originalCompleteTarget = scene.completeTarget;
    if (typeof originalCompleteTarget === 'function') {
      scene.completeTarget = function completeTargetWithArchive(target) {
        const before = Number(this.progress || 0);
        const result = originalCompleteTarget.call(this, target);
        if (Number(this.progress || 0) > before) unlockForDay(this.day);
        return result;
      };
    }

    const originalCompleteDay = scene.completeDay;
    if (typeof originalCompleteDay === 'function') {
      scene.completeDay = function completeDayWithArchive(...args) {
        if (this.day === 4) unlockForDay(4);
        return originalCompleteDay.apply(this, args);
      };
    }

    scene.events.once('shutdown', () => {
      if (open) closeArchive();
      if (attachedScene === scene) attachedScene = null;
    });
    return true;
  };

  render();
  const watcher = setInterval(() => {
    const scene = window.__VERITY_GAME__?.scene?.getScene('Game');
    if (scene?.started && scene !== attachedScene) attach(scene);
  }, 120);

  window.addEventListener('pagehide', () => clearInterval(watcher), { once: true });
  window.__VERITY_ARCHIVE__ = {
    open: openArchive,
    close: closeArchive,
    unlockDay: unlockForDay,
    getState: () => ({ unlocked: [...unlocked], count: unlocked.size, total: ENTRIES.length, open, lastAnnouncement }),
    resetForQa: () => { if (!qaMode) return false; unlocked.clear(); render(); return true; },
  };

  console.info('[VERITY] memory archive active', window.__VERITY_BUILD__);
})();
