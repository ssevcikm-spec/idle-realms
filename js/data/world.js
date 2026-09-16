(function () {
  const G = window.Game;

  G.NAMES = {
    first: ['Aldo','Bram','Cedrik','Dara','Egon','Fina','Gor','Hela','Ivo','Jara','Kael',
            'Lira','Miro','Nela','Oren','Pia','Quin','Rada','Sil','Tomas','Ula','Vek',
            'Wren','Xan','Yara','Zor','Bára','Dana','Emil','Filip','Gustav','Hana'],
    last: ['Rychlý','Tichý','Kovář','Odvážný','Moudrý','Šedý','Zelený','z Horního kopce',
           'z Údolí','z Lesa','z Jeskyně','Ostří','Kamenný','Bystrý','Železný','z Brodu']
  };
  G.randomName = function () { return G.pick(G.NAMES.first) + ' ' + G.pick(G.NAMES.last); };

  G.QUALITY = ['crude', 'common', 'fine', 'superior', 'masterwork'];
  G.QUALITY_LABEL = { crude:'Hrubý', common:'Běžný', fine:'Jemný', superior:'Vynikající', masterwork:'Mistrovský' };
  G.QUALITY_MULT = { crude:0.6, common:1, fine:1.7, superior:2.6, masterwork:4.2 };
  G.MATERIALS = {
    wood:       { name:'Dřevo',         icon:'🪵', tier:1, price:3 },
    stone:      { name:'Kámen',         icon:'🪨', tier:1, price:3 },
    fiber:      { name:'Vlákno',        icon:'🧵', tier:1, price:4 },
    herb:       { name:'Byliny',        icon:'🌿', tier:1, price:6 },
    grain:      { name:'Obilí',          icon:'🌾', tier:1, price:3 },
    flour:      { name:'Mouka',          icon:'🥣', tier:1, price:8 },
    fish:       { name:'Ryba',          icon:'🐟', tier:1, price:7 },
    coal:       { name:'Uhlí',          icon:'⬛', tier:2, price:8 },
    iron_ore:   { name:'Železná ruda',  icon:'⛏️', tier:2, price:12 },
    hide:       { name:'Kůže',          icon:'🟫', tier:2, price:14 },
    plank:      { name:'Prkno',         icon:'🪚', tier:2, price:11 },
    cloth:      { name:'Látka',         icon:'🧶', tier:2, price:16 },
    bread:      { name:'Chléb',         icon:'🍞', tier:2, price:10 },
    iron_ingot: { name:'Železný ingot', icon:'🔩', tier:2, price:34 },
    potion:     { name:'Lektvar',       icon:'🧪', tier:3, price:90 },
    crystal:    { name:'Krystal',       icon:'💎', tier:3, price:60 },
    coin:       { name:'Mince',         icon:'💰', tier:1, price:1, currency:true },
    jewel:      { name:'Šperk',         icon:'💍', tier:3, price:45 },
    map_fragment:{ name:'Fragment mapy',icon:'🗺️', tier:3, price:80 },
    trophy_wolf:{ name:'Vlčí hlava',    icon:'🐺', tier:2, price:35 },
    trophy_bear:{ name:'Medvědí kožich',icon:'🐻', tier:3, price:90 },
    dragon_scale:{ name:'Dračí šupina', icon:'🐉', tier:3, price:200 },
    bandit_seal:{ name:'Pečeť banditů', icon:'🔱', tier:2, price:60 },
    /* zpracované - nové */
    bow:        { name:'Lovecký luk',   icon:'🏹', tier:2, price:48 },
    sword:      { name:'Meč',           icon:'⚔️', tier:3, price:120 },
    armor:      { name:'Zbroj',         icon:'🛡️', tier:3, price:260 },
    longbow:    { name:'Dlouhý luk',    icon:'🏹', tier:3, price:180 }
  };
  G.TRADED = ['wood','stone','fiber','herb','grain','flour','fish','coal','iron_ore','hide','plank','cloth','bread','iron_ingot','potion','crystal','jewel','bow','sword','armor'];

  G.SKILLS = {
    woodcutting: { name:'Dřevorubectví', icon:'🪓', attr:'str' },
    mining:      { name:'Hornictví',     icon:'⛏️', attr:'str' },
    herbalism:   { name:'Bylinkářství',  icon:'🌿', attr:'int' },
    hunting:     { name:'Lov',           icon:'🏹', attr:'agi' },
    combat:      { name:'Boj',           icon:'⚔️', attr:'str' },
    smithing:    { name:'Kovářství',     icon:'🔨', attr:'str' },
    alchemy:     { name:'Alchymie',      icon:'⚗️', attr:'int' },
    cooking:     { name:'Kuchařství',    icon:'🍳', attr:'int' },
    crafting:    { name:'Řemeslo',       icon:'🧰', attr:'agi' },
    scouting:    { name:'Průzkum',       icon:'🧭', attr:'agi' },
    trading:     { name:'Obchod',        icon:'⚖️', attr:'int' }
  };
  G.xpForLevel = function (level) { return Math.floor(50 * Math.pow(level, 1.6)); };

  G.NODE_KINDS = {
    forest:      { name:'Les',          icon:'🌲', terrain:['forest'],                weight:10, danger:0 },
    deep_forest: { name:'Hluboký les',  icon:'🌲', terrain:['deep_forest'],           weight:7,  danger:1 },
    grove:       { name:'Hájek',        icon:'🌳', terrain:['grass'],                 weight:6,  danger:0 },
    meadow:      { name:'Louka',        icon:'🌿', terrain:['grass'],                 weight:6,  danger:0 },
    quarry:      { name:'Kamenolom',    icon:'🪨', terrain:['hills'],                 weight:7,  danger:1 },
    mine:        { name:'Důl',          icon:'⛏️', terrain:['hills','mountain'],      weight:8,  danger:2 },
    cave:        { name:'Jeskyně',      icon:'🕳️', terrain:['mountain','hills'],      weight:4,  danger:3 },
    marsh:       { name:'Močál',        icon:'🌾', terrain:['swamp'],                 weight:5,  danger:1 },
    lake:        { name:'Jezero',       icon:'🎣', terrain:['water'],                 weight:5,  danger:0 }
  };
  G.NODE_DANGER = { forest:0, deep_forest:1, grove:0, meadow:0, quarry:1, mine:2, cave:3, marsh:1, lake:0 };
  G.DANGER_LABEL = {
    0: { text:'Bezpečné',        color:'#8fbf7a' },
    1: { text:'Mírné nebezpečí', color:'#e0bb5e' },
    2: { text:'Nebezpečné',      color:'#cf8f6a' },
    3: { text:'Smrtelné',        color:'#c05a45' }
  };
  G.NODE_TINT = {
    forest:'#3f5a34', deep_forest:'#2b3f24', grove:'#4d6b3a', meadow:'#5f7a42',
    quarry:'#6b6350', mine:'#5a5347', cave:'#3a3730', marsh:'#4a5240', lake:'#3d5a68'
  };

  G.ACTIVITIES = {
    chop_wood: { id:'chop_wood', name:'Kácet dřevo', icon:'🪓', nodeKinds:['forest','deep_forest','grove'],
      skill:'woodcutting', attr:'str', mode:'quantity', workPerUnit:4, defaultQty:20,
      output:[{material:'wood',qty:1}], xpPerUnit:6,
      drops:{ coin:[0.06,1,5], jewel:[0.02,1,1], crystal:[0.005,1,1], map_fragment:[0.005,1,1] } },
    gather_fiber: { id:'gather_fiber', name:'Sbírat vlákno', icon:'🧵', nodeKinds:['forest','grove','meadow','marsh'],
      skill:'herbalism', attr:'agi', mode:'quantity', workPerUnit:6, defaultQty:15,
      output:[{material:'fiber',qty:1}], xpPerUnit:6,
      drops:{ coin:[0.04,1,3] } },
    forage_herbs: { id:'forage_herbs', name:'Sbírat byliny', icon:'🌿', nodeKinds:['forest','deep_forest','meadow','marsh'],
      skill:'herbalism', attr:'int', mode:'quantity', workPerUnit:7, defaultQty:15,
      output:[{material:'herb',qty:1}], xpPerUnit:8,
      drops:{ coin:[0.05,1,4], jewel:[0.01,1,1] } },
    hunt: { id:'hunt', name:'Lovit zvěř', icon:'🏹', nodeKinds:['forest','deep_forest'],
      skill:'hunting', attr:'agi', mode:'quantity', workPerUnit:12, defaultQty:8,
      output:[{material:'hide',qty:1}], xpPerUnit:14,
      requires:{ skillLevel:{ hunting:2 } },
      drops:{ coin:[0.10,2,8], trophy_wolf:[0.03,1,1] } },
    gather_stone: { id:'gather_stone', name:'Lámat kámen', icon:'🪨', nodeKinds:['quarry'],
      skill:'mining', attr:'str', mode:'quantity', workPerUnit:5, defaultQty:20,
      output:[{material:'stone',qty:1}], xpPerUnit:6,
      drops:{ coin:[0.05,1,4], crystal:[0.01,1,1] } },
    mine_iron: { id:'mine_iron', name:'Těžit železo', icon:'⛏️', nodeKinds:['mine'],
      skill:'mining', attr:'str', mode:'quantity', workPerUnit:10, defaultQty:15,
      output:[{material:'iron_ore',qty:1}], xpPerUnit:13,
      requires:{ skillLevel:{ mining:2 } },
      drops:{ coin:[0.07,2,6], jewel:[0.015,1,1], crystal:[0.01,1,1] } },
    mine_coal: { id:'mine_coal', name:'Těžit uhlí', icon:'⬛', nodeKinds:['mine'],
      skill:'mining', attr:'str', mode:'quantity', workPerUnit:8, defaultQty:20,
      output:[{material:'coal',qty:1}], xpPerUnit:10,
      drops:{ coin:[0.05,1,5] } },
    mine_crystal: { id:'mine_crystal', name:'Těžit krystal', icon:'💎', nodeKinds:['cave'],
      skill:'mining', attr:'str', mode:'quantity', workPerUnit:18, defaultQty:6,
      output:[{material:'crystal',qty:1}], xpPerUnit:28,
      requires:{ skillLevel:{ mining:6 } },
      drops:{ coin:[0.15,5,15], jewel:[0.08,1,1], map_fragment:[0.03,1,1] } },
    explore_cave: { id:'explore_cave', name:'Prozkoumat jeskyni', icon:'🧭', nodeKinds:['cave'],
      skill:'scouting', attr:'agi', mode:'timed', workRequired:60,
      output:[{material:'crystal',qty:2},{material:'iron_ore',qty:4}], xpReward:45,
      requires:{ skillLevel:{ scouting:2 } } },
    fish: { id:'fish', name:'Rybařit', icon:'🎣', nodeKinds:['lake'],
      skill:'hunting', attr:'agi', mode:'quantity', workPerUnit:9, defaultQty:12,
      output:[{material:'fish',qty:1}], xpPerUnit:9,
      drops:{ coin:[0.06,1,3], jewel:[0.01,1,1] } },
    harvest_grain: { id:'harvest_grain', name:'Sklízet obilí', icon:'🌾', nodeKinds:['meadow','grove'],
      skill:'herbalism', attr:'agi', mode:'quantity', workPerUnit:6, defaultQty:15,
      output:[{material:'grain',qty:1}], xpPerUnit:7,
      drops:{ coin:[0.04,1,3] } }
  };

  /* ---------- recepty s dílnami a řetězci ---------- */
  G.RECIPES = {
    /* Tesařská dílna */
    plank:      { id:'plank', name:'Prkno', icon:'🪚', skill:'crafting', reqLevel:1, xp:8,
                  workshop:'carpenter', tier:1,
                  inputs:[{material:'wood',qty:2}], output:{material:'plank',qty:1} },
    bow:        { id:'bow', name:'Lovecký luk', icon:'🏹', skill:'crafting', reqLevel:3, xp:18,
                  workshop:'carpenter', tier:2,
                  inputs:[{material:'plank',qty:2},{material:'fiber',qty:3}], output:{material:'bow',qty:1} },
    longbow:    { id:'longbow', name:'Dlouhý luk', icon:'🏹', skill:'crafting', reqLevel:8, xp:45,
                  workshop:'carpenter', tier:3,
                  inputs:[{material:'plank',qty:4},{material:'cloth',qty:2},{material:'crystal',qty:1}], output:{material:'longbow',qty:1} },
    /* Tkalcovská dílna */
    cloth:      { id:'cloth', name:'Látka', icon:'🧶', skill:'crafting', reqLevel:2, xp:12,
                  workshop:'weaver', tier:1,
                  inputs:[{material:'fiber',qty:3}], output:{material:'cloth',qty:1} },
    /* Kovářská dílna */
    iron_ingot: { id:'iron_ingot', name:'Železný ingot', icon:'🔩', skill:'smithing', reqLevel:2, xp:16,
                  workshop:'smithy', tier:2,
                  inputs:[{material:'iron_ore',qty:2},{material:'coal',qty:1}], output:{material:'iron_ingot',qty:1} },
    sword:      { id:'sword', name:'Meč', icon:'⚔️', skill:'smithing', reqLevel:5, xp:35,
                  workshop:'smithy', tier:3,
                  inputs:[{material:'iron_ingot',qty:3},{material:'plank',qty:1}], output:{material:'sword',qty:1} },
    armor:      { id:'armor', name:'Zbroj', icon:'🛡️', skill:'smithing', reqLevel:7, xp:50,
                  workshop:'smithy', tier:3,
                  inputs:[{material:'iron_ingot',qty:5},{material:'cloth',qty:2},{material:'hide',qty:2}], output:{material:'armor',qty:1} },
    /* Kuchyň */
    flour:      { id:'flour', name:'Mouka', icon:'🥣', skill:'cooking', reqLevel:1, xp:6,
                  workshop:'kitchen', tier:1,
                  inputs:[{material:'grain',qty:2}], output:{material:'flour',qty:1} },
    bread:      { id:'bread', name:'Chléb', icon:'🍞', skill:'cooking', reqLevel:1, xp:7,
                  workshop:'kitchen', tier:1,
                  inputs:[{material:'flour',qty:1}], output:{material:'bread',qty:1} },
    /* Alchymistická laboratoř */
    potion:     { id:'potion', name:'Lektvar', icon:'🧪', skill:'alchemy', reqLevel:3, xp:22,
                  workshop:'alchemy', tier:2,
                  inputs:[{material:'herb',qty:3},{material:'crystal',qty:1}], output:{material:'potion',qty:1} }
  };

  G.SETTLEMENT_SPECS = {
    mining:    { label:'Těžební',    produces:['iron_ore','coal','stone','crystal'],   consumes:['bread','cloth','potion','wood','fish'] },
    forestry:  { label:'Lesnická',   produces:['wood','plank','fiber','hide'],         consumes:['bread','iron_ingot','potion','stone'] },
    farming:   { label:'Zemědělská', produces:['grain','bread','herb','fiber','fish'], consumes:['iron_ingot','plank','cloth','coal'] },
    trade:     { label:'Obchodní',   produces:['cloth','potion','plank','iron_ingot'], consumes:['crystal','hide','herb','iron_ore'] }
  };
  G.SETTLEMENT_SIZE = {
    village: { label:'Vesnice',   icon:'🏘️', radius:1, goldBase:120,  stockMult:0.7, houses:3 },
    town:    { label:'Město',     icon:'🏰', radius:2, goldBase:400,  stockMult:1.0, houses:5 },
    city:    { label:'Metropole', icon:'🏛️', radius:2, goldBase:1100, stockMult:1.5, houses:8 }
  };
  G.SETTLEMENT_DEFS = [
    { id:'svitavy',  name:'Svitavy',         x:7,  y:22, size:'village', spec:'farming'  },
    { id:'kamenice', name:'Kamenice',        x:31, y:20, size:'village', spec:'mining'   },
    { id:'brezova',  name:'Březová',         x:11, y:8,  size:'town',    spec:'forestry' },
    { id:'stribrod', name:'Stříbrný Brod',   x:28, y:10, size:'town',    spec:'trade'    },
    { id:'hluboka',  name:'Hluboká',         x:19, y:25, size:'village', spec:'mining'   },
    { id:'kralov',   name:'Královské Město', x:20, y:15, size:'city',    spec:'trade'    }
  ];
  G.ROADS = [
    ['kralov','svitavy'],['kralov','brezova'],['kralov','stribrod'],
    ['kralov','kamenice'],['kralov','hluboka'],['brezova','stribrod'],
    ['svitavy','hluboka']
  ];

  G.FACTIONS = {
    crown:       { id:'crown',       name:'Koruna',         icon:'👑', color:'#d8b45a', rivals:['brotherhood','league'], motto:'Řád, daň a pořádek.' },
    guild:       { id:'guild',       name:'Hornický cech',  icon:'⛏️', color:'#9c937c', rivals:['brotherhood'],          motto:'Co je pod zemí, patří nám.' },
    brotherhood: { id:'brotherhood', name:'Lesní bratrstvo',icon:'🌲', color:'#8fbf7a', rivals:['crown','guild'],        motto:'Les byl tady dřív než vy.' },
    league:      { id:'league',      name:'Kupecký svaz',   icon:'⚖️', color:'#7aa8e0', rivals:['crown'],                motto:'Vše má svou cenu.' }
  };
  G.SETTLEMENT_FACTION = {
    svitavy:'crown', kamenice:'guild', brezova:'brotherhood',
    stribrod:'league', hluboka:'guild', kralov:'crown'
  };
  G.REP_TIERS = [
    { min:-100, id:'hostile',  name:'Nepřátelský', color:'#c05a45', buyMult:1.25, sellMult:0.75 },
    { min:-20,  id:'cold',     name:'Chladný',     color:'#cf8f6a', buyMult:1.10, sellMult:0.90 },
    { min:0,    id:'neutral',  name:'Neutrální',   color:'#9c937c', buyMult:1.00, sellMult:1.00 },
    { min:20,   id:'friendly', name:'Přátelský',   color:'#8fbf7a', buyMult:0.94, sellMult:1.06 },
    { min:60,   id:'allied',   name:'Spojenec',    color:'#7aa8e0', buyMult:0.85, sellMult:1.14 },
    { min:120,  id:'exalted',  name:'Oslavený',    color:'#d8b45a', buyMult:0.75, sellMult:1.22 }
  ];
  G.repTier = function (v) { let t = G.REP_TIERS[0]; for (const x of G.REP_TIERS) if (v >= x.min) t = x; return t; };
  G.REP_PER_SALE_UNIT = 0.04;
  G.REP_PER_PURCHASE_UNIT = 0.02;
  G.REP_RIVAL_PENALTY = 0.35;
  G.REP_QUEST_SUCCESS = 8;
  G.REP_QUEST_FAIL = -5;

  const W = 40, H = 30;
  const TERR = ['grass','forest','deep_forest','hills','mountain','water','swamp','snow','road','dirt'];
  const TI = {}; TERR.forEach((t, i) => TI[t] = i);
  function smooth(t) { return t * t * (3 - 2 * t); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function gridNoise(rnd, gw, gh) {
    const g = new Float32Array(gw * gh);
    for (let i = 0; i < g.length; i++) g[i] = rnd();
    return function (x, y) {
      const fx = x * gw, fy = y * gh;
      let x0 = Math.floor(fx), y0 = Math.floor(fy);
      const tx = smooth(fx - x0), ty = smooth(fy - y0);
      x0 = ((x0 % gw) + gw) % gw; y0 = ((y0 % gh) + gh) % gh;
      const x1 = (x0 + 1) % gw, y1 = (y0 + 1) % gh;
      const a = g[y0*gw+x0], b = g[y0*gw+x1];
      const c = g[y1*gw+x0], d = g[y1*gw+x1];
      return lerp(lerp(a, b, tx), lerp(c, d, tx), ty);
    };
  }
  G.generateWorld = function (seed) {
    seed = (seed | 0) || 20260910;
    const rnd = G.rngFrom(seed);
    const e1 = gridNoise(G.rngFrom(seed+101), 5, 4);
    const e2 = gridNoise(G.rngFrom(seed+202), 11, 9);
    const e3 = gridNoise(G.rngFrom(seed+303), 23, 18);
    const m1 = gridNoise(G.rngFrom(seed+404), 7, 6);
    const m2 = gridNoise(G.rngFrom(seed+505), 15, 12);
    const elev  = (x, y) => e1(x,y)*0.55 + e2(x,y)*0.30 + e3(x,y)*0.15;
    const moist = (x, y) => m1(x,y)*0.65 + m2(x,y)*0.35;
    const tiles = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const u = x / (W - 1), v = y / (H - 1);
      const e = elev(u, v), m = moist(u, v);
      let t = 'grass';
      if (e < 0.315) t = 'water';
      else if (e > 0.745) t = 'mountain';
      else if (e > 0.635) t = 'hills';
      else if (m > 0.66 && e < 0.44) t = 'swamp';
      else if (m > 0.585) t = 'deep_forest';
      else if (m > 0.475) t = 'forest';
      if (v < 0.10 && t !== 'water') t = 'snow';
      tiles[y*W+x] = TI[t];
    }
    const settlements = G.SETTLEMENT_DEFS.map(def => {
      const sizeDef = G.SETTLEMENT_SIZE[def.size];
      const r = sizeDef.radius;
      for (let dy = -r-1; dy <= r+1; dy++) for (let dx = -r-1; dx <= r+1; dx++) {
        const x = def.x+dx, y = def.y+dy;
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const d = Math.hypot(dx, dy);
        if (d <= r+1) tiles[y*W+x] = TI.dirt;
        else if (tiles[y*W+x] === TI.water) tiles[y*W+x] = TI.grass;
      }
      return { id:def.id, name:def.name, x:def.x, y:def.y, size:def.size, spec:def.spec };
    });
    const byId = {}; settlements.forEach(s => byId[s.id] = s);
    const roadSet = new Set();
    function carveRoad(a, b) {
      let x0 = a.x, y0 = a.y, x1 = b.x, y1 = b.y;
      const dx = Math.abs(x1-x0), dy = Math.abs(y1-y0);
      const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let err = dx - dy, guard = 0;
      while (guard++ < 500) {
        for (const [ox, oy] of [[0,0],[1,0],[0,1],[-1,0],[0,-1]]) {
          const px = x0+ox, py = y0+oy;
          if (px < 0 || py < 0 || px >= W || py >= H) continue;
          const idx = py*W+px;
          if (tiles[idx] !== TI.water) { tiles[idx] = TI.road; roadSet.add(px+','+py); }
        }
        if (x0 === x1 && y0 === y1) break;
        const e2v = 2*err;
        if (e2v > -dy) { err -= dy; x0 += sx; }
        if (e2v < dx)  { err += dx; y0 += sy; }
      }
    }
    G.ROADS.forEach(([a, b]) => { if (byId[a] && byId[b]) carveRoad(byId[a], byId[b]); });
    const nodes = [];
    let nodeSeq = 1;
    const occ = new Uint8Array(W * H);
    function placeNode(x, y, kindId) {
      const kind = G.NODE_KINDS[kindId]; if (!kind) return null;
      const n = { id:'n'+(nodeSeq++), x, y, kind:kindId, richness: 0.85 + rnd()*0.35, variant: (rnd()*4)|0 };
      nodes.push(n); occ[y*W+x] = 1; return n;
    }
    function tileAt(x, y) { return TERR[tiles[y*W+x]]; }
    /** Má dlaždice vedle sebe suchou zem? (rybaření nesmí být uprostřed vody) */
    function hasLandNeighbor(x, y) {
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        if (TERR[tiles[ny*W+nx]] !== 'water') return true;
      }
      return false;
    }
    function nearSettlement(x, y, d) { return settlements.some(s => Math.hypot(s.x-x, s.y-y) < d); }
    function nearNode(x, y, d) {
      for (let dy = -d; dy <= d; dy++) for (let dx = -d; dx <= d; dx++) {
        const nx = x+dx, ny = y+dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        if (occ[ny*W+nx]) return true;
      }
      return false;
    }
    for (let y = 1; y < H-1; y++) for (let x = 1; x < W-1; x++) {
      if (occ[y*W+x] || nearSettlement(x, y, 4) || nearNode(x, y, 1)) continue;
      const t = tileAt(x, y);
      const candidates = [];
      for (const k in G.NODE_KINDS) {
        if (G.NODE_KINDS[k].terrain.includes(t))
          for (let i = 0; i < G.NODE_KINDS[k].weight; i++) candidates.push(k);
      }
      if (!candidates.length || rnd() > 0.30) continue;
      const kind = candidates[(rnd()*candidates.length)|0];
      // rybářská místa (voda) musejí být u břehu — ne uprostřed jezera
      if (G.NODE_KINDS[kind].terrain.indexOf('water') >= 0 && !hasLandNeighbor(x, y)) continue;
      placeNode(x, y, kind);
    }
    const start = byId.svitavy;
    function ensureNear(kindId, maxDist) {
      if (nodes.some(n => n.kind === kindId && Math.hypot(n.x-start.x, n.y-start.y) < maxDist)) return;
      for (let r = 2; r <= maxDist; r++) for (let a = 0; a < 24; a++) {
        const ang = (a/24)*Math.PI*2;
        const x = Math.round(start.x + Math.cos(ang)*r);
        const y = Math.round(start.y + Math.sin(ang)*r);
        if (x < 1 || y < 1 || x >= W-1 || y >= H-1 || occ[y*W+x]) continue;
        if (!G.NODE_KINDS[kindId].terrain.includes(tileAt(x, y))) continue;
        placeNode(x, y, kindId); return;
      }
    }
    ensureNear('grove', 5); ensureNear('meadow', 5);
    ensureNear('quarry', 8); ensureNear('forest', 6);
    return {
      w:W, h:H, seed, tiles, terrainNames:TERR,
      settlements, settlementById:byId, nodes, roads:roadSet,
      terrainAt(x, y) { if (x<0||y<0||x>=W||y>=H) return 'grass'; return TERR[tiles[y*W+x]]; },
      nodeAt(x, y) { return nodes.find(n => n.x===x && n.y===y) || null; },
      settlementAt(x, y) { return settlements.find(s => s.x===x && s.y===y) || null; },
      nearestNode(kindIds, fromX, fromY) {
        let best = null, bestD = Infinity;
        for (const n of nodes) {
          if (!kindIds.includes(n.kind)) continue;
          const d = Math.hypot(n.x - fromX, n.y - fromY);
          if (d < bestD) { bestD = d; best = n; }
        }
        return best;
      }
    };
  };

  G.CARAVAN_TYPES = {
    trade:  { id:'trade',  name:'Kupecká karavana',  icon:'🐎', speed:0.85, cargoSlots:4, color:'#d8b45a' },
    supply: { id:'supply', name:'Zásobovací vůz',    icon:'🛒', speed:0.65, cargoSlots:2, color:'#7aa8e0' },
    royal:  { id:'royal',  name:'Královská eskorta', icon:'👑', speed:1.05, cargoSlots:3, color:'#e0bb5e' }
  };
  G.CARAVAN_TARGET_COUNT = 5;
  G.CARAVAN_SPAWN_INTERVAL = 45;
  G.CARAVAN_GOODS = ['wood','stone','fiber','herb','coal','iron_ore','hide','plank','cloth','bread','iron_ingot'];

  G.WORLD_EVENTS = {
    war:        { id:'war',        name:'Válka',       icon:'⚔️', color:'#c05a45', duration:1800, weight:4,
                  desc:'Konflikt. Zbraně a ruda dražší.',
                  priceMods:{ iron_ore:{buy:1.40,sell:1.40}, iron_ingot:{buy:1.50,sell:1.50}, coal:{buy:1.20,sell:1.20}, bread:{buy:1.15,sell:1.15} } },
    plague:     { id:'plague',     name:'Mor',         icon:'☠️', color:'#8a4f7a', duration:1200, weight:3,
                  desc:'Nemoc. Léčiva vzácná.',
                  priceMods:{ potion:{buy:1.80,sell:1.80}, herb:{buy:1.50,sell:1.50}, bread:{buy:1.20,sell:1.20} }, staminaMult:1.20 },
    harvest:    { id:'harvest',    name:'Sklizeň',     icon:'🌾', color:'#8fbf7a', duration:1500, weight:5,
                  desc:'Bohatá úroda.', priceMods:{ bread:{buy:0.65,sell:0.65}, herb:{buy:0.75,sell:0.75}, fish:{buy:0.70,sell:0.70} } },
    drought:    { id:'drought',    name:'Sucho',       icon:'🔥', color:'#e0bb5e', duration:1200, weight:3,
                  desc:'Jídlo drahé.', priceMods:{ bread:{buy:1.50,sell:1.50}, herb:{buy:1.30,sell:1.30}, fish:{buy:1.40,sell:1.40} }, staminaMult:1.10 },
    festival:   { id:'festival',   name:'Svátky',      icon:'🎉', color:'#d8b45a', duration:900, weight:4,
                  desc:'Oslavy. Vše dražší, renomé rychleji.',
                  priceMods:{ all:{buy:1.15,sell:1.15} }, renownMult:1.50 },
    golden_age: { id:'golden_age', name:'Zlatý věk',   icon:'✨', color:'#e0bb5e', duration:1500, weight:2,
                  desc:'Obchod vzkvétá.', priceMods:{ all:{buy:1.05,sell:1.25} } },
    calm:       { id:'calm',       name:'Klidné časy', icon:'🕊️', color:'#9c937c', duration:2000, weight:4, desc:'Nic zvláštního.', priceMods:{} }
  };
  G.WORLD_EVENT_INTERVAL = [2400, 4200];
  G.WORLD_EVENT_MAX = 2;
})();
