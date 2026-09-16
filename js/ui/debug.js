(function () {
  const G = window.Game;
  let open = false, speed = 1;
  const SPEEDS = [1, 5, 20, 100];
  G.debugSpeed = function () { return speed; };

  G.initDebug = function () {
    const btn = document.createElement('button');
    btn.id = 'debug-btn'; btn.textContent = '🐞'; btn.title = 'Debug (D)';
    btn.addEventListener('click', toggle);
    document.body.appendChild(btn);
    window.addEventListener('keydown', e => {
      if (e.key === 'd' || e.key === 'D') {
        if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
        toggle();
      }
    });
  };

  function toggle() {
    open = !open;
    let el = document.getElementById('debug-panel');
    if (open && !el) {
      el = document.createElement('div');
      el.id = 'debug-panel';
      el.innerHTML = `
        <div class="dbg-title">🐞 Debug <button class="dbg-close" data-dbg="close">✕</button></div>
        <div class="dbg-section"><div class="dbg-label">Rychlost času</div><div class="dbg-row" id="dbg-speeds"></div></div>
        <div class="dbg-section"><div class="dbg-label">Rychlé přidání</div>
          <div class="dbg-row">
            <button class="dbg-btn" data-dbg="gold">+500 🪙</button>
            <button class="dbg-btn" data-dbg="renown">+10 ⭐</button>
            <button class="dbg-btn" data-dbg="renown25">+25 ⭐</button>
          </div>
          <div class="dbg-row" id="dbg-mats"></div>
        </div>
        <div class="dbg-section"><div class="dbg-label">Čas</div>
          <div class="dbg-row">
            <button class="dbg-btn" data-dbg="skip-day">⏭ +1 den</button>
            <button class="dbg-btn" data-dbg="skip-season">⏭ +1 sezóna</button>
          </div>
          <div class="dbg-row">
            <button class="dbg-btn" data-dbg="set-spring">🌸</button>
            <button class="dbg-btn" data-dbg="set-summer">☀️</button>
            <button class="dbg-btn" data-dbg="set-autumn">🍂</button>
            <button class="dbg-btn" data-dbg="set-winter">❄️</button>
          </div>
        </div>
        <div class="dbg-section"><div class="dbg-label">Mapa — měřítko</div>
          <div class="dbg-row" id="dbg-tiles"></div>
          <div class="dbg-row" id="dbg-figs"></div>
          <div class="dbg-note" id="dbg-scale-note"></div>
        </div>
        <div class="dbg-section"><div class="dbg-label">Svět</div>
          <div class="dbg-row" id="dbg-events"></div>
          <div class="dbg-row"><button class="dbg-btn" data-dbg="spawn-caravan">🐎 Karavana</button></div>
        </div>
        <div class="dbg-section"><div class="dbg-label">Systémy</div>
          <div class="dbg-row"><button class="dbg-btn" data-dbg="unlock-base">🏕️ Základna</button></div>
          <div class="dbg-row">
            <button class="dbg-btn" data-dbg="force-story">📖 Příběh</button>
            <button class="dbg-btn" data-dbg="all-achievements">🏆 Cíle</button>
          </div>
          <div class="dbg-row">
            <button class="dbg-btn" data-dbg="mood-up">😄 Nálada +30</button>
            <button class="dbg-btn" data-dbg="force-combat">⚔️ Souboj</button>
          </div>
          <div class="dbg-row">
            <button class="dbg-btn" data-dbg="check-ambitions">🎯 Ambice</button>
            <button class="dbg-btn" data-dbg="age-up">⏳ +10 let</button>
          </div>
          <div class="dbg-row">
            <button class="dbg-btn" data-dbg="kill-random">💀 Zabij</button>
            <button class="dbg-btn" data-dbg="make-couple">❤️ Pár</button>
          </div>
          <div class="dbg-row">
            <button class="dbg-btn" data-dbg="election-now">🏛️ Volby</button>
            <button class="dbg-btn" data-dbg="force-birth">👶 Dítě</button>
          </div>
          <div class="dbg-row">
            <button class="dbg-btn" data-dbg="force-expedition-end">⛵ Konec expedice</button>
          </div>
          <div class="dbg-row"><button class="dbg-btn" data-dbg="do-prestige">🌟 Prestiž</button></div>
        </div>
        <div class="dbg-section"><div class="dbg-label">Stav</div><div class="dbg-stats" id="dbg-stats"></div></div>
        <div class="dbg-section"><div class="dbg-row">
          <button class="dbg-btn dbg-danger" data-dbg="reset">Reset</button>
          <button class="dbg-btn" data-dbg="save">Uložit</button>
        </div></div>
      `;
      document.body.appendChild(el);
      el.addEventListener('click', onDebugClick);
      buildSpeedButtons(); buildMatButtons(); buildEventButtons(); buildScaleButtons();
      setInterval(updateStats, 500); updateStats();
    }
    if (el) el.classList.toggle('show', open);
  }

  function buildSpeedButtons() {
    const el = document.getElementById('dbg-speeds'); if (!el) return;
    el.innerHTML = SPEEDS.map(s => `<button class="dbg-btn ${s === speed ? 'active' : ''}" data-dbg="speed" data-speed="${s}">×${s}</button>`).join('');
  }
  function buildMatButtons() {
    const el = document.getElementById('dbg-mats'); if (!el) return;
    const mats = ['wood','stone','fiber','herb','grain','coal','iron_ore','hide','crystal','iron_ingot','coin','jewel','potion'];
    el.innerHTML = mats.map(m => `<button class="dbg-btn" data-dbg="mat" data-mat="${m}" title="+25 ks">${G.MATERIALS[m].icon}</button>`).join('');
  }
  function buildEventButtons() {
    const el = document.getElementById('dbg-events'); if (!el) return;
    el.innerHTML = Object.values(G.WORLD_EVENTS).slice(0, 7).map(t =>
      `<button class="dbg-btn" data-dbg="event" data-event="${t.id}" title="${G.esc(t.name)}">${t.icon}</button>`
    ).join('');
  }

  /** Přepínače měřítka mapy — velikost dlaždice a výška postav. */
  const TILE_STEPS = [46, 56, 64, 80];
  const FIG_STEPS = [0.6, 0.8, 0.94, 1.15];
  function buildScaleButtons() {
    const tEl = document.getElementById('dbg-tiles');
    const fEl = document.getElementById('dbg-figs');
    const note = document.getElementById('dbg-scale-note');
    if (tEl) {
      const cur = G.getTileBase ? G.getTileBase() : 64;
      tEl.innerHTML = TILE_STEPS.map(v =>
        `<button class="dbg-btn ${v === cur ? 'active' : ''}" data-dbg="tilebase" data-v="${v}" title="Dlaždice ${v} px">${v}</button>`
      ).join('');
    }
    if (fEl) {
      const cur = G.getFigureHeight ? G.getFigureHeight() : 0.94;
      fEl.innerHTML = FIG_STEPS.map(v =>
        `<button class="dbg-btn ${Math.abs(v - cur) < 0.001 ? 'active' : ''}" data-dbg="figheight" data-v="${v}" title="Postava ${Math.round(v*100)} % dlaždice">${Math.round(v*100)}%</button>`
      ).join('');
    }
    if (note) {
      const t = G.getTileBase ? G.getTileBase() : 64;
      const f = G.getFigureHeight ? G.getFigureHeight() : 0.94;
      note.textContent = `dlaždice ${t} px • postava ${Math.round(t * f)} px`;
    }
  }

  function onDebugClick(e) {
    const el = e.target.closest('[data-dbg]'); if (!el) return;
    const a = el.dataset.dbg;
    if (a === 'close') { open = false; document.getElementById('debug-panel').classList.remove('show'); }
    else if (a === 'tilebase') {
      if (G.setTileBase) G.setTileBase(parseFloat(el.dataset.v));
      if (G.state && G.state.settings) G.state.settings.tileBase = G.getTileBase();
      buildScaleButtons();
    }
    else if (a === 'figheight') {
      if (G.setFigureHeight) G.setFigureHeight(parseFloat(el.dataset.v));
      if (G.state && G.state.settings) G.state.settings.figHeight = G.getFigureHeight();
      buildScaleButtons();
    }
    else if (a === 'speed') { speed = parseFloat(el.dataset.speed); buildSpeedButtons(); }
    else if (a === 'gold') G.state.resources.gold += 500;
    else if (a === 'renown') G.state.resources.renown += 10;
    else if (a === 'renown25') G.state.resources.renown += 25;
    else if (a === 'mat') G.matAdd(el.dataset.mat, 25, 'common');
    else if (a === 'event') G.startEvent(el.dataset.event, true);
    else if (a === 'skip-day') {
      G.state.dayTime += G.TIME.dayLength;
      G.log('⏭ +1 den (debug)', 'info');
    }
    else if (a === 'skip-season') {
      G.state.dayTime += G.TIME.dayLength * G.TIME.daysPerSeason;
      G.log('⏭ +1 sezóna (debug)', 'info');
    }
    else if (a === 'set-spring') { G.state.season = 'spring'; }
    else if (a === 'set-summer') { G.state.season = 'summer'; }
    else if (a === 'set-autumn') { G.state.season = 'autumn'; }
    else if (a === 'set-winter') { G.state.season = 'winter'; }
    else if (a === 'spawn-caravan') {
      const sids = Object.keys(G.WORLD.settlementById);
      const a2 = sids[G.randInt(0, sids.length - 1)];
      let b = sids[G.randInt(0, sids.length - 1)];
      while (b === a2) b = sids[G.randInt(0, sids.length - 1)];
      G.spawnCaravanNow(a2, b, 'trade');
    }
    else if (a === 'unlock-base') {
      G.state.resources.renown = Math.max(G.state.resources.renown, 25);
      G.tryUnlockBase();
      if (!G.state.base.unlocked) {
        const s = G.baseSuggestion ? G.baseSuggestion() : null;
        if (s) G.placeBaseAt(s.x, s.y);
      }
    }
    else if (a === 'force-story') {
      if (!G.state.story) G.state.story = { completed: [], flags: {} };
      for (const q of G.STORY_QUESTS) {
        if (G.state.story.completed.includes(q.id)) continue;
        G.state.pendingStory = { id: q.id, title: q.title, text: q.text, choices: q.choices.map((c, i) => ({ text: c.text, index: i })) };
        G.pauseGame(); G.showStoryModal(G.state.pendingStory);
        break;
      }
    }
    else if (a === 'all-achievements') {
      for (const ach of G.ACHIEVEMENTS) {
        if (!G.state.achievements.unlocked.includes(ach.id)) {
          G.state.achievements.unlocked.push(ach.id);
          if (ach.reward.gold) G.state.resources.gold += ach.reward.gold;
          if (ach.reward.renown) G.state.resources.renown += ach.reward.renown;
        }
      }
      G.log('🏆 Cíle odemčeny (debug).', 'info');
    }
    else if (a === 'mood-up') { for (const u of G.state.units) if (!u.dead) G.addMood(u, 30); }
    else if (a === 'force-combat') {
      const idle = G.state.units.filter(u => !u.dead && !u.resting && !u.onExpedition);
      if (idle.length) {
        const node = G.WORLD.nodes.find(n => G.NODE_DANGER[n.kind] >= 2) || G.WORLD.nodes[0];
        G.startCombat(node, idle, { tactic:'balanced' });
      }
    }
    else if (a === 'check-ambitions') {
      for (const u of G.state.units) if (G.checkAmbitions) G.checkAmbitions(u);
    }
    else if (a === 'age-up') { G.state.time += 10 * G.AGE_YEAR; }
    else if (a === 'kill-random') {
      const alive = G.state.units.filter(u => !u.dead && !u.isChild);
      if (alive.length) G.die(G.pick(alive), 'debug');
    }
    else if (a === 'make-couple') {
      const alive = G.state.units.filter(u => !u.dead && !u.isChild);
      if (alive.length >= 2) {
        const a2 = alive[0], b = alive[1];
        a2.relationships[b.id] = 90;
        b.relationships[a2.id] = 90;
      }
    }
    else if (a === 'election-now') {
      G.ensurePolitics();
      for (const fid in G.state.politics.factions) G.state.politics.factions[fid].nextElection = G.state.time;
    }
    else if (a === 'force-birth') {
      const alive = G.state.units.filter(u => !u.dead && !u.isChild);
      if (alive.length >= 2) G.createChild(alive[0], alive[1]);
    }
    else if (a === 'force-expedition-end') {
      for (const exp of (G.state.expeditions || [])) exp.endsAt = G.state.time;
    }
    else if (a === 'do-prestige') {
      G.state.resources.renown = 100;
      G.state.stats.goldEarned = 3000;
      while (G.state.units.filter(u => !u.dead).length < 8) G.state.units.push(G.createUnit());
      const res = G.doPrestige();
      if (!res.ok) G.log('⚠️ ' + res.reason, 'info');
    }
    else if (a === 'save') { G.save(); G.log('💾 Uloženo.', 'info'); }
    else if (a === 'reset') { if (confirm('Opravdu smazat celý postup?')) G.resetSave(); }
  }

  function updateStats() {
    if (!open) return;
    const el = document.getElementById('dbg-stats'); if (!el || !G.state) return;
    const s = G.state;
    const alive = s.units.filter(u => !u.dead);
    const dead = s.units.filter(u => u.dead);
    const kids = (s.family && s.family.children) ? s.family.children.length : 0;
    const resting = alive.filter(u => u.resting).length;
    const onExp = alive.filter(u => u.onExpedition).length;
    const avgStam = alive.length ? Math.round(alive.reduce((a, u) => a + u.stamina, 0) / alive.length) : 0;
    const avgMood = alive.length ? Math.round(alive.reduce((a, u) => a + (u.mood || 70), 0) / alive.length) : 0;
    const avgAge = alive.length ? Math.round(alive.reduce((a, u) => a + G.unitAge(u), 0) / alive.length) : 0;
    const season = G.seasonInfo ? G.seasonInfo() : null;
    const phase = G.phaseInfo ? G.phaseInfo() : null;
    const t = s.time;
    const hh = Math.floor(t/3600), mm = Math.floor((t%3600)/60), ss = Math.floor(t%60);
    const lvl = (s.prestige && s.prestige.level) || 0;
    const achDone = s.achievements ? (s.achievements.unlocked || []).length : 0;
    const expCount = (s.expeditions || []).length;
    el.innerHTML = `
      čas: <b>${hh}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}</b><br>
      den: <b>${(s.day||0)+1}/${G.TIME.daysPerSeason}</b> rok <b>${s.year||1}</b> ${season ? season.icon + ' ' + season.name : ''} ${phase ? phase.icon : ''}<br>
      živé: <b>${alive.length}</b> • mrtvé: <b>${dead.length}</b> • děti: <b>${kids}</b><br>
      tasky: <b>${s.tasks.length}</b> • odpočívá: <b>${resting}</b> • exp.: <b>${onExp}</b><br>
      Ø výdrž: <b>${avgStam}</b> • Ø nálada: <b>${avgMood}</b> • Ø věk: <b>${avgAge}</b><br>
      zlato: <b>${Math.floor(s.resources.gold)}</b> • prestiž: <b>${lvl}</b><br>
      expedice: <b>${expCount}</b> • cíle: <b>${achDone}/${G.ACHIEVEMENTS.length}</b>
    `;
  }
})();
