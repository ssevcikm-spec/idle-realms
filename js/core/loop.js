(function () {
  const G = window.Game;
  const TICK = 1 / 10;
  const MAX_CATCHUP = 24;
  const OFFLINE_CAP_S = 4 * 3600;
// 4 h při kroku 0,1 s = 144 000 ticků; rezerva nad to, aby hodiny za dvě nepřetékly.
const OFFLINE_MAX_STEPS = 200000;
  let running = false, paused = false, acc = 0, lastTs = 0;
  G.simulating = false;

  G.pauseGame  = function () { paused = true; };
  G.resumeGame = function () { paused = false; };
  G.isPaused   = function () { return paused; };

  G.startLoop = function () {
    if (running) return;
    running = true;
    lastTs = performance.now();
    requestAnimationFrame(frame);
    setInterval(() => G.save(), 5000);
  };

  function frame(ts) {
    const speedMult = G.debugSpeed ? G.debugSpeed() : 1;
    const real = Math.min(0.25, (ts - lastTs) / 1000 || 0) * speedMult;
    lastTs = ts;
    if (!paused) {
      acc += real;
      let guard = 0;
      while (acc >= TICK && guard++ < MAX_CATCHUP) { acc -= TICK; G.tick(TICK); }
    }
    requestAnimationFrame(frame);
  }

  G.tick = function (dt) {
    G.state.time += dt;
    if (G.tickTime) G.tickTime(dt);
    G.tickTasks(dt);
    G.tickEconomy(dt);
    if (G.tickInjuries) G.tickInjuries(dt);
    if (G.tickQuests) G.tickQuests(dt);
    if (G.tickCaravans) G.tickCaravans(dt);
    if (G.tickWorldEvents) G.tickWorldEvents(dt);
    if (G.tickMerchants) G.tickMerchants(dt);
    if (G.tickExpeditions) G.tickExpeditions(dt);
    if (G.tickAchievements) G.tickAchievements(dt);
    if (G.tickPolitics) G.tickPolitics(dt);
    G.tickAutonomy(dt);
    if (G.tickTutorial) G.tickTutorial(dt);
    if (G.tickEndgame) G.tickEndgame(dt);
    if (G.tickStory) G.tickStory(dt);
    if (G.tickAging) G.tickAging(dt);
    G.tickEvents(dt);
  };

  G.simulateOffline = function (elapsedSeconds) {
    const cap = (G.currentDifficulty ? G.currentDifficulty().offlineCap : OFFLINE_CAP_S);
    const total = Math.min(elapsedSeconds, cap);
    let remaining = total;
    G.simulating = true;
    let guard = 0;
    // K3 (parita): krok je STEJNÝ jako v živém běhu. Dřív tady byla sekunda
    // proti desáté sekundě živého běhu a to tiše měnilo hru: systémy s vlastním
    // intervalem (autonomie, nálada, odpočinek) přehrávají v jednom kroku jiné
    // podmínky než ve dvou — a prahy (nálada < 20 = odmítne práci, výdrž < 25)
    // to rozdíl násobí dál. Naměřeno před opravou: 57 % rozdílu v vykonané práci
    // za hodinu. Teď běží offline stejná posloupnost ticků jako hra.
    while (remaining > 0 && guard++ < OFFLINE_MAX_STEPS) {
      const dt = Math.min(TICK, remaining);
      G.tick(dt);
      remaining -= dt;
    }
    G.simulating = false;
    return total;
  };
})();
