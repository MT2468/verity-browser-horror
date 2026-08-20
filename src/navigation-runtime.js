(() => {
  const Phaser = window.Phaser;
  if (!Phaser) return;

  const attach = setInterval(() => {
    const scene = window.__VERITY_GAME__?.scene?.getScene('Game');
    const compass = document.querySelector('#signalCompass');
    if (!scene?.started || !scene.player || !compass) return;
    clearInterval(attach);

    const arrows = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'];
    const findTarget = () => {
      if (scene.finalExitReady && scene.exitDoor?.active) return scene.exitDoor;
      let nearest = null;
      let bestDistance = Infinity;
      for (const object of scene.objectives?.getChildren?.() || []) {
        if (!object?.active || object.getData?.('done')) continue;
        const d = Phaser.Math.Distance.Between(scene.player.x, scene.player.y, object.x, object.y);
        if (d < bestDistance) {
          bestDistance = d;
          nearest = object;
        }
      }
      return nearest;
    };

    const render = () => {
      if (!scene.scene?.isActive?.() || !scene.player?.active || scene.day === 4) {
        compass.textContent = 'ECO --';
        return;
      }

      const target = findTarget();
      if (!target) {
        compass.textContent = 'ECO --';
        return;
      }

      const dx = target.x - scene.player.x;
      const dy = target.y - scene.player.y;
      const angle = (Math.atan2(dy, dx) + Math.PI * 2) % (Math.PI * 2);
      const direction = arrows[Math.round(angle / (Math.PI / 4)) % 8];
      const distanceM = Math.max(1, Math.round(Math.hypot(dx, dy) / 32));
      compass.textContent = `ECO ${String(distanceM).padStart(2, '0')}m ${direction}`;
    };

    render();
    const timer = window.setInterval(render, 180);
    scene.events.once('shutdown', () => window.clearInterval(timer));
    scene.events.once('destroy', () => window.clearInterval(timer));
  }, 100);
})();
