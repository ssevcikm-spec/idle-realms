(function () {
  const G = window.Game;
  const TICK = 1 / 10;
  const MAX_CATCHUP = 24;
  const OFFLINE_CAP_S = 4 * 3600;
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
    const real = Math.min(0.25, (ts - lastTs) / 1000 || 0);
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
    if (G.tickStory) G.tickStory(dt);
    if (G.tickAging) G.tickAging(dt);
    G.tickEvents(dt);
  };

  G.simulateOffline = function (elapsedSeconds) {
    const total = Math.min(elapsedSeconds, OFFLINE_CAP_S);
    let remaining = total;
    G.simulating = true;
    let guard = 0;
    while (remaining > 0 && guard++ < 30000) {
      const dt = Math.min(1, remaining);
      G.tick(dt);
      remaining -= dt;
    }
    G.simulating = false;
    return total;
  };
})();
