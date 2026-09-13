(function () {
  const G = window.Game;

  /* 15 expedic + eventy na cestě */
  G.EXPEDITIONS = {
    /* === Základní (bylo 5) === */
    lost_caravan: { id:'lost_caravan', name:'Ztracená karavana', icon:'🐎', desc:'Najdi ztracenou kupeckou karavanu v horách.', minDays:2, maxDays:4, difficulty:2,
      rewardPool:[{material:'coin',min:40,max:120,chance:1.00},{material:'cloth',min:3,max:6,chance:0.70},{material:'iron_ingot',min:1,max:3,chance:0.50},{material:'jewel',min:1,max:2,chance:0.30}],
      xpReward:80, renownReward:5, failureText:'Karavana byla dávno pryč.', successText:'Našli jste karavanu ukrytou v rokli!' },
    ancient_ruins: { id:'ancient_ruins', name:'Starobylé zříceniny', icon:'🏛️', desc:'Prozkoumej zříceniny dávné civilizace.', minDays:3, maxDays:6, difficulty:3,
      rewardPool:[{material:'coin',min:80,max:200,chance:1.00},{material:'crystal',min:2,max:5,chance:0.70},{material:'jewel',min:2,max:4,chance:0.50},{material:'map_fragment',min:1,max:2,chance:0.40}],
      xpReward:150, renownReward:10, failureText:'Zříceniny byly prázdné.', successText:'Našli jste skrytou komoru plnou pokladů!' },
    dragon_hunt: { id:'dragon_hunt', name:'Lov na draka', icon:'🐉', desc:'Vypátrej a zabij draka.', minDays:5, maxDays:8, difficulty:5,
      rewardPool:[{material:'coin',min:200,max:500,chance:1.00},{material:'dragon_scale',min:3,max:6,chance:1.00},{material:'crystal',min:4,max:8,chance:0.80},{material:'jewel',min:3,max:6,chance:0.60}],
      xpReward:400, renownReward:30, failureText:'Drak byl příliš silný.', successText:'Drak padl! Jeho poklad je váš.' },
    distant_trade: { id:'distant_trade', name:'Daleká výprava', icon:'⛵', desc:'Vydej se do vzdálené země za vzácným zbožím.', minDays:4, maxDays:7, difficulty:1,
      rewardPool:[{material:'coin',min:100,max:250,chance:1.00},{material:'potion',min:2,max:5,chance:0.60},{material:'cloth',min:4,max:8,chance:0.70}],
      xpReward:100, renownReward:8, failureText:'Obchod se nevyvedl.', successText:'Přivezli jste vzácné zboží!' },
    ice_journey: { id:'ice_journey', name:'Cesta za led', icon:'🧊', desc:'Zamíříš na sever do zmrzlých plání.', minDays:5, maxDays:9, difficulty:4,
      rewardPool:[{material:'coin',min:150,max:350,chance:1.00},{material:'crystal',min:3,max:7,chance:0.80},{material:'jewel',min:2,max:5,chance:0.60}],
      xpReward:250, renownReward:20, failureText:'Mráz vás zahnal zpět.', successText:'Přinesli jste krystaly z ledu!' },

    /* === FÁZE 9: NOVÉ === */
    bandit_raid:     { id:'bandit_raid', name:'Nájezd banditů', icon:'🏴', desc:'Vyčisti banditský tábor v horách.', minDays:2, maxDays:4, difficulty:3,
      rewardPool:[{material:'coin',min:80,max:180,chance:1.00},{material:'iron_ingot',min:2,max:5,chance:0.70},{material:'bandit_seal',min:2,max:4,chance:0.60}],
      xpReward:120, renownReward:12, failureText:'Bandité vás odrazili.', successText:'Tábor dobyt!' },
    wolf_hunt:       { id:'wolf_hunt', name:'Lov vlků', icon:'🐺', desc:'Zbav kraj vlčí smečky.', minDays:2, maxDays:3, difficulty:2,
      rewardPool:[{material:'hide',min:8,max:15,chance:1.00},{material:'trophy_wolf',min:2,max:4,chance:0.80},{material:'coin',min:30,max:80,chance:1.00}],
      xpReward:90, renownReward:8, failureText:'Smečka byla příliš velká.', successText:'Vlci vyhubeni!' },
    rescue_mission:  { id:'rescue_mission', name:'Záchranná mise', icon:'🆘', desc:'Zachraň ztracené horníky.', minDays:2, maxDays:5, difficulty:3,
      rewardPool:[{material:'coin',min:100,max:200,chance:1.00},{material:'iron_ore',min:10,max:20,chance:1.00},{material:'crystal',min:2,max:4,chance:0.60}],
      xpReward:150, renownReward:15, failureText:'Nenašli jste je včas.', successText:'Všichni zachráněni!' },
    treasure_map:    { id:'treasure_map', name:'Honba za pokladem', icon:'🗺️', desc:'Podle mapy najdi skrytý poklad.', minDays:4, maxDays:7, difficulty:2,
      rewardPool:[{material:'coin',min:200,max:500,chance:1.00},{material:'jewel',min:3,max:7,chance:0.70},{material:'crystal',min:2,max:6,chance:0.60}],
      xpReward:100, renownReward:10, failureText:'Poklad byl už vybrán.', successText:'Našli jste truhlu!' },
    pilgrimage:      { id:'pilgrimage', name:'Pouť', icon:'⛪', desc:'Vydej se na svatou pouť.', minDays:6, maxDays:10, difficulty:1,
      rewardPool:[{material:'coin',min:80,max:150,chance:1.00},{material:'herb',min:10,max:20,chance:1.00},{material:'potion',min:3,max:6,chance:0.80}],
      xpReward:200, renownReward:25, failureText:'Pouť byla přerušena.', successText:'Pouť dokončena s požehnáním.' },
    spying:          { id:'spying', name:'Špionáž', icon:'🕵️', desc:'Získej informace o nepříteli.', minDays:3, maxDays:5, difficulty:3,
      rewardPool:[{material:'map_fragment',min:1,max:3,chance:1.00},{material:'coin',min:100,max:200,chance:1.00}],
      xpReward:130, renownReward:10, failureText:'Byli jste odhaleni.', successText:'Zprávy získány!' },
    monster_slayer:  { id:'monster_slayer', name:'Lov monster', icon:'🐉', desc:'Zabij monstrum ohrožující kraj.', minDays:5, maxDays:8, difficulty:4,
      rewardPool:[{material:'coin',min:180,max:400,chance:1.00},{material:'crystal',min:4,max:8,chance:0.80},{material:'dragon_scale',min:1,max:3,chance:0.50}],
      xpReward:300, renownReward:25, failureText:'Monstrum uprchlo.', successText:'Monstrum padlo!' },
    gem_mining:      { id:'gem_mining', name:'Těžba gemů', icon:'💎', desc:'Vyprav se do hlubin za gemy.', minDays:4, maxDays:6, difficulty:3,
      rewardPool:[{material:'gem_ruby',min:1,max:2,chance:0.60},{material:'gem_sapphire',min:1,max:2,chance:0.60},{material:'crystal',min:3,max:7,chance:1.00}],
      xpReward:150, renownReward:12, failureText:'Doly byly vyčerpané.', successText:'Přinesli jste vzácné gemy!' },
    diplomatic:      { id:'diplomatic', name:'Diplomatická mise', icon:'📜', desc:'Vyjednávej s cizí mocností.', minDays:4, maxDays:7, difficulty:1,
      rewardPool:[{material:'coin',min:150,max:300,chance:1.00},{material:'cloth',min:5,max:10,chance:0.80}],
      xpReward:80, renownReward:30, failureText:'Jednání zkrachovala.', successText:'Dohoda podepsána!' },
    plague_research: { id:'plague_research', name:'Výzkum moru', icon:'☠️', desc:'Najdi lék na mor.', minDays:5, maxDays:8, difficulty:4,
      rewardPool:[{material:'potion',min:5,max:10,chance:1.00},{material:'herb',min:15,max:30,chance:1.00},{material:'crystal',min:3,max:6,chance:0.60}],
      xpReward:250, renownReward:30, failureText:'Výzkum selhal.', successText:'Lék nalezen!' },
    raid_stronghold:{ id:'raid_stronghold', name:'Útok na pevnost', icon:'🏰', desc:'Dobyj nepřátelskou pevnost.', minDays:6, maxDays:10, difficulty:5,
      rewardPool:[{material:'coin',min:300,max:600,chance:1.00},{material:'iron_ingot',min:5,max:12,chance:1.00},{material:'bandit_seal',min:3,max:7,chance:0.80},{material:'jewel',min:3,max:7,chance:0.60}],
      xpReward:400, renownReward:40, failureText:'Pevnost odolala.', successText:'Pevnost dobyta!' }
  };

  /* Eventy na cestě — spustí se s 35% šancí během expedice */
  G.EXPEDITION_EVENTS = [
    { id:'merchant_meet', text:'Potkali jste potulného obchodníka.', icon:'⚖️', outcome:'loot',
      loot:[{material:'coin',min:20,max:60,chance:0.8},{material:'potion',min:1,max:2,chance:0.4}] },
    { id:'storm', text:'Zastihla vás bouře. Ztratili jste část zásob.', icon:'🌩️', outcome:'loss',
      loss:[{material:'bread',qty:2},{material:'coin',qty:15}] },
    { id:'shortcut', text:'Našli jste tajnou zkratku — expedice se zkrátí.', icon:'🗺️', outcome:'shorten', days:1 },
    { id:'ruins_find', text:'Narazili jste na starobylé ruiny.', icon:'🏛️', outcome:'loot',
      loot:[{material:'crystal',min:1,max:3,chance:0.7},{material:'coin',min:30,max:80,chance:0.9}] },
    { id:'wolves', text:'Přepadla vás vlčí smečka.', icon:'🐺', outcome:'injury' },
    { id:'traveling_bard', text:'Potkali jste potulného barda.', icon:'🎵', outcome:'mood', value:10 },
    { id:'lost', text:'Ztratili jste se v mlze — expedice se prodlouží.', icon:'🌫️', outcome:'lengthen', days:1 },
    { id:'hermit', text:'Setkali jste se s moudrým poustevníkem.', icon:'🧘', outcome:'xp', value:80 },
    { id:'dragon_sighting', text:'V dálce jste spatřili draka.', icon:'🐉', outcome:'renown', value:5 },
    { id:'natural_spring', text:'Našli jste léčivý pramen.', icon:'💧', outcome:'heal' }
  ];
  G.EXPEDITION_MIN_PARTY = 2;
  G.EXPEDITION_MAX_PARTY = 6;
  G.EXPEDITION_EVENT_CHANCE = 0.35;
})();
