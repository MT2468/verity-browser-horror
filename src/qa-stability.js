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
      const stable = scene?.day === 6 && scene?.started && !fatal;
      const stamp = new Date().toLocaleTimeString();
      if (stable) {
        state.textContent = 'STABLE PASS';
        state.className = 'pass';
        if (log) log.textContent += `\n[${stamp}] PASS: day state stable after delayed-timer window`;
        console.info('[VERITY QA] STABLE PASS');
      } else {
        state.textContent = 'STABILITY FAIL';
        state.className = 'fail';
        if (log) log.textContent += `\n[${stamp}] FAIL: state drifted after test (day=${scene?.day ?? 'none'})`;
        console.error('[VERITY QA] STABILITY FAIL', { day: scene?.day, fatal: Boolean(fatal) });
      }
    }, 5000);
  }, 100);
})();
