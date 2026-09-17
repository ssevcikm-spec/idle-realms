(function () {
  const G = window.Game;

  /* ENEMY ABILITIES */
  G.ENEMY_ABILITIES = {
    charge:        { id:'charge',        name:'Nájezd',         icon:'💥', cooldown:3, chance:0.7, effect:{ type:'damage', mult:2.0 } },
    maul:          { id:'maul',          name:'Drcení',         icon:'🐾', cooldown:3, chance:0.6, effect:{ type:'damage', mult:1.8, selfDebuff:{ def:0.8, duration:1 } } },
    deadly_bite:   { id:'deadly_bite',   name:'Smrtelné kousnutí', icon:'🦷', cooldown:3, chance:0.6, effect:{ type:'damage', mult:1.9 } },
    whirlwind:     { id:'whirlwind',     name:'Vír',            icon:'🌀', cooldown:4, chance:0.5, effect:{ type:'aoe', mult:1.1 } },
    fire_breath:   { id:'fire_breath',   name:'Ohnivý dech',    icon:'🔥', cooldown:4, chance:0.7, effect:{ type:'aoe', mult:1.3 } },
    quake:         { id:'quake',         name:'Zemětřesení',    icon:'🌋', cooldown:5, chance:0.5, effect:{ type:'aoe', mult:1.0, stun:1 } },
    tidal_wave:    { id:'tidal_wave',    name:'Přílivová vlna', icon:'🌊', cooldown:4, chance:0.6, effect:{ type:'aoe', mult:1.4 } },
    hellfire:      { id:'hellfire',      name:'Pekelný oheň',   icon:'🔥', cooldown:5, chance:0.6, effect:{ type:'aoe', mult:1.5 } },
    poison_bite:   { id:'poison_bite',   name:'Jedovaté kousnutí', icon:'☠️', cooldown:3, chance:0.7, effect:{ type:'poison', damage:8, duration:3 } },
    poison_sting:  { id:'poison_sting',  name:'Jedovaté bodnutí', icon:'🦂', cooldown:3, chance:0.6, effect:{ type:'poison', damage:10, duration:3 } },
    poison_cloud:  { id:'poison_cloud',  name:'Jedovatý oblak', icon:'☁️', cooldown:4, chance:0.6, effect:{ type:'poison', damage:7, duration:4, aoe:true } },
    stun_sting:    { id:'stun_sting',    name:'Omračující bodnutí', icon:'💫', cooldown:5, chance:0.4, effect:{ type:'stun', duration:1 } },
    petrify_gaze:  { id:'petrify_gaze',  name:'Zkamenělý pohled', icon:'🗿', cooldown:5, chance:0.35, effect:{ type:'stun', duration:1 } },
    root_grasp:    { id:'root_grasp',    name:'Kořeny',          icon:'🌿', cooldown:4, chance:0.5, effect:{ type:'stun', duration:1 } },
    regenerate:    { id:'regenerate',    name:'Regenerace',     icon:'💚', cooldown:4, chance:0.6, effect:{ type:'heal', pct:0.20 } },
    regen_head:    { id:'regen_head',    name:'Dorůstání hlav', icon:'🐍', cooldown:4, chance:0.6, effect:{ type:'heal', pct:0.15 } },
    pack_howl:     { id:'pack_howl',     name:'Vytí smečky',    icon:'🐺', cooldown:6, chance:0.4, effect:{ type:'summon', enemyId:'wolf', count:1 } },
    call_reinf:    { id:'call_reinf',    name:'Volání posil',   icon:'📣', cooldown:6, chance:0.5, effect:{ type:'summon', enemyId:'bandit', count:2 } },
    summon_undead: { id:'summon_undead', name:'Vzkříšení mrtvých', icon:'💀', cooldown:5, chance:0.5, effect:{ type:'summon', enemyId:'skeleton', count:2 } },
    summon_swamp:  { id:'summon_swamp',  name:'Bahenní přisluhovači', icon:'🟫', cooldown:6, chance:0.4, effect:{ type:'summon', enemyId:'slime', count:2 } },
    warcry:        { id:'warcry',        name:'Válečný pokřik', icon:'📢', cooldown:5, chance:0.5, effect:{ type:'buff', stat:'atk', mult:1.4, duration:3 } },
    shield_wall:   { id:'shield_wall',   name:'Štítová hradba', icon:'🛡️', cooldown:4, chance:0.5, effect:{ type:'buff', stat:'def', mult:1.5, duration:3 } },
    stone_armor:   { id:'stone_armor',   name:'Kamenná zbroj',  icon:'🗿', cooldown:5, chance:0.5, effect:{ type:'buff', stat:'def', mult:1.6, duration:3 } },
    frenzy:        { id:'frenzy',        name:'Šílenství',      icon:'💢', cooldown:5, chance:0.5, effect:{ type:'buff', stat:'atk', mult:1.5, duration:3, selfDebuff:{ def:0.8, duration:3 } } },
    screech:       { id:'screech',       name:'Skřek',          icon:'😱', cooldown:4, chance:0.5, effect:{ type:'debuff', target:'party', stat:'atk', mult:0.8, duration:2 } },
    curse:         { id:'curse',         name:'Prokletí',       icon:'💀', cooldown:5, chance:0.5, effect:{ type:'debuff', target:'party', stat:'def', mult:0.75, duration:3 } },
    fear:          { id:'fear',          name:'Strach',         icon:'😨', cooldown:4, chance:0.5, effect:{ type:'debuff', target:'party', stat:'atk', mult:0.75, duration:2 } },
    life_drain:    { id:'life_drain',    name:'Vysávání života', icon:'🩸', cooldown:3, chance:0.6, effect:{ type:'drain', mult:1.3 } },
    bite_drain:    { id:'bite_drain',    name:'Pijavice',       icon:'🦇', cooldown:3, chance:0.5, effect:{ type:'drain', mult:1.0 } },
    multi_bite:    { id:'multi_bite',    name:'Trojité kousnutí', icon:'🐍', cooldown:4, chance:0.6, effect:{ type:'damage', mult:0.8, hits:3 } },
    swallow:       { id:'swallow',       name:'Pohlcení',       icon:'🌀', cooldown:5, chance:0.4, effect:{ type:'damage', mult:3.0 } },
    dirty_fight:   { id:'dirty_fight',   name:'Špinavý boj',    icon:'🗡️', cooldown:4, chance:0.5, effect:{ type:'damage', mult:1.5, debuff:{ stat:'def', mult:0.85, duration:2 } } },
    smash:         { id:'smash',         name:'Drtivý úder',    icon:'🔨', cooldown:3, chance:0.5, effect:{ type:'damage', mult:2.2 } }
  };

  G.ENEMIES = {
    /* T1 */
    rat:       { id:'rat', name:'Krysa', icon:'🐀', tier:1, region:'grass', hp:15, atk:4, def:1, speed:16, xp:6, gold:[1,3], eliteChance:0.02, drops:[{material:'coin',chance:0.4,qty:[1,2]}] },
    slime:     { id:'slime', name:'Sliz', icon:'🟢', tier:1, region:'grass', hp:30, atk:6, def:4, speed:4, xp:8, gold:[2,5], eliteChance:0.03, drops:[{material:'herb',chance:0.3,qty:[1,1]}] },
    boar:      { id:'boar', name:'Divoké prase', icon:'🐗', tier:1, region:'grass', hp:35, atk:8, def:2, speed:8, xp:12, gold:[3,8], eliteChance:0.05, abilities:['charge'], drops:[{material:'hide',chance:0.8,qty:[1,2]},{material:'coin',chance:0.5,qty:[2,5]}] },
    bandit:    { id:'bandit', name:'Bandita', icon:'🗡️', tier:1, region:'grass', hp:50, atk:12, def:4, speed:10, xp:20, gold:[8,18], eliteChance:0.06, drops:[{material:'coin',chance:0.9,qty:[5,15]},{material:'bandit_seal',chance:0.15,qty:[1,1]}] },
    skeleton:  { id:'skeleton', name:'Kostlivec', icon:'💀', tier:1, region:'swamp', hp:25, atk:7, def:3, speed:9, xp:10, gold:[2,6], eliteChance:0.03, summonOnly:true, drops:[{material:'coin',chance:0.3,qty:[1,3]}] },

    /* T2 */
    wolf:      { id:'wolf', name:'Vlk', icon:'🐺', tier:2, region:'forest', hp:45, atk:11, def:3, speed:14, xp:18, gold:[4,10], eliteChance:0.05, abilities:['pack_howl'], drops:[{material:'hide',chance:0.9,qty:[1,3]},{material:'trophy_wolf',chance:0.25,qty:[1,1]}] },
    spider:    { id:'spider', name:'Pavouk', icon:'🕷️', tier:2, region:'forest', hp:40, atk:10, def:2, speed:12, xp:16, gold:[3,8], eliteChance:0.05, abilities:['poison_bite'], drops:[{material:'fiber',chance:0.6,qty:[1,2]},{material:'coin',chance:0.4,qty:[2,6]}] },
    bat:       { id:'bat', name:'Netopýr', icon:'🦇', tier:2, region:'cave', hp:25, atk:7, def:1, speed:18, xp:10, gold:[2,6], eliteChance:0.04, abilities:['bite_drain'], drops:[{material:'coin',chance:0.4,qty:[1,3]}] },
    goblin:    { id:'goblin', name:'Goblin', icon:'👺', tier:2, region:'hills', hp:35, atk:9, def:3, speed:11, xp:14, gold:[4,12], eliteChance:0.05, drops:[{material:'coin',chance:0.7,qty:[3,10]},{material:'fiber',chance:0.3,qty:[1,2]}] },
    harpy:     { id:'harpy', name:'Harpyje', icon:'🦅', tier:2, region:'hills', hp:70, atk:18, def:5, speed:15, xp:50, gold:[15,35], eliteChance:0.08, abilities:['screech'], drops:[{material:'hide',chance:0.4,qty:[1,2]},{material:'jewel',chance:0.15,qty:[1,1]}] },
    serpent:   { id:'serpent', name:'Zmije', icon:'🐍', tier:2, region:'swamp', hp:40, atk:14, def:2, speed:12, xp:22, gold:[5,12], eliteChance:0.06, abilities:['poison_bite'], drops:[{material:'herb',chance:0.5,qty:[1,2]}] },

    /* T3 */
    bear:      { id:'bear', name:'Medvěd', icon:'🐻', tier:3, region:'deep_forest', hp:90, atk:20, def:8, speed:8, xp:45, gold:[15,30], eliteChance:0.07, abilities:['maul'], drops:[{material:'hide',chance:1,qty:[2,4]},{material:'trophy_bear',chance:0.35,qty:[1,1]}] },
    werewolf:  { id:'werewolf', name:'Vlkodlak', icon:'🐺', tier:3, region:'deep_forest', hp:120, atk:26, def:10, speed:16, xp:70, gold:[25,50], eliteChance:0.10, abilities:['frenzy','regenerate'], drops:[{material:'crystal',chance:0.3,qty:[1,2]},{material:'jewel',chance:0.2,qty:[1,1]}] },
    orc:       { id:'orc', name:'Ork', icon:'👹', tier:3, region:'hills', hp:100, atk:22, def:12, speed:9, xp:60, gold:[20,40], eliteChance:0.07, abilities:['warcry'], drops:[{material:'iron_ingot',chance:0.5,qty:[1,2]},{material:'coin',chance:0.9,qty:[10,30]}] },
    scorpion:  { id:'scorpion', name:'Škorpión', icon:'🦂', tier:3, region:'swamp', hp:55, atk:16, def:6, speed:10, xp:40, gold:[8,20], eliteChance:0.06, abilities:['poison_sting','stun_sting'], drops:[{material:'crystal',chance:0.2,qty:[1,1]},{material:'herb',chance:0.4,qty:[1,2]}] },
    animated_armor:{ id:'animated_armor', name:'Oživená zbroj', icon:'🛡️', tier:3, region:'cave', hp:110, atk:15, def:20, speed:5, xp:55, gold:[15,35], eliteChance:0.06, abilities:['shield_wall'], drops:[{material:'iron_ingot',chance:0.8,qty:[1,3]},{material:'iron_ore',chance:0.6,qty:[2,4]}] },
    wisp:      { id:'wisp', name:'Bludička', icon:'👻', tier:3, region:'swamp', hp:35, atk:18, def:1, speed:20, xp:30, gold:[8,20], eliteChance:0.06, abilities:['life_drain'], drops:[{material:'potion',chance:0.15,qty:[1,1]},{material:'crystal',chance:0.2,qty:[1,1]}] },
    mud_golem: { id:'mud_golem', name:'Bahenní golem', icon:'🟫', tier:3, region:'swamp', hp:150, atk:24, def:14, speed:6, xp:85, gold:[30,60], eliteChance:0.07, abilities:['poison_cloud'], drops:[{material:'herb',chance:0.5,qty:[2,4]},{material:'crystal',chance:0.25,qty:[1,2]}] },

    /* T4 */
    troll:     { id:'troll', name:'Troll', icon:'👺', tier:4, region:'mountain', hp:180, atk:32, def:16, speed:7, xp:110, gold:[40,80], eliteChance:0.08, abilities:['regenerate','smash'], drops:[{material:'crystal',chance:0.4,qty:[1,3]},{material:'trophy_bear',chance:0.5,qty:[1,1]}] },
    basilisk:  { id:'basilisk', name:'Bazilišek', icon:'🦎', tier:4, region:'cave', hp:130, atk:22, def:12, speed:9, xp:90, gold:[30,60], eliteChance:0.08, abilities:['petrify_gaze','poison_bite'], drops:[{material:'crystal',chance:0.5,qty:[1,2]},{material:'jewel',chance:0.2,qty:[1,1]}] },
    wraith:    { id:'wraith', name:'Přízrak', icon:'👻', tier:4, region:'cave', hp:100, atk:26, def:6, speed:14, xp:95, gold:[30,70], eliteChance:0.08, abilities:['life_drain'], drops:[{material:'crystal',chance:0.4,qty:[1,2]},{material:'potion',chance:0.2,qty:[1,1]}] },
    minotaur:  { id:'minotaur', name:'Minotaur', icon:'🐂', tier:4, region:'mountain', hp:200, atk:30, def:14, speed:10, xp:120, gold:[50,100], eliteChance:0.09, abilities:['charge'], drops:[{material:'iron_ingot',chance:0.7,qty:[2,4]},{material:'hide',chance:0.8,qty:[2,4]}] },
    golem:     { id:'golem', name:'Kamenný golem', icon:'🗿', tier:4, region:'cave', hp:220, atk:28, def:22, speed:5, xp:130, gold:[30,70], eliteChance:0.08, abilities:['stone_armor'], drops:[{material:'crystal',chance:0.7,qty:[2,4]},{material:'jewel',chance:0.3,qty:[1,2]}] },

    /* T5 */
    drake:     { id:'drake', name:'Drak Ohnivec', icon:'🐉', tier:5, region:'cave', hp:400, atk:55, def:30, speed:12, xp:400, gold:[200,400], eliteChance:0.10, abilities:['fire_breath'], drops:[{material:'dragon_scale',chance:1,qty:[2,4]},{material:'crystal',chance:1,qty:[5,10]},{material:'jewel',chance:0.8,qty:[3,5]}] },
    bandit_leader:{ id:'bandit_leader', name:'Vůdce banditů', icon:'🏴', tier:5, region:'hills', hp:200, atk:38, def:18, speed:13, xp:250, gold:[150,300], eliteChance:0.10, abilities:['call_reinf','dirty_fight'], drops:[{material:'bandit_seal',chance:1,qty:[3,5]},{material:'iron_ingot',chance:1,qty:[3,5]},{material:'jewel',chance:0.5,qty:[1,2]}] },
    lich:      { id:'lich', name:'Lich', icon:'💀', tier:5, region:'swamp', hp:260, atk:40, def:15, speed:11, xp:350, gold:[200,400], eliteChance:0.10, abilities:['summon_undead','curse','life_drain'], drops:[{material:'crystal',chance:1,qty:[4,7]},{material:'potion',chance:0.8,qty:[2,4]},{material:'jewel',chance:0.6,qty:[2,4]}] },
    hydra:     { id:'hydra', name:'Hydra', icon:'🐍', tier:5, region:'swamp', hp:450, atk:45, def:25, speed:8, xp:420, gold:[250,500], eliteChance:0.10, abilities:['multi_bite','regen_head'], drops:[{material:'dragon_scale',chance:0.6,qty:[1,3]},{material:'crystal',chance:1,qty:[4,8]},{material:'jewel',chance:0.7,qty:[2,5]}] },
    demon:     { id:'demon', name:'Démon', icon:'😈', tier:5, region:'cave', hp:380, atk:60, def:28, speed:13, xp:450, gold:[250,500], eliteChance:0.10, abilities:['hellfire','fear'], drops:[{material:'crystal',chance:1,qty:[5,10]},{material:'jewel',chance:0.8,qty:[3,6]},{material:'potion',chance:0.7,qty:[2,4]}] },

    /* BOSSES */
    ancient_treant: { id:'ancient_treant', name:'Prastarý ent', icon:'🌳', tier:6, region:'forest', isBoss:true, hp:800, atk:45, def:35, speed:4, xp:800, gold:[400,800], eliteChance:0, abilities:['root_grasp','regenerate','smash'], drops:[{material:'wood',chance:1,qty:[50,100]},{material:'crystal',chance:1,qty:[8,15]},{material:'jewel',chance:0.8,qty:[5,10]}] },
    alpha_werewolf: { id:'alpha_werewolf', name:'Alfa vlkodlak', icon:'🐺', tier:6, region:'deep_forest', isBoss:true, hp:700, atk:65, def:25, speed:20, xp:900, gold:[400,900], eliteChance:0, abilities:['frenzy','pack_howl','regenerate'], drops:[{material:'hide',chance:1,qty:[20,40]},{material:'crystal',chance:1,qty:[8,15]},{material:'jewel',chance:0.9,qty:[6,12]}] },
    warlord:   { id:'warlord', name:'Válečný náčelník', icon:'🏴', tier:6, region:'hills', isBoss:true, hp:900, atk:55, def:40, speed:12, xp:1000, gold:[600,1200], eliteChance:0, abilities:['call_reinf','warcry','whirlwind'], drops:[{material:'iron_ingot',chance:1,qty:[15,30]},{material:'bandit_seal',chance:1,qty:[10,20]},{material:'jewel',chance:1,qty:[8,15]}] },
    colossus:  { id:'colossus', name:'Kamenný kolos', icon:'🗿', tier:6, region:'mountain', isBoss:true, hp:1400, atk:60, def:55, speed:3, xp:1200, gold:[500,1000], eliteChance:0, abilities:['quake','stone_armor','smash'], drops:[{material:'stone',chance:1,qty:[80,150]},{material:'crystal',chance:1,qty:[12,20]},{material:'jewel',chance:0.9,qty:[8,15]}] },
    bog_witch: { id:'bog_witch', name:'Bahenní čarodějka', icon:'🧙', tier:6, region:'swamp', isBoss:true, hp:650, atk:50, def:20, speed:14, xp:850, gold:[400,800], eliteChance:0, abilities:['poison_cloud','summon_swamp','curse'], drops:[{material:'herb',chance:1,qty:[30,60]},{material:'potion',chance:1,qty:[10,20]},{material:'crystal',chance:1,qty:[8,15]}] },
    leviathan: { id:'leviathan', name:'Leviatan', icon:'🐋', tier:6, region:'lake', isBoss:true, hp:1200, atk:70, def:40, speed:8, xp:1400, gold:[700,1400], eliteChance:0, abilities:['tidal_wave','swallow','regenerate'], drops:[{material:'dragon_scale',chance:1,qty:[5,10]},{material:'crystal',chance:1,qty:[12,20]},{material:'jewel',chance:1,qty:[10,18]}] }
  };

  G.ENCOUNTER_TABLE = {
    forest:      ['wolf','bandit','boar','spider','rat'],
    deep_forest: ['wolf','bear','werewolf','bandit','spider'],
    grove:       ['boar','bandit','slime','rat'],
    meadow:      ['boar','bandit','slime','rat'],
    quarry:      ['bandit','orc','harpy','goblin','animated_armor'],
    mine:        ['orc','golem','bat','goblin','animated_armor'],
    cave:        ['bat','golem','drake','basilisk','wraith','demon','lich'],
    marsh:       ['serpent','wisp','bandit','mud_golem','scorpion','hydra'],
    mountain:    ['troll','minotaur','orc','harpy','golem'],
    lake:        ['serpent','wisp']
  };

  G.BOSS_TABLE = {
    forest:      ['ancient_treant'],
    grove:       ['ancient_treant'],
    meadow:      ['ancient_treant'],
    deep_forest: ['alpha_werewolf'],
    hills:       ['warlord'],
    mountain:    ['colossus'],
    quarry:      ['warlord'],
    mine:        ['colossus'],
    cave:        ['colossus'],
    marsh:       ['bog_witch'],
    lake:        ['leviathan']
  };

  G.unitCombatStats = function (u) {
    let atk = 5 + (u.attrs.str || 5) * 1.8;
    let def = 3 + (u.attrs.end || 5) * 1.2;
    let speed = 5 + (u.attrs.agi || 5) * 1.6;
    let hpMax = 100 + (u.attrs.end || 5) * 5;
    let crit = 0.05 + (u.attrs.luk || 3) * 0.005;
    let reach = 1;
    const eq = u.equipment || {};
    for (const slot in eq) {
      const item = eq[slot];
      if (!item || item.durability <= 0) continue;
      const d2 = G.EQUIPMENT[item.itemId];
      if (!d2) continue;
      if (d2.combatBonus) atk += d2.combatBonus * 0.7;
      if (d2.defBonus) def += d2.defBonus;
      if (d2.visual === 'bow') reach = 2;
      if (d2.visual === 'staff') reach = 2;
    }
    const c = G.unitSkill(u, 'combat');
    atk += c * 1.5; def += c * 0.8; hpMax += c * 3;
    if (G.professionSkillMult) atk *= G.professionSkillMult(u, 'combat');
    if (G.perkCombatMult) atk *= G.perkCombatMult(u);
    if (G.personalityMod) atk *= G.personalityMod(u, 'combat');
    if (G.injuryWorkMult) { atk *= G.injuryWorkMult(u); def *= G.injuryWorkMult(u); }
    const moodMult = G.moodWorkMult ? G.moodWorkMult(u) : 1;
    atk *= (0.7 + 0.3 * moodMult);
    if (G.groupCombatMultFor) { const gm = G.groupCombatMultFor(u); atk *= gm; hpMax *= (1 + (gm - 1) * 0.5); }   // role Bojovník + chemie
    return { hpMax: Math.round(hpMax), atk: Math.round(atk), def: Math.round(def), speed: Math.round(speed), crit, reach };
  };

  G.TACTICS = {
    aggressive: { id:'aggressive', name:'Agresivní', icon:'⚔️', atkMult:1.30, defMult:0.80, desc:'+30 % útok, −20 % obrana' },
    balanced:   { id:'balanced',   name:'Vyvážená',  icon:'⚖️', atkMult:1.00, defMult:1.00, desc:'Normální' },
    defensive:  { id:'defensive',  name:'Defenzivní',icon:'🛡️', atkMult:0.75, defMult:1.35, desc:'−25 % útok, +35 % obrana' }
  };

  /** Průměrná síla jedné postavy (~čerstvá postava) — referenční bod pro škálování. */
  G.COMBAT_POWER_REF = 14;
  G.pickEnemyFor = function (nodeKind, partyPower) {
    const pool = G.ENCOUNTER_TABLE[nodeKind] || ['bandit'];
    const candidates = pool.filter(id => {
      const e = G.ENEMIES[id];
      if (!e || e.summonOnly || e.isBoss) return false;
      return e.hp * 0.7 <= partyPower * 1.5;
    });
    const list = candidates.length ? candidates : pool.filter(id => !G.ENEMIES[id].summonOnly && !G.ENEMIES[id].isBoss);
    return G.ENEMIES[G.pick(list.length ? list : pool)];
  };
  /**
   * Kolik nepřátel se postaví družině. Neškáluje se podle počtu hlav, ale podle
   * SÍLY: slabý člen, kterého přibereš, nepřitáhne dalšího nepřítele, takže
   * „vzít celou skupinu" je vždycky výhoda a ne past.
   */
  G.enemyCountFor = function (enemy, partySize, partyPower) {
    let eff = Math.max(1, partySize || 1);
    if (partyPower != null && partySize > 0) {
      const ratio = partyPower / (G.COMBAT_POWER_REF * partySize);   // jak silný je průměrný člen
      eff = Math.max(1, Math.min(partySize, Math.round(partySize * G.clamp(ratio, 0.35, 1.6))));
    }
    if (enemy.tier <= 1) return G.randInt(1, Math.min(4, Math.max(1, eff)));
    if (enemy.tier === 2) return G.randInt(1, Math.min(3, Math.max(1, eff)));
    if (enemy.tier === 3) return G.randInt(1, Math.min(2, Math.max(1, eff)));
    return 1;
  };
  G.pickBossFor = function (nodeKind) {
    const pool = G.BOSS_TABLE[nodeKind];
    if (!pool || !pool.length) return null;
    const id = G.pick(pool);
    return G.ENEMIES[id] || null;
  };
})();
