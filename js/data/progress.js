(function () {
  const G = window.Game;

  G.QUEST_TEMPLATES = {
    deliver_wood:   { id:'deliver_wood', kind:'deliver', weight:10,
      generate:(s)=>({ text:`Potřebujeme ${8+s*4}× dřevo na opravu střech.`,
        need:[{material:'wood',qty:8+s*4}],
        reward:{ gold:Math.round(6*(8+s*4)*(1+s*0.2)), renown:1, rep:6 }, deadline:900+s*300 }) },
    deliver_food:   { id:'deliver_food', kind:'deliver', weight:8,
      generate:(s)=>({ text:`Zásoby pro stráž — ${5+s*3}× chléb.`,
        need:[{material:'bread',qty:5+s*3}],
        reward:{ gold:Math.round(10*(5+s*3)*(1+s*0.2)), renown:2, rep:8 }, deadline:1200+s*300 }) },
    deliver_ore:    { id:'deliver_ore', kind:'deliver', weight:9, minSize:1,
      generate:(s)=>({ text:`Kovárna spotřebovala zásoby — ${6+s*3}× ruda.`,
        need:[{material:'iron_ore',qty:6+s*3}],
        reward:{ gold:Math.round(14*(6+s*3)*(1+s*0.2)), renown:2, rep:8 }, deadline:1400+s*300 }) },
    deliver_ingot:  { id:'deliver_ingot', kind:'deliver', weight:6, minSize:2,
      generate:(s)=>({ text:`Zbrojíř potřebuje ${2+s}× železný ingot.`,
        need:[{material:'iron_ingot',qty:2+s}],
        reward:{ gold:Math.round(90*(2+s)*(1+s*0.15)), renown:4, rep:12 }, deadline:1800+s*300 }) },
    deliver_potion: { id:'deliver_potion', kind:'deliver', weight:5, minSize:1,
      generate:(s)=>({ text:`Ranhojič objednal ${1+Math.floor(s/2)}× lektvar.`,
        need:[{material:'potion',qty:1+Math.floor(s/2)}],
        reward:{ gold:Math.round(120*(1+Math.floor(s/2))*(1+s*0.15)), renown:5, rep:14 }, deadline:2100+s*300 }) },
    deliver_planks: { id:'deliver_planks', kind:'deliver', weight:7,
      generate:(s)=>({ text:`Staví se nová stodola — ${5+s*2}× prkno.`,
        need:[{material:'plank',qty:5+s*2}],
        reward:{ gold:Math.round(20*(5+s*2)*(1+s*0.2)), renown:2, rep:9 }, deadline:1500+s*300 }) },
    deliver_cloth:  { id:'deliver_cloth', kind:'deliver', weight:6,
      generate:(s)=>({ text:`Švadlena potřebuje ${3+s*2}× látka.`,
        need:[{material:'cloth',qty:3+s*2}],
        reward:{ gold:Math.round(30*(3+s*2)*(1+s*0.2)), renown:3, rep:10 }, deadline:1600+s*300 }) },
    deliver_weapon: { id:'deliver_weapon', kind:'deliver', weight:5, minSize:2,
      generate:(s)=>({ text:`Zbrojíř objednal ${1+s}× meč.`,
        need:[{material:'sword',qty:1+s}],
        reward:{ gold:Math.round(180*(1+s)*(1+s*0.15)), renown:6, rep:15 }, deadline:2400+s*300 }) }
  };
  G.questSlots = function (size) { return size === 0 ? 2 : size === 1 ? 3 : 4; };
  G.QUEST_REFRESH = 240;
  G.MAX_ACTIVE_QUESTS = 6;

  function anyUnitSkill(s, skillId, lvl) {
    for (const u of s.units) { const sk = u.skills[skillId]; if (sk && sk.level >= lvl) return true; }
    return false;
  }
  function countFactionsAbove(s, threshold) {
    let n = 0; const rep = s.reputation || {};
    for (const fid in rep) if (rep[fid] >= threshold) n++;
    return n;
  }
  G.STORY_QUESTS = [
    { id:'arrival', title:'Neznámý poutník',
      text:'Sedíš u ohně. Starý muž s holí se přitočí. „Tak ty jsi ten nový vůdce. Máš plán?"',
      trigger:(s)=>s.time >= 120,
      choices:[
        { text:'Postavit vlastní osadu.', effects:[
          { type:'log', text:'🏕️ Rozhodl ses vybudovat vlastní základnu (při renomé 25).' },
          { type:'set_flag', flag:'plan', value:'base' }, { type:'renown', value:3 } ] },
        { text:'Ovládnout obchod.', effects:[
          { type:'log', text:'⚖️ Rozhodl ses ovládnout obchodní stezky.' },
          { type:'set_flag', flag:'plan', value:'trade' },
          { type:'bonus_rep', faction:'league', value:5 } ] },
        { text:'Stát se legendou v boji.', effects:[
          { type:'log', text:'⚔️ Tvé jméno bude znít v každém hostinci.' },
          { type:'set_flag', flag:'plan', value:'war' }, { type:'renown', value:2 } ] }
      ] },
    { id:'mountain_message', title:'Zpráva z hor',
      text:'Posel přináší zprávu: „V dolech na severu se ztratili dva horníci."',
      trigger:(s)=>s.time >= 600 && anyUnitSkill(s, 'mining', 3),
      choices:[
        { text:'Vyslat skupinu hledat.', effects:[
          { type:'cost_mat', material:'bread', qty:2 },
          { type:'mat', material:'iron_ore', qty:8 }, { type:'renown', value:4 },
          { type:'bonus_rep', faction:'guild', value:8 },
          { type:'log', text:'⛏️ Našli jste oba horníky i bohatou žílu.' } ] },
        { text:'To není náš problém.', effects:[
          { type:'bonus_rep', faction:'guild', value:-5 },
          { type:'log', text:'😐 Hornický cech si to zapamatuje.' } ] }
      ] },
    { id:'forest_call', title:'Volání lesa',
      text:'Z temnoty vystoupí muž v kožešinách. „Jsem z Lesního bratrstva. Přítel, nebo cizinec?"',
      trigger:(s)=>G.getRep('brotherhood') >= 10,
      choices:[
        { text:'Přísahat lesu.', effects:[
          { type:'set_flag', flag:'oath', value:'forest' },
          { type:'bonus_rep', faction:'brotherhood', value:15 },
          { type:'bonus_rep', faction:'guild', value:-8 },
          { type:'log', text:'🌲 Složil jsi přísahu Lesnímu bratrstvu.' } ] },
        { text:'Zůstat neutrální.', effects:[ { type:'log', text:'🤝 Bratrstvo odchází.' } ] }
      ] },
    { id:'merchant_call', title:'Kupecká výzva',
      text:'Přijde k tobě bohatý kupec: „Chceš-li prosperovat, musíš obchodovat. Pošli někoho, kdo zná cesty."',
      trigger:(s)=>s.units.length >= 4 && s.resources.gold >= 200,
      choices:[
        { text:'Vyšlu obchodníka.', effects:[
          { type:'log', text:'🐎 Rozhodl ses vyslat obchodníka na cesty.' },
          { type:'set_flag', flag:'merchant_unlocked', value:true },
          { type:'bonus_rep', faction:'league', value:8 } ] },
        { text:'Zatím ne.', effects:[ { type:'log', text:'Kupec odchází s úsměvem.' } ] }
      ] },
    { id:'cave_shadows', title:'Stíny v jeskyni',
      text:'Tvá nejzkušenější postava se vrací bledá. „Není tam jen krystal."',
      trigger:(s)=>anyUnitSkill(s, 'combat', 5),
      choices:[
        { text:'Vyčistit jeskyni.', effects:[
          { type:'combat', difficulty:6 },
          { type:'mat', material:'crystal', qty:3, quality:'fine' },
          { type:'renown', value:8 },
          { type:'set_flag', flag:'cave_cleared', value:true },
          { type:'log', text:'⚔️ Jeskyně je čistá.' } ] },
        { text:'Zapečetit vchod.', effects:[
          { type:'log', text:'🪨 Zapečetili jste jeskyni.' },
          { type:'set_flag', flag:'cave_sealed', value:true } ] }
      ] },
    { id:'council', title:'Rada starších',
      text:'Zástupci frakcí se sešli, aby rozhodli o tvém místě ve světě.',
      trigger:(s)=>countFactionsAbove(s, 30) >= 2,
      choices:[
        { text:'Zůstat věrný Koruně.', effects:[
          { type:'bonus_rep', faction:'crown', value:20 },
          { type:'bonus_rep', faction:'brotherhood', value:-15 },
          { type:'set_flag', flag:'allegiance', value:'crown' },
          { type:'log', text:'👑 Přísahal jsi Koruně.' } ] },
        { text:'Stát na straně svobodných.', effects:[
          { type:'bonus_rep', faction:'brotherhood', value:20 },
          { type:'bonus_rep', faction:'guild', value:10 },
          { type:'bonus_rep', faction:'crown', value:-20 },
          { type:'set_flag', flag:'allegiance', value:'free' },
          { type:'log', text:'🌲 Přidal ses k svobodným.' } ] },
        { text:'Nezávislost.', effects:[
          { type:'renown', value:15 },
          { type:'set_flag', flag:'allegiance', value:'independent' },
          { type:'log', text:'⚖️ Zůstal jsi nezávislý.' } ] }
      ] },
    { id:'new_beginning', title:'Nový začátek',
      text:'Tvá první kapitola je u konce. Před tebou se otevírá nová cesta.',
      trigger:(s)=>(s.prestige && s.prestige.level >= 1) || s.resources.renown >= 100,
      choices:[
        { text:'Pokračovat dál.', effects:[
          { type:'renown', value:20 },
          { type:'log', text:'🌟 Kapitola jedna skončila.' },
          { type:'set_flag', flag:'chapter1_done', value:true } ] }
      ] }
  ];
  G.STORY_CHECK_INTERVAL = 10;

  function anySkillLevel(s, lvl) {
    for (const u of s.units) for (const sid in u.skills) if (u.skills[sid].level >= lvl) return true;
    return false;
  }
  function anyBaseBuilding(s) {
    if (!s.base || !s.base.buildings) return false;
    for (const bid in s.base.buildings) if (s.base.buildings[bid] > 0) return true;
    return false;
  }
  function allBaseBuildingsAt(s, lvl) {
    if (!s.base || !s.base.buildings) return false;
    let n = 0;
    for (const bid in G.BASE_BUILDINGS) if ((s.base.buildings[bid] || 0) >= lvl) n++;
    return n === Object.keys(G.BASE_BUILDINGS).length;
  }
  function anyFactionAbove(s, threshold) {
    const rep = s.reputation || {};
    for (const fid in rep) if (rep[fid] >= threshold) return true;
    return false;
  }
  function totalSettlementBuildings(s) {
    let n = 0;
    if (!s.buildings) return 0;
    for (const sid in s.buildings) for (const bid in s.buildings[sid]) n += s.buildings[sid][bid] || 0;
    return n;
  }
  function anySettlementRepAbove(s, threshold) {
    const r = s.settlementRep || {};
    for (const sid in r) if (r[sid] >= threshold) return true;
    return false;
  }
  function anyAmbitionDone(s, n) {
    let cnt = 0;
    for (const u of s.units) {
      for (const a of (u.ambitions || [])) if (a.done) cnt++;
    }
    return cnt >= n;
  }
  function totalMasterworks(s) {
    return (s.stats && s.stats.masterworks) || 0;
  }

  G.ACHIEVEMENTS = [
    { id:'first_blood', name:'První krůčky', icon:'🌱', desc:'Dokonči první úkol.', reward:{gold:20,renown:1}, check:(s)=>(s.stats.tasksDone||0)>=1 },
    { id:'wood_100', name:'Dřevorubec', icon:'🪓', desc:'Nasbírej 100 dřeva.', reward:{gold:40,renown:2}, check:(s)=>(s.stats.totalWood||0)>=100 },
    { id:'stone_100', name:'Kamenický mistr', icon:'🪨', desc:'Nasbírej 100 kamene.', reward:{gold:40,renown:2}, check:(s)=>(s.stats.totalStone||0)>=100 },
    { id:'first_thousand', name:'Obchodník', icon:'🪙', desc:'Vydělej 1000 zlata.', reward:{gold:100,renown:4}, check:(s)=>(s.stats.goldEarned||0)>=1000 },
    { id:'five_units', name:'Vůdce', icon:'🧙', desc:'Mít 5 postav.', reward:{gold:60,renown:3}, check:(s)=>s.units.length>=5 },
    { id:'first_combat', name:'První krev', icon:'⚔️', desc:'Vyhraj první souboj.', reward:{gold:50,renown:3}, check:(s)=>(s.stats.combatsWon||0)>=1 },
    { id:'ten_combats', name:'Bojovník', icon:'🗡️', desc:'Vyhraj 10 soubojů.', reward:{gold:300,renown:8}, check:(s)=>(s.stats.combatsWon||0)>=10 },
    { id:'first_trade', name:'Kupčík', icon:'🐎', desc:'Proveď první obchodníkovu cestu.', reward:{gold:80,renown:3}, check:(s)=>(s.stats.merchantTrades||0)>=1 },
    { id:'merchant_10', name:'Karavanní magnát', icon:'🏪', desc:'Proveď 10 obchodníkových cest.', reward:{gold:400,renown:10}, check:(s)=>(s.stats.merchantTrades||0)>=10 },
    { id:'settlement_friendly', name:'Vítaný host', icon:'🤝', desc:'Reputace 40 u některého sídla.', reward:{gold:150,renown:5}, check:(s)=>anySettlementRepAbove(s,40) },
    { id:'settlement_allied', name:'Spojenec města', icon:'🏛️', desc:'Reputace 80 u sídla.', reward:{gold:600,renown:12}, check:(s)=>anySettlementRepAbove(s,80) },
    { id:'skill_10', name:'Zkušený řemeslník', icon:'🎯', desc:'Dovednost na úrovni 10.', reward:{gold:100,renown:4}, check:(s)=>anySkillLevel(s,10) },
    { id:'skill_20', name:'Legenda', icon:'👑', desc:'Dovednost na úrovni 20.', reward:{gold:400,renown:10}, check:(s)=>anySkillLevel(s,20) },
    { id:'base_founded', name:'Poutník usedlý', icon:'🏕️', desc:'Postav první budovu základny.', reward:{gold:80,renown:3}, check:(s)=>s.base && s.base.unlocked && anyBaseBuilding(s) },
    { id:'base_full', name:'Osada', icon:'🏰', desc:'Všechny budovy základny na úr. 3.', reward:{gold:800,renown:12}, check:(s)=>allBaseBuildingsAt(s,3) },
    { id:'friendly_faction', name:'Spojenec frakce', icon:'🤝', desc:'Reputace 60 u frakce.', reward:{gold:200,renown:6}, check:(s)=>anyFactionAbove(s,60) },
    { id:'exalted', name:'Oslavený', icon:'🌟', desc:'Reputace 120 u frakce.', reward:{gold:600,renown:15}, check:(s)=>anyFactionAbove(s,120) },
    { id:'quests_5', name:'Spolehlivý', icon:'📜', desc:'Splň 5 zakázek.', reward:{gold:250,renown:5}, check:(s)=>(s.stats.questsCompleted||0)>=5 },
    { id:'traveler', name:'Poutník', icon:'🗺️', desc:'Navštiv všechna sídla.', reward:{gold:150,renown:5}, check:(s)=>(s.stats.settlementsVisited||[]).length>=6 },
    { id:'prestige_1', name:'Nový začátek', icon:'🔄', desc:'Proveď Prestiž.', reward:{gold:500,renown:20}, check:(s)=>(s.prestige && s.prestige.level)>=1 },
    { id:'dragon_slayer', name:'Drakobijec', icon:'🐉', desc:'Poraz draka Ohnivce.', reward:{gold:2000,renown:40}, check:(s)=>(s.stats.dragonsKilled||0)>=1 },
    { id:'master_builder', name:'Stavitel', icon:'🔨', desc:'Postav 10 budov v sídlech.', reward:{gold:300,renown:8}, check:(s)=>totalSettlementBuildings(s)>=10 },
    { id:'ambition_1', name:'Splněný sen', icon:'🎯', desc:'Splň 1 ambici postavy.', reward:{gold:200,renown:5}, check:(s)=>anyAmbitionDone(s,1) },
    { id:'ambition_5', name:'Sběratel snů', icon:'✨', desc:'Splň 5 ambicí postav.', reward:{gold:800,renown:15}, check:(s)=>anyAmbitionDone(s,5) },
    { id:'masterwork_1', name:'Mistr řemeslník', icon:'💎', desc:'Vyrob mistrovský předmět.', reward:{gold:300,renown:8}, check:(s)=>totalMasterworks(s)>=1 }
  ];
})();
