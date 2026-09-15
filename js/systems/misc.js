(function () {
  const G = window.Game;

  G.die = function (unit, reason) {
    if (unit.dead) return;
    unit.dead = true;
    unit.deathTime = G.state.time;
    unit.deathAge = G.unitAge ? G.unitAge(unit) : 0;
    unit.deathReason = reason || 'neznámý';
    if (unit.assignedTaskId) G.cancelTask(unit.assignedTaskId);
    G.removeUnitFromGroup(unit.id);
    unit.merchantState = null; unit.merchantRoute = null; unit.role = null;
    unit.resting = false;
    if (G.state.stats) G.state.stats.deaths = (G.state.stats.deaths || 0) + 1;
    const ageStr = unit.deathAge ? ` (${Math.round(unit.deathAge)} let)` : '';
    G.log(`⚰️ ${unit.name}${ageStr} zemřel — ${reason}.`, 'social');
    if (G.addJournal) G.addJournal(unit, `Zemřel — ${reason}.`, '⚰️');
    if (G.onCompanionLoss) G.onCompanionLoss(unit, reason);
    if (G.onDynastyDeath) G.onDynastyDeath(unit);
  };

  G.resurrectCost = function () { const n = (G.state.stats.resurrections || 0); return 500 + n * 400; };
  G.resurrect = function (unitId) {
    const u = G.getUnit(unitId);
    if (!u || !u.dead) return { ok:false, reason:'Postava není mrtvá.' };
    if (u.deserted) return { ok:false, reason:'Dezertér se nechce vrátit.' };
    if (G.currentDifficulty && G.currentDifficulty().permaDeath) return { ok:false, reason:'Na této obtížnosti je smrt trvalá.' };
    const cost = G.resurrectCost();
    if (G.matCount('potion') < 3) return { ok:false, reason:`Potřebuješ 3× lektvar.` };
    if (G.state.resources.gold < cost) return { ok:false, reason:`Potřebuješ ${cost} zlata.` };
    G.matRemove('potion', 3);
    G.state.resources.gold -= cost;
    G.state.stats.resurrections = (G.state.stats.resurrections || 0) + 1;
    u.dead = false; u.deathTime = null;
    const safeDeathAge = (u.deathAge && isFinite(u.deathAge)) ? u.deathAge : 30;
    u.birthTime = G.state.time - Math.max(20, (safeDeathAge - 5)) * G.AGE_YEAR;
    const attr = G.pick(G.ATTRS);
    u.attrs[attr] = Math.max(3, u.attrs[attr] - 2);
    u.mood = 40; u.stamina = u.maxStamina * 0.5; u._resurrected = true;
    u.injuries = [{ id:'wounded', healsAt: G.state.time + G.INJURIES.wounded.duration }];
    G.log(`✨ ${u.name} byl vzkříšen za ${cost} 🪙 a 3 lektvary.`, 'story');
    if (G.addJournal) G.addJournal(u, `Byl vzkříšen z mrtvých.`, '✨');
    return { ok:true, cost };
  };

  /* INJURIES */
  G.addInjury = function (unit, injuryType) {
    if (unit.dead) return null;
    if (!unit.injuries) unit.injuries = [];
    if (unit.injuries.length >= 3) return null;
    const def = typeof injuryType === 'string' ? G.INJURIES[injuryType] : injuryType;
    if (!def) return null;
    const existing = unit.injuries.find(i => i.id === def.id);
    if (existing) { existing.healsAt = Math.max(existing.healsAt, G.state.time + def.duration); return existing; }
    const injury = { id:def.id, healsAt: G.state.time + def.duration };
    unit.injuries.push(injury);
    G.log(`🩹 ${unit.name}: ${def.name} (${def.desc}).`, 'social');
    if (G.addJournal && def.severity >= 2) G.addJournal(unit, `Utrpěl zranění: ${def.name}.`, def.icon);
    if (def.severity === 3 && unit.assignedTaskId) G.cancelTask(unit.assignedTaskId);
    if (def.severity === 3 && !unit.resting) G.sendToRest(unit, true);
    return injury;
  };
  G.injuryWorkMult = function (unit) {
    if (!unit.injuries || !unit.injuries.length) return 1;
    let mult = 1;
    for (const inj of unit.injuries) { const def = G.INJURIES[inj.id]; if (def) mult *= def.workMult; }
    return mult;
  };
  G.hasSevereInjury = function (unit) {
    if (!unit.injuries) return false;
    return unit.injuries.some(inj => { const def = G.INJURIES[inj.id]; return def && def.severity >= 3; });
  };
  G.worstInjury = function (unit) {
    if (!unit.injuries || !unit.injuries.length) return null;
    let worst = null;
    for (const inj of unit.injuries) {
      const def = G.INJURIES[inj.id];
      if (!def) continue;
      if (!worst || def.severity > G.INJURIES[worst.id].severity) worst = inj;
    }
    return worst;
  };
  let healAccum = 0;
  const HEAL_CHECK = 2;
  G.tickInjuries = function (dt) {
    healAccum += dt;
    if (healAccum < HEAL_CHECK) return;
    const step = healAccum; healAccum = 0;
    for (const u of G.state.units) {
      if (u.dead) continue;
      if (!u.injuries || !u.injuries.length) continue;
      let healBoost = 1;
      if (u.restingAt && G.settlementBonuses) { const b = G.settlementBonuses(u.restingAt); if (b.healMult) healBoost = b.healMult; }
      if (u.groupId) { const g = G.getGroup(u.groupId); if (g) healBoost *= G.groupHealMult(g); }
      if (healBoost > 1) { const shift = step * (healBoost - 1); for (const inj of u.injuries) inj.healsAt -= shift; }
      const remaining = u.injuries.filter(inj => inj.healsAt > G.state.time);
      const healedCount = u.injuries.length - remaining.length;
      if (healedCount > 0) {
        u.injuries = remaining;
        G.log(`✨ ${u.name} se uzdravil.`, 'social');
        u._injuriesHealed = (u._injuriesHealed || 0) + healedCount;
        if (G.addJournal && u._injuriesHealed === 1) G.addJournal(u, 'Poprvé se uzdravil ze zranění.', '💪');
      }
    }
  };
  G.treatInjury = function (settlementId, unitId, injuryId) {
    const u = G.getUnit(unitId);
    if (!u || !u.injuries) return { ok:false, reason:'Nic k léčení.' };
    const inj = u.injuries.find(i => i.id === injuryId);
    if (!inj) return { ok:false, reason:'Zranění nenalezeno.' };
    const def = G.INJURIES[injuryId];
    const remaining = Math.max(0, inj.healsAt - G.state.time);
    const basePrice = def.severity === 3 ? 60 : def.severity === 2 ? 35 : 18;
    const cost = Math.max(5, Math.round(basePrice * (0.4 + remaining / def.duration)));
    if (G.state.resources.gold < cost) return { ok:false, reason:`Potřebuješ ${cost} zlata.` };
    G.state.resources.gold -= cost;
    u.injuries = u.injuries.filter(i => i.id !== injuryId);
    G.log(`⚕️ ${u.name}: ${def.name} vyléčeno za ${cost} zlata.`, 'economy');
    return { ok:true, cost };
  };

  /* BUILDINGS */
  G.buildingsAt = function (settlementId) {
    if (!G.state.buildings) G.state.buildings = {};
    if (!G.state.buildings[settlementId]) G.state.buildings[settlementId] = {};
    return G.state.buildings[settlementId];
  };
  G.buildingLevel = function (settlementId, buildingId) { return G.buildingsAt(settlementId)[buildingId] || 0; };
  G.buildingEffect = function (settlementId, buildingId) {
    const lvl = G.buildingLevel(settlementId, buildingId);
    if (lvl <= 0) return null;
    const def = G.BUILDINGS[buildingId];
    return def ? def.effect(lvl) : null;
  };
  G.settlementBonuses = function (settlementId) {
    const out = { sellMult:1, buyMult:1, craftQualityBonus:0, buildDiscount:0, restMult:1, stockMult:1, healMult:1, safetyMult:1, moodMult:1, combatTraining:1, xpBonus:1,
      smithingQuality:0, huntingQuality:0, alchemyQuality:0, herbalismQuality:0,
      smithingBatch:0, alchemyBatch:0, huntingYield:0, herbalismYield:0 };
    for (const bid in G.BUILDINGS) {
      const eff = G.buildingEffect(settlementId, bid);
      if (!eff) continue;
      for (const k in eff) {
        if (ADDITIVE_BONUS[k]) out[k] = (out[k] || 0) + eff[k];
        else out[k] = (out[k] || 1) * eff[k];
      }
    }
    return out;
  };

  /** Klíče, které se sčítají (ostatní se násobí). */
  function additiveKeys() {
    return ['craftQualityBonus','buildDiscount','smithingQuality','huntingQuality','alchemyQuality','herbalismQuality','smithingBatch','alchemyBatch','huntingYield','herbalismYield'];
  }
  const ADDITIVE_BONUS = {};
  additiveKeys().forEach(k => ADDITIVE_BONUS[k] = true);

  /** Sídlo, u kterého postava stojí (podle dosahu), jinak null. */
  G.settlementNearUnit = function (unit) {
    if (!unit || !unit.pos) return null;
    for (const s of G.WORLD.settlements) {
      const sd = G.SETTLEMENT_SIZE[s.size];
      if (Math.hypot(s.x + 0.5 - unit.pos.x, s.y + 0.5 - unit.pos.y) <= sd.radius + 1.5) return s.id;
    }
    return null;
  };

  /** Bonus budov sídla, u kterého postava stojí (jinak výchozí hodnota). */
  G.unitBonus = function (unit, key, dflt) {
    const fallback = dflt == null ? 1 : dflt;
    const sid = G.settlementNearUnit(unit);
    if (!sid) return fallback;
    const v = G.settlementBonuses(sid)[key];
    return v == null ? fallback : v;
  };

  /** Nejlepší bonus kvality z budov pro danou dovednost (skóre, sčítá se). */
  G.skillQualityBonus = function (units, skillId) {
    let best = 0;
    for (const u of (units || [])) {
      const sid = G.settlementNearUnit(u);
      if (!sid) continue;
      const b = G.settlementBonuses(sid);
      const v = (b.craftQualityBonus || 0) + (b[skillId + 'Quality'] || 0);
      if (v > best) best = v;
    }
    return best;
  };

  /** Bonus kusů navíc pro danou dovednost (sběr i výroba). */
  G.skillYieldBonus = function (units, skillId) {
    let best = 0;
    for (const u of (units || [])) {
      const sid = G.settlementNearUnit(u);
      if (!sid) continue;
      const b = G.settlementBonuses(sid);
      const v = (b[skillId + 'Yield'] || 0) + (b[skillId + 'Batch'] || 0);
      if (v > best) best = v;
    }
    return best;
  };

  /** Lidsky čitelný popis efektu budovy na dané úrovni (pro UI). */
  G.buildingEffectText = function (buildingId, level) {
    const def = G.BUILDINGS[buildingId];
    if (!def || level <= 0) return '';
    const e = def.effect(level), out = [];
    const pct = m => Math.round((m - 1) * 100);
    for (const k in e) {
      const v = e[k];
      if (k === 'sellMult') out.push(`prodejní ceny +${pct(v)} %`);
      else if (k === 'buyMult') out.push(`nákupní ceny ${pct(v)} %`);
      else if (k === 'stockMult') out.push(`zásoby sídla +${pct(v)} %`);
      else if (k === 'restMult') out.push(`odpočinek +${pct(v)} %`);
      else if (k === 'moodMult') out.push(`nálada z odpočinku +${pct(v)} %`);
      else if (k === 'healMult') out.push(`hojení +${pct(v)} %`);
      else if (k === 'safetyMult') out.push(`nebezpečí u sídla ${pct(v)} %`);
      else if (k === 'combatTraining') out.push(`bojová síla postav u sídla +${pct(v)} %`);
      else if (k === 'xpBonus') out.push(`XP dovedností u sídla +${pct(v)} %`);
      else if (k === 'craftQualityBonus') out.push(`kvalita výroby +${v}`);
      else if (k === 'buildDiscount') out.push(`stavby v sídle −${Math.round(v * 100)} %`);
      else if (k === 'smithingQuality') out.push(`kvalita kování +${v}`);
      else if (k === 'alchemyQuality') out.push(`kvalita alchymie +${v}`);
      else if (k === 'huntingQuality') out.push(`kvalita lovu +${v}`);
      else if (k === 'herbalismQuality') out.push(`kvalita bylinkářství +${v}`);
      else if (k === 'smithingBatch') out.push(`+${v} kus navíc při kování`);
      else if (k === 'alchemyBatch') out.push(`+${v} kus navíc při alchymii`);
      else if (k === 'huntingYield') out.push(`+${v} surovina navíc z lovu`);
      else if (k === 'herbalismYield') out.push(`+${v} surovina navíc ze sběru`);
      else out.push(`${k}: ${v}`);
    }
    return out.join(' • ');
  };

  /** Cena budovy s ohledem na slevu z Dílny. */
  G.buildingCost = function (settlementId, buildingId, level) {
    const def = G.BUILDINGS[buildingId];
    if (!def) return null;
    const cost = def.cost(level);
    const disc = (settlementId && G.settlementBonuses) ? (G.settlementBonuses(settlementId).buildDiscount || 0) : 0;
    if (!disc) return cost;
    const d = Math.min(0.6, disc);
    return {
      gold: Math.max(1, Math.round(cost.gold * (1 - d))),
      materials: cost.materials.map(m => ({ material: m.material, qty: Math.max(1, Math.round(m.qty * (1 - d))) }))
    };
  };

  G.canBuild = function (settlementId, buildingId) {
    const def = G.BUILDINGS[buildingId];
    if (!def) return { ok:false, reason:'Neznámá budova.' };
    const busy = G.constructionAt ? G.constructionAt(settlementId) : null;
    if (busy) return { ok:false, reason:`Nejdřív dokonči stavbu: ${G.buildingLabel(busy)}.` };
    const lvl = G.buildingLevel(settlementId, buildingId);
    if (lvl >= def.maxLevel) return { ok:false, reason:'Maximální úroveň.' };
    const cost = G.buildingCost(settlementId, buildingId, lvl + 1);
    if (G.state.resources.gold < cost.gold) return { ok:false, reason:`Potřebuješ ${cost.gold} zlata.` };
    for (const m of cost.materials) {
      if (G.matCount(m.material) < m.qty) return { ok:false, reason:`Chybí ${m.qty}× ${G.MATERIALS[m.material].name}.` };
    }
    return { ok:true, cost };
  };
  G.build = function (settlementId, buildingId) {
    const check = G.canBuild(settlementId, buildingId);
    if (!check.ok) return check;
    const cost = check.cost;
    G.state.resources.gold -= cost.gold;
    G.state.stats.goldSpent = (G.state.stats.goldSpent || 0) + cost.gold;
    for (const m of cost.materials) G.matRemove(m.material, m.qty);
    const lvl = G.buildingLevel(settlementId, buildingId) + 1;
    const s = G.WORLD.settlementById[settlementId];
    const def = G.BUILDINGS[buildingId];
    const job = G.startConstruction('settlement', settlementId, buildingId, lvl);
    G.log(job.taskId
      ? `🏗️ ${s ? s.name : settlementId}: stavba ${def.name} (úr. ${lvl}) začala.`
      : `🧱 ${s ? s.name : settlementId}: ${def.name} (úr. ${lvl}) čeká na stavitele — pošli k sídlu někoho schopného.`, 'work');
    return { ok:true, level:lvl, job:job };
  };

  /* EQUIPMENT */
  G.equipAdd = function (itemId, opts) {
    opts = opts || {};
    const def = G.EQUIPMENT[itemId]; if (!def) return null;
    if (!G.state.equipment) G.state.equipment = [];
    if (G.state.equipmentSeq == null) G.state.equipmentSeq = 1;
    const item = {
      id:'eq'+(G.state.equipmentSeq++), itemId,
      durability: opts.durability != null ? opts.durability : def.durability,
      quality: opts.quality || 'common',
      gems: []
    };
    G.state.equipment.push(item);
    return item;
  };
  G.equipRemove = function (instanceId) {
    if (!G.state.equipment) return null;
    const idx = G.state.equipment.findIndex(e => e.id === instanceId);
    if (idx < 0) return null;
    return G.state.equipment.splice(idx, 1)[0];
  };
  G.equipFind = function (instanceId) {
    if (!G.state.equipment) return null;
    return G.state.equipment.find(e => e.id === instanceId) || null;
  };
  G.buyEquipment = function (settlementId, itemId) {
    const def = G.EQUIPMENT[itemId];
    if (!def) return { ok:false, reason:'Neznámý předmět.' };
    if (def.legendary) return { ok:false, reason:'Legendární předmět nelze koupit.' };
    const b = G.settlementBonuses(settlementId);
    const srep = G.settlementRepMods(settlementId);
    const price = Math.max(1, Math.round(def.price * b.buyMult * srep.buyMult));
    if (G.state.resources.gold < price) return { ok:false, reason:`Potřebuješ ${price} zlata.` };
    G.state.resources.gold -= price;
    G.state.stats.goldSpent = (G.state.stats.goldSpent || 0) + price;
    // Kvalita nákupu podle sídla
    let q = 'common';
    const r = G.rand();
    if (srep && srep.tier === 'spojenec' && r < 0.3) q = 'fine';
    else if (r < 0.15) q = 'fine';
    else if (r < 0.20) q = 'crude';
    const item = G.equipAdd(itemId, { quality: q });
    G.log(`🛒 Koupil jsi ${def.name} (${G.QUALITY_LABEL[q]}) za ${price} zlata.`, 'economy');
    return { ok:true, price, instance:item };
  };
  G.sellEquipment = function (instanceId) {
    const item = G.equipFind(instanceId);
    if (!item) return { ok:false, reason:'Předmět nenalezen.' };
    const def = G.EQUIPMENT[item.itemId];
    if (!def) return { ok:false, reason:'Neznámý předmět.' };
    if (def.legendary) return { ok:false, reason:'Legendární předměty nelze prodat.' };
    const durFrac = item.durability / def.durability;
    const qMult = G.QUALITY_MULT[item.quality || 'common'];
    const price = Math.max(1, Math.round(def.price * 0.4 * durFrac * qMult));
    G.equipRemove(instanceId);
    G.state.resources.gold += price;
    G.log(`💰 Prodáno ${def.name} za ${price} zlata.`, 'economy');
    return { ok:true, price };
  };
  G.equipUnit = function (unitId, instanceId) {
    const u = G.getUnit(unitId);
    const item = G.equipFind(instanceId);
    if (!u || !item) return { ok:false, reason:'Chybí postava nebo předmět.' };
    const def = G.EQUIPMENT[item.itemId];
    const slot = def.slot;
    if (u.equipment[slot]) G.state.equipment.push(u.equipment[slot]);
    G.equipRemove(instanceId);
    u.equipment[slot] = item;
    G.refreshGearVisual(u);
    G.log(`🎽 ${u.name} si nasadil ${def.name}.`, 'social');
    return { ok:true };
  };
  G.unequipUnit = function (unitId, slot) {
    const u = G.getUnit(unitId);
    if (!u || !u.equipment[slot]) return { ok:false };
    const item = u.equipment[slot];
    u.equipment[slot] = null;
    G.state.equipment.push(item);
    G.refreshGearVisual(u);
    return { ok:true };
  };
  G.equipmentSkillBonus = function (unit, skillId) {
    if (!unit.equipment) return 0;
    let bonus = 0;
    const qMult = 0.5;
    for (const slot in unit.equipment) {
      const item = unit.equipment[slot];
      if (!item || item.durability <= 0) continue;
      const def = G.EQUIPMENT[item.itemId];
      if (def && def.mods && def.mods[skillId]) {
        const qualityBoost = 1 + (G.QUALITY_MULT[item.quality || 'common'] - 1) * qMult;
        bonus += def.mods[skillId] * qualityBoost;
      }
    }
    return bonus;
  };
  G.equipmentStaminaMult = function (unit) {
    if (!unit.equipment) return 1;
    let mult = 1;
    for (const slot in unit.equipment) {
      const item = unit.equipment[slot];
      if (!item || item.durability <= 0) continue;
      const def = G.EQUIPMENT[item.itemId];
      if (def && def.staminaDrain) mult *= def.staminaDrain;
    }
    return mult;
  };
  G.equipmentCombatBonus = function (unit) {
    if (!unit.equipment) return 0;
    let b = 0;
    for (const slot in unit.equipment) {
      const item = unit.equipment[slot];
      if (!item || item.durability <= 0) continue;
      const def = G.EQUIPMENT[item.itemId];
      if (def && def.combatBonus) {
        const qMult = G.QUALITY_MULT[item.quality || 'common'];
        b += def.combatBonus * (0.7 + 0.3 * qMult);
      }
      if (def && def.defBonus) {
        const qMult = G.QUALITY_MULT[item.quality || 'common'];
        b += def.defBonus * 0.3 * qMult;
      }
    }
    // Set bonusy
    if (G.setBonusFor) {
      const s = G.setBonusFor(unit);
      if (s.bonuses.atk) b *= s.bonuses.atk;
    }
    return b;
  };
  G.wearEquipment = function (unit, dt) {
    if (!unit.equipment) return;
    const wear = G.WEAR_PER_SEC * dt;
    let brokeAny = false;
    for (const slot in unit.equipment) {
      const item = unit.equipment[slot];
      if (!item || item.durability <= 0) continue;
      item.durability = Math.max(0, item.durability - wear);
      if (item.durability <= 0) {
        brokeAny = true;
        const def = G.EQUIPMENT[item.itemId];
        G.log(`💥 ${unit.name}: ${def.name} se opotřebil.`, 'social');
      }
    }
    if (brokeAny) G.refreshGearVisual(unit);
  };
  G.availableEquipment = function (settlementId) {
    const s = G.WORLD.settlementById[settlementId];
    if (!s) return [];
    const maxTier = s.size === 'city' ? 3 : s.size === 'town' ? 2 : 1;
    return Object.values(G.EQUIPMENT)
      .filter(e => e.tier <= maxTier && !e.legendary)
      .sort((a, b) => a.tier - b.tier || a.price - b.price);
  };

  /* PROFESSIONS */
  let profTimer = 0;
  G.tickProfessions = function (dt) {
    profTimer += dt;
    if (profTimer < 5) return;
    profTimer = 0;
    for (const u of G.state.units) G.checkProfession(u);
  };
  G.checkProfession = function (unit) {
    if (unit.dead || unit.isChild) return;
    if (unit.merchantState && unit.merchantState.active) {
      if (unit.profession !== 'merchant') unit.profession = 'merchant';
      return;
    }
    let best = null, bestLvl = 0;
    for (const sid in unit.skills) {
      const lvl = unit.skills[sid].level;
      if (lvl > bestLvl) { bestLvl = lvl; best = sid; }
    }
    if (!best || bestLvl < G.PROFESSION_THRESHOLD) { if (!unit.profession) unit.profession = 'adventurer'; return; }
    const profId = G.SKILL_TO_PROFESSION[best];
    if (!profId) return;
    if (unit.profession !== profId) {
      const np = G.PROFESSIONS[profId];
      unit.profession = profId;
      if (np) { G.log(`🎖️ ${unit.name} se stal ${np.name}.`, 'social'); if (G.addJournal) G.addJournal(unit, `Stal se ${np.name}.`, np.icon); }
    }
  };
  G.professionOf = function (unit) {
    if (!unit.profession) return G.PROFESSIONS.adventurer;
    return G.PROFESSIONS[unit.profession] || G.PROFESSIONS.adventurer;
  };
  G.professionSkillMult = function (unit, skillId) {
    const prof = G.professionOf(unit);
    if (!prof) return 1;
    if (prof.primary === null && !prof.bonus) return 1;
    if (prof.bonus && prof.bonus[skillId] != null) return prof.bonus[skillId];
    if (prof.penalty && prof.penalty !== 1) return prof.penalty;
    return 1;
  };

  /* PERKS */
  G.perksOf = function (unit, skillId) { if (!unit.perks) unit.perks = {}; if (!unit.perks[skillId]) unit.perks[skillId] = {}; return unit.perks[skillId]; };
  G.perkAt = function (unit, skillId, level) { return G.perksOf(unit, skillId)[level] || null; };
  G.perkChoices = function (unit, skillId, level) { const table = G.PERKS[skillId]; if (!table) return []; return table[level] || []; };
  G.canPickPerk = function (unit, skillId, level) { if (G.unitSkill(unit, skillId) < level) return false; return !G.perkAt(unit, skillId, level); };
  G.pickPerk = function (unitId, skillId, level, perkId) {
    const u = G.getUnit(unitId);
    if (!u) return { ok:false, reason:'Postava nenalezena.' };
    if (!G.canPickPerk(u, skillId, level)) return { ok:false, reason:'Nelze vybrat.' };
    const choices = G.perkChoices(u, skillId, level);
    const choice = choices.find(c => c.id === perkId);
    if (!choice) return { ok:false, reason:'Neznámý perk.' };
    G.perksOf(u, skillId)[level] = choice.id;
    G.log(`✨ ${u.name}: ${G.SKILLS[skillId].name} — ${choice.name}.`, 'social');
    if (G.addJournal) G.addJournal(u, `Zvolil si perk: ${choice.name} (${G.SKILLS[skillId].name}).`, '✨');
    return { ok:true };
  };
  G.respecSkill = function (unitId, skillId) {
    const u = G.getUnit(unitId);
    if (!u || !u.perks || !u.perks[skillId]) return { ok:false };
    if (G.state.resources.gold < G.RESPEC_COST) return { ok:false, reason:`Potřebuješ ${G.RESPEC_COST} zlata.` };
    G.state.resources.gold -= G.RESPEC_COST;
    u.perks[skillId] = {};
    G.log(`🔄 ${u.name}: perky ${G.SKILLS[skillId].name} resetovány.`, 'social');
    return { ok:true };
  };
  G.perkEffects = function (unit, skillId) {
    const eff = { work:1, quality:0, stamina:1, safety:1, combat:1, groupCombat:1, craftBatch:0, scoutBonusLoot:0, extraOutput:{}, rareDrop:[], craftingSave:{} };
    if (!unit.perks || !unit.perks[skillId]) return eff;
    const picked = unit.perks[skillId];
    for (const level in picked) {
      const perkId = picked[level];
      const table = G.PERKS[skillId]; if (!table) continue;
      const perk = (table[level] || []).find(c => c.id === perkId);
      if (!perk || !perk.effect) continue;
      const e = perk.effect;
      if (e.work != null) eff.work *= e.work;
      if (e.quality != null) eff.quality += e.quality;
      if (e.stamina != null) eff.stamina *= e.stamina;
      if (e.safety != null) eff.safety *= e.safety;
      if (e.combat != null) eff.combat *= e.combat;
      if (e.groupCombat != null) eff.groupCombat *= e.groupCombat;
      if (e.craftBatch != null) eff.craftBatch += e.craftBatch;
      if (e.scoutBonusLoot != null) eff.scoutBonusLoot += e.scoutBonusLoot;
      if (e.extraOutput) { const m = e.extraOutput.material; eff.extraOutput[m] = (eff.extraOutput[m] || 0) + e.extraOutput.qty; }
      if (e.rareDrop) eff.rareDrop.push(e.rareDrop);
      if (e.craftingSave) { const m = e.craftingSave.material; eff.craftingSave[m] = (eff.craftingSave[m] || 0) + e.craftingSave.qty; }
    }
    return eff;
  };
  G.perkWorkMult = function (unit, skillId) { return G.perkEffects(unit, skillId).work; };
  G.perkQualityBonus = function (unit, skillId) { return G.perkEffects(unit, skillId).quality; };
  G.perkSafetyMult = function (unit, skillId) { return G.perkEffects(unit, skillId).safety; };
  G.perkCombatMult = function (unit) {
    let m = 1;
    for (const sid in G.SKILLS) { const eff = G.perkEffects(unit, sid); if (eff.combat !== 1) m *= eff.combat; }
    return m;
  };
  G.perkStaminaMult = function (unit, skillId) { return G.perkEffects(unit, skillId).stamina; };
  G.perkExtraOutput = function (unit, skillId) { return G.perkEffects(unit, skillId).extraOutput; };
  G.perkCraftBatch = function (unit, skillId) { return G.perkEffects(unit, skillId).craftBatch; };

  /* MENTORSHIP */
  G.MENTOR_MIN_DIFF = 8;
  G.MENTOR_XP_BONUS = 0.80;
  G.MENTOR_WORK_BONUS = 0.10;
  G.MENTOR_SPEED_PENALTY = 0.75;
  G.mentorOf = function (unit) { if (!unit.mentorId) return null; const m = G.getUnit(unit.mentorId); if (!m) { unit.mentorId = null; return null; } return m; };
  G.isTraining = function (unit) {
    if (!unit.mentorId) return false;
    const m = G.getUnit(unit.mentorId); if (!m) return false;
    if (!unit.assignedTaskId || !m.assignedTaskId) return false;
    return unit.assignedTaskId === m.assignedTaskId;
  };
  G.setMentor = function (apprenticeId, mentorId) {
    const a = G.getUnit(apprenticeId), m = G.getUnit(mentorId);
    if (!a || !m) return { ok:false, reason:'Postava nenalezena.' };
    if (a.id === m.id) return { ok:false, reason:'Nemůžeš být sám sobě mistrem.' };
    let bestSkill = null, bestLvl = 0;
    for (const sid in a.skills) {
      const mLvl = G.unitSkill(m, sid), aLvl = G.unitSkill(a, sid);
      if (mLvl - aLvl >= G.MENTOR_MIN_DIFF && mLvl > bestLvl) { bestSkill = sid; bestLvl = mLvl; }
    }
    if (!bestSkill) return { ok:false, reason:`Mistr musí mít dovednost o ${G.MENTOR_MIN_DIFF}+ úrovní výš.` };
    a.mentorId = m.id; a.mentorSkill = bestSkill;
    G.log(`🎓 ${m.name} učí ${a.name} — ${G.SKILLS[bestSkill].name}.`, 'social');
    return { ok:true, skill:bestSkill };
  };
  G.clearMentor = function (apprenticeId) { const a = G.getUnit(apprenticeId); if (!a) return; a.mentorId = null; a.mentorSkill = null; };
  G.trainingXpMult = function (unit, skillId) { if (!G.isTraining(unit)) return 1; if (unit.mentorSkill !== skillId) return 1; return 1 + G.MENTOR_XP_BONUS; };
  G.trainingWorkMult = function (unit, skillId) { if (!G.isTraining(unit)) return 1; if (unit.mentorSkill !== skillId) return 1; return 1 + G.MENTOR_WORK_BONUS; };
  G.mentorWorkMult = function (unit, skillId) {
    if (!unit.id) return 1;
    for (const a of G.state.units) {
      if (a.mentorId !== unit.id) continue;
      if (!G.isTraining(a)) continue;
      if (a.mentorSkill !== skillId) continue;
      return G.MENTOR_SPEED_PENALTY;
    }
    return 1;
  };
  G.availableMentors = function (apprenticeId) {
    const a = G.getUnit(apprenticeId); if (!a) return [];
    const out = [];
    for (const m of G.state.units) {
      if (m.id === a.id || m.dead) continue;
      for (const sid in a.skills) {
        const mLvl = G.unitSkill(m, sid), aLvl = G.unitSkill(a, sid);
        if (mLvl - aLvl >= G.MENTOR_MIN_DIFF) { out.push({ mentor:m, skill:sid, diff: mLvl - aLvl }); break; }
      }
    }
    return out;
  };
})();
