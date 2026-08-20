(() => {
  if (window.__VERITY_PERF__) return;

  const params = new URLSearchParams(location.search);
  const forced = params.get('perf');
  const allowed = new Set(['high', 'balanced', 'low']);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const qa = params.get('qa') === '1';

  const state = {
    tier: 'high',
    fps: 60,
    forced: allowed.has(forced) ? forced : null,
    reducedMotion,
    samples: [],
    lowWindows: 0,
    highWindows: 0,
    lastFrame: performance.now(),
    lastEvaluation: performance.now(),
  };

  const badge = document.createElement('div');
  badge.id = 'perfBadge';
  badge.setAttribute('aria-hidden', 'true');
  document.body.appendChild(badge);

  let badgeTimer = 0;
  const showBadge = () => {
    badge.dataset.recent = 'true';
    clearTimeout(badgeTimer);
    badgeTimer = setTimeout(() => { badge.dataset.recent = 'false'; }, 2600);
  };

  const applyTier = (tier, reason = 'adaptive') => {
    if (!allowed.has(tier)) return false;
    if (state.tier === tier && document.documentElement.dataset.verityPerf === tier) return false;
    state.tier = tier;
    document.documentElement.dataset.verityPerf = tier;
    badge.textContent = `FX ${tier.toUpperCase()} · ${Math.round(state.fps)} FPS`;
    showBadge();

    const scene = window.__VERITY_GAME__?.scene?.getScene?.('Game');
    if (scene?.cameras?.main) {
      scene.cameras.main.roundPixels = tier !== 'high';
    }

    window.dispatchEvent(new CustomEvent('verity:performance-tier', {
      detail: { tier, fps: state.fps, reason },
    }));
    console.info('[VERITY] performance tier', tier, reason, Math.round(state.fps));
    return true;
  };

  const initialTier = state.forced || (reducedMotion ? 'low' : 'high');
  applyTier(initialTier, state.forced ? 'query' : reducedMotion ? 'reduced-motion' : 'initial');

  const evaluate = now => {
    const elapsed = now - state.lastEvaluation;
    if (elapsed < 2200) return;
    state.lastEvaluation = now;

    const valid = state.samples.filter(value => Number.isFinite(value) && value > 0 && value < 250);
    state.samples.length = 0;
    if (!valid.length) return;

    const avgFrame = valid.reduce((sum, value) => sum + value, 0) / valid.length;
    state.fps = Math.min(60, 1000 / avgFrame);
    badge.textContent = `FX ${state.tier.toUpperCase()} · ${Math.round(state.fps)} FPS`;

    if (state.forced || reducedMotion || qa || document.hidden) return;

    if (state.fps < 42) {
      state.lowWindows += 1;
      state.highWindows = 0;
    } else if (state.fps > 55) {
      state.highWindows += 1;
      state.lowWindows = 0;
    } else {
      state.lowWindows = Math.max(0, state.lowWindows - 1);
      state.highWindows = Math.max(0, state.highWindows - 1);
    }

    // Hysteresis prevents effect quality from flickering around the threshold.
    if (state.tier === 'high' && state.lowWindows >= 2) {
      applyTier('balanced', 'sustained-frame-drop');
      state.lowWindows = 0;
    } else if (state.tier === 'balanced' && state.lowWindows >= 2) {
      applyTier('low', 'sustained-frame-drop');
      state.lowWindows = 0;
    } else if (state.tier === 'low' && state.highWindows >= 4) {
      applyTier('balanced', 'sustained-recovery');
      state.highWindows = 0;
    } else if (state.tier === 'balanced' && state.highWindows >= 5) {
      applyTier('high', 'sustained-recovery');
      state.highWindows = 0;
    }
  };

  const frame = now => {
    const delta = now - state.lastFrame;
    state.lastFrame = now;
    if (!document.hidden && delta < 250) state.samples.push(delta);
    evaluate(now);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  document.addEventListener('visibilitychange', () => {
    state.samples.length = 0;
    state.lastFrame = performance.now();
    state.lastEvaluation = performance.now();
  });

  const api = {
    get state() {
      return { ...state, samples: undefined };
    },
    setTier(tier) {
      if (!allowed.has(tier)) return false;
      state.forced = tier;
      return applyTier(tier, 'manual');
    },
    clearOverride() {
      state.forced = null;
      state.lowWindows = 0;
      state.highWindows = 0;
      return applyTier(reducedMotion ? 'low' : 'high', 'override-cleared');
    },
    effectsBudget() {
      return state.tier === 'high' ? 1 : state.tier === 'balanced' ? .65 : .28;
    },
  };

  window.__VERITY_PERF__ = api;
})();
