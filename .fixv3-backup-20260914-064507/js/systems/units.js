(function () {
  const G = window.Game;
  G.ATTRS = ['str', 'agi', 'int', 'end', 'luk'];
  G.ATTR_LABEL = { str:'Síla', agi:'Obratnost', int:'Inteligence', end:'Výdrž', luk:'Štěstí' };

  let unitIdSeq = 1;
  G.setUnitIdSeq = function (v) { unitIdSeq = v; };

  const COLORS = ['#8c4a3a','#3f6b4a','#4a5f8c','#8c6f3a','#6b4a7a','#7a3f4a','#3f6b6b','#7a5f3a','#5a4a8c','#6b5a3a'];

  const TRAIT_POOL = [
    { id:'diligent',     name:'Pilný',            desc:'+10 % práce',        mod:{ work:1.10 } },
    { id:'lazy',         name:'Lenivý',           desc:'−10 % práce',        mod:{ work:0.90 } },
    { id:'brave',        name:'Statečný',         desc:'+15 % boj',          mod:{ combat:1.15 } },
    { id:'lucky',        name:'Šťastný',          desc:'+15 % kvalita',      mod:{ luck:1.15 } },
    { id:'curious',      name:'Zvídavý',          desc:'+20 % XP',           mod:{ xp:1.20 } },
    { id:'sturdy',       name:'Statný',           desc:'+10 % výdrž',        mod:{ end:1.10 } },
    { id:'likes_nature', name:'Milovník přírody', desc:'+25 % dřevo/byliny', mod:{ nature:1.25 } },
    { id:'likes_stone',  name:'Dítě hor',         desc:'+25 % kámen/ruda',   mod:{ stone:1.25 } },
    { id:'merchant',     name:'Kupčík',           desc:'+12 % prodej',       mod:{ sell:1.12 } },
    { id:'tireless',     name:'Neúnavný',         desc:'−30 % spotřeba výdrže', mod:{ stamina:0.70 } },
    { id:'cautious',     name:'Opatrný',          desc:'−40 % šance úrazu',  mod:{ safety:0.60 } },
    { id:'reckless',     name:'Bezstarostný',     desc:'+30 % úraz, +10 % práce', mod:{ safety:1.30, work:1.10 } },
    { id:'cheerful',     name:'Veselý',           desc:'+20 % obnova nálady', mod:{ moodRegen:1.20 } },
    { id:'melancholic',  name:'Melancholik',      desc:'−15 % obnova nálady', mod:{ moodRegen:0.85 } },
    { id:'ambitious',    name:'Ctižádostivý',     desc:'+30 % XP',           mod:{ xp:1.30 } },
    { id:'loyal',        name:'Věrný',            desc:'+25 % vztahy',       mod:{ relationship:1.25 } }
  ];
  G.TRAIT_POOL = TRAIT_POOL;

  G.rollTraits = function () {
    const pool = TRAIT_POOL.slice(); const out = [];
    const n = G.randInt(1, 2);
    for (let i = 0; i < n && pool.length; i++) out.push(pool.splice(G.randInt(0, pool.length - 1), 1)[0]);
    return out;
  };

  G.createUnit = function (name, opts) {
    opts = opts || {};
    const u = {
      id:'u'+(unitIdSeq++), name: name || G.randomName(),
      level:1, xp:0,
      attrs:{ str:5+G.randInt(0,3), agi:5+G.randInt(0,3), int:5+G.randInt(0,3), end:5+G.randInt(0,3), luk:3+G.randInt(0,3) },
      skills:{}, traits: opts.traits || G.rollTraits(),
      equipment:{ tool:null, weapon:null, armor:null },
      injuries:[], perks:{}, profession:null, mentorId:null, mentorSkill:null,
      stamina:100, maxStamina:100, resting:false, restingAt:null,
      assignedTaskId:null, groupId: opts.groupId || null, status:'idle',
      mood: 70,
      personality: G.rollPersonality ? G.rollPersonality() : null,
      ambitions: G.rollAmbitions ? G.rollAmbitions() : [],
      relationships: {},
      role: null,
      merchantRoute: null, merchantState: null,
      onExpedition: false, expeditionId: null,
      _combatWins: 0, _injuriesHealed: 0,
      birthTime: opts.birthTime != null ? opts.birthTime : -20 * (G.AGE_YEAR || 300),
      dead: false, deserted: false, isChild: false,
      griefUntil: null,
      generation: opts.generation || 1,
      parentIds: opts.parentIds || [],
      legacy: 0,
      manual: false,
      journal: [],
      pos:{ x:7+(G.rand()-0.5)*2, y:22+(G.rand()-0.5)*2 },
      facing:1, color: COLORS[G.randInt(0, COLORS.length-1)],
      _walk:0, _bob:0, _working:false
    };
    for (const sid in G.SKILLS) u.skills[sid] = { xp:0, level:1 };
    if (G.refreshGearVisual) G.refreshGearVisual(u);
    if (G.addJournal) G.addJournal(u, 'Připojil se ke skupině.', '👋');
    return u;
  };

  G.unitTraitMod = function (unit, key, def) {
    if (def === undefined) def = 1;
    let m = def;
    for (const t of unit.traits) if (t.mod && t.mod[key] !== undefined) m *= t.mod[key];
    return m;
  };

  G.unitSkill = function (unit, sid) { const s = unit.skills[sid]; return (s && s.level) || 1; };
  G.unitSkillXp = function (unit, sid) { const s = unit.skills[sid]; return (s && s.xp) || 0; };

  G.addSkillXp = function (unit, sid, amount) {
    let mult = G.unitTraitMod(unit, 'xp', 1);
    if (G.trainingXpMult) mult *= G.trainingXpMult(unit, sid);
    if (G.prestigeXpMult) mult *= G.prestigeXpMult();
    if (G.personalityMod) mult *= G.personalityMod(unit, 'xp');
    if (G.ageMod) mult *= G.ageMod(unit, 'xp');
    if (G.legacyXpMult) mult *= G.legacyXpMult(unit);
    if (G.timeXpMod) mult *= G.timeXpMod();
    if (G.unlockXpMult) mult *= G.unlockXpMult();
    if (G.currentDifficulty) mult *= G.currentDifficulty().xpMult;
    amount *= mult;
    if (amount <= 0) return;
    if (!unit.skills[sid]) unit.skills[sid] = { xp:0, level:1 };
    const s = unit.skills[sid]; const oldLvl = s.level;
    s.xp += amount; let leveled = false;
    while (s.xp >= G.xpForLevel(s.level) && s.level < 200) {
      s.xp -= G.xpForLevel(s.level); s.level++; leveled = true;
    }
    if (leveled) {
      G.log(`⬆️ ${unit.name} — ${G.SKILLS[sid].name} na úrovni ${s.level}.`, 'social');
      if (G.addJournal && s.level % 5 === 0) {
        G.addJournal(unit, `Dosáhl úrovně ${s.level} v ${G.SKILLS[sid].name}.`, G.SKILLS[sid].icon);
      }
      if (G.PERK_LEVELS && G.PERK_LEVELS.some(l => l >= oldLvl && l <= s.level)) {
        G.log(`✨ ${unit.name} má nový perk (${G.SKILLS[sid].name}).`, 'social');
      }
    }
  };

  G.unitXpForLevel = function (level) { return Math.floor(40 * Math.pow(level, 1.5)); };
  G.addUnitXp = function (unit, amount) {
    if (amount <= 0) return;
    if (unit.equipment) {
      for (const slot in unit.equipment) {
        const it = unit.equipment[slot];
        if (!it) continue;
        const def = G.EQUIPMENT[it.itemId];
        if (def && def.effect && def.effect.xpBonus) amount *= (1 + def.effect.xpBonus / 100);
      }
    }
    unit.xp += amount; let leveled = false;
    while (unit.xp >= G.unitXpForLevel(unit.level)) {
      unit.xp -= G.unitXpForLevel(unit.level); unit.level++;
      unit.attrs[G.pick(G.ATTRS)] += 1; leveled = true;
    }
    if (leveled) {
      G.log(`⭐ ${unit.name} postoupil na úroveň ${unit.level}!`, 'social');
      if (G.addJournal && unit.level % 3 === 0) {
        G.addJournal(unit, `Dosáhl ${unit.level}. úrovně.`, '⭐');
      }
    }
  };

  G.unitWorkRate = function (unit, activity) {
    if (unit.dead) return 0;
    if (G.unitRefusesWork && G.unitRefusesWork(unit)) return 0;
    if (unit.onExpedition) return 0;
    const sid = activity.skill;
    const lvl = G.unitSkill(unit, sid);
    const attr = unit.attrs[activity.attr] || 10;
    let base = 1 + (lvl - 1)*0.15 + (attr - 10)*0.03;
    base = Math.max(0.15, base);
    base *= G.unitTraitMod(unit, 'work', 1);
    if (unit.traits.some(t => t.id === 'likes_nature') && (sid === 'woodcutting' || sid === 'herbalism')) base *= 1.25;
    if (unit.traits.some(t => t.id === 'likes_stone') && sid === 'mining') base *= 1.25;
    if (G.equipmentSkillBonus) base *= 1 + G.equipmentSkillBonus(unit, sid);
    if (G.professionSkillMult) base *= G.professionSkillMult(unit, sid);
    if (G.perkWorkMult) base *= G.perkWorkMult(unit, sid);
    if (G.trainingWorkMult) base *= G.trainingWorkMult(unit, sid);
    if (G.mentorWorkMult) base *= G.mentorWorkMult(unit, sid);
    if (G.personalityMod) base *= G.personalityMod(unit, 'work');
    if (G.ageMod) base *= G.ageMod(unit, 'work');
    if (G.timeWorkMod) base *= G.timeWorkMod(sid);
    if (G.injuryWorkMult) base *= G.injuryWorkMult(unit);
    if (G.moodWorkMult) base *= G.moodWorkMult(unit);
    if (unit.stamina < 25) base *= Math.max(0.15, unit.stamina / 25);
    return base;
  };

  G.bestSellBonus = function () {
    let best = 1;
    for (const u of G.state.units) {
      if (u.dead) continue;
      let m = G.unitTraitMod(u, 'sell', 1) * (1 + (u.attrs.int - 10)*0.006);
      const prof = G.professionOf ? G.professionOf(u) : null;
      if (prof && prof.special === 'sellBonus') m *= 1.10;
      if (u.perks && u.perks.trading) for (const lvl in u.perks.trading) {
        const pid = u.perks.trading[lvl];
        const found = (G.PERKS.trading[lvl] || []).find(p => p.id === pid);
        if (found && found.effect.sell) m *= found.effect.sell;
      }
      if (m > best) best = m;
    }
    return best;
  };
  G.bestBuyBonus = function () {
    let best = 1;
    for (const u of G.state.units) {
      if (u.dead) continue;
      if (!u.perks || !u.perks.trading) continue;
      for (const lvl in u.perks.trading) {
        const pid = u.perks.trading[lvl];
        const found = (G.PERKS.trading[lvl] || []).find(p => p.id === pid);
        if (found && found.effect.buy) best = Math.min(best, found.effect.buy);
      }
    }
    return best;
  };

  G.recordKill = function (killType, count) {
    if (!G.state.killCounts) G.state.killCounts = { beast: 0, humanoid: 0, monster: 0 };
    if (!G.state.killCounts[killType]) G.state.killCounts[killType] = 0;
    G.state.killCounts[killType] += (count || 1);
  };

  G.unitCombatPower = function (unit) {
    if (unit.dead) return 0;
    let p = (unit.attrs.str + unit.attrs.agi)*0.5 + G.unitSkill(unit, 'combat')*2.5;
    if (G.equipmentCombatBonus) p += G.equipmentCombatBonus(unit);
    p *= G.unitTraitMod(unit, 'combat', 1);
    if (G.injuryWorkMult) p *= G.injuryWorkMult(unit);
    if (G.perkCombatMult) p *= G.perkCombatMult(unit);
    if (G.personalityMod) p *= G.personalityMod(unit, 'combat');
    if (G.ageMod) p *= G.ageMod(unit, 'str');
    if (G.moodWorkMult) p *= (0.8 + 0.2 * G.moodWorkMult(unit));
    return p;
  };

  G.refreshGearVisual = function (unit) {
    const eq = unit.equipment || {};
    const wDef = eq.weapon ? G.EQUIPMENT[eq.weapon.itemId] : null;
    const aDef = eq.armor ? G.EQUIPMENT[eq.armor.itemId] : null;
    const tDef = eq.tool ? G.EQUIPMENT[eq.tool.itemId] : null;
    let weaponVisual = wDef && eq.weapon.durability > 0 ? wDef.visual : null;
    if (!weaponVisual && tDef && eq.tool.durability > 0) weaponVisual = tDef.visual;
    const armorVisual = aDef && eq.armor.durability > 0 ? aDef.visual : null;
    unit.gear = {
      weapon: weaponVisual || 'axe',
      helm: armorVisual === 'mail' || armorVisual === 'leather',
      shield: weaponVisual === 'sword'
    };
  };
})();
