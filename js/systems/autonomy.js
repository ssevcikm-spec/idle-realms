(function () {
  const G = window.Game;
  let timer = 0;
  const INTERVAL = 2;

  G.tickAutonomy = function (dt) {
    timer += dt;
    if (timer < INTERVAL) return;
    timer = 0;

    // Fronta příkazů hráče má přednost před automatickou prací
    if (G.tickOrders) G.tickOrders();
    // Rozestavěné stavby bez stavitelů zkusí získat nové
    if (G.tickConstruction) G.tickConstruction();

    if (G.tickProfessions) G.tickProfessions(INTERVAL);
    if (G.tickRestCheck) G.tickRestCheck();
    if (G.tickStaminaRegen) for (const u of G.state.units) G.tickStaminaRegen(u, INTERVAL);
    if (G.tickMood) G.tickMood(INTERVAL);
    if (G.tickRelationships) G.tickRelationships(INTERVAL);
    if (G.tickPersonalityDrift) G.tickPersonalityDrift(INTERVAL);
    if (G.tickPersonalityReactions) G.tickPersonalityReactions(INTERVAL);
    if (G.tickDesertion) G.tickDesertion(INTERVAL);
    if (G.tickAmbitions) G.tickAmbitions(INTERVAL);
    if (G.tickBase) G.tickBase(INTERVAL);
    if (G.tryUnlockBase) G.tryUnlockBase();

    for (const g of G.state.groups) {
      if (!g.focus) continue;
      const act = G.ACTIVITIES[g.focus];
      if (!act) { g.focus = null; continue; }
      const idle = G.groupMembers(g).filter(u =>
        u && !u.dead && !u.isChild && !u.onExpedition && !u.assignedTaskId && !u.resting
        && !(G.hasSevereInjury && G.hasSevereInjury(u))
        && !(u.merchantState && u.merchantState.active)
        && !(G.unitRefusesWork && G.unitRefusesWork(u))
        && !(u._refuseUntil && G.state.time < u._refuseUntil) && !u.manual);
      if (!idle.length) continue;
      const node = G.findNodeFor(g.focus, idle.map(u => u.id));
      if (!node) continue;
      G.startTask(g.focus, idle.map(u => u.id), {
        nodeId: node.id,
        targetQty: act.mode === 'quantity' ? (act.defaultQty || 10) : 1,
        auto: true
      });
    }

    for (const u of G.state.units) {
      if (u.dead || u.isChild || u.onExpedition) continue;
      if (u.assignedTaskId || u.resting) continue;
      if (u.merchantState && u.merchantState.active) continue;
      if (G.hasSevereInjury && G.hasSevereInjury(u)) continue;
      if (G.unitRefusesWork && G.unitRefusesWork(u)) continue;
      if (u._refuseUntil && G.state.time < u._refuseUntil) continue;
      if (u.manual) continue;
      if (u.groupId) {
        const g = G.getGroup(u.groupId);
        if (g && g.focus) continue;
      }
      const pick = pickActivity(u);
      if (!pick) continue;
      G.startTask(pick.act.id, [u.id], {
        nodeId: pick.node.id,
        targetQty: pick.act.mode === 'quantity' ? Math.max(3, Math.floor((pick.act.defaultQty || 10) / 2)) : 1,
        auto: true
      });
    }
  };

  function pickActivity(unit) {
    const cands = [];
    const dir = G.state.directives || {};
    const prof = G.professionOf ? G.professionOf(unit) : null;
    for (const aid in G.ACTIVITIES) {
      const a = G.ACTIVITIES[aid];
      if (a.hidden) continue;
      if (!meetsReq(unit, a)) continue;
      const node = G.WORLD.nearestNode(a.nodeKinds, unit.pos.x, unit.pos.y);
      if (!node) continue;
      const danger = G.nodeDanger ? G.nodeDanger(node.kind) : 0;
      if (danger >= 2) {
        const power = G.unitCombatPower(unit);
        if (power < danger * 18) continue;
      }
      if (danger === 3) continue;
      if (dir.avoidDanger && danger >= 2) continue;
      const dist = Math.hypot(node.x - unit.pos.x, node.y - unit.pos.y);
      const lvl = G.unitSkill(unit, a.skill);
      let w = (1 + lvl*lvl*0.12) / (1 + dist*0.07);
      if (unit.traits.some(t => t.id === 'likes_nature') && (a.skill === 'woodcutting' || a.skill === 'herbalism')) w *= 2.2;
      if (unit.traits.some(t => t.id === 'likes_stone') && a.skill === 'mining') w *= 2.2;
      if (prof && prof.primary === a.skill) w *= 2.5;
      if (prof && prof.bonus && prof.bonus[a.skill]) w *= 1.5;
      if (G.timeWorkMod) w *= G.timeWorkMod(a.skill);
      if (dir.focusMaterial && a.output && a.output.some(o => o.material === dir.focusMaterial)) {
        const have = G.matCount(dir.focusMaterial);
        const target = dir.focusTarget || 30;
        if (have < target) w *= 8;
        else if (have < target * 2) w *= 1.5;
      } else if (a.output) {
        let need = 0;
        for (const o of a.output) need = Math.max(need, materialNeed(o.material));
        if (need > 0) w *= 1 + need * 6;
      }
      cands.push({ act: a, node, w });
    }
    if (!cands.length) return null;
    let total = 0;
    for (const c of cands) total += c.w;
    let r = G.rand() * total;
    for (const c of cands) { r -= c.w; if (r <= 0) return c; }
    return cands[cands.length - 1];
  }
  function meetsReq(unit, a) {
    if (!a.requires || !a.requires.skillLevel) return true;
    for (const sid in a.requires.skillLevel) {
      if (G.unitSkill(unit, sid) < a.requires.skillLevel[sid]) return false;
    }
    return true;
  }
  function materialNeed(matId) {
    const count = G.matCount(matId);
    if (count >= 15) return 0;
    return (15 - count) / 15;
  }
  G.pickActivity = pickActivity;
  G.setDirective = function (key, value) {
    if (!G.state.directives) G.state.directives = { focusMaterial: null, focusTarget: 30, avoidDanger: false };
    G.state.directives[key] = value;
  };
  G.getDirective = function (key) {
    return (G.state.directives || {})[key];
  };

  const REST_THRESHOLD = 20;
  const REGEN_BASE = 1.2, DRAIN_BASE = 0.35;
  G.tickStaminaDrain = function (unit, dt) {
    if (unit.dead || unit.resting || !unit.assignedTaskId) return;
    const mult = G.equipmentStaminaMult(unit);
    const traitMult = G.unitTraitMod(unit, 'stamina', 1);
    let perkMult = 1;
    if (G.perkStaminaMult) {
      const t = G.state.tasks.find(x => x.id === unit.assignedTaskId);
      if (t) { const a = G.ACTIVITIES[t.activityId]; if (a) perkMult = G.perkStaminaMult(unit, a.skill); }
    }
    let weMult = G.worldEventStaminaMult ? G.worldEventStaminaMult() : 1;
    const tMult = G.timeStaminaMod ? G.timeStaminaMod() : 1;
    unit.stamina = Math.max(0, unit.stamina - DRAIN_BASE * mult * traitMult * perkMult * weMult * tMult * dt);
  };
  G.tickStaminaRegen = function (unit, dt) {
    if (unit.dead || !unit.resting) return;
    let mult = 1, moodMult = 1;
    if (unit.restingAt && G.settlementBonuses) {
      const b = G.settlementBonuses(unit.restingAt);
      mult = b.restMult;
      moodMult = b.moodMult || 1;
    }
    unit.stamina = Math.min(unit.maxStamina, unit.stamina + REGEN_BASE * mult * dt);
    if (unit.mood != null && unit.mood < 90) unit.mood = Math.min(90, unit.mood + 0.4 * moodMult * dt);
    if (unit.stamina >= unit.maxStamina) {
      unit.resting = false; unit.restingAt = null; unit.status = 'idle';
      G.log(`💪 ${unit.name} je odpočatý.`, 'social');
    }
  };
  G.tickRestCheck = function () {
    for (const u of G.state.units) {
      if (u.dead || u.onExpedition) continue;
      if (u.resting) continue;
      if (u.stamina < REST_THRESHOLD) G.sendToRest(u, true);
    }
  };
  G.sendToRest = function (unit, auto) {
    if (unit.dead || unit.resting) return;
    if (unit.assignedTaskId) G.cancelTask(unit.assignedTaskId);
    unit.resting = true; unit.status = 'resting';
    let best = null, bestD = Infinity;
    for (const s of G.WORLD.settlements) {
      const d = Math.hypot(s.x + 0.5 - unit.pos.x, s.y + 0.5 - unit.pos.y);
      if (d < bestD) { bestD = d; best = s; }
    }
    unit.restingAt = best ? best.id : null;
    if (!auto) G.log(`😴 ${unit.name} jde odpočívat.`, 'social');
    else G.log(`😴 ${unit.name} je vyčerpaný a jde odpočívat.`, 'social');
  };
  G.wakeUnit = function (unit) {
    if (!unit.resting) return;
    unit.resting = false; unit.restingAt = null; unit.status = 'idle';
  };
  /** Vzbudí všechny odpočívající postavy; vrací počet probuzených. */
  G.wakeAllUnits = function () {
    let n = 0;
    for (const u of G.state.units) {
      if (u.resting) { G.wakeUnit(u); n++; }
    }
    return n;
  };

  G.baseBuildingLevel = function (buildingId) {
    if (!G.state.base || !G.state.base.buildings) return 0;
    return G.state.base.buildings[buildingId] || 0;
  };
  G.canBuildBase = function (buildingId) {
    const def = G.BASE_BUILDINGS[buildingId];
    if (!def) return { ok:false, reason:'Neznámá budova.' };
    const busy = G.constructionAt ? G.constructionAt('base') : null;
    if (busy) return { ok:false, reason:`Nejdřív dokonči stavbu: ${G.buildingLabel(busy)}.` };
    const lvl = G.baseBuildingLevel(buildingId);
    if (lvl >= def.maxLevel) return { ok:false, reason:'Maximální úroveň.' };
    const cost = def.cost(lvl + 1);
    if (G.state.resources.gold < cost.gold) return { ok:false, reason:`Potřebuješ ${cost.gold} zlata.` };
    for (const m of cost.materials) {
      if (G.matCount(m.material) < m.qty) return { ok:false, reason:`Chybí ${m.qty}× ${G.MATERIALS[m.material].name}.` };
    }
    return { ok:true, cost };
  };
  G.buildBase = function (buildingId) {
    const check = G.canBuildBase(buildingId);
    if (!check.ok) return check;
    const cost = check.cost;
    G.state.resources.gold -= cost.gold;
    G.state.stats.goldSpent = (G.state.stats.goldSpent || 0) + cost.gold;
    for (const m of cost.materials) G.matRemove(m.material, m.qty);
    if (!G.state.base) G.state.base = { unlocked:true, buildings:{}, accum:{} };
    if (!G.state.base.buildings) G.state.base.buildings = {};
    const def = G.BASE_BUILDINGS[buildingId];
    const lvl = G.baseBuildingLevel(buildingId) + 1;
    const job = G.startConstruction('base', null, buildingId, lvl);
    G.log(job.taskId
      ? `🏗️ Základna: stavba ${def.name} (úr. ${lvl}) začala.`
      : `🧱 Základna: ${def.name} (úr. ${lvl}) čeká na stavitele — někdo musí být u základny.`, 'work');
    return { ok:true, level:lvl, job:job };
  };
  /** Od kolika renomé se odemyká základna (volba v příběhu ji umí zlevnit). */
  G.baseUnlockRenown = function () {
    return (G.storyFlag && G.storyFlag('plan') === 'base') ? 20 : G.BASE_UNLOCK.renown;
  };

  G.tryUnlockBase = function () {
    if (G.state.base && G.state.base.unlocked) return false;
    if (G.state.resources.renown < G.baseUnlockRenown()) return false;
    if (!G.state.base) G.state.base = { unlocked:false, buildings:{}, accum:{}, x: G.BASE_POS.x, y: G.BASE_POS.y };
    if (G.state.base.placementOffered) return false;
    G.state.base.placementOffered = true;
    G.state.base.suggested = null;   // dopočítá se líně
    const s = G.baseSuggestion();
    G.log(`🏕️ Máš dost renomé na vlastní základnu! Vyber místo tlačítkem 🏕️ na mapě${s ? ` (doporučeno ${s.x}, ${s.y})` : ''}.`, 'story');
    return true;
  };

  /* ---------- základna: poloha, výběr místa ---------- */

  /** Autoritativní poloha základny (stav hry, s fallbackem na výchozí bod). */
  G.basePos = function () {
    const b = G.state.base || {};
    return {
      x: b.x == null ? G.BASE_POS.x : b.x,
      y: b.y == null ? G.BASE_POS.y : b.y
    };
  };

  G.baseNearestSettlement = function (x, y) {
    let best = null, bestD = Infinity;
    for (const s of G.WORLD.settlements) {
      const d = Math.hypot(s.x - (x == null ? G.basePos().x : x), s.y - (y == null ? G.basePos().y : y));
      if (d < bestD) { bestD = d; best = s; }
    }
    return best ? { settlement: best, dist: bestD } : null;
  };
  G.baseNearestNode = function (x, y) {
    const p = G.basePos();
    const tx = x == null ? p.x : x, ty = y == null ? p.y : y;
    let best = null, bestD = Infinity;
    for (const n of G.WORLD.nodes) {
      const d = Math.hypot(n.x - tx, n.y - ty);
      if (d < bestD) { bestD = d; best = n; }
    }
    return best ? { node: best, dist: bestD } : null;
  };

  /** Lidsky čitelný popis polohy („5 polí od Královské Město, u Dolu"). */
  G.baseLocationText = function (x, y) {
    const near = G.baseNearestSettlement(x, y);
    const nn = G.baseNearestNode(x, y);
    const parts = [];
    if (near) parts.push(`${Math.round(near.dist)} polí od ${near.settlement.name}`);
    if (nn && nn.dist <= 3) parts.push(`u ${G.NODE_KINDS[nn.node.kind].name.toLowerCase()}`);
    return parts.join(' • ') || 'v divočině';
  };

  /** Může tady základna stát? Vrací { ok, reason }. */
  G.canPlaceBaseAt = function (x, y) {
    const w = G.WORLD;
    if (x == null || y == null) return { ok:false, reason:'Neplatné pole.' };
    if (x < 1 || y < 1 || x >= w.w - 1 || y >= w.h - 1) return { ok:false, reason:'Mimo mapu.' };
    const t = w.terrainAt(x, y);
    if (t === 'water') return { ok:false, reason:'Na vodě základna stát nemůže.' };
    if (t === 'mountain') return { ok:false, reason:'Na skále základna stát nemůže.' };
    const n = w.nodeAt(x, y);
    if (n) return { ok:false, reason:`Tady je ${G.NODE_KINDS[n.kind].name} — vyber jiné pole.` };
    const s = w.settlementAt(x, y);
    if (s) return { ok:false, reason:`Tady leží ${s.name}.` };
    for (const st of w.settlements) {
      const d = Math.hypot(st.x - x, st.y - y);
      if (d <= G.SETTLEMENT_SIZE[st.size].radius + 1.5) {
        return { ok:false, reason:`Moc blízko ${st.name} — nech odstup ${G.SETTLEMENT_SIZE[st.size].radius + 2} polí.` };
      }
    }
    return { ok:true };
  };

  /** Nejlepší volné pole: blízko sídla (obchod) i různých surovinových uzlů. */
  G.suggestBaseSpot = function () {
    let best = null, bestScore = -Infinity;
    for (let y = 1; y < G.WORLD.h - 1; y++) {
      for (let x = 1; x < G.WORLD.w - 1; x++) {
        if (!G.canPlaceBaseAt(x, y).ok) continue;
        let score = 0;
        const near = G.baseNearestSettlement(x, y);
        if (near) score -= Math.abs(near.dist - 4) * 1.5;   // ~4 pole od sídla: po ruce, ale ne pod hradbami
        const kinds = new Set();
        for (const n of G.WORLD.nodes) {
          const d = Math.hypot(n.x - x, n.y - y);
          if (d <= 4) { kinds.add(n.kind); score += (5 - d) * 0.6; }
        }
        score += kinds.size * 2;
        if (score > bestScore) { bestScore = score; best = { x: x, y: y, score: Math.round(score) }; }
      }
    }
    return best;
  };

  /** Doporučené místo (uložené, jinak dopočítané a zapamatované). */
  G.baseSuggestion = function () {
    if (!G.state.base) G.state.base = { unlocked:false, buildings:{}, accum:{}, x: G.BASE_POS.x, y: G.BASE_POS.y };
    const b = G.state.base;
    if (!b.suggested) b.suggested = G.suggestBaseSpot();
    return b.suggested;
  };

  /** Zapne režim výběru místa (nová základna i přesun). */
  G.startBasePlacement = function (moving) {
    if (!G.state.base) G.state.base = { unlocked:false, buildings:{}, accum:{}, x: G.BASE_POS.x, y: G.BASE_POS.y };
    G.state.base.placing = true;
    G.state.base.moving = !!moving;
    return true;
  };
  G.cancelBasePlacement = function () {
    if (!G.state.base) return;
    G.state.base.placing = false;
    G.state.base.moving = false;
  };
  G.isBasePlacing = function () { return !!(G.state.base && G.state.base.placing); };

  /** Postaví (nebo přesune) základnu na dané pole. */
  G.placeBaseAt = function (x, y) {
    const check = G.canPlaceBaseAt(x, y);
    if (!check.ok) return check;
    const b = G.state.base;
    const wasUnlocked = !!b.unlocked;
    if (wasUnlocked && !b.moving) return { ok:false, reason:'Základna už stojí.' };
    b.x = x; b.y = y;
    b.unlocked = true;
    b.placing = false;
    b.placementOffered = false;
    if (!b.buildings) b.buildings = {};
    if (!b.accum) b.accum = {};
    const loc = G.baseLocationText(x, y);
    if (wasUnlocked) { b.moving = false; G.log(`🚚 Základna přesunuta — ${loc}.`, 'work'); }
    else G.log(`🏕️ Základna založena — ${loc}.`, 'story');
    return { ok:true, x: x, y: y };
  };

  /** Lze základnu ještě přesunout? (Jen dokud na ní nic nestojí.) */
  G.canMoveBase = function () {
    if (!G.state.base || !G.state.base.unlocked) return false;
    const b = G.state.base.buildings || {};
    for (const k in b) if (b[k] > 0) return false;
    return true;
  };

  G.legendaryDropBonus = function () {
    const lvl = G.baseBuildingLevel ? G.baseBuildingLevel('legendary_forge') : 0;
    return lvl * 0.05;
  };

  let gemTimer = 0;
  const GEM_INTERVAL = 300;

  let baseTimer = 0;
  const BASE_INTERVAL = 2;
  G.tickBase = function (dt) {
    baseTimer += dt;
    if (baseTimer < BASE_INTERVAL) return;
    const step = baseTimer; baseTimer = 0;
    if (!G.state.base || !G.state.base.unlocked) return;
    if (!G.state.base.accum) G.state.base.accum = {};
    for (const bid in G.BASE_BUILDINGS) {
      const def = G.BASE_BUILDINGS[bid];
      const lvl = G.baseBuildingLevel(bid);
      if (lvl <= 0) continue;
      const rate = def.rate(lvl);
      const add = rate * step;
      const accum = (G.state.base.accum[bid] || 0) + add;
      const whole = Math.floor(accum);
      if (whole > 0) {
        const q = G.chance(G.BASE_FINE_CHANCE) ? 'fine' : 'common';
        G.matAdd(def.produces, whole, q);
        G.state.base.accum[bid] = accum - whole;
      } else G.state.base.accum[bid] = accum;
    }
    const gemLvl = G.baseBuildingLevel ? G.baseBuildingLevel('gem_smithy') : 0;
    if (gemLvl > 0) {
      gemTimer += step;
      if (gemTimer >= GEM_INTERVAL / gemLvl) {
        gemTimer = 0;
        const gemIds = Object.keys(G.GEMS);
        const gid = gemIds[G.randInt(0, gemIds.length - 1)];
        G.matAdd('gem_' + gid, 1, 'common');
        G.log(`💎 Gemmová dílna vyrobila ${G.GEMS[gid].icon} ${G.GEMS[gid].name}.`, 'work');
      }
    }
  };
  G.baseProductionSummary = function () {
    const out = {};
    if (!G.state.base || !G.state.base.unlocked) return out;
    for (const bid in G.BASE_BUILDINGS) {
      const def = G.BASE_BUILDINGS[bid];
      const lvl = G.baseBuildingLevel(bid);
      if (lvl <= 0) continue;
      const perHour = def.rate(lvl) * 3600;
      out[def.produces] = (out[def.produces] || 0) + perHour;
    }
    return out;
  };
})();
