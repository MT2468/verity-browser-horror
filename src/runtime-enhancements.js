(() => {
  const Phaser = window.Phaser;
  if (!Phaser) return;

  const wait = setInterval(() => {
    const scene = window.__VERITY_GAME__?.scene?.getScene('Game');
    if (!scene?.started || !scene.player || !scene.verity) return;
    clearInterval(wait);
    if (scene.__verityEnhanced) return;
    scene.__verityEnhanced = true;

    // --- Player readability -------------------------------------------------
    // Replace the intentionally tiny first-pass sprite with a clearer top-down
    // survival silhouette without importing external art.
    if (!scene.textures.exists('playerPolished')) {
      const g = scene.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0x0a0d0b, .38).fillEllipse(24, 40, 34, 13);
      g.fillStyle(0x1b231e, 1).fillRect(12, 21, 24, 23);
      g.fillStyle(0x5a705e, 1).fillRect(15, 18, 18, 22);
      g.fillStyle(0xc9c2aa, 1).fillRect(15, 6, 18, 15);
      g.fillStyle(0x252c26, 1).fillRect(14, 5, 20, 5);
      g.fillStyle(0x202520, 1).fillRect(15, 40, 8, 7).fillRect(26, 40, 8, 7);
      g.fillStyle(0xdde4d9, .8).fillRect(18, 11, 3, 2).fillRect(27, 11, 3, 2);
      g.generateTexture('playerPolished', 48, 48);
      g.destroy();
    }
    scene.player.setTexture('playerPolished');

    // --- Enemy spawn correctness -------------------------------------------
    // The original implementation seeded every supplemental spawn identically,
    // which could stack late-game shadows on the exact same coordinates.
    const originalSpawnShadows = scene.spawnShadows;
    scene.__shadowSpawnSerial = 0;
    scene.spawnShadows = function spawnShadowsUnique(count, aggression) {
      this.__shadowSpawnSerial += 1;
      const rng = new Phaser.Math.RandomDataGenerator([
        `shadows-${this.day}-${this.__shadowSpawnSerial}`,
      ]);
      for (let i = 0; i < count; i += 1) {
        const angle = rng.realInRange(0, Math.PI * 2);
        const radius = rng.between(650, 1050);
        const x = Phaser.Math.Clamp(this.player.x + Math.cos(angle) * radius, 80, 2520);
        const y = Phaser.Math.Clamp(this.player.y + Math.sin(angle) * radius, 80, 1820);
        const shadow = this.hazards.create(x, y, 'shadow').setDepth(7).setAlpha(.2 + aggression * .55);
        shadow.setData('speed', 55 + aggression * 92 + rng.between(-12, 18));
        shadow.setData('wander', rng.realInRange(0, Math.PI * 2));
        shadow.setData('aggression', aggression);
        shadow.body.setSize(34, 34).setOffset(7, 7);
      }
    };
    scene.spawnShadows.__original = originalSpawnShadows;

    const originalSetupDay = scene.setupDay;
    scene.setupDay = function setupDayEnhanced(day) {
      this.__shadowSpawnSerial = 0;
      const result = originalSetupDay.call(this, day);
      if (this.player?.active) this.player.setTexture('playerPolished');
      return result;
    };

    // --- Tap / click movement ----------------------------------------------
    // Keyboard remains the primary scheme. Clicking or tapping the world sets a
    // destination, making the game playable on touchscreens as well.
    const marker = scene.add.circle(0, 0, 12, 0xf3e938, .08)
      .setStrokeStyle(2, 0xf3e938, .7)
      .setDepth(20)
      .setVisible(false);
    scene.__tapTarget = null;
    scene.__tapSprint = false;

    scene.input.on('pointerdown', pointer => {
      if (scene.pausedByUI || scene.transitioning) return;
      if (!Number.isFinite(pointer.worldX) || !Number.isFinite(pointer.worldY)) return;
      scene.__tapTarget = {
        x: Phaser.Math.Clamp(pointer.worldX, 20, 2580),
        y: Phaser.Math.Clamp(pointer.worldY, 20, 1880),
      };
      marker.setPosition(scene.__tapTarget.x, scene.__tapTarget.y).setVisible(true).setScale(.55).setAlpha(1);
      scene.tweens.add({ targets: marker, scale: 1.5, alpha: .1, duration: 480, ease: 'Quad.Out' });
    });

    const originalUpdatePlayer = scene.updatePlayer;
    scene.updatePlayer = function updatePlayerEnhanced(dt) {
      const keyboardMoving = this.keys.left.isDown || this.keys.left2.isDown ||
        this.keys.right.isDown || this.keys.right2.isDown ||
        this.keys.up.isDown || this.keys.up2.isDown ||
        this.keys.down.isDown || this.keys.down2.isDown;

      originalUpdatePlayer.call(this, dt);
      if (keyboardMoving) {
        this.__tapTarget = null;
        marker.setVisible(false);
        return;
      }

      if (!this.__tapTarget) return;
      const dx = this.__tapTarget.x - this.player.x;
      const dy = this.__tapTarget.y - this.player.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 15) {
        this.__tapTarget = null;
        marker.setVisible(false);
        this.player.setVelocity(0, 0);
        return;
      }

      const sprinting = this.__tapSprint && this.stamina > 2;
      const speed = sprinting ? 285 : 175;
      this.player.setVelocity((dx / dist) * speed, (dy / dist) * speed);
      if (sprinting) this.stamina = Phaser.Math.Clamp(this.stamina - 31 * dt, 0, 100);
    };

    // --- Thematic objective compass ----------------------------------------
    const compass = document.createElement('div');
    compass.id = 'signalCompass';
    compass.style.cssText = 'position:fixed;left:24px;top:108px;z-index:11;padding:6px 9px;border:1px solid rgba(237,245,235,.14);background:rgba(5,8,6,.66);color:#8f9c8e;font:9px/1.2 "IBM Plex Mono",monospace;letter-spacing:.12em;pointer-events:none';
    compass.textContent = 'ECO --';
    document.body.appendChild(compass);

    const arrows = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'];
    const updateCompass = () => {
      if (!scene.started || scene.scene.isPaused()) return;
      let target = null;
      if (scene.finalExitReady && scene.exitDoor?.active) {
        target = scene.exitDoor;
      } else {
        let best = Infinity;
        scene.objectives?.getChildren()?.forEach(object => {
          if (!object.active || object.getData('done')) return;
          const d = Phaser.Math.Distance.Between(scene.player.x, scene.player.y, object.x, object.y);
          if (d < best) { best = d; target = object; }
        });
      }

      if (!target || scene.day === 4) {
        compass.textContent = 'ECO --';
        return;
      }
      const dx = target.x - scene.player.x;
      const dy = target.y - scene.player.y;
      const angle = Math.atan2(dy, dx);
      const normalized = (angle + Math.PI * 2) % (Math.PI * 2);
      const index = Math.round(normalized / (Math.PI / 4)) % 8;
      const meters = Math.max(1, Math.round(Math.hypot(dx, dy) / 32));
      compass.textContent = `ECO ${String(meters).padStart(2, '0')}m ${arrows[index]}`;
    };
    scene.time.addEvent({ delay: 220, loop: true, callback: updateCompass });

    // --- Touch controls -----------------------------------------------------
    const touchLike = matchMedia('(pointer: coarse)').matches || innerWidth < 780;
    if (touchLike) {
      const controls = document.createElement('div');
      controls.id = 'touchControls';
      controls.style.cssText = 'position:fixed;left:12px;right:12px;bottom:15px;z-index:14;display:flex;justify-content:space-between;gap:8px;pointer-events:none';
      controls.innerHTML = `
        <button data-touch="sprint">CORRER</button>
        <span style="flex:1"></span>
        <button data-touch="light">LUZ</button>
        <button data-touch="interact">USAR</button>`;
      document.body.appendChild(controls);
      controls.querySelectorAll('button').forEach(button => {
        button.style.cssText = 'width:auto;min-width:72px;margin:0;padding:12px 13px;border:1px solid rgba(243,234,54,.25);background:rgba(5,8,6,.8);color:#f3ea36;font:700 10px monospace;pointer-events:auto;touch-action:manipulation';
      });

      const sprintButton = controls.querySelector('[data-touch="sprint"]');
      const setSprint = value => {
        scene.__tapSprint = value;
        sprintButton.style.background = value ? 'rgba(243,234,54,.2)' : 'rgba(5,8,6,.8)';
      };
      sprintButton.addEventListener('pointerdown', () => setSprint(true));
      sprintButton.addEventListener('pointerup', () => setSprint(false));
      sprintButton.addEventListener('pointercancel', () => setSprint(false));

      controls.querySelector('[data-touch="light"]').addEventListener('click', () => {
        scene.flashlightOn = !scene.flashlightOn;
        const indicator = document.querySelector('#flashlightIndicator');
        if (indicator) indicator.innerHTML = `LANTERNA <b>${scene.flashlightOn ? 'ON' : 'OFF'}</b>`;
      });

      controls.querySelector('[data-touch="interact"]').addEventListener('click', () => {
        if (scene.finalExitReady && scene.exitDoor && Phaser.Math.Distance.Between(scene.player.x, scene.player.y, scene.exitDoor.x, scene.exitDoor.y) < 100) {
          scene.finishGame();
          return;
        }
        let target = null;
        let best = 96;
        scene.objectives?.getChildren()?.forEach(object => {
          if (!object.active || object.getData('done')) return;
          const d = Phaser.Math.Distance.Between(scene.player.x, scene.player.y, object.x, object.y);
          if (d < best) { best = d; target = object; }
        });
        if (target) scene.completeTarget(target);
      });
    }

    console.info('[VERITY] runtime enhancements active', window.__VERITY_BUILD__);
  }, 100);
})();
