(() => {
  const Phaser = window.Phaser;
  if (!Phaser?.Game || window.__VERITY_BOOTSTRAPPED__) return;
  window.__VERITY_BOOTSTRAPPED__ = true;
  window.__VERITY_BUILD__ = '0.4.0';
  window.__VERITY_REQUESTED_DAY__ = 1;

  const readSavedDay = () => {
    try {
      const raw = localStorage.getItem('verity-browser-horror-save-v2');
      const parsed = raw ? JSON.parse(raw) : null;
      const day = Number(parsed?.day);
      return Number.isFinite(day) ? Phaser.Math.Clamp(day, 1, 6) : 1;
    } catch {
      return 1;
    }
  };

  document.querySelector('#startBtn')?.addEventListener('click', () => {
    window.__VERITY_REQUESTED_DAY__ = 1;
  }, { capture: true });
  document.querySelector('#continueBtn')?.addEventListener('click', () => {
    window.__VERITY_REQUESTED_DAY__ = readSavedDay();
  }, { capture: true });

  const OriginalGame = Phaser.Game;
  Phaser.Game = class VerityCapturedGame extends OriginalGame {
    constructor(config) {
      const safeConfig = { ...config };

      if (typeof safeConfig.scene === 'function') {
        const OriginalScene = safeConfig.scene;
        safeConfig.scene = class VerityInitialisedScene extends OriginalScene {
          init(data = {}) {
            const requested = Number(data?.day ?? window.__VERITY_REQUESTED_DAY__ ?? 1);
            super.init({ ...data, day: Phaser.Math.Clamp(requested, 1, 6) });
          }
        };
      }

      if (safeConfig.callbacks) {
        const callbacks = { ...safeConfig.callbacks };
        delete callbacks.postBoot;
        safeConfig.callbacks = callbacks;
      }

      super(safeConfig);
      window.__VERITY_GAME__ = this;
    }
  };

  const showFatal = message => {
    if (document.querySelector('#verityFatal')) return;
    const box = document.createElement('div');
    box.id = 'verityFatal';
    box.setAttribute('role', 'alert');
    box.style.cssText = 'position:fixed;inset:auto 16px 16px 16px;z-index:5000;padding:14px;border:1px solid #7d3535;background:#160a0a;color:#ffd4d4;font:12px/1.5 monospace;white-space:pre-wrap';
    box.textContent = `VERITY RUNTIME ERROR\n${message}\n\nRecarregue a página. Se persistir, abra uma issue no repositório.`;
    document.body.appendChild(box);
  };

  window.addEventListener('error', event => {
    const message = `${event.message || 'Unknown error'}${event.filename ? `\n${event.filename}:${event.lineno || '?'}` : ''}`;
    console.error('[VERITY]', message);
    showFatal(message);
  });

  window.addEventListener('unhandledrejection', event => {
    const reason = event.reason?.stack || event.reason?.message || String(event.reason || 'Unhandled promise rejection');
    console.error('[VERITY]', reason);
    showFatal(reason);
  });
})();
