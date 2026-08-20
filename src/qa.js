(() => {
  const params = new URLSearchParams(location.search);
  if (!params.has('qa')) return;

  const state = { logs: [], running: false, scene: null, failures: 0 };
  const panel = document.createElement('aside');
  panel.id = 'verityQaPanel';
  panel.innerHTML = `
    <div class="qa-head"><strong>VERITY QA</strong><span id="qaState">BOOT</span></div>
    <div class="qa-actions">
      <button data-qa="objective">COMPLETE TARGET</button>
      <button data-qa="day">NEXT DAY</button>
      <button data-qa="hit">ADD SIGNAL</button>
      <button data-qa="auto">RUN FULL TEST</button>
    </div>
    <pre id="qaLog">waiting for Phaser…</pre>
  `;
  document.body.appendChild(panel);

  const style = document.createElement('style');
  style.textContent = `
    #verityQaPanel{position:fixed;left:12px;bottom:12px;z-index:1000;width:min(430px,calc(100vw - 24px));padding:10px;border:1px solid #6b756b;background:rgba(2,5,3,.94);color:#dbe5d8;font:11px/1.35 monospace;pointer-events:auto}
    #verityQaPanel .qa-head{display:flex;justify-content:space-between;color:#f3ea36;margin-bottom:8px}
    #verityQaPanel .qa-actions{display:grid;grid-template-columns:1fr 1fr;gap:5px}
    #verityQaPanel button{margin:0;padding:7px;background:#111811;border:1px solid #384238;color:#dbe5d8;font:10px monospace;cursor:pointer}
    #verityQaPanel pre{max-height:150px;overflow:auto;white-space:pre-wrap;margin:8px 0 0;color:#9baa98}
    #verityQaPanel .pass{color:#8ee99d} #verityQaPanel .fail{color:#ff7777}
  `;
  document.head.appendChild(style);

  const logEl = panel.querySelector('#qaLog');
  const stateEl = panel.querySelector('#qaState');
  const log = (text, kind = '') => {
    const stamp = new Date().toLocaleTimeString();
    state.logs.push(`[${stamp}] ${text}`);
    if (state.logs.length > 16) state.logs.shift();
    logEl.textContent = state.logs.join('\n');
    if (kind === 'fail') state.failures++;
    stateEl.textContent = state.failures ? `FAIL ${state.failures}` : 'READY';
    stateEl.className = kind;
    console[kind === 'fail' ? 'error' : 'log'](`[VERITY QA] ${text}`);
  };

  window.addEventListener('error', (event) => log(`JS ERROR: ${event.message}`, 'fail'));
  window.addEventListener('unhandledrejection', (event) => log(`PROMISE ERROR: ${event.reason}`, 'fail'));

  const getScene = () => {
    const game = window.Phaser?.GAMES?.find(Boolean);
    return game?.scene?.getScene('Game') || null;
  };

  const waitForScene = async (timeout = 12000) => {
    const start = performance.now();
    while (performance.now() - start < timeout) {
      const scene = getScene();
      if (scene?.started && scene.player && scene.objectives && scene.hazards) {
        state.scene = scene;
        return scene;
      }
      await new Promise(r => setTimeout(r, 100));
    }
    throw new Error('Game scene did not become ready');
  };

  const completeOne = scene => {
    const target = scene.objectives?.getChildren()?.find(o => o.active && !o.getData('done'));
    if (!target) return false;
    scene.completeTarget(target);
    return true;
  };

  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
    log(`PASS: ${message}`, 'pass');
  };

  const testDay = async (scene, day) => {
    scene.transitioning = false;
    scene.setupDay(day);
    await new Promise(r => setTimeout(r, 120));
    assert(scene.day === day, `day ${day} initialized`);
    assert(scene.player.active && scene.verity.active, `day ${day} actors active`);
    assert(Number.isFinite(scene.player.x) && Number.isFinite(scene.verity.x), `day ${day} coordinates finite`);

    if (day === 4) {
      assert(scene.hazards.countActive() >= 5, 'survival enemies spawned');
      scene.surviveElapsed = 34.95;
      scene.updateSurvival(.1);
      await new Promise(r => setTimeout(r, 80));
      scene.transitioning = false;
      return;
    }

    const expected = { 1: 3, 2: 4, 3: 3, 5: 3, 6: 4 }[day];
    assert(scene.objectives.getChildren().length === expected, `day ${day} objective count ${expected}`);

    for (let i = 0; i < expected; i++) {
      const before = scene.progress;
      if (!completeOne(scene)) throw new Error(`day ${day}: target ${i + 1} missing`);
      assert(scene.progress === before + 1, `day ${day} target ${i + 1} increments progress`);
      await new Promise(r => setTimeout(r, 70));
      scene.transitioning = false;
    }

    if (day === 6) {
      assert(scene.finalExitReady === true, 'final exit unlocked');
      assert(Boolean(scene.exitDoor?.active), 'final exit exists');
    }
  };

  const runFull = async () => {
    if (state.running) return;
    state.running = true;
    state.failures = 0;
    stateEl.textContent = 'RUNNING';
    try {
      const scene = await waitForScene();
      log('scene ready');
      for (let day = 1; day <= 6; day++) {
        await testDay(scene, day);
      }
      assert(scene.hazards.countActive() >= 8, 'final chase population present');
      stateEl.textContent = 'ALL PASS';
      stateEl.className = 'pass';
      log('FULL STATE TEST COMPLETE', 'pass');
    } catch (error) {
      stateEl.textContent = 'FAILED';
      stateEl.className = 'fail';
      log(error?.stack || String(error), 'fail');
    } finally {
      state.running = false;
    }
  };

  panel.addEventListener('click', async event => {
    const button = event.target.closest('button[data-qa]');
    if (!button) return;
    try {
      const scene = await waitForScene();
      const action = button.dataset.qa;
      if (action === 'objective') {
        if (scene.day === 4) scene.surviveElapsed = 34.95;
        else completeOne(scene);
      } else if (action === 'day') {
        scene.transitioning = false;
        scene.setupDay(Math.min(6, scene.day + 1));
      } else if (action === 'hit') {
        scene.addSignal(12, 'QA SIGNAL');
      } else if (action === 'auto') {
        runFull();
      }
    } catch (error) {
      log(String(error), 'fail');
    }
  });

  const autostart = params.has('autostart') || params.has('autotest');
  if (autostart) {
    const bootPoll = setInterval(() => {
      const start = document.querySelector('#startBtn');
      if (!start || start.offsetParent === null) return;
      clearInterval(bootPoll);
      start.click();
    }, 100);
  }

  const requestedDay = Number(params.get('day'));
  (async () => {
    try {
      const scene = await waitForScene();
      log('runtime connected');
      if (Number.isInteger(requestedDay) && requestedDay >= 1 && requestedDay <= 6) {
        scene.transitioning = false;
        scene.setupDay(requestedDay);
        log(`jumped to day ${requestedDay}`);
      }
      if (params.has('autotest')) runFull();
    } catch (error) {
      log(String(error), 'fail');
    }
  })();
})();
