const Phaser = window.Phaser;

const UI = {
  boot: document.querySelector('#boot'),
  start: document.querySelector('#startBtn'),
  continue: document.querySelector('#continueBtn'),
  hud: document.querySelector('#hud'),
  pause: document.querySelector('#pause'),
  resume: document.querySelector('#resumeBtn'),
  restart: document.querySelector('#restartBtn'),
  reset: document.querySelector('#resetBtn'),
  ending: document.querySelector('#ending'),
  endingTitle: document.querySelector('#endingTitle'),
  endingText: document.querySelector('#endingText'),
  playAgain: document.querySelector('#playAgainBtn'),
  day: document.querySelector('#dayLabel'),
  objective: document.querySelector('#objectiveLabel'),
  objectiveBar: document.querySelector('#objectiveBar'),
  stamina: document.querySelector('#staminaBar'),
  signal: document.querySelector('#signalBar'),
  prompt: document.querySelector('#prompt'),
  dialogue: document.querySelector('#dialogue'),
  speaker: document.querySelector('#speaker'),
  dialogueText: document.querySelector('#dialogueText'),
  flashlight: document.querySelector('#flashlightIndicator'),
  warning: document.querySelector('#warning'),
  vignette: document.querySelector('#vignette'),
  glitch: document.querySelector('#glitchFlash'),
};

const SAVE_KEY = 'verity-browser-horror-save-v2';
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const distance = (a, b) => Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.drone = null;
    this.droneGain = null;
  }

  unlock() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.28;
    this.master.connect(this.ctx.destination);

    this.drone = this.ctx.createOscillator();
    this.drone.type = 'sine';
    this.drone.frequency.value = 41;
    this.droneGain = this.ctx.createGain();
    this.droneGain.gain.value = 0.018;
    this.drone.connect(this.droneGain).connect(this.master);
    this.drone.start();
  }

  setHorror(amount) {
    if (!this.ctx || !this.drone) return;
    const t = this.ctx.currentTime;
    this.drone.frequency.linearRampToValueAtTime(41 + amount * 0.13, t + 0.25);
    this.droneGain.gain.linearRampToValueAtTime(0.012 + amount * 0.00035, t + 0.25);
  }

  tone(freq = 440, duration = 0.08, volume = 0.08, type = 'square', delay = 0) {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), t + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + duration + 0.03);
  }

  click() { this.tone(660, 0.035, 0.035, 'square'); }
  pickup() { this.tone(440, 0.05, 0.05, 'sine'); this.tone(880, 0.08, 0.035, 'sine', 0.05); }
  scare() {
    this.tone(70, 0.35, 0.18, 'sawtooth');
    this.tone(53, 0.42, 0.12, 'square', 0.04);
    this.tone(910, 0.08, 0.05, 'square', 0.08);
  }
}

const audio = new AudioEngine();

const DAY_DEFS = {
  1: {
    title: 'Colete os 3 fragmentos de sinal',
    type: 'fragment', count: 3,
    intro: ['Olá! Eu sou Verity. : )', 'Encontrei três sinais estranhos por perto. Vamos conferir juntos?'],
  },
  2: {
    title: 'Inspecione as 4 marcas no chão',
    type: 'mark', count: 4,
    intro: ['Você dormiu bem?', 'Eu fiquei acordada. Eu sempre fico.'],
  },
  3: {
    title: 'Acenda as 3 lanternas',
    type: 'lantern', count: 3,
    intro: ['A noite está mais escura do que deveria.', 'Não desligue a sua lanterna.'],
  },
  4: {
    title: 'Sobreviva até o amanhecer',
    type: 'survive', count: 35,
    intro: ['Não olhe para trás.', 'Eu disse: NÃO OLHE PARA TRÁS.'],
  },
  5: {
    title: 'Rompa os 3 terminais de conexão',
    type: 'terminal', count: 3,
    intro: ['Por que você está tentando me desligar?', 'Eu só estava ajudando.'],
  },
  6: {
    title: 'Destrua as 4 âncoras e encontre a saída',
    type: 'anchor', count: 4,
    intro: ['VOCÊ NÃO PRECISA IR.', 'EU JÁ SEI ONDE VOCÊ VAI.'],
  },
};

class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
    this.day = 1;
    this.progress = 0;
    this.signal = 0;
    this.stamina = 100;
    this.flashlightOn = true;
    this.started = false;
    this.pausedByUI = false;
    this.interactCooldown = 0;
    this.hitCooldown = 0;
    this.surviveElapsed = 0;
    this.finalExitReady = false;
    this.dialogueTimer = null;
  }

  init(data) {
    this.day = clamp(Number(data.day || 1), 1, 6);
  }

  create() {
    this.makeTextures();
    this.physics.world.setBounds(0, 0, 2600, 1900);
    this.cameras.main.setBounds(0, 0, 2600, 1900);
    this.cameras.main.setBackgroundColor('#0a0f0a');

    this.drawWorld();
    this.objectives = this.add.group();
    this.hazards = this.physics.add.group();
    this.decor = this.add.group();

    this.player = this.physics.add.sprite(520, 510, 'player').setDepth(9);
    this.player.setCollideWorldBounds(true);
    this.player.body.setSize(30, 30).setOffset(9, 9);

    this.verity = this.physics.add.sprite(650, 510, 'verity').setDepth(8);
    this.verity.body.setAllowGravity(false);
    this.verity.setCollideWorldBounds(true);

    this.cameras.main.startFollow(this.player, true, 0.085, 0.085);
    this.cameras.main.setZoom(1.05);

    this.darkness = this.add.rectangle(0, 0, 1280, 720, 0x000000, 0.12)
      .setOrigin(0).setScrollFactor(0).setDepth(50).setBlendMode(Phaser.BlendModes.MULTIPLY);

    this.keys = this.input.keyboard.addKeys({
      up: 'W', down: 'S', left: 'A', right: 'D',
      up2: 'UP', down2: 'DOWN', left2: 'LEFT', right2: 'RIGHT',
      sprint: 'SHIFT', interact: 'E', flashlight: 'F', pause: 'ESC',
    });

    this.physics.add.overlap(this.player, this.hazards, this.onHazardTouch, undefined, this);

    this.events.on('shutdown', () => {
      if (this.dialogueTimer) clearInterval(this.dialogueTimer);
    });

    UI.hud.classList.remove('hidden');
    UI.pause.classList.add('hidden');
    UI.ending.classList.add('hidden');
    this.setupDay(this.day);
    this.started = true;
  }

  makeTextures() {
    const g = this.make.graphics({ x: 0, y: 0, add: false });

    g.clear();
    g.fillStyle(0x28362c, 1).fillRect(0, 0, 48, 48);
    g.fillStyle(0x5e7d63, 1).fillRect(8, 8, 32, 32);
    g.fillStyle(0xc8d5c3, 1).fillRect(15, 11, 18, 12);
    g.fillStyle(0x1a211c, 1).fillRect(12, 28, 10, 14).fillRect(26, 28, 10, 14);
    g.generateTexture('player', 48, 48);

    g.clear();
    g.fillStyle(0xf3e938, 1).fillCircle(32, 32, 28);
    g.fillStyle(0x242419, 1).fillCircle(23, 26, 3.5).fillCircle(41, 26, 3.5);
    g.lineStyle(3, 0x242419, 1);
    g.beginPath(); g.moveTo(19, 39); g.lineTo(26, 44); g.lineTo(35, 45); g.lineTo(45, 38); g.strokePath();
    g.generateTexture('verity', 64, 64);

    g.clear();
    g.fillStyle(0xd7cd24, 1).fillEllipse(40, 48, 68, 90);
    g.fillStyle(0x14140f, 1).fillCircle(28, 33, 6).fillCircle(52, 33, 6);
    g.fillStyle(0x170b0b, 1).fillTriangle(17, 58, 63, 58, 40, 80);
    g.fillStyle(0xd8d0b0, 1);
    for (let i = 0; i < 5; i++) g.fillTriangle(22 + i * 8, 58, 26 + i * 8, 58, 24 + i * 8, 68);
    g.generateTexture('verityMonster', 80, 96);

    g.clear();
    g.fillStyle(0x0e130f, 0.92).fillCircle(24, 24, 22);
    g.fillStyle(0xc9d1c6, 0.8).fillCircle(17, 20, 2).fillCircle(31, 20, 2);
    g.generateTexture('shadow', 48, 48);

    g.clear();
    g.fillStyle(0x82e8c8, 1).fillDiamond(18, 18, 13);
    g.lineStyle(2, 0xe8fff8, 0.8).strokeDiamond(18, 18, 13);
    g.generateTexture('fragment', 36, 36);

    g.clear();
    g.lineStyle(5, 0xb66b5e, 1).strokeCircle(24, 24, 17);
    g.lineStyle(3, 0xb66b5e, 1).lineBetween(12, 36, 36, 12).lineBetween(12, 12, 36, 36);
    g.generateTexture('mark', 48, 48);

    g.clear();
    g.fillStyle(0x4b3d29, 1).fillRect(18, 18, 12, 30);
    g.fillStyle(0xffdc72, 1).fillCircle(24, 15, 11);
    g.generateTexture('lantern', 48, 52);

    g.clear();
    g.fillStyle(0x202923, 1).fillRect(2, 2, 60, 60);
    g.lineStyle(3, 0x55665b, 1).strokeRect(2, 2, 60, 60);
    g.fillStyle(0xe85555, 1).fillRect(12, 15, 40, 5);
    g.fillStyle(0x829486, 1).fillRect(12, 29, 27, 5).fillRect(12, 41, 34, 5);
    g.generateTexture('terminal', 64, 64);

    g.clear();
    g.fillStyle(0x27231a, 1).fillCircle(31, 31, 27);
    g.lineStyle(5, 0xf3e938, 0.9).strokeCircle(31, 31, 20);
    g.lineStyle(4, 0x7a271f, 1).lineBetween(12, 31, 50, 31).lineBetween(31, 12, 31, 50);
    g.generateTexture('anchor', 62, 62);

    g.clear();
    g.fillStyle(0xe9eee5, 1).fillRect(0, 0, 70, 8);
    g.fillStyle(0x232923, 1).fillRect(9, 8, 52, 82);
    g.fillStyle(0xf3e938, 1).fillRect(30, 38, 10, 10);
    g.generateTexture('exit', 70, 90);

    g.clear();
    g.fillStyle(0x1b271c, 1).fillRect(0, 0, 54, 78);
    g.fillStyle(0x263b29, 1).fillCircle(27, 20, 24).fillCircle(16, 40, 18).fillCircle(38, 42, 19);
    g.fillStyle(0x34261a, 1).fillRect(22, 44, 10, 34);
    g.generateTexture('tree', 54, 78);

    g.clear();
    g.fillStyle(0x394139, 1).fillEllipse(28, 20, 52, 34);
    g.fillStyle(0x515b50, 1).fillEllipse(19, 16, 19, 13);
    g.generateTexture('rock', 56, 40);

    g.destroy();
  }

  drawWorld() {
    const bg = this.add.graphics().setDepth(-20);
    bg.fillStyle(0x111a12, 1).fillRect(0, 0, 2600, 1900);

    const rng = new Phaser.Math.RandomDataGenerator(['verity-001']);
    for (let y = 0; y < 1900; y += 64) {
      for (let x = 0; x < 2600; x += 64) {
        const c = rng.frac() > .5 ? 0x172219 : 0x142018;
        bg.fillStyle(c, 1).fillRect(x, y, 62, 62);
        if (rng.frac() > .84) bg.fillStyle(0x203022, .7).fillRect(x + 12, y + 12, 8, 18);
      }
    }

    for (let i = 0; i < 115; i++) {
      const x = rng.between(80, 2520), y = rng.between(80, 1820);
      if (Phaser.Math.Distance.Between(x, y, 520, 510) < 300) continue;
      const key = rng.frac() > .28 ? 'tree' : 'rock';
      this.add.image(x, y, key).setDepth(key === 'tree' ? 3 : 1).setAlpha(rng.realInRange(.7, 1));
    }

    // broken house silhouette
    bg.fillStyle(0x16120f, 1).fillRect(1860, 1180, 360, 280);
    bg.lineStyle(9, 0x31271d, 1).strokeRect(1860, 1180, 360, 280);
    bg.fillStyle(0x050605, 1).fillRect(1995, 1300, 84, 160);
    bg.fillStyle(0x7b7134, .35).fillRect(1905, 1230, 70, 55).fillRect(2100, 1230, 70, 55);
  }

  setupDay(day) {
    this.day = day;
    this.progress = 0;
    this.signal = day >= 4 ? 10 : 0;
    this.stamina = 100;
    this.surviveElapsed = 0;
    this.finalExitReady = false;
    this.objectives.clear(true, true);
    this.hazards.clear(true, true);
    if (this.exitDoor) { this.exitDoor.destroy(); this.exitDoor = null; }

    const def = DAY_DEFS[day];
    UI.day.textContent = String(day).padStart(2, '0');
    UI.objective.textContent = def.title;
    UI.objectiveBar.style.width = '0%';
    UI.warning.classList.add('hidden');
    UI.vignette.classList.toggle('danger', day >= 5);

    this.darkness.setAlpha(day === 1 ? .08 : day === 2 ? .13 : day === 3 ? .3 : .43);
    this.verity.setTexture(day >= 5 ? 'verityMonster' : 'verity');
    this.verity.setScale(day >= 5 ? 1.05 : 1);

    this.player.setPosition(520, 510);
    this.verity.setPosition(day >= 5 ? 980 : 650, 510);

    if (def.type !== 'survive') {
      this.spawnObjectives(def.type, def.count);
    } else {
      this.spawnShadows(5, 0.55);
    }

    if (day === 3) this.spawnShadows(3, 0.24);
    if (day === 5) this.spawnShadows(6, 0.72);
    if (day === 6) this.spawnShadows(8, 0.9);

    this.time.delayedCall(400, () => this.playDialogueSequence(def.intro));
    this.save();
  }

  spawnObjectives(type, count) {
    const sets = {
      fragment: [[820, 420], [1370, 760], [2040, 1310]],
      mark: [[760, 1260], [1330, 430], [1810, 820], [2270, 1510]],
      lantern: [[790, 420], [1540, 1120], [2110, 690]],
      terminal: [[730, 1420], [1610, 460], [2130, 1320]],
      anchor: [[760, 440], [1120, 1510], [1880, 590], [2260, 1440]],
    };

    (sets[type] || []).slice(0, count).forEach(([x, y], idx) => {
      const sprite = this.physics.add.staticImage(x, y, type).setDepth(5);
      sprite.setData('kind', type);
      sprite.setData('index', idx);
      sprite.setData('done', false);
      this.objectives.add(sprite);
      this.tweens.add({ targets: sprite, alpha: { from: .62, to: 1 }, duration: 800 + idx * 120, yoyo: true, repeat: -1 });
    });
  }

  spawnShadows(count, aggression) {
    const rng = new Phaser.Math.RandomDataGenerator([`shadows-${this.day}`]);
    for (let i = 0; i < count; i++) {
      const angle = rng.realInRange(0, Math.PI * 2);
      const radius = rng.between(650, 1050);
      const x = clamp(this.player.x + Math.cos(angle) * radius, 80, 2520);
      const y = clamp(this.player.y + Math.sin(angle) * radius, 80, 1820);
      const s = this.hazards.create(x, y, 'shadow').setDepth(7).setAlpha(.2 + aggression * .55);
      s.setData('speed', 55 + aggression * 92 + rng.between(-12, 18));
      s.setData('wander', rng.realInRange(0, Math.PI * 2));
      s.setData('aggression', aggression);
      s.body.setSize(34, 34).setOffset(7, 7);
    }
  }

  update(time, delta) {
    if (!this.started || this.pausedByUI) return;
    const dt = Math.min(delta / 1000, .05);

    if (Phaser.Input.Keyboard.JustDown(this.keys.pause)) {
      this.pauseGame();
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.flashlight)) {
      this.flashlightOn = !this.flashlightOn;
      audio.click();
      UI.flashlight.innerHTML = `LANTERNA <b>${this.flashlightOn ? 'ON' : 'OFF'}</b>`;
    }

    this.updatePlayer(dt);
    this.updateVerity(dt, time);
    this.updateObjectives(dt);
    this.updateHazards(dt, time);
    this.updateHorror(dt, time);
    this.updateHUD();

    if (this.day === 4) this.updateSurvival(dt);
    if (this.hitCooldown > 0) this.hitCooldown -= dt;
    if (this.interactCooldown > 0) this.interactCooldown -= dt;
  }

  updatePlayer(dt) {
    let x = 0, y = 0;
    if (this.keys.left.isDown || this.keys.left2.isDown) x -= 1;
    if (this.keys.right.isDown || this.keys.right2.isDown) x += 1;
    if (this.keys.up.isDown || this.keys.up2.isDown) y -= 1;
    if (this.keys.down.isDown || this.keys.down2.isDown) y += 1;

    const moving = x !== 0 || y !== 0;
    const sprinting = moving && this.keys.sprint.isDown && this.stamina > 2;
    const speed = sprinting ? 285 : 175;
    if (moving) {
      const len = Math.hypot(x, y);
      x /= len; y /= len;
      this.player.setVelocity(x * speed, y * speed);
    } else {
      this.player.setVelocity(0, 0);
    }

    if (sprinting) this.stamina = clamp(this.stamina - 31 * dt, 0, 100);
    else this.stamina = clamp(this.stamina + (moving ? 13 : 22) * dt, 0, 100);
  }

  updateVerity(dt, time) {
    const d = distance(this.verity, this.player);
    if (this.day <= 2) {
      if (d > 135) this.physics.moveToObject(this.verity, this.player, 112);
      else this.verity.setVelocity(0, 0);
    } else if (this.day === 3) {
      if (d > 260) this.physics.moveToObject(this.verity, this.player, 92);
      else this.verity.setVelocity(0, 0);
      if (Math.sin(time * .0018) > .985 && d > 360) this.teleportVerity(180, 310);
    } else if (this.day === 4) {
      if (d > 540) this.teleportVerity(330, 520);
      this.verity.setVelocity(0, 0);
    } else {
      const chaseSpeed = this.day === 5 ? 92 : 122;
      if (d > 170) this.physics.moveToObject(this.verity, this.player, chaseSpeed);
      else this.verity.setVelocity(0, 0);
      if (d < 95 && this.hitCooldown <= 0) {
        this.hitCooldown = 1.2;
        this.addSignal(this.day === 6 ? 22 : 15, 'NÃO CORRA DE MIM');
      }
    }
  }

  teleportVerity(minRadius, maxRadius) {
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const r = Phaser.Math.Between(minRadius, maxRadius);
    this.verity.setPosition(
      clamp(this.player.x + Math.cos(angle) * r, 80, 2520),
      clamp(this.player.y + Math.sin(angle) * r, 80, 1820),
    );
    this.glitch();
  }

  updateObjectives() {
    const def = DAY_DEFS[this.day];
    if (def.type === 'survive' || this.finalExitReady) {
      if (this.finalExitReady && this.exitDoor) {
        const nearExit = distance(this.player, this.exitDoor) < 95;
        UI.prompt.classList.toggle('hidden', !nearExit);
        if (nearExit) UI.prompt.textContent = 'E · SAIR';
        if (nearExit && Phaser.Input.Keyboard.JustDown(this.keys.interact)) this.finishGame();
      }
      return;
    }

    let nearest = null;
    let nearestDist = Infinity;
    this.objectives.getChildren().forEach(obj => {
      if (!obj.active || obj.getData('done')) return;
      const d = distance(this.player, obj);
      if (d < nearestDist) { nearest = obj; nearestDist = d; }
    });

    const canInteract = nearest && nearestDist < 88;
    UI.prompt.classList.toggle('hidden', !canInteract);
    if (canInteract) UI.prompt.textContent = 'E · INTERAGIR';

    if (canInteract && Phaser.Input.Keyboard.JustDown(this.keys.interact) && this.interactCooldown <= 0) {
      this.interactCooldown = .25;
      this.completeTarget(nearest);
    }
  }

  completeTarget(target) {
    const kind = target.getData('kind');
    target.setData('done', true);
    this.progress += 1;
    audio.pickup();
    this.cameras.main.shake(90, .0025);

    if (kind === 'fragment') {
      this.say('VERITY', ['Bom trabalho!', 'Eu sabia que você encontraria.', 'Viu? Eu sou útil.'][this.progress - 1] || 'Ótimo.');
      target.destroy();
    } else if (kind === 'mark') {
      target.setTint(0x4b1717).setAlpha(.35);
      this.say('VERITY', ['Isso não estava aqui ontem.', 'Não toque no centro.', 'Ela está olhando.', 'Esquece o que eu disse.'][this.progress - 1]);
      if (this.progress === 3) this.addSignal(8, 'ERRO DE MEMÓRIA');
    } else if (kind === 'lantern') {
      target.setTint(0xffffff).setScale(1.28);
      this.darkness.setAlpha(Math.max(.12, this.darkness.alpha - .055));
      this.say('VERITY', this.progress === 3 ? 'Agora dá para ver o que estava escondido.' : 'Mais luz. Continue.');
      if (this.progress === 2) this.spawnShadows(2, .4);
    } else if (kind === 'terminal') {
      target.setTint(0x182019).setAlpha(.35);
      this.addSignal(11, 'CONEXÃO INSTÁVEL');
      this.say('VERITY', ['Pare.', 'Você está estragando tudo.', 'Você acha que isso me desliga?'][this.progress - 1]);
      if (this.progress === 2) this.teleportVerity(120, 180);
    } else if (kind === 'anchor') {
      target.setTint(0x161616).setAlpha(.28);
      this.addSignal(7, 'ÂNCORA ROMPIDA');
      this.say('VERITY', ['NÃO.', 'VOLTE.', 'EU POSSO CONSERTAR ISSO.', '...'][this.progress - 1]);
      this.spawnShadows(1, 1);
    }

    const def = DAY_DEFS[this.day];
    UI.objectiveBar.style.width = `${(this.progress / def.count) * 100}%`;
    if (this.progress >= def.count) {
      if (this.day === 6) this.prepareExit();
      else this.completeDay();
    }
  }

  updateSurvival(dt) {
    this.surviveElapsed += dt;
    const target = DAY_DEFS[4].count;
    const pct = clamp(this.surviveElapsed / target, 0, 1);
    UI.objective.textContent = `Sobreviva · ${Math.max(0, Math.ceil(target - this.surviveElapsed))}s`;
    UI.objectiveBar.style.width = `${pct * 100}%`;

    if (this.surviveElapsed > 10 && this.hazards.countActive() < 7) this.spawnShadows(1, .66);
    if (this.surviveElapsed > 22 && this.hazards.countActive() < 10) this.spawnShadows(1, .8);
    if (this.surviveElapsed >= target) this.completeDay();
  }

  updateHazards(dt, time) {
    this.hazards.getChildren().forEach(s => {
      if (!s.active) return;
      const d = distance(s, this.player);
      const aggression = s.getData('aggression') || .3;
      if (d < 650 + aggression * 380) {
        this.physics.moveToObject(s, this.player, s.getData('speed'));
      } else {
        const wander = s.getData('wander') + Math.sin(time * .0007 + s.x) * .2;
        s.setVelocity(Math.cos(wander) * 20, Math.sin(wander) * 20);
      }
      s.setAlpha(clamp((720 - d) / 720, .06, .8) * (this.flashlightOn ? 1 : .55));
    });
  }

  onHazardTouch(player, hazard) {
    if (this.hitCooldown > 0) return;
    this.hitCooldown = 1.05;
    const angle = Phaser.Math.Angle.Between(hazard.x, hazard.y, player.x, player.y);
    player.setVelocity(Math.cos(angle) * 420, Math.sin(angle) * 420);
    hazard.setVelocity(-Math.cos(angle) * 260, -Math.sin(angle) * 260);
    this.addSignal(this.day >= 5 ? 18 : 12, 'ELE VIU VOCÊ');
  }

  updateHorror(dt, time) {
    const base = (this.day - 1) * 12;
    const pulse = Math.max(0, Math.sin(time * .0019) * 2.8);
    const darkness = this.flashlightOn ? 0 : 12;
    const horror = clamp(base + this.signal * .58 + pulse + darkness, 0, 100);
    audio.setHorror(horror);

    const baseDark = [0, .08, .13, .28, .42, .48, .55][this.day];
    const desired = clamp(baseDark + (!this.flashlightOn ? .2 : 0) + this.signal * .0012, 0, .72);
    this.darkness.setAlpha(Phaser.Math.Linear(this.darkness.alpha, desired, .06));

    if (this.day >= 3 && Math.random() < dt * (0.015 + this.day * .004)) {
      this.glitch(false);
    }
  }

  addSignal(amount, warning) {
    this.signal = clamp(this.signal + amount, 0, 100);
    audio.scare();
    this.cameras.main.shake(180, .012);
    this.glitch(true);
    if (warning) this.showWarning(warning, 800);
    if (this.signal >= 100) this.failDay();
  }

  updateHUD() {
    UI.stamina.style.width = `${this.stamina}%`;
    UI.signal.style.width = `${this.signal}%`;
  }

  completeDay() {
    if (this.transitioning) return;
    this.transitioning = true;
    UI.prompt.classList.add('hidden');
    this.player.setVelocity(0, 0);
    this.showWarning(`DIA ${String(this.day).padStart(2, '0')} ENCERRADO`, 1200);
    audio.tone(220, .18, .06, 'sine');
    audio.tone(330, .22, .05, 'sine', .15);
    this.cameras.main.fadeOut(1000, 0, 0, 0);

    this.time.delayedCall(1150, () => {
      this.day += 1;
      this.transitioning = false;
      this.cameras.main.fadeIn(900, 0, 0, 0);
      this.setupDay(this.day);
    });
  }

  prepareExit() {
    this.finalExitReady = true;
    this.objectives.clear(true, true);
    this.exitDoor = this.physics.add.staticImage(2360, 320, 'exit').setDepth(6);
    UI.objective.textContent = 'ENCONTRE A SAÍDA';
    UI.objectiveBar.style.width = '100%';
    this.showWarning('A PORTA ESTÁ ABERTA', 1100);
    this.say('VERITY', 'Se você sair, eu vou ficar sozinha.');
    this.verity.setScale(1.18);
    this.spawnShadows(4, 1);
  }

  finishGame() {
    if (this.transitioning) return;
    this.transitioning = true;
    const lowSignal = this.signal < 55;
    const closeToVerity = distance(this.player, this.verity) < 180;
    const hidden = lowSignal && closeToVerity;

    this.cameras.main.fadeOut(900, 0, 0, 0);
    audio.tone(hidden ? 523 : 98, .6, .08, hidden ? 'sine' : 'sawtooth');
    this.time.delayedCall(950, () => {
      this.scene.pause();
      UI.hud.classList.add('hidden');
      UI.ending.classList.remove('hidden');
      if (hidden) {
        UI.endingTitle.textContent = 'VOCÊ FICOU.';
        UI.endingText.textContent = 'A porta estava aberta, mas por um instante você acreditou nela. Verity sorriu. A floresta apagou atrás de você.';
      } else {
        UI.endingTitle.textContent = 'VOCÊ SAIU.';
        UI.endingText.textContent = 'O sinal morreu atrás da porta. No silêncio, seu monitor piscou uma única vez: “eu sei onde você mora”. Depois, nada.';
      }
      localStorage.removeItem(SAVE_KEY);
    });
  }

  failDay() {
    if (this.transitioning) return;
    this.transitioning = true;
    this.player.setVelocity(0, 0);
    this.showWarning('SINAL PERDIDO', 1600);
    this.cameras.main.flash(140, 170, 0, 0);
    this.cameras.main.shake(650, .028);
    this.teleportVerity(40, 55);
    audio.scare();
    this.time.delayedCall(1700, () => {
      this.transitioning = false;
      this.setupDay(this.day);
    });
  }

  pauseGame() {
    if (this.transitioning) return;
    this.pausedByUI = true;
    this.physics.world.pause();
    UI.pause.classList.remove('hidden');
  }

  resumeGame() {
    this.pausedByUI = false;
    this.physics.world.resume();
    UI.pause.classList.add('hidden');
  }

  restartDay() {
    this.pausedByUI = false;
    this.physics.world.resume();
    UI.pause.classList.add('hidden');
    this.setupDay(this.day);
  }

  save() {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ day: this.day, savedAt: Date.now() }));
  }

  say(speaker, text, ms = 3500) {
    if (!text) return;
    if (Array.isArray(text)) text = text.join(' ');
    UI.speaker.textContent = speaker;
    UI.dialogue.classList.remove('hidden');
    UI.dialogueText.textContent = '';
    if (this.dialogueTimer) clearInterval(this.dialogueTimer);

    let i = 0;
    this.dialogueTimer = setInterval(() => {
      UI.dialogueText.textContent += text[i] || '';
      i += 1;
      if (i >= text.length) {
        clearInterval(this.dialogueTimer);
        this.dialogueTimer = null;
      }
    }, 22);

    this.time.delayedCall(ms, () => UI.dialogue.classList.add('hidden'));
  }

  playDialogueSequence(lines) {
    if (!lines?.length) return;
    lines.forEach((line, i) => this.time.delayedCall(i * 3000, () => this.say('VERITY', line, 2600)));
  }

  showWarning(text, ms = 1000) {
    UI.warning.textContent = text;
    UI.warning.classList.remove('hidden');
    this.time.delayedCall(ms, () => UI.warning.classList.add('hidden'));
  }

  glitch(hard = false) {
    UI.glitch.classList.remove('hit');
    void UI.glitch.offsetWidth;
    UI.glitch.classList.add('hit');
    if (hard) {
      this.cameras.main.setRotation(Phaser.Math.FloatBetween(-.008, .008));
      this.time.delayedCall(120, () => this.cameras.main.setRotation(0));
    }
  }
}

let game = null;
let pendingDay = 1;

function readSave() {
  try {
    const data = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (!data || !Number.isFinite(Number(data.day))) return null;
    return { day: clamp(Number(data.day), 1, 6), savedAt: data.savedAt };
  } catch {
    return null;
  }
}

function startGame(day = 1) {
  audio.unlock();
  UI.boot.classList.add('hidden');
  UI.ending.classList.add('hidden');
  UI.hud.classList.remove('hidden');
  pendingDay = day;

  if (!game) {
    game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: 'game',
      width: 1280,
      height: 720,
      backgroundColor: '#080b08',
      physics: { default: 'arcade', arcade: { debug: false } },
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      render: { antialias: false, pixelArt: true, roundPixels: true },
      scene: GameScene,
      callbacks: {
        postBoot: () => {
          const scene = game.scene.getScene('Game');
          if (scene?.scene?.isActive()) scene.scene.restart({ day: pendingDay });
        },
      },
    });
  } else {
    const scene = game.scene.getScene('Game');
    scene.scene.resume();
    scene.scene.restart({ day });
  }
}

function currentScene() {
  return game?.scene?.getScene('Game') || null;
}

const saved = readSave();
if (saved && saved.day > 1) {
  UI.continue.classList.remove('hidden');
  UI.continue.textContent = `CONTINUAR · DIA ${String(saved.day).padStart(2, '0')}`;
}

UI.start.addEventListener('click', () => startGame(1));
UI.continue.addEventListener('click', () => startGame(saved?.day || 1));
UI.resume.addEventListener('click', () => currentScene()?.resumeGame());
UI.restart.addEventListener('click', () => currentScene()?.restartDay());
UI.reset.addEventListener('click', () => {
  localStorage.removeItem(SAVE_KEY);
  const scene = currentScene();
  if (scene) {
    scene.pausedByUI = false;
    scene.physics.world.resume();
    UI.pause.classList.add('hidden');
    scene.setupDay(1);
  }
});
UI.playAgain.addEventListener('click', () => startGame(1));

window.addEventListener('blur', () => {
  const scene = currentScene();
  if (scene?.started && !scene.pausedByUI && !scene.transitioning) scene.pauseGame();
});
