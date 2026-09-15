(function () {
  const G = window.Game;
  G.SAVE_KEY = 'idleRealmSave_v8';
  G.SAVE_VERSION = 8;
  G.SAVE_KEYS = [
    'idleRealmSave_v8','idleRealmSave_v7','idleRealmSave_v6',
    'idleRealmSave_v5','idleRealmSave_v4','idleRealmSave_v3','idleRealmSave_v2'
  ];

  G.newState = function () {
    return {
      version: G.SAVE_VERSION,
      time: 0, lastSave: Date.now(),
      worldSeed: null,
      dayTime: 0, day: 0, season: 'spring', year: 1,
      resources: { gold: 40, renown: 0 },
      materials: {}, equipment: [], equipmentSeq: 1,
      buildings: {}, units: [], groups: [], tasks: [],
      economy: {}, reputation: {}, settlementRep: {}, quests: {},
      caravans: [], worldEvents: [],
      expeditions: [], masterworks: [], orders: [], construction: [],
      prestige: { level: 0, totalPrestige: 0, unlocks: [], lastUnlock: null },
      base: { unlocked: false, buildings: {}, accum: {}, x: 14, y: 18, placing: false, placementOffered: false, suggested: null, moving: false },
      story: { completed: [], flags: {} },
      achievements: { unlocked: [] },
      combat: { active: null },
      family: { children: [] },
      politics: { factions: {}, lastCheck: 0 },
      dynasty: { generations: 1, names: [], totalBirths: 0, totalDeaths: 0 },
      directives: { focusMaterial: null, focusTarget: 30, avoidDanger: false },
      settings: { difficulty: null, tutorial: true },
      tutorial: null,
      killCounts: { beast: 0, humanoid: 0, monster: 0 },
      victoryReached: false,
      defeatReached: false,
      chapterHistory: [],
      pendingStory: null,
      selected: null,
      camera: { x: 7, y: 22, zoom: 1.0 },
      log: [], pendingEvents: [],
      logFilter: 'all', logSearch: '',
      stats: {
        totalWork: 0, tasksDone: 0, goldEarned: 0, goldSpent: 0,
        injuries: 0, masterworks: 0, combatsWon: 0, combatsLost: 0,
        questsCompleted: 0, settlementsVisited: [],
        totalWood: 0, totalStone: 0, totalIronOre: 0,
        merchantTrades: 0, merchantGoldEarned: 0,
        dragonsKilled: 0, ambitionsDone: 0,
        deaths: 0, births: 0, desertions: 0, resurrections: 0,
        abilitiesUsed: 0, electionsWon: 0, bossesKilled: 0,
        expeditions: 0, expeditionSuccesses: 0, namedMasterworks: 0,
        prestiges: 0
      }
    };
  };

  G.save = function () {
    if (!G.state) return;
    try {
      G.state.lastSave = Date.now();
      if (G.state.worldSeed == null) G.state.worldSeed = G.WORLD_SEED || 20260910;
      localStorage.setItem(G.SAVE_KEY, JSON.stringify(G.state));
    } catch (e) { console.warn('[IdleRealm] save failed:', e); }
  };
  G.load = function () {
    try {
      let raw = localStorage.getItem(G.SAVE_KEY);
      if (raw) { const p = JSON.parse(raw); if (p && p.version === G.SAVE_VERSION) return p; }
      for (const key of ['idleRealmSave_v7','idleRealmSave_v6','idleRealmSave_v5','idleRealmSave_v4','idleRealmSave_v3','idleRealmSave_v2']) {
        raw = localStorage.getItem(key);
        if (raw) { const p = JSON.parse(raw); const m = G.migrateSave(p); if (m) return m; }
      }
    } catch (e) { console.warn('[IdleRealm] load failed:', e); }
    return null;
  };
  G.migrateSave = function (save) {
    if (!save) return null;
    if (save.version === G.SAVE_VERSION) return save;
    save.version = G.SAVE_VERSION;
    save.worldSeed = save.worldSeed || G.WORLD_SEED || 20260910;
    save.equipment = save.equipment || []; save.equipmentSeq = save.equipmentSeq || 1;
    save.buildings = save.buildings || {}; save.reputation = save.reputation || {};
    save.settlementRep = save.settlementRep || {};
    save.quests = save.quests || {}; save.caravans = save.caravans || [];
    save.worldEvents = save.worldEvents || [];
    save.expeditions = save.expeditions || [];
    save.masterworks = save.masterworks || [];
    save.orders = save.orders || [];
    save.construction = save.construction || [];
    save.construction.forEach(j => { if (j.site == null) j.site = j.kind === 'base' ? 'base' : j.settlementId; });
    // rozestavěné stavby bez odpovídajícího úkolu se mají zkusit znovu rozjet
    save.construction.forEach(j => { if (j.taskId && !(save.tasks || []).some(t => t.id === j.taskId)) j.taskId = null; });
    save.dayTime = save.dayTime || 0;
    save.day = save.day || 0;
    save.season = save.season || 'spring';
    save.year = save.year || 1;
    save.logFilter = save.logFilter || 'all';
    if (save.logSearch == null) save.logSearch = '';
    save.prestige = save.prestige || { level: 0, totalPrestige: 0, unlocks: [] };
    if (!save.prestige.unlocks) save.prestige.unlocks = [];
    if (save.prestige.lastUnlock === undefined) save.prestige.lastUnlock = null;
    save.base = save.base || { unlocked: false, buildings: {}, accum: {}, x: 14, y: 18 };
    if (save.base.x == null) save.base.x = 14;
    if (save.base.y == null) save.base.y = 18;
    if (save.base.placementOffered == null) save.base.placementOffered = !!save.base.unlocked;
    if (save.base.suggested === undefined) save.base.suggested = null;
    save.base.placing = false;   // výběr místa je jen dočasný stav
    save.base.moving = false;
    save.story = save.story || { completed: [], flags: {} };
    save.achievements = save.achievements || { unlocked: [] };
    save.combat = save.combat || { active: null };
    save.family = save.family || { children: [] };
    save.politics = save.politics || { factions: {}, lastCheck: 0 };
    save.dynasty = save.dynasty || { generations: 1, names: [], totalBirths: 0, totalDeaths: 0 };
    save.directives = save.directives || { focusMaterial: null, focusTarget: 30, avoidDanger: false };
    if (save.directives.focusTarget == null) save.directives.focusTarget = 30;
    save.pendingStory = null;
    save.stats = save.stats || {};
    ['totalWork','tasksDone','goldEarned','goldSpent','injuries','masterworks','combatsWon','combatsLost',
     'questsCompleted','merchantTrades','merchantGoldEarned','dragonsKilled','totalWood','totalStone',
     'totalIronOre','ambitionsDone','deaths','births','desertions','resurrections','abilitiesUsed',
     'electionsWon','expeditions','expeditionSuccesses','namedMasterworks','prestiges']
      .forEach(k => save.stats[k] = save.stats[k] || 0);
    save.stats.settlementsVisited = save.stats.settlementsVisited || [];
    save.units = save.units || [];
    save.settings = save.settings || { difficulty: 'normal', tutorial: false };
    save.tutorial = save.tutorial || { active: false, stepIdx: 99, completed: [] };
    save.killCounts = save.killCounts || { beast: 0, humanoid: 0, monster: 0 };
    if (save.victoryReached == null) save.victoryReached = false;
    if (save.defeatReached == null) save.defeatReached = false;
    save.chapterHistory = save.chapterHistory || [];
    save.stats.bossesKilled = save.stats.bossesKilled || 0;
    const savedTime = save.time || 0;
    for (const u of save.units) {
      u.equipment = u.equipment || { tool: null, weapon: null, armor: null };
      u.stamina = u.maxStamina || 100; u.maxStamina = 100;
      u.resting = false; u.restingAt = null;
      u.injuries = u.injuries || []; u.perks = u.perks || {};
      u.mood = u.mood == null ? 70 : u.mood;
      u.relationships = u.relationships || {};
      u.role = u.role || null;
      u.merchantRoute = u.merchantRoute || null;
      u.merchantState = u.merchantState || null;
      u.personality = u.personality || G.rollPersonality();
      u.ambitions = u.ambitions || G.rollAmbitions();
      u._combatWins = u._combatWins || 0;
      u._injuriesHealed = u._injuriesHealed || 0;
      // FIX (Hotfix A): relativně k uloženému času, ne fixní -20*AGE_YEAR
      if (u.birthTime == null) u.birthTime = savedTime - G.randInt(20, 30) * G.AGE_YEAR;
      if (u.dead == null) u.dead = false;
      if (u.isChild == null) u.isChild = false;
      if (u.griefUntil === undefined) u.griefUntil = null;
      if (u.generation == null) u.generation = 1;
      if (!u.parentIds) u.parentIds = [];
      if (u.legacy == null) u.legacy = 0;
      if (u.manual == null) u.manual = false;
      if (u.onExpedition == null) u.onExpedition = false;
      if (!u.journal) u.journal = [];
      delete u.gear;
    }
    return save;
  };
  G.resetSave = function () {
    try {
      for (const key of G.SAVE_KEYS) localStorage.removeItem(key);
    } catch (e) {}
    location.reload();
  };

  G.exportSave = function () {
    if (!G.state) return null;
    if (G.currentDifficulty && G.currentDifficulty().noExport) return null;
    try {
      if (G.state.worldSeed == null) G.state.worldSeed = G.WORLD_SEED || 20260910;
      const json = JSON.stringify(G.state);
      return btoa(unescape(encodeURIComponent(json)));
    } catch (e) { console.warn('[IdleRealm] export failed:', e); return null; }
  };
  G.importSave = function (b64) {
    if (!b64) return { ok:false, reason:'Prázdný vstup.' };
    try {
      const json = decodeURIComponent(escape(atob(b64.trim())));
      const parsed = JSON.parse(json);
      if (!parsed || typeof parsed !== 'object') return { ok:false, reason:'Neplatný formát.' };
      const migrated = G.migrateSave(parsed);
      if (!migrated) return { ok:false, reason:'Migrace selhala.' };
      localStorage.setItem(G.SAVE_KEY, JSON.stringify(migrated));
      return { ok:true };
    } catch (e) { return { ok:false, reason:'Chyba: ' + e.message }; }
  };

  G.matAdd = function (matId, qty, quality) {
    qty = Math.floor(qty); if (qty <= 0) return;
    quality = quality || 'common';
    if (!G.state.materials[matId]) G.state.materials[matId] = {};
    const m = G.state.materials[matId];
    m[quality] = (m[quality] || 0) + qty;
    if (G.state.stats) {
      if (matId === 'wood') G.state.stats.totalWood = (G.state.stats.totalWood || 0) + qty;
      else if (matId === 'stone') G.state.stats.totalStone = (G.state.stats.totalStone || 0) + qty;
      else if (matId === 'iron_ore') G.state.stats.totalIronOre = (G.state.stats.totalIronOre || 0) + qty;
    }
    if (quality === 'masterwork' && G.state.stats) G.state.stats.masterworks = (G.state.stats.masterworks || 0) + qty;
  };
  G.matCount = function (matId) {
    const m = G.state.materials[matId]; if (!m) return 0;
    let s = 0; for (const q in m) s += m[q]; return s;
  };
  G.matCountQuality = function (matId, quality) {
    const m = G.state.materials[matId]; return (m && m[quality]) || 0;
  };
  G.matRemove = function (matId, qty) {
    qty = Math.floor(qty);
    const m = G.state.materials[matId]; if (!m) return false;
    let avail = 0; for (const q of G.QUALITY) avail += m[q] || 0;
    if (avail < qty) return false;
    let left = qty;
    for (const q of G.QUALITY) {
      if (left <= 0) break;
      const have = m[q] || 0; const take = Math.min(have, left);
      m[q] = have - take; if (m[q] <= 0) delete m[q];
      left -= take;
    }
    return true;
  };
  G.matRemoveQuality = function (matId, qty, quality) {
    const m = G.state.materials[matId]; if (!m) return false;
    const have = m[quality] || 0; if (have < qty) return false;
    m[quality] = have - qty; if (m[quality] <= 0) delete m[quality];
    return true;
  };
  G.hasMaterials = function (list) {
    for (const it of list) if (G.matCount(it.material) < it.qty) return false;
    return true;
  };
  G.matAvgQualityMult = function (matId) {
    const m = G.state.materials[matId]; if (!m) return 1;
    let qty = 0, sum = 0;
    for (const q in m) { qty += m[q]; sum += m[q] * G.QUALITY_MULT[q]; }
    return qty > 0 ? sum / qty : 1;
  };

  const MAX_LOG = 260;
  G.LOG_CATEGORIES = ['info', 'work', 'economy', 'combat', 'story', 'social', 'politics'];

  G.log = function (msg, category) {
    if (!G.state) return;
    G.state.log.push({
      t: G.state.time,
      msg: String(msg),
      cat: category || 'info'
    });
    if (G.state.log.length > MAX_LOG) G.state.log.splice(0, G.state.log.length - MAX_LOG);
    if (G.renderLog) G.renderLog();
  };
})();
