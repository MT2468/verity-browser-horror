(() => {
  const Phaser = window.Phaser;
  if (!Phaser) return;

  const params = new URLSearchParams(location.search);
  const qaMode = params.get('qa') === '1';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const MIN_GAP_MS = 10500;
  const TICK_MS = 1200;

  const attach = window.setInterval(() => {
    const scene = window.__VERITY_GAME__?.scene?.getScene('Game');
    if (!scene?.started || !scene.player?.active || !scene.verity?.active) return;
    window.clearInterval(attach);
    if (scene.__psychDirectorAttached) return;
    scene.__psychDirectorAttached = true;

    let destroyed = false;
    let lastBeatAt = performance.now();
    let beatSerial = 0;
    let activeApparition = null;
    let activeEcho = null;
    let restoreDarknessTimer = 0;
    let directorTimer = 0;

    const lines = {
      1: ['Você está indo muito bem.', 'Eu gosto quando você me escuta.'],
      2: ['Você lembra de ter vindo por aqui?', 'Não foi isso que aconteceu ontem.'],
      3: ['A luz não impede que eles vejam você.', 'Eu ouvi você dormindo.'],
      4: ['Continue correndo.', 'Você não precisa olhar para trás para saber.'],
      5: ['Ainda dá tempo de parar.', 'Eu posso esquecer isso se você quiser.'],
      6: ['A porta não leva para casa.', 'Você acha que sair significa ir embora?'],
    };

    const directorState = () => ({
      attached: !destroyed,
      day: scene.day,
      serial: beatSerial,
      lastBeatAt,
      reducedMotion,
      qaMode,
      apparitionActive: Boolean(activeApparition?.active),
      echoActive: Boolean(activeEcho?.active),
    });

    const safeToInterrupt = () => {
      if (destroyed || !scene.started || scene.pausedByUI || scene.transitioning) return false;
      if (scene.scene?.isPaused?.()) return false;
      return true;
    };

    const cleanupTransient = () => {
      if (activeApparition?.active) activeApparition.destroy();
      if (activeEcho?.active) activeEcho.destroy();
      activeApparition = null;
      activeEcho = null;
      window.clearTimeout(restoreDarknessTimer);
    };

    const beatWhisper = () => {
      if (!safeToInterrupt()) return false;
      const pool = lines[scene.day] || lines[6];
      const line = pool[beatSerial % pool.length];
      scene.say('VERITY', line, 2500);
      if (scene.day >= 3) scene.signal = Phaser.Math.Clamp((Number(scene.signal) || 0) + 1.5, 0, 99);
      return true;
    };

    const beatFalseEcho = () => {
      if (!safeToInterrupt() || scene.day < 2) return false;
      if (activeEcho?.active) activeEcho.destroy();
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const radius = Phaser.Math.Between(210, 430);
      const x = Phaser.Math.Clamp(scene.player.x + Math.cos(angle) * radius, 60, 2540);
      const y = Phaser.Math.Clamp(scene.player.y + Math.sin(angle) * radius, 60, 1840);
      activeEcho = scene.add.circle(x, y, 17, 0xf3e938, .06)
        .setStrokeStyle(2, 0xf3e938, .52)
        .setDepth(18);
      scene.tweens.add({
        targets: activeEcho,
        alpha: { from: .7, to: .05 },
        scale: { from: .65, to: 1.45 },
        duration: reducedMotion ? 900 : 1550,
        yoyo: true,
        repeat: 1,
        onComplete: () => {
          if (activeEcho?.active) activeEcho.destroy();
          activeEcho = null;
        },
      });
      scene.showWarning('ECO NÃO IDENTIFICADO', 900);
      return true;
    };

    const beatApparition = () => {
      if (!safeToInterrupt() || scene.day < 3) return false;
      if (activeApparition?.active) activeApparition.destroy();
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const radius = Phaser.Math.Between(330, 520);
      const x = Phaser.Math.Clamp(scene.player.x + Math.cos(angle) * radius, 80, 2520);
      const y = Phaser.Math.Clamp(scene.player.y + Math.sin(angle) * radius, 80, 1820);
      const texture = scene.day >= 5 ? 'verityMonster' : 'verity';
      activeApparition = scene.add.image(x, y, texture)
        .setDepth(7)
        .setTint(scene.day >= 5 ? 0x5f170f : 0xb8ad29)
        .setAlpha(.16)
        .setScale(scene.day >= 5 ? .9 : .78);
      scene.tweens.add({
        targets: activeApparition,
        alpha: { from: .08, to: .55 },
        duration: reducedMotion ? 500 : 950,
        yoyo: true,
        hold: reducedMotion ? 250 : 700,
        onComplete: () => {
          if (activeApparition?.active) activeApparition.destroy();
          activeApparition = null;
        },
      });
      return true;
    };

    const beatBrownout = () => {
      if (!safeToInterrupt() || scene.day < 3 || !scene.darkness) return false;
      const before = scene.darkness.alpha;
      scene.darkness.setAlpha(Phaser.Math.Clamp(before + .16 + scene.day * .012, 0, .76));
      scene.showWarning(scene.day >= 5 ? 'NÃO DESLIGUE A TELA' : 'QUEDA DE SINAL', 650);
      if (!reducedMotion) scene.glitch(scene.day >= 5);
      window.clearTimeout(restoreDarknessTimer);
      restoreDarknessTimer = window.setTimeout(() => {
        if (!destroyed && scene.darkness?.active) scene.darkness.setAlpha(before);
      }, reducedMotion ? 450 : 900);
      return true;
    };

    const beats = {
      whisper: beatWhisper,
      echo: beatFalseEcho,
      apparition: beatApparition,
      brownout: beatBrownout,
    };

    const eligibleBeats = () => {
      if (scene.day <= 1) return ['whisper'];
      if (scene.day === 2) return ['whisper', 'echo'];
      if (scene.day <= 4) return ['whisper', 'echo', 'apparition', 'brownout'];
      return ['echo', 'apparition', 'brownout', 'whisper', 'apparition'];
    };

    const forceBeat = name => {
      const fn = beats[name];
      if (!fn) return false;
      const ok = fn();
      if (ok) {
        beatSerial += 1;
        lastBeatAt = performance.now();
      }
      return ok;
    };

    const tick = () => {
      if (!safeToInterrupt() || qaMode) return;
      const now = performance.now();
      if (now - lastBeatAt < MIN_GAP_MS) return;

      const signal = Phaser.Math.Clamp(Number(scene.signal) || 0, 0, 100);
      const dayPressure = (scene.day - 1) * .055;
      const signalPressure = signal * .0018;
      const chance = Math.min(.52, .12 + dayPressure + signalPressure);
      if (Math.random() > chance) return;

      const pool = eligibleBeats();
      const name = pool[(beatSerial + Phaser.Math.Between(0, pool.length - 1)) % pool.length];
      forceBeat(name);
    };

    directorTimer = window.setInterval(tick, TICK_MS);

    window.__VERITY_DIRECTOR__ = {
      getState: directorState,
      forceBeat,
      available: () => eligibleBeats().slice(),
    };

    const cleanup = () => {
      if (destroyed) return;
      destroyed = true;
      window.clearInterval(directorTimer);
      cleanupTransient();
      if (window.__VERITY_DIRECTOR__?.forceBeat === forceBeat) delete window.__VERITY_DIRECTOR__;
    };

    scene.events.once('shutdown', cleanup);
    scene.events.once('destroy', cleanup);
    console.info('[VERITY] psychological director active', directorState());
  }, 100);
})();
