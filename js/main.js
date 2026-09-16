(function () {
  const G = window.Game;
  G.WORLD_SEED = 20260910;

  function boot() {
    // ?reset=1 → smaž všechny savy a přesměruj na čistou URL
    if (location.search.indexOf('reset=1') >= 0) {
      if (G.wipeSave) G.wipeSave();
      else if (G.SAVE_KEYS) {
        for (const k of G.SAVE_KEYS) { try { localStorage.removeItem(k); } catch (e) {} }
      }
      location.href = location.pathname;
      return;
    }

    const saved = G.load();

    // Urči seed: ze save, jinak default
    let seed = G.WORLD_SEED;
    if (saved && saved.worldSeed) seed = saved.worldSeed;
    G.WORLD_SEED = seed;
    G.WORLD = G.generateWorld(seed);

    // Když je co načíst, hra rovnou pokračuje — menu se otevírá tlačítkem ☰ v liště.
    if (saved) { continueGame(saved); return; }

    // První spuštění: titulní obrazovka s volbou obtížnosti
    if (G.showTitleScreen) {
      G.showTitleScreen({
        saveInfo: G.getSaveInfo ? G.getSaveInfo(saved) : null,
        onContinue: () => continueGame(saved),
        onNewGame: (diffId) => startNewGame(diffId)
      });
      return;
    }

    // Fallback (kdyby title_screen.js chyběl)
    startNewGame('normal');
  }

  function continueGame(saved) {
    G.state = saved;
    G.state.worldSeed = G.WORLD_SEED;

    // Orphan state cleanup (K1 z FIX-v3)
    if (!Array.isArray(G.state.log)) G.state.log = [];
    if (G.state.combat && G.state.combat.active) {
      G.state.combat.active = null;
      G.log('⚔️ Nedokončený souboj byl zrušen.', 'info');
    }
    if (G.state.pendingEvents && G.state.pendingEvents.length) {
      G.state.pendingEvents = [];
      G.log('🎲 Nevyřešené události byly zrušeny.', 'info');
    }
    if (G.state.pendingStory) {
      G.state.pendingStory = null;
      G.log('📖 Nevyřešený příběh byl zrušen.', 'info');
    }

    ensureDefaults();
    restoreSequences();
    if (!Object.keys(G.state.economy).length) G.initEconomy();
    if (G.ensurePolitics) G.ensurePolitics();
    if (G.ensureDynasty) G.ensureDynasty();
    repairUnits();
    if (G.repairAges) G.repairAges();

    for (const s of G.WORLD.settlements) G.ensureQuests(s.id);

    const elapsed = Math.max(0, (Date.now() - (saved.lastSave || Date.now())) / 1000);
    if (elapsed > 5) {
      const sim = G.simulateOffline(elapsed);
      setTimeout(() => G.log(`💤 Offline ${formatDuration(sim)} — postavy pracovaly dál.`, 'info'), 150);
    }
    G.log('💾 Načteno. Vítej zpět! (menu otevřeš tlačítkem ☰ v liště)', 'info');

    initGame();
  }

  function startNewGame(diffId) {
    G.state = G.newState();
    G.state.worldSeed = G.WORLD_SEED;
    newGame(diffId);
    initGame();
  }
  G.startNewGame = startNewGame;   // používá menu (☰) pro „Nová hra" ze hry

  function initGame() {
    G.initWorld(document.getElementById('world'));
    G.initUI();
    G.initDebug();
    G.startLoop();
    window.addEventListener('beforeunload', () => G.save());
    document.addEventListener('visibilitychange', () => { if (document.hidden) G.save(); });
  }

  function repairUnits() {
    for (const u of G.state.units) {
      if (!u.equipment) u.equipment = { tool:null, weapon:null, armor:null };
      if (u.maxStamina == null) u.maxStamina = 100;
      if (u.stamina == null) u.stamina = 100;
      if (u.resting == null) u.resting = false;
      if (u.restingAt === undefined) u.restingAt = null;
      if (!u.injuries) u.injuries = [];
      if (!u.perks) u.perks = {};
      if (u.profession === undefined) u.profession = null;
      if (u.mentorId === undefined) u.mentorId = null;
      if (u.mood == null) u.mood = 70;
      if (!u.relationships) u.relationships = {};
      if (u.role === undefined) u.role = null;
      if (u.merchantRoute === undefined) u.merchantRoute = null;
      if (u.merchantState === undefined) u.merchantState = null;
      if (!u.personality && G.rollPersonality) u.personality = G.rollPersonality();
      if (!u.ambitions && G.rollAmbitions) u.ambitions = G.rollAmbitions();
      // FIX (Hotfix A): relativně k aktuálnímu času
      if (u.birthTime == null) u.birthTime = G.state.time - G.randInt(20, 30) * G.AGE_YEAR;
      if (u.dead == null) u.dead = false;
      if (u.isChild == null) u.isChild = false;
      if (u.generation == null) u.generation = 1;
      if (!u.parentIds) u.parentIds = [];
      if (u.legacy == null) u.legacy = 0;
      if (u.manual == null) u.manual = false;
      if (u.onExpedition == null) u.onExpedition = false;
      if (!u.journal) u.journal = [];
      if (G.refreshGearVisual) G.refreshGearVisual(u);
      if (G.checkProfession) G.checkProfession(u);
    }
  }

  function ensureDefaults() {
    const s = G.state;
    s.pendingEvents = s.pendingEvents || [];
    s.pendingStory = s.pendingStory || null;
    s.combat = s.combat || { active: null };
    s.family = s.family || { children: [] };
    s.politics = s.politics || { factions: {}, lastCheck: 0 };
    s.dynasty = s.dynasty || { generations: 1, names: [], totalBirths: 0, totalDeaths: 0 };
    s.directives = s.directives || { focusMaterial: null, avoidDanger: false };
    s.settings = s.settings || { difficulty: null, tutorial: true };
    s.expeditions = s.expeditions || [];
    s.masterworks = s.masterworks || [];
    s.orders = s.orders || [];
    s.productionOrders = s.productionOrders || [];
    s.dayTime = s.dayTime || 0;
    s.day = s.day || 0;
    s.season = s.season || 'spring';
    s.year = s.year || 1;
    s.logFilter = s.logFilter || 'all';
    s.prestige = s.prestige || { level: 0, totalPrestige: 0, unlocks: [] };
    if (!s.prestige.unlocks) s.prestige.unlocks = [];
    s.stats = s.stats || {};
    ['totalWork','tasksDone','goldEarned','goldSpent','injuries','masterworks','combatsWon','combatsLost',
     'questsCompleted','merchantTrades','merchantGoldEarned','dragonsKilled','totalWood','totalStone',
     'totalIronOre','ambitionsDone','deaths','births','desertions','resurrections','abilitiesUsed',
     'electionsWon','bossesKilled','expeditions','expeditionSuccesses','namedMasterworks','prestiges']
      .forEach(k => s.stats[k] = s.stats[k] || 0);
    s.stats.settlementsVisited = s.stats.settlementsVisited || [];
    s.economy = s.economy || {};
    s.buildings = s.buildings || {};
    s.equipment = s.equipment || [];
    s.equipmentSeq = s.equipmentSeq || 1;
    s.reputation = s.reputation || {};
    s.settlementRep = s.settlementRep || {};
    s.quests = s.quests || {};
    s.caravans = s.caravans || [];
    s.worldEvents = s.worldEvents || [];
    s.base = s.base || { unlocked: false, buildings: {}, accum: {}, x: 30, y: 30 };
    s.construction = s.construction || [];
    s.construction.forEach(j => {
      if (j.site == null) j.site = j.kind === 'base' ? 'base' : j.settlementId;
      if (j.taskId && !s.tasks.some(t => t.id === j.taskId)) j.taskId = null;
    });
    s.base.accum = s.base.accum || {};
    s.base.buildings = s.base.buildings || {};
    if (s.base.x == null) s.base.x = 30;
    if (s.base.y == null) s.base.y = 30;
    if (s.base.placementOffered == null) s.base.placementOffered = !!s.base.unlocked;
    if (s.base.suggested === undefined) s.base.suggested = null;
    s.story = s.story || { completed: [], flags: {} };
    if (!s.story.flags) s.story.flags = {};
    if (!s.story.choices) s.story.choices = {};
    s.achievements = s.achievements || { unlocked: [] };
    s.camera = s.camera || { x: 7, y: 22, zoom: 1 };
    s.camera.zoom = G.clampZoom ? G.clampZoom(s.camera.zoom || 1) : G.clamp(s.camera.zoom || 1, 0.55, 2.0);
    s.camera.x = G.clamp(s.camera.x || 7, 0, (G.WORLD && G.WORLD.w ? G.WORLD.w - 1 : 63));
    s.camera.y = G.clamp(s.camera.y || 22, 0, (G.WORLD && G.WORLD.h ? G.WORLD.h - 1 : 47));
    s.selected = s.selected || null;
  }

  function newGame(diffId) {
    G.state.worldSeed = G.WORLD_SEED;
    if (diffId) G.setDifficulty(diffId);
    else if (!G.state.settings.difficulty) G.setDifficulty('normal');
    const diff = G.currentDifficulty();
    G.state.settings.tutorial = true;
    G.state.tutorial = { active: true, stepIdx: 0, completed: [] };
    const a = G.createUnit('Aldo');
    const b = G.createUnit('Bram');
    const c = G.createUnit('Cira');
    const start = G.WORLD.settlementById['svitavy'];
    if (start) {
      a.pos = { x: start.x + 0.6, y: start.y + 0.6 };
      b.pos = { x: start.x - 0.6, y: start.y + 0.9 };
      c.pos = { x: start.x + 1.1, y: start.y - 0.4 };
      G.state.camera.x = start.x + 0.5;
      G.state.camera.y = start.y + 0.5;
      G.state.camera.zoom = 1.0;
      G.state.selected = { type: 'settlement', id: 'svitavy' };
      G.state.stats.settlementsVisited = ['svitavy'];
    }
    G.state.units.push(a, b, c);
    const g = G.createGroup('Dobrodruzi');
    g.memberIds = [a.id, b.id, c.id];
    a.groupId = b.groupId = c.groupId = g.id;
    G.state.resources.gold = diff.startGold;
    const extraUnits = Math.max(0, (diff.startUnits || 3) - 3);
    for (let i = 0; i < extraUnits; i++) {
      const ue = G.createUnit();
      const stx = G.WORLD.settlementById['svitavy'];
      if (stx) ue.pos = { x: stx.x + 0.5 + (G.rand() - 0.5) * 2, y: stx.y + 0.5 + (G.rand() - 0.5) * 2 };
      G.state.units.push(ue);
    }
    G.initEconomy();
    if (G.ensurePolitics) G.ensurePolitics();
    if (G.ensureDynasty) G.ensureDynasty();
    for (const s of G.WORLD.settlements) G.ensureQuests(s.id);
    if (G.spawnCaravanNow) {
      G.spawnCaravanNow('kralov', 'svitavy', 'royal');
      G.spawnCaravanNow('kamenice', 'kralov', 'trade');
    }
    G.log(`🌟 Vítej ve Idle Realm! Obtížnost: ${diff.icon} ${diff.name}.`, 'story');
    G.log('📘 Sleduj úkol v panelu Místo — tutoriál tě provede začátkem.', 'story');
    G.log('🌍 Prestiž ti jednou otevře nový svět (novou mapu).', 'info');
    G.log('📖 Každá postava má vlastní deník — podívej se do karty postavy.', 'info');
  }

  function restoreSequences() {
    let maxU = 0, maxG = 0, maxT = 0, maxE = 0, maxQ = 0, maxC = 0, maxWE = 0, maxCon = 0;
    for (const u of G.state.units) maxU = Math.max(maxU, parseInt(u.id.slice(1), 10) || 0);
    for (const g of G.state.groups) maxG = Math.max(maxG, parseInt(g.id.slice(1), 10) || 0);
    for (const t of G.state.tasks) maxT = Math.max(maxT, parseInt(t.id.slice(1), 10) || 0);
    for (const e of (G.state.equipment || [])) maxE = Math.max(maxE, parseInt(e.id.slice(2), 10) || 0);
    if (G.state.quests) for (const sid in G.state.quests) for (const q of G.state.quests[sid])
      maxQ = Math.max(maxQ, parseInt(q.id.slice(1), 10) || 0);
    for (const c of (G.state.caravans || [])) maxC = Math.max(maxC, parseInt(c.id.slice(1), 10) || 0);
    for (const ev of (G.state.worldEvents || [])) maxWE = Math.max(maxWE, parseInt(ev.id.slice(2), 10) || 0);
    for (const j of (G.state.construction || [])) maxCon = Math.max(maxCon, parseInt(j.id.slice(1), 10) || 0);
    G.setUnitIdSeq(maxU + 1);
    G.setGroupIdSeq(maxG + 1);
    G.setTaskIdSeq(maxT + 1);
    if (G.setConstructionSeq) G.setConstructionSeq(maxCon + 1);
    if (G.setQuestSeq) G.setQuestSeq(maxQ + 1);
    if (G.setCaravanSeq) G.setCaravanSeq(maxC + 1);
    if (G.setWorldEventSeq) G.setWorldEventSeq(maxWE + 1);
    if (G.state.equipmentSeq == null || G.state.equipmentSeq <= maxE) G.state.equipmentSeq = maxE + 1;
  }

  function formatDuration(s) {
    const h = Math.floor(s/3600), m = Math.floor((s%3600)/60);
    if (h > 0) return `${h} h ${m} min`;
    if (m > 0) return `${m} min`;
    return `${Math.floor(s)} s`;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
