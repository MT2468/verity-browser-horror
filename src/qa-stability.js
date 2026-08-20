(() => {
  const params = new URLSearchParams(location.search);
  if (!params.has('qa')) return;

  const watcher = setInterval(() => {
    const state = document.querySelector('#qaState');
    const log = document.querySelector('#qaLog');
    if (!state || state.textContent !== 'ALL PASS') return;
    clearInterval(watcher);
    state.textContent = 'STABILITY';

    setTimeout(() => {
      const scene = window.__VERITY_GAME__?.scene?.getScene('Game');
      const fatal = document.querySelector('#verityFatal');
      const prefs = window.__VERITY_PREFS__;
      const recap = window.__VERITY_RECAP__;
      let prefsOk = Boolean(prefs?.getState && prefs?.set && prefs?.reset);
      let recapOk = Boolean(recap?.getState && recap?.getLast);

      if (prefsOk) {
        const before = prefs.getState();
        prefs.set({ contrast: true, largeText: true, softenFx: true });
        const changed = prefs.getState();
        prefsOk = changed.contrast === true && changed.largeText === true && changed.softenFx === true;
        prefs.set({ contrast: before.contrast, largeText: before.largeText, softenFx: before.softenFx });
      }

      if (recapOk) {
        const recapState = recap.getState();
        recapOk = Number.isFinite(recapState.duration) && recapState.day >= 1 && recapState.day <= 6;
      }

      const stable = scene?.day === 6 && scene?.started && !fatal && prefsOk && recapOk && window.__VERITY_BUILD__ === '0.8.0';
      const stamp = new Date().toLocaleTimeString();
      if (stable) {
        state.textContent = 'STABLE PASS';
        state.className = 'pass';
        if (log) log.textContent += `\n[${stamp}] PASS: day state stable; preferences + recap runtime healthy; build 0.8.0`;
        console.info('[VERITY QA] STABLE PASS', { prefsOk, recapOk, build: window.__VERITY_BUILD__ });
      } else {
        state.textContent = 'STABILITY FAIL';
        state.className = 'fail';
        if (log) log.textContent += `\n[${stamp}] FAIL: final stability (day=${scene?.day ?? 'none'}, prefs=${prefsOk}, recap=${recapOk}, build=${window.__VERITY_BUILD__})`;
        console.error('[VERITY QA] STABILITY FAIL', { day: scene?.day, fatal: Boolean(fatal), prefsOk, recapOk, build: window.__VERITY_BUILD__ });
      }
    }, 5000);
  }, 100);
})();
