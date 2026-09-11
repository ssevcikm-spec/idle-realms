(function () {
  const G = window.Game;

  G.ENEMIES = {
    boar:      { id:'boar',      name:'Divoké prase',  icon:'🐗', hp:35,  atk:8,  def:2,  speed:8,  xp:12, region:'grass',    tier:1, gold:[3,8],   drops:[{material:'hide',chance:0.8,qty:[1,2]},{material:'coin',chance:0.5,qty:[2,5]}] },
    bandit:    { id:'bandit',    name:'Bandita',       icon:'🗡️', hp:50,  atk:12, def:4,  speed:10, xp:20, region:'grass',    tier:1, gold:[8,18],  drops:[{material:'coin',chance:0.9,qty:[5,15]},{material:'bandit_seal',chance:0.15,qty:[1,1]}] },
    wolf:      { id:'wolf',      name:'Vlk',           icon:'🐺', hp:45,  atk:11, def:3,  speed:14, xp:18, region:'forest',   tier:2, gold:[4,10],  drops:[{material:'hide',chance:0.9,qty:[1,3]},{material:'trophy_wolf',chance:0.25,qty:[1,1]}] },
    bear:      { id:'bear',      name:'Medvěd',        icon:'🐻', hp:90,  atk:20, def:8,  speed:8,  xp:45, region:'deep_forest',tier:3, gold:[15,30], drops:[{material:'hide',chance:1,qty:[2,4]},{material:'trophy_bear',chance:0.35,qty:[1,1]}] },
    werewolf:  { id:'werewolf',  name:'Vlkodlak',      icon:'🐺', hp:120, atk:26, def:10, speed:16, xp:70, region:'deep_forest',tier:3, gold:[25,50], drops:[{material:'crystal',chance:0.3,qty:[1,2]},{material:'jewel',chance:0.2,qty:[1,1]}] },
    orc:       { id:'orc',       name:'Ork',           icon:'👹', hp:100, atk:22, def:12, speed:9,  xp:60, region:'hills',    tier:3, gold:[20,40], drops:[{material:'iron_ingot',chance:0.5,qty:[1,2]},{material:'coin',chance:0.9,qty:[10,30]}] },
    troll:     { id:'troll',     name:'Troll',         icon:'👺', hp:180, atk:32, def:16, speed:7,  xp:110,region:'mountain', tier:4, gold:[40,80], drops:[{material:'crystal',chance:0.4,qty:[1,3]},{material:'trophy_bear',chance:0.5,qty:[1,1]}] },
    golem:     { id:'golem',     name:'Kamenný golem', icon:'🗿', hp:220, atk:28, def:22, speed:5,  xp:130,region:'cave',     tier:4, gold:[30,70], drops:[{material:'crystal',chance:0.7,qty:[2,4]},{material:'jewel',chance:0.3,qty:[1,2]}] },
    bat:       { id:'bat',       name:'Netopýr',       icon:'🦇', hp:25,  atk:7,  def:1,  speed:18, xp:10, region:'cave',     tier:2, gold:[2,6],   drops:[{material:'coin',chance:0.4,qty:[1,3]}] },
    serpent:   { id:'serpent',   name:'Zmije',         icon:'🐍', hp:40,  atk:14, def:2,  speed:12, xp:22, region:'swamp',    tier:2, gold:[5,12],  drops:[{material:'herb',chance:0.5,qty:[1,2]}] },
    wisp:      { id:'wisp',      name:'Bludička',      icon:'👻', hp:35,  atk:18, def:1,  speed:20, xp:30, region:'swamp',    tier:3, gold:[8,20],  drops:[{material:'potion',chance:0.15,qty:[1,1]},{material:'crystal',chance:0.2,qty:[1,1]}] },
    drake:     { id:'drake',     name:'Drak Ohnivec',  icon:'🐉', hp:400, atk:55, def:30, speed:12, xp:400,region:'cave',     tier:5, gold:[200,400],drops:[{material:'dragon_scale',chance:1,qty:[2,4]},{material:'crystal',chance:1,qty:[5,10]},{material:'jewel',chance:0.8,qty:[3,5]}] },
    bandit_leader:{ id:'bandit_leader',name:'Vůdce banditů',icon:'🏴',hp:200,atk:38,def:18,speed:13,xp:250,region:'hills', tier:5, gold:[150,300],drops:[{material:'bandit_seal',chance:1,qty:[3,5]},{material:'iron_ingot',chance:1,qty:[3,5]},{material:'jewel',chance:0.5,qty:[1,2]}] }
  };

  G.ENCOUNTER_TABLE = {
    forest:      ['wolf','bandit','boar'],
    deep_forest: ['wolf','bear','werewolf','bandit'],
    grove:       ['boar','bandit'],
    meadow:      ['boar','bandit'],
    quarry:      ['bandit','orc'],
    mine:        ['orc','golem','bat'],
    cave:        ['bat','golem','drake'],
    marsh:       ['serpent','wisp','bandit'],
    lake:        ['serpent','wisp']
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
    return { hpMax: Math.round(hpMax), atk: Math.round(atk), def: Math.round(def), speed: Math.round(speed), crit, reach };
  };

  G.TACTICS = {
    aggressive: { id:'aggressive', name:'Agresivní', icon:'⚔️', atkMult:1.30, defMult:0.80, desc:'+30 % útok, −20 % obrana' },
    balanced:   { id:'balanced',   name:'Vyvážená',  icon:'⚖️', atkMult:1.00, defMult:1.00, desc:'Normální' },
    defensive:  { id:'defensive',  name:'Defenzivní',icon:'🛡️', atkMult:0.75, defMult:1.35, desc:'−25 % útok, +35 % obrana' }
  };

  G.pickEnemyFor = function (nodeKind, partyPower) {
    const pool = G.ENCOUNTER_TABLE[nodeKind] || ['bandit'];
    const candidates = pool.filter(id => {
      const e = G.ENEMIES[id];
      return e && e.hp * 0.7 <= partyPower * 1.5;
    });
    const list = candidates.length ? candidates : pool;
    return G.ENEMIES[G.pick(list)];
  };
  G.enemyCountFor = function (enemy, partySize) {
    if (enemy.tier <= 1) return G.randInt(1, Math.min(4, Math.max(2, partySize)));
    if (enemy.tier === 2) return G.randInt(1, Math.min(3, partySize));
    if (enemy.tier === 3) return G.randInt(1, Math.min(2, partySize));
    return 1;
  };
})();
