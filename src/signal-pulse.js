(() => {
  const Phaser = window.Phaser;
  if (!Phaser) return;

  const ATTACH_MS = 100;
  const COOLDOWN_MS = 8000;
  const REVEAL_MS = 1800;
  const SIGNAL_COST = 14;

  const attach = window.setInterval(() => {
    const scene = window.__VERITY_GAME__?.scene?.getScene('Game');
    if (!scene?.started || !scene.player?.active || !scene.objectives || !scene.hazards) return;
    window.clearInterval(attach);
    if (scene.__signalPulseAttached) return;
    scene.__signalPulseAttached = true;

    const style = document.createElement('style');
    style.textContent = `
      #pulseStatus{position:fixed;left:24px;top:138px;z-index:11;padding:6px 9px;border:1px solid rgba(237,245,235,.14);background:rgba(5,8,6,.66);color:#8f9c8e;font:9px/1.2 monospace;letter-spacing:.12em;pointer-events:none;transition:color .18s,border-color .18s}
      #pulseStatus.ready{color:#f3ea36;border-color:rgba(243,234,54,.28)}
      #pulseStatus.hot{color:#ff7c66;border-color:rgba(255,124,102,.35)}
      #pulseHint{position:fixed;left:50%;bottom:48px;transform:translateX(-50%);z-index:15;padding:7px 10px;background:rgba(5,8,6,.82);border:1px solid rgba(243,234,54,.24);color:#f3ea36;font:700 10px/1 monospace;letter-spacing:.1em;pointer-events:none;opacity:0;transition:opacity .15s}
      #pulseHint.show{opacity:1}
      @media(max-width:780px),(pointer:coarse){#pulseStatus{left:12px;top:126px}#pulseHint{bottom:74px}}
    `;
    document.head.appendChild(style);

    const status = document.createElement('div');
    status.id = 'pulseStatus';
    status.setAttribute('aria-live', 'polite');
    document.body.appendChild(status);

    const hint = document.createElement('div');
    hint.id = 'pulseHint';
    hint.textContent = 'Q · PULSO DE SINAL';
    document.body.appendChild(hint);

    let lastPulse = -Infinity;
    let revealUntil = 0;
    let hintTimer = 0;
    let pulseRing = null;
    let destroyed = false;

    const signalCap = () => Phaser.Math.Clamp(Number(scene.signal) || 0, 0, 100);
    const cooldownLeft = now => Math.max(0, COOLDOWN_MS - (now - lastPulse));

    const showHint = text => {
      hint.textContent = text;
      hint.classList.add('show');
      window.clearTimeout(hintTimer);
      hintTimer = window.setTimeout(() => hint.classList.remove('show'), 1400);
    };

    const revealEntity = (entity, color) => {
      if (!entity?.active || typeof entity.setTint !== 'function') return;
      entity.setTint(color);
      if (typeof entity.setScale === 'function') {
        scene.tweens.add({ targets: entity, scaleX: 1.14, scaleY: 1.14, duration: 140, yoyo: true, ease: 'Sine.Out' });
      }
    };

    const clearReveals = () => {
      for (const object of scene.objectives?.getChildren?.() || []) {
        if (object?.active && typeof object.clearTint === 'function') object.clearTint();
      }
      for (const hazard of scene.hazards?.getChildren?.() || []) {
        if (hazard?.active && typeof hazard.clearTint === 'function') hazard.clearTint();
      }
      if (scene.verity?.active && typeof scene.verity.clearTint === 'function') scene.verity.clearTint();
      if (scene.exitDoor?.active && typeof scene.exitDoor.clearTint === 'function') scene.exitDoor.clearTint();
    };

    const emitPulse = () => {
      const now = performance.now();
      if (destroyed || scene.pausedByUI || scene.transitioning || scene.scene?.isPaused?.()) return false;
      if (cooldownLeft(now) > 0) {
        showHint(`PULSO RECARREGANDO · ${Math.ceil(cooldownLeft(now) / 1000)}s`);
        return false;
      }
      if (signalCap() > 86) {
        showHint('SINAL SATURADO · ESPERE BAIXAR');
        return false;
      }

      lastPulse = now;
      revealUntil = now + REVEAL_MS;
      scene.signal = Phaser.Math.Clamp(signalCap() + SIGNAL_COST, 0, 100);

      if (pulseRing?.active) pulseRing.destroy();
      pulseRing = scene.add.circle(scene.player.x, scene.player.y, 24, 0xf3ea36, 0)
        .setStrokeStyle(4, 0xf3ea36, .85)
        .setDepth(30);
      scene.tweens.add({
        targets: pulseRing,
        radius: 430,
        alpha: 0,
        duration: 760,
        ease: 'Quad.Out',
        onComplete: () => {
          if (pulseRing?.active) pulseRing.destroy();
          pulseRing = null;
        },
      });

      let nearest = null;
      let nearestDistance = Infinity;
      for (const object of scene.objectives?.getChildren?.() || []) {
        if (!object?.active || object.getData?.('done')) continue;
        const d = Phaser.Math.Distance.Between(scene.player.x, scene.player.y, object.x, object.y);
        if (d <= 720) revealEntity(object, 0xf3ea36);
        if (d < nearestDistance) {
          nearestDistance = d;
          nearest = object;
        }
      }
      if (scene.finalExitReady && scene.exitDoor?.active) {
        nearest = scene.exitDoor;
        nearestDistance = Phaser.Math.Distance.Between(scene.player.x, scene.player.y, nearest.x, nearest.y);
        revealEntity(nearest, 0xf3ea36);
      }

      let dangerCount = 0;
      for (const hazard of scene.hazards?.getChildren?.() || []) {
        if (!hazard?.active) continue;
        const d = Phaser.Math.Distance.Between(scene.player.x, scene.player.y, hazard.x, hazard.y);
        if (d <= 820) {
          revealEntity(hazard, 0xff594d);
          dangerCount += 1;
          const speed = Number(hazard.getData?.('speed')) || 0;
          if (speed > 0) hazard.setData('speed', Math.min(220, speed + 6));
        }
      }

      if (scene.verity?.active && scene.day >= 5) revealEntity(scene.verity, 0xffd94d);

      const targetText = nearest ? `${Math.max(1, Math.round(nearestDistance / 32))}m` : 'SEM ECO';
      showHint(`ECO ${targetText} · AMEAÇAS ${dangerCount}`);
      return true;
    };

    let pulseButton = null;
    const touchControls = document.querySelector('#touchControls');
    if (touchControls) {
      pulseButton = document.createElement('button');
      pulseButton.type = 'button';
      pulseButton.dataset.touch = 'pulse';
      pulseButton.textContent = 'PULSO';
      pulseButton.style.cssText = 'width:auto;min-width:72px;margin:0;padding:12px 13px;border:1px solid rgba(243,234,54,.25);background:rgba(5,8,6,.8);color:#f3ea36;font:700 10px monospace;pointer-events:auto;touch-action:manipulation';
      pulseButton.addEventListener('click', emitPulse);
      touchControls.insertBefore(pulseButton, touchControls.lastElementChild);
    }

    const updateStatus = () => {
      if (destroyed) return;
      const now = performance.now();
      const left = cooldownLeft(now);
      status.classList.toggle('ready', left <= 0 && signalCap() <= 86);
      status.classList.toggle('hot', signalCap() > 86);
      if (signalCap() > 86) status.textContent = 'PULSO · SINAL ALTO';
      else if (left <= 0) status.textContent = 'PULSO Q · PRONTO';
      else status.textContent = `PULSO · ${Math.ceil(left / 1000)}s`;

      if (revealUntil && now > revealUntil) {
        revealUntil = 0;
        clearReveals();
      }
    };

    const onPulseKey = event => {
      if (event?.repeat) return;
      emitPulse();
    };
    scene.input.keyboard.on('keydown-Q', onPulseKey);
    const statusTimer = window.setInterval(updateStatus, 150);
    updateStatus();

    window.__VERITY_PULSE__ = {
      emit: emitPulse,
      getState: () => ({
        ready: cooldownLeft(performance.now()) <= 0 && signalCap() <= 86,
        cooldownMs: cooldownLeft(performance.now()),
        signal: signalCap(),
        revealing: revealUntil > performance.now(),
      }),
    };

    const cleanup = () => {
      if (destroyed) return;
      destroyed = true;
      window.clearInterval(statusTimer);
      window.clearTimeout(hintTimer);
      clearReveals();
      status.remove();
      hint.remove();
      style.remove();
      if (pulseButton) pulseButton.remove();
      if (pulseRing?.active) pulseRing.destroy();
      scene.input.keyboard.off('keydown-Q', onPulseKey);
      if (window.__VERITY_PULSE__?.emit === emitPulse) delete window.__VERITY_PULSE__;
    };

    scene.events.once('shutdown', cleanup);
    scene.events.once('destroy', cleanup);
    console.info('[VERITY] signal pulse mechanic active');
  }, ATTACH_MS);
})();
