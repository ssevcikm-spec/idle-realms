(function () {
  const G = window.Game;

  /* EQUIPMENT — rozšířeno o setId (pro sety) a legendárky */
  G.EQUIPMENT = {
    /* Tools */
    stone_axe:    { id:'stone_axe',   name:'Kamenná sekera',  slot:'tool',  tier:1, icon:'🪓', price:20,  durability:120, visual:'axe',   mods:{ woodcutting:0.20 } },
    copper_axe:   { id:'copper_axe',  name:'Měděná sekera',   slot:'tool',  tier:2, icon:'🪓', price:90,  durability:200, visual:'axe',   mods:{ woodcutting:0.45, mining:0.10 } },
    stone_pick:   { id:'stone_pick',  name:'Kamenný krumpáč', slot:'tool',  tier:1, icon:'⛏️', price:20,  durability:120, visual:'pick',  mods:{ mining:0.20 } },
    iron_pick:    { id:'iron_pick',   name:'Železný krumpáč', slot:'tool',  tier:2, icon:'⛏️', price:110, durability:220, visual:'pick',  mods:{ mining:0.50 } },
    herb_kit:     { id:'herb_kit',    name:'Bylinkářská sada',slot:'tool',  tier:1, icon:'🌿', price:30,  durability:150, visual:'staff', mods:{ herbalism:0.30 } },
    fishing_rod:  { id:'fishing_rod', name:'Rybářský prut',   slot:'tool',  tier:1, icon:'🎣', price:25,  durability:130, visual:'staff', mods:{ hunting:0.15 } },
    master_tools: { id:'master_tools',name:'Mistrovské nářadí',slot:'tool', tier:3, icon:'🧰', price:350, durability:400, visual:'axe',   mods:{ woodcutting:0.60, mining:0.60, herbalism:0.30 } },

    /* Weapons */
    hunting_bow:  { id:'hunting_bow', name:'Lovecký luk',     slot:'weapon',tier:1, icon:'🏹', price:40,  durability:140, visual:'bow',   mods:{ hunting:0.25 }, combatBonus:3, setId:'hunters_kit' },
    iron_sword:   { id:'iron_sword',  name:'Železný meč',     slot:'weapon',tier:2, icon:'⚔️', price:130, durability:200, visual:'sword', mods:{}, combatBonus:12, setId:'warrior_plate' },
    war_axe:      { id:'war_axe',     name:'Bojová sekera',   slot:'weapon',tier:2, icon:'🪓', price:150, durability:210, visual:'axe',   mods:{}, combatBonus:15 },
    hunter_bow:   { id:'hunter_bow',  name:'Mistrovský luk',  slot:'weapon',tier:3, icon:'🏹', price:320, durability:320, visual:'bow',   mods:{ hunting:0.50 }, combatBonus:20, setId:'hunters_kit' },

    /* Armor */
    leather_armor:{ id:'leather_armor',name:'Kožená zbroj',   slot:'armor', tier:1, icon:'🥋', price:50,  durability:200, visual:'leather', mods:{}, staminaDrain:0.85, combatBonus:4, defBonus:3, setId:'hunters_kit' },
    chain_mail:   { id:'chain_mail',  name:'Kroužková zbroj', slot:'armor', tier:2, icon:'🛡️', price:180, durability:300, visual:'mail',  mods:{}, staminaDrain:0.70, combatBonus:12, defBonus:8, setId:'warrior_plate' },
    scholar_robe: { id:'scholar_robe',name:'Učenecký plášť',  slot:'armor', tier:2, icon:'👘', price:160, durability:250, visual:'robe',  mods:{ herbalism:0.20, alchemy:0.20, crafting:0.20 }, staminaDrain:0.90, combatBonus:4, defBonus:2, setId:'scholars_insight' },
    scholar_cloak:{ id:'scholar_cloak',name:'Plášť učence',   slot:'armor', tier:3, icon:'🧥', price:340, durability:400, visual:'robe',  mods:{ herbalism:0.30, alchemy:0.30, crafting:0.30 }, staminaDrain:0.85, combatBonus:6, defBonus:5, setId:'scholars_insight' }
  };

  // Přidej legendárky do EQUIPMENT
  for (const lid in G.LEGENDARIES) {
    const l = G.LEGENDARIES[lid];
    G.EQUIPMENT[lid] = Object.assign({
      id: lid, name: l.name, slot: l.slot, tier: l.tier, icon: l.icon,
      price: 0, durability: l.durability, visual: l.slot === 'armor' ? 'mail' : (l.slot === 'weapon' ? 'sword' : 'staff'),
      legendary: true
    }, l);
  }

  G.WEAR_PER_SEC = 0.0025;

  G.BUILDINGS = {
    market:    { id:'market', name:'Tržnice', icon:'⚖️', maxLevel:5, desc:'Lepší ceny (+5 % prodej, −4 % nákup za úroveň).',
      cost:(l)=>({ gold:60*l*l, materials:[{material:'plank',qty:2*l}] }),
      effect:(l)=>({ sellMult:1+0.05*l, buyMult:1-0.04*l }) },
    workshop:  { id:'workshop', name:'Dílna', icon:'🔧', maxLevel:5, desc:'Vyšší kvalita výroby a levnější stavby v sídle.',
      cost:(l)=>({ gold:80*l*l, materials:[{material:'wood',qty:5*l},{material:'stone',qty:3*l}] }),
      effect:(l)=>({ craftQualityBonus:8*l, buildDiscount:0.05*l }) },
    tavern:    { id:'tavern', name:'Hospoda', icon:'🍺', maxLevel:5, desc:'Rychlejší regenerace výdrže i nálady (+15 %/+10 % za úroveň).',
      cost:(l)=>({ gold:45*l*l, materials:[{material:'bread',qty:3*l},{material:'fiber',qty:4*l}] }),
      effect:(l)=>({ restMult:1+0.15*l, moodMult:1+0.10*l }) },
    warehouse: { id:'warehouse', name:'Sklad', icon:'📦', maxLevel:5, desc:'Sídlo udrží více zboží (+15 % za úroveň).',
      cost:(l)=>({ gold:70*l*l, materials:[{material:'stone',qty:5*l},{material:'plank',qty:2*l}] }),
      effect:(l)=>({ stockMult:1+0.15*l }) },
    hospice:   { id:'hospice', name:'Lazebna', icon:'⚕️', maxLevel:5, desc:'Rychlejší hojení zranění (+25 % za úroveň).',
      cost:(l)=>({ gold:90*l*l, materials:[{material:'herb',qty:6*l},{material:'cloth',qty:3*l}] }),
      effect:(l)=>({ healMult:1+0.25*l }) },
    guardhouse:{ id:'guardhouse', name:'Strážnice', icon:'🛡️', maxLevel:5, desc:'Sníží nebezpečí v okolí sídla (−8 % za úroveň).',
      cost:(l)=>({ gold:110*l*l, materials:[{material:'plank',qty:3*l},{material:'iron_ingot',qty:1*l}] }),
      effect:(l)=>({ safetyMult:1-0.08*l }) },
    /* === FÁZE 10: NOVÉ SPECIALIZOVANÉ BUDOVY === */
    forge:       { id:'forge',       name:'Kovárna',         icon:'🔥', maxLevel:5, desc:'Kvalitnější a bohatší kování (+4 skóre kvality, +1 kus za 2 úrovně).',
      cost:(l)=>({ gold:150*l*l, materials:[{material:'iron_ingot',qty:2*l},{material:'stone',qty:8*l}] }),
      effect:(l)=>({ smithingQuality:4*l, smithingBatch:Math.floor(l/2) }) },
    herbal_garden:{ id:'herbal_garden', name:'Bylinná zahrada', icon:'🌱', maxLevel:5, desc:'Kvalitnější a bohatší sběr bylin (+4 skóre kvality, +1 surovina za úroveň).',
      cost:(l)=>({ gold:120*l*l, materials:[{material:'wood',qty:6*l},{material:'fiber',qty:10*l}] }),
      effect:(l)=>({ herbalismQuality:4*l, herbalismYield:l }) },
    hunters_lodge:{ id:'hunters_lodge', name:'Lovecká chata', icon:'🏹', maxLevel:5, desc:'Kvalitnější lov (+4 skóre kvality, +1 kůže za 2 úrovně).',
      cost:(l)=>({ gold:130*l*l, materials:[{material:'hide',qty:3*l},{material:'plank',qty:5*l}] }),
      effect:(l)=>({ huntingQuality:4*l, huntingYield:Math.floor(l/2) }) },
    alchemist_lab:{ id:'alchemist_lab', name:'Alchymistická laboratoř', icon:'⚗️', maxLevel:5, desc:'Kvalitnější a bohatší alchymie (+4 skóre kvality, +1 lektvar za 2 úrovně).',
      cost:(l)=>({ gold:180*l*l, materials:[{material:'potion',qty:1*l},{material:'crystal',qty:2*l}] }),
      effect:(l)=>({ alchemyQuality:4*l, alchemyBatch:Math.floor(l/2) }) },
    training_ground:{ id:'training_ground', name:'Cvičiště', icon:'⚔️', maxLevel:5, desc:'Bojová síla postav u sídla +8 % za úroveň.',
      cost:(l)=>({ gold:200*l*l, materials:[{material:'plank',qty:8*l},{material:'iron_ingot',qty:2*l}] }),
      effect:(l)=>({ combatTraining:1+0.08*l }) },
    library:     { id:'library',     name:'Knihovna',         icon:'📚', maxLevel:5, desc:'XP dovedností postav u sídla +8 % za úroveň.',
      cost:(l)=>({ gold:220*l*l, materials:[{material:'plank',qty:6*l},{material:'cloth',qty:8*l}] }),
      effect:(l)=>({ xpBonus:1+0.08*l }) }
  };

  G.BASE_BUILDINGS = {
    woodcutter_camp:{ id:'woodcutter_camp', name:'Dřevařský tábor', icon:'🪵', maxLevel:5, desc:'Pasivně produkuje dřevo.', produces:'wood', rate:(l)=>0.006*l,
      cost:(l)=>({ gold:100*l*l, materials:[{material:'wood',qty:15*l},{material:'stone',qty:5*l}] }) },
    stone_quarry:   { id:'stone_quarry', name:'Kamenolom', icon:'🪨', maxLevel:5, desc:'Pasivně produkuje kámen.', produces:'stone', rate:(l)=>0.006*l,
      cost:(l)=>({ gold:100*l*l, materials:[{material:'wood',qty:10*l},{material:'stone',qty:10*l}] }) },
    herb_garden:    { id:'herb_garden', name:'Bylinková zahrada', icon:'🌿', maxLevel:5, desc:'Pasivně produkuje byliny.', produces:'herb', rate:(l)=>0.004*l,
      cost:(l)=>({ gold:120*l*l, materials:[{material:'wood',qty:10*l},{material:'fiber',qty:8*l}] }) },
    iron_mine:      { id:'iron_mine', name:'Železný důl', icon:'⛏️', maxLevel:5, desc:'Pasivně produkuje rudu.', produces:'iron_ore', rate:(l)=>0.004*l,
      requires:{ buildingId:'stone_quarry', level:2 },
      cost:(l)=>({ gold:180*l*l, materials:[{material:'stone',qty:20*l},{material:'plank',qty:8*l}] }) },
    weaving_hut:    { id:'weaving_hut', name:'Tkalcovská chata', icon:'🧵', maxLevel:5, desc:'Pasivně produkuje vlákno.', produces:'fiber', rate:(l)=>0.005*l,
      cost:(l)=>({ gold:90*l*l, materials:[{material:'wood',qty:8*l},{material:'herb',qty:5*l}] }) },
    hunting_lodge:  { id:'hunting_lodge', name:'Lovecká chata', icon:'🏹', maxLevel:5, desc:'Pasivně produkuje kůže.', produces:'hide', rate:(l)=>0.003*l,
      cost:(l)=>({ gold:160*l*l, materials:[{material:'plank',qty:8*l},{material:'fiber',qty:10*l}] }) },
    /* === FÁZE 10: NOVÉ BUDOVY ZÁKLADNY === */
    grain_field:    { id:'grain_field', name:'Obilné pole', icon:'🌾', maxLevel:5, desc:'Pasivně produkuje obilí.', produces:'grain', rate:(l)=>0.005*l,
      cost:(l)=>({ gold:130*l*l, materials:[{material:'wood',qty:8*l},{material:'stone',qty:6*l}] }) },
    coal_pit:       { id:'coal_pit', name:'Uhelná jáma', icon:'⬛', maxLevel:5, desc:'Pasivně produkuje uhlí.', produces:'coal', rate:(l)=>0.004*l,
      requires:{ buildingId:'stone_quarry', level:2 },
      cost:(l)=>({ gold:170*l*l, materials:[{material:'stone',qty:15*l},{material:'plank',qty:6*l}] }) },
    crystal_cave:   { id:'crystal_cave', name:'Krystalová jeskyně', icon:'💎', maxLevel:5, desc:'Pasivně produkuje krystaly.', produces:'crystal', rate:(l)=>0.0015*l,
      requires:{ buildingId:'iron_mine', level:3 },
      cost:(l)=>({ gold:400*l*l, materials:[{material:'stone',qty:30*l},{material:'iron_ingot',qty:5*l}] }) },
    apiary:         { id:'apiary', name:'Včelín', icon:'🍯', maxLevel:5, desc:'Pasivně produkuje byliny (bonus)', produces:'herb', rate:(l)=>0.003*l,
      cost:(l)=>({ gold:140*l*l, materials:[{material:'wood',qty:12*l},{material:'fiber',qty:8*l}] }) },
    gem_smithy:     { id:'gem_smithy', name:'Gemmová dílna', icon:'💠', maxLevel:5, desc:'Pasivně produkuje gemy (jeden za hodinu na level).', produces:null, rate:(l)=>0,
      requires:{ buildingId:'iron_mine', level:3 },
      cost:(l)=>({ gold:600*l*l, materials:[{material:'crystal',qty:8*l},{material:'iron_ingot',qty:8*l}] }),
      special:'gem' },
    legendary_forge:{ id:'legendary_forge', name:'Legendární výheň', icon:'🔥', maxLevel:3, desc:'Zvyšuje šanci na legendární drop z bossů (+5 % per level).', produces:null, rate:(l)=>0,
      requires:{ buildingId:'gem_smithy', level:3 },
      cost:(l)=>({ gold:1200*l*l, materials:[{material:'crystal',qty:15*l},{material:'iron_ingot',qty:20*l}] }),
      special:'legendary' }
  };
  G.BASE_FINE_CHANCE = 0.10;
  G.BASE_UNLOCK = { renown: 25 };
  G.BASE_POS = { x: 30, y: 30 };

  G.INJURIES = {
    bruise:     { id:'bruise',     name:'Pohmožděnina',  icon:'🟣', severity:1, desc:'−25 % rychlost', workMult:0.75, duration:180 },
    cut:        { id:'cut',        name:'Řezná rána',    icon:'🩸', severity:1, desc:'−35 % rychlost', workMult:0.65, duration:240 },
    sprain:     { id:'sprain',     name:'Výron',         icon:'🦶', severity:2, desc:'−50 % rychlost', workMult:0.50, duration:360 },
    wounded:    { id:'wounded',    name:'Otevřená rána', icon:'⚕️', severity:2, desc:'−55 % rychlost', workMult:0.45, duration:420 },
    fracture:   { id:'fracture',   name:'Zlomenina',     icon:'🦴', severity:3, desc:'Nemůže pracovat', workMult:0, duration:600 },
    concussion: { id:'concussion', name:'Otřes mozku',   icon:'💫', severity:3, desc:'Nemůže pracovat', workMult:0, duration:540 }
  };
  G.rollInjury = function (dangerLevel) {
    const r = G.rand();
    if (dangerLevel <= 1) return r < 0.65 ? G.INJURIES.bruise : G.INJURIES.cut;
    if (dangerLevel === 2) {
      if (r < 0.40) return G.INJURIES.bruise;
      if (r < 0.70) return G.INJURIES.cut;
      if (r < 0.90) return G.INJURIES.sprain;
      return G.INJURIES.wounded;
    }
    if (r < 0.20) return G.INJURIES.cut;
    if (r < 0.45) return G.INJURIES.sprain;
    if (r < 0.70) return G.INJURIES.wounded;
    if (r < 0.88) return G.INJURIES.fracture;
    return G.INJURIES.concussion;
  };
  G.INJURY_COLOR = { 1:'#e0bb5e', 2:'#cf8f6a', 3:'#c05a45' };

  G.PROFESSIONS = {
    woodcutter: { id:'woodcutter', name:'Dřevorubec',  icon:'🪓', color:'#8fbf7a', primary:'woodcutting', bonus:{ woodcutting:1.25, crafting:1.10 }, penalty:0.93, desc:'+25 % dřevorubectví' },
    miner:      { id:'miner',      name:'Horník',      icon:'⛏️', color:'#9c937c', primary:'mining',      bonus:{ mining:1.25, smithing:1.10 }, penalty:0.93, desc:'+25 % hornictví' },
    herbalist:  { id:'herbalist',  name:'Bylinkář',    icon:'🌿', color:'#8fbf7a', primary:'herbalism',   bonus:{ herbalism:1.25, alchemy:1.15 }, penalty:0.93, desc:'+25 % bylinkářství' },
    hunter:     { id:'hunter',     name:'Lovec',       icon:'🏹', color:'#cf8f6a', primary:'hunting',     bonus:{ hunting:1.25, scouting:1.15, combat:1.10 }, penalty:0.93, desc:'+25 % lov' },
    smith:      { id:'smith',      name:'Kovář',       icon:'🔨', color:'#e0bb5e', primary:'smithing',    bonus:{ smithing:1.30, crafting:1.15 }, penalty:0.90, desc:'+30 % kovářství' },
    alchemist:  { id:'alchemist',  name:'Alchymista',  icon:'⚗️', color:'#b3a4e8', primary:'alchemy',     bonus:{ alchemy:1.30, herbalism:1.15 }, penalty:0.90, desc:'+30 % alchymie' },
    cook:       { id:'cook',       name:'Kuchař',      icon:'🍳', color:'#e0bb5e', primary:'cooking',     bonus:{ cooking:1.30, herbalism:1.10 }, penalty:0.93, desc:'+30 % kuchařství' },
    scout:      { id:'scout',      name:'Průzkumník',  icon:'🧭', color:'#7aa8e0', primary:'scouting',    bonus:{ scouting:1.30, hunting:1.15, combat:1.10 }, penalty:0.93, desc:'+30 % průzkum' },
    merchant:   { id:'merchant',   name:'Kupec',       icon:'⚖️', color:'#7aa8e0', primary:'trading',     bonus:{ trading:1.30 }, penalty:0.95, special:'sellBonus', desc:'+30 % obchod' },
    adventurer: { id:'adventurer', name:'Dobrodruh',   icon:'🎲', color:'#b3a4e8', primary:null, bonus:{}, penalty:1.0, desc:'Bez specializace' }
  };
  G.PROFESSION_THRESHOLD = 6;
  G.SKILL_TO_PROFESSION = {
    woodcutting:'woodcutter', mining:'miner', herbalism:'herbalist', hunting:'hunter',
    smithing:'smith', alchemy:'alchemist', cooking:'cook', scouting:'scout',
    combat:'hunter', crafting:'smith', trading:'merchant'
  };

  G.PERK_LEVELS = [5, 10, 20];
  function mk(id, name, desc, effect) { return { id, name, desc, effect }; }
  G.PERKS = {
    woodcutting: {
      5:[mk('wc_volume','Široký záběr','+15 % rychlost',{work:1.15}), mk('wc_quality','Pečlivý řez','+20 % kvalita',{quality:20})],
      10:[mk('wc_yield','Hojné výnosy','+1 dřevo',{extraOutput:{material:'wood',qty:1}}), mk('wc_stamina','Úsporný postoj','−25 % výdrž',{stamina:0.75})],
      20:[mk('wc_master','Mistr lesa','+30 % rychlost',{work:1.30,quality:10}), mk('wc_focus','Soustředění','+50 % rychlost',{work:1.50,stamina:1.15})]
    },
    mining: {
      5:[mk('mi_volume','Silná rána','+15 % rychlost',{work:1.15}), mk('mi_quality','Čistý lom','+20 % kvalita',{quality:20})],
      10:[mk('mi_yield','Hluboké žíly','+1 ruda',{extraOutput:{material:'iron_ore',qty:1}}), mk('mi_coal','Uhelný prach','+1 uhlí',{extraOutput:{material:'coal',qty:1}})],
      20:[mk('mi_master','Mistr dolu','+30 % rychlost',{work:1.30,quality:10}), mk('mi_endure','Vytrvalost','−30 % výdrž',{stamina:0.70})]
    },
    herbalism: {
      5:[mk('he_volume','Rychlé ruce','+15 % rychlost',{work:1.15}), mk('he_quality','Znalec bylin','+20 % kvalita',{quality:20})],
      10:[mk('he_yield','Bohaté úlovky','+1 bylina',{extraOutput:{material:'herb',qty:1}}), mk('he_rare','Vzácné druhy','+5 % krystal',{rareDrop:{material:'crystal',chance:0.05}})],
      20:[mk('he_master','Mistr bylin','+30 % rychlost',{work:1.30,quality:10}), mk('he_hermit','Poustevník','+50 % kvalita',{quality:50})]
    },
    hunting: {
      5:[mk('hu_volume','Rychlý šíp','+15 % rychlost',{work:1.15}), mk('hu_quality','Čistý zásah','+20 % kvalita',{quality:20})],
      10:[mk('hu_yield','Hojná zvěř','+1 kůže',{extraOutput:{material:'hide',qty:1}}), mk('hu_combat','Bojový instinkt','+25 % boj',{combat:1.25})],
      20:[mk('hu_master','Mistr lovu','+30 % rychlost',{work:1.30,quality:10}), mk('hu_tracker','Stopař','+5 % krystal',{rareDrop:{material:'crystal',chance:0.05}})]
    },
    combat: {
      5:[mk('co_power','Silný úder','+20 % boj',{combat:1.20}), mk('co_def','Obranný postoj','−30 % zranění',{safety:0.70})],
      10:[mk('co_veteran','Veterán','+30 % boj',{combat:1.30}), mk('co_leader','Vůdce','+15 % boj skupiny',{groupCombat:1.15})],
      20:[mk('co_master','Mistr boje','+50 % boj',{combat:1.50,safety:0.80}), mk('co_immortal','Neochvějný','−50 % zranění',{safety:0.50})]
    },
    smithing: {
      5:[mk('sm_speed','Rychlé kování','+15 % rychlost',{work:1.15}), mk('sm_quality','Pečlivá práce','+20 % kvalita',{quality:20})],
      10:[mk('sm_save','Úsporný kovář','−1 ruda',{craftingSave:{material:'iron_ore',qty:1}}), mk('sm_master','Zbrojíř','+15 % kvalita',{quality:15})],
      20:[mk('sm_grand','Velmistr','+30 % rychlost, +15 % kvalita',{work:1.30,quality:15}), mk('sm_legend','Legenda','+40 % kvalita',{quality:40})]
    },
    alchemy: {
      5:[mk('al_speed','Rychlé míchání','+15 % rychlost',{work:1.15}), mk('al_quality','Čistý extrakt','+20 % kvalita',{quality:20})],
      10:[mk('al_save','Úsporná dávka','−1 bylina',{craftingSave:{material:'herb',qty:1}}), mk('al_potent','Silnější lektvar','+25 % kvalita',{quality:25})],
      20:[mk('al_grand','Velmistr','+30 % rychlost',{work:1.30,quality:15}), mk('al_philo','Kámen mudrců','+50 % kvalita',{quality:50})]
    },
    crafting: {
      5:[mk('cr_speed','Rychlé ruce','+15 % rychlost',{work:1.15}), mk('cr_quality','Precizní práce','+20 % kvalita',{quality:20})],
      10:[mk('cr_save','Úsporný','−1 dřevo',{craftingSave:{material:'wood',qty:1}}), mk('cr_batch','Sériová výroba','+1 kus',{craftBatch:1})],
      20:[mk('cr_grand','Velmistr','+30 % rychlost',{work:1.30,quality:15}), mk('cr_master','Mistr řemesla','+2 kusy',{craftBatch:2})]
    },
    cooking: {
      5:[mk('ck_speed','Rychlé vaření','+15 % rychlost',{work:1.15}), mk('ck_quality','Pečlivá chuť','+20 % kvalita',{quality:20})],
      10:[mk('ck_save','Úsporná kuchyně','−1 bylina',{craftingSave:{material:'herb',qty:1}}), mk('ck_batch','Velké dávky','+1 chléb',{craftBatch:1})],
      20:[mk('ck_grand','Velmistr','+30 % rychlost',{work:1.30,quality:15}), mk('ck_feast','Hostina','+2 kusy',{craftBatch:2})]
    },
    scouting: {
      5:[mk('sc_speed','Bystré oko','+15 % rychlost',{work:1.15}), mk('sc_safe','Opatrný krok','−25 % zranění',{safety:0.75})],
      10:[mk('sc_loot','Hledač pokladů','+1 nález',{scoutBonusLoot:1}), mk('sc_combat','Bojový průzkum','+20 % boj',{combat:1.20})],
      20:[mk('sc_grand','Velmistr','+30 % rychlost',{work:1.30,quality:15}), mk('sc_legend','Legenda stezek','−50 % zranění',{safety:0.50})]
    },
    trading: {
      5:[mk('tr_prices','Dobrý řečník','+10 % prodej',{sell:1.10}), mk('tr_buy','Ostrý vyjednavač','−10 % nákup',{buy:0.90})],
      10:[mk('tr_rep','Přátelské tváře','+50 % reputace',{rep:1.50}), mk('tr_route','Znalec cest','+15 % rychlost',{route:1.15})],
      20:[mk('tr_master','Mistr kupců','+25 % prodej, −20 % nákup',{sell:1.25,buy:0.80}), mk('tr_legend','Legenda trhu','+100 % reputace',{rep:2.0})]
    }
  };
  G.RESPEC_COST = 200;
})();
