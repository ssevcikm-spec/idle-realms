(function () {
  const G = window.Game;
  // JEDINÝ ZDROJ BAREV TERÉNŮ. Odsud je bere kresba dlaždic, foundry, a
  // `scripts/tile_palette.py` z toho stejné hodnoty čte pro barevné srovnání
  // malovaných (AI) dlaždic — aby obě cesty hrály stejnou paletou.
  // Rozestupy: nejbližší dvojice (grass vs swamp) je 33,1 (L2 v RGB), dřív
  // bylo 8,3 (hills vs dirt se na 46 px nedaly rozeznat). Při změně barvy
  // spusť `python scripts/check-tiles.py` — hlídá odchylku assetů od palety.
  G.PAL = {
    grass:       { base:'#5e7042', dark:'#47572f', light:'#7a8d55', daubs:['#657847','#546636','#6f824c','#4c5d31','#6a7d4d'] },
    forest:      { base:'#304828', dark:'#1a2f18', light:'#466036', daubs:['#344d26','#273e1f','#3d562f','#203519'] },
    deep_forest: { base:'#1e281a', dark:'#0c130c', light:'#303d25', daubs:['#1a2215','#12190f','#26301f','#0e150d'] },
    hills:       { base:'#86794e', dark:'#6a5f38', light:'#9f9160', daubs:['#827649','#74693f','#908354','#665c35'] },
    mountain:    { base:'#686870', dark:'#484952', light:'#8a878b', daubs:['#64636a','#55555d','#747379','#4c4c55'] },
    water:       { base:'#305474', dark:'#1d3d5a', light:'#4a7396', daubs:['#2e5270','#254764','#3a6085','#20405c'] },
    swamp:       { base:'#4c5834', dark:'#354120', light:'#616f47', daubs:['#495430','#3e4b27','#546239','#303c1b'] },
    snow:        { base:'#ced5dc', dark:'#aab3bd', light:'#eff4f9', daubs:['#cbd2d9','#bec6cf','#dbe1e7','#b5bec8'] },
    road:        { base:'#a69c84', dark:'#88816e', light:'#c2b79a', daubs:['#a09780','#938b76','#afa68c','#827c6f'] },
    dirt:        { base:'#6d523a', dark:'#523927', light:'#896c4e', daubs:['#684d37','#5c422e','#765a41','#4f3627'] }
  };
  G.PAL_BUILDING = {
    village: { wall:'#8a7a5e', wallDark:'#6a5d47', roof:'#7a3f32', roofDark:'#5b2d24' },
    town:    { wall:'#94836a', wallDark:'#6f624f', roof:'#6d4a35', roofDark:'#4f3526' },
    city:    { wall:'#9c8b6f', wallDark:'#776a52', roof:'#5d4636', roofDark:'#413024' }
  };
  G.PAL_WOOD = '#4a3a28';

  // SIZE = logický kreslicí prostor dlaždice (v něm jsou napsané všechny painters),
  // RES = skutečné rozlišení canvasu. Kreslíme 2× jemněji, kompozice zůstává stejná,
  // takže dlaždice je ostrá i ve větším měřítku a na retina displeji.
  const SIZE = 96, RES = 192, VARIANTS = 4, cache = {};
  function rndFrom(seed) {
    let s = (seed | 0) || 1;
    return function () { s ^= s << 13; s |= 0; s ^= s >>> 17; s ^= s << 5; s |= 0; return (s >>> 0) / 4294967296; };
  }
  function daubs(ctx, rnd, colors, count, rMin, rMax, aMin, aMax) {
    for (let i = 0; i < count; i++) {
      const x = rnd()*SIZE, y = rnd()*SIZE;
      const r = rMin + rnd()*(rMax - rMin);
      ctx.globalAlpha = aMin + rnd()*(aMax - aMin);
      ctx.fillStyle = colors[(rnd()*colors.length)|0];
      ctx.beginPath(); ctx.ellipse(x, y, r, r*(0.45+rnd()*0.7), rnd()*Math.PI, 0, Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  // POZOR: dlaždicová "vignette" (diagonální gradient světla přes dlaždici) tu
  // bývala a byla to hlavní příčina viditelných švů: světlo se počítalo
  // v souřadnicích DLAŽDICE, takže na každé hranici skočilo o ~11 úrovní jasu
  // a mapa dostala šachovnici. Světlo musí být funkce SVĚTA, ne dlaždice —
  // proto je pryč a velkoplošné odchylky řeší až světová vrstva (viz
  // docs/STYL_GRAFIKY.md). Naměřený dopad: seam/zrno 1,9 -> 1,4.
  function ground(ctx, rnd, pal) {
    ctx.fillStyle = pal.base; ctx.fillRect(0, 0, SIZE, SIZE);
    daubs(ctx, rnd, pal.daubs, 140, 3, 11, 0.10, 0.30);
    daubs(ctx, rnd, [pal.dark], 26, 4, 13, 0.08, 0.18);
    daubs(ctx, rnd, [pal.light], 20, 2, 8, 0.06, 0.16);
  }
  function tree(ctx, rnd, x, y, s, dark, mid, light) {
    ctx.fillStyle = G.PAL_WOOD;
    ctx.beginPath(); ctx.moveTo(x-1.6*s, y); ctx.lineTo(x-0.9*s, y-9*s); ctx.lineTo(x+0.9*s, y-9*s); ctx.lineTo(x+1.6*s, y); ctx.closePath(); ctx.fill();
    for (let i = 0; i < 6; i++) {
      const a = rnd()*Math.PI*2, d = rnd()*7*s;
      const cx = x + Math.cos(a)*d, cy = y - 13*s + Math.sin(a)*d*0.65;
      const r = (5 + rnd()*5)*s;
      ctx.fillStyle = i < 3 ? dark : mid;
      ctx.beginPath(); ctx.ellipse(cx, cy, r, r*0.85, 0, 0, Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha = 0.32; ctx.fillStyle = light;
    ctx.beginPath(); ctx.ellipse(x - 4*s, y - 18*s, 6*s, 4.5*s, -0.45, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1;
  }
  function pine(ctx, rnd, x, y, s, dark, mid, light) {
    ctx.fillStyle = G.PAL_WOOD;
    ctx.fillRect(x - 1.3*s, y - 6*s, 2.6*s, 7*s);
    for (let i = 0; i < 4; i++) {
      const ty = y - 6*s - i*5.5*s, w = (9 - i*1.6)*s, h = 8*s;
      ctx.fillStyle = i % 2 === 0 ? dark : mid;
      ctx.beginPath(); ctx.moveTo(x, ty - h); ctx.lineTo(x - w, ty); ctx.lineTo(x + w, ty); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 0.22; ctx.fillStyle = light;
      ctx.beginPath(); ctx.moveTo(x, ty - h); ctx.lineTo(x - w, ty); ctx.lineTo(x - w*0.35, ty); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
  function boulder(ctx, rnd, x, y, r, light, mid, dark) {
    ctx.globalAlpha = 0.25; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(x, y + r*0.55, r*1.05, r*0.34, 0, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1;
    const pts = 7, verts = [];
    for (let i = 0; i < pts; i++) {
      const a = (i/pts)*Math.PI*2, rr = r*(0.72 + rnd()*0.4);
      verts.push([x + Math.cos(a)*rr, y + Math.sin(a)*rr*0.72]);
    }
    ctx.fillStyle = mid;
    ctx.beginPath(); ctx.moveTo(verts[0][0], verts[0][1]);
    for (let i = 1; i < verts.length; i++) ctx.lineTo(verts[i][0], verts[i][1]);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = light;
    ctx.beginPath(); ctx.moveTo(verts[0][0], verts[0][1]);
    for (let i = 1; i < verts.length; i++) if (verts[i][1] < y) ctx.lineTo(verts[i][0], verts[i][1]);
    ctx.lineTo(x, y - r*0.25); ctx.closePath();
    ctx.globalAlpha = 0.7; ctx.fill(); ctx.globalAlpha = 1;
    ctx.strokeStyle = dark; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(verts[0][0], verts[0][1]);
    for (let i = 1; i < verts.length; i++) ctx.lineTo(verts[i][0], verts[i][1]);
    ctx.closePath(); ctx.stroke();
  }
  function peak(ctx, x, baseY, w, h, light, mid, dark, snowy) {
    ctx.fillStyle = light;
    ctx.beginPath(); ctx.moveTo(x, baseY - h); ctx.lineTo(x - w, baseY); ctx.lineTo(x, baseY); ctx.closePath(); ctx.fill();
    ctx.fillStyle = dark;
    ctx.beginPath(); ctx.moveTo(x, baseY - h); ctx.lineTo(x + w, baseY); ctx.lineTo(x, baseY); ctx.closePath(); ctx.fill();
    ctx.fillStyle = mid;
    ctx.beginPath(); ctx.moveTo(x, baseY - h); ctx.lineTo(x - w*0.16, baseY); ctx.lineTo(x + w*0.16, baseY); ctx.closePath(); ctx.fill();
    if (snowy) {
      ctx.fillStyle = 'rgba(226,232,238,0.85)';
      ctx.beginPath(); ctx.moveTo(x, baseY - h);
      ctx.lineTo(x - w*0.30, baseY - h*0.62); ctx.lineTo(x - w*0.12, baseY - h*0.68);
      ctx.lineTo(x + w*0.06, baseY - h*0.56); ctx.lineTo(x + w*0.28, baseY - h*0.66);
      ctx.closePath(); ctx.fill();
    }
  }
  function ripple(ctx, rnd, y, light) {
    const x0 = rnd()*SIZE*0.5, len = SIZE*(0.3 + rnd()*0.5);
    ctx.globalAlpha = 0.16 + rnd()*0.16;
    ctx.strokeStyle = light; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.quadraticCurveTo(x0 + len*0.5, y - 2, x0 + len, y); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  const painters = {
    grass(ctx, rnd) { ground(ctx, rnd, G.PAL.grass); daubs(ctx, rnd, ['#7d8a5c'], 18, 2, 6, 0.10, 0.22); },
    forest(ctx, rnd) {
      ground(ctx, rnd, G.PAL.forest);
      const n = 3 + ((rnd()*3)|0), spots = [];
      for (let i = 0; i < n; i++) spots.push([12+rnd()*72, 34+rnd()*52, 0.55+rnd()*0.42]);
      spots.sort((a, b) => a[1] - b[1]);
      for (const [x, y, s] of spots) {
        if (rnd() < 0.45) pine(ctx, rnd, x, y, s, '#243019', '#33421f', '#5c6f42');
        else tree(ctx, rnd, x, y, s, '#26301c', '#39472a', '#6a7a4a');
      }
    },
    deep_forest(ctx, rnd) {
      ground(ctx, rnd, G.PAL.deep_forest);
      const n = 4 + ((rnd()*3)|0), spots = [];
      for (let i = 0; i < n; i++) spots.push([8+rnd()*80, 30+rnd()*56, 0.62+rnd()*0.45]);
      spots.sort((a, b) => a[1] - b[1]);
      for (const [x, y, s] of spots) pine(ctx, rnd, x, y, s, '#161d10', '#212b16', '#3d4c2b');
      ctx.fillStyle = 'rgba(20,28,16,0.22)'; ctx.fillRect(0, 0, SIZE, SIZE);
    },
    hills(ctx, rnd) {
      ground(ctx, rnd, G.PAL.hills);
      for (let i = 0; i < 3; i++) boulder(ctx, rnd, 14+rnd()*68, 34+rnd()*44, 6+rnd()*6, G.PAL.hills.light, G.PAL.hills.base, G.PAL.hills.dark);
    },
    mountain(ctx, rnd) {
      ctx.fillStyle = G.PAL.mountain.base; ctx.fillRect(0, 0, SIZE, SIZE);
      daubs(ctx, rnd, G.PAL.mountain.daubs, 100, 3, 10, 0.10, 0.26);
      peak(ctx, 30, 88, 34, 66, '#7d766c', '#5b5751', '#37342f', false);
      peak(ctx, 66, 92, 38, 78, '#8a8278', '#615d57', '#3b3833', true);
      for (let i = 0; i < 5; i++) boulder(ctx, rnd, 10+rnd()*76, 74+rnd()*18, 3.5+rnd()*4, '#6d675d', '#4e4a44', '#332f2b');
    },
    water(ctx, rnd) {
      ctx.fillStyle = G.PAL.water.base; ctx.fillRect(0, 0, SIZE, SIZE);
      daubs(ctx, rnd, G.PAL.water.daubs, 90, 4, 13, 0.08, 0.22);
      for (let i = 0; i < 7; i++) ripple(ctx, rnd, 12+rnd()*76, G.PAL.water.light);
    },
    swamp(ctx, rnd) {
      ground(ctx, rnd, G.PAL.swamp);
      for (let i = 0; i < 4; i++) {
        ctx.globalAlpha = 0.45; ctx.fillStyle = '#2a3020';
        ctx.beginPath(); ctx.ellipse(rnd()*SIZE, rnd()*SIZE, 8+rnd()*12, 5+rnd()*7, rnd()*3, 0, Math.PI*2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      for (let i = 0; i < 16; i++) {
        const x = rnd()*SIZE, y = 20+rnd()*70;
        ctx.strokeStyle = '#6d7a4e'; ctx.lineWidth = 1.1;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (rnd()-0.5)*4, y - 9 - rnd()*8); ctx.stroke();
      }
    },
    snow(ctx, rnd) {
      ctx.fillStyle = G.PAL.snow.base; ctx.fillRect(0, 0, SIZE, SIZE);
      daubs(ctx, rnd, G.PAL.snow.daubs, 110, 3, 12, 0.10, 0.26);
      daubs(ctx, rnd, ['#ffffff'], 22, 2, 6, 0.10, 0.20);
    },
    road(ctx, rnd) {
      // podklad cesty — vlastní pruh cesty kreslí world.js spojitě podle sousedů
      ground(ctx, rnd, G.PAL.dirt);
      daubs(ctx, rnd, G.PAL.grass.daubs, 34, 3, 9, 0.10, 0.22);
    },
    dirt(ctx, rnd) {
      ctx.fillStyle = G.PAL.dirt.base; ctx.fillRect(0, 0, SIZE, SIZE);
      daubs(ctx, rnd, G.PAL.dirt.daubs, 120, 3, 11, 0.12, 0.28);
      for (let i = 0; i < 14; i++) {
        ctx.globalAlpha = 0.25 + rnd()*0.25; ctx.fillStyle = '#565044';
        ctx.beginPath(); ctx.ellipse(rnd()*SIZE, rnd()*SIZE, 1+rnd()*2, 1+rnd()*1.4, 0, 0, Math.PI*2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  };
  function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h*31 + s.charCodeAt(i)) | 0; return Math.abs(h) || 1; }
  function buildTile(terrain, variant) {
    const c = document.createElement('canvas'); c.width = RES; c.height = RES;
    const ctx = c.getContext('2d');
    ctx.scale(RES / SIZE, RES / SIZE);
    const rnd = rndFrom(hash(terrain) * 7919 + variant * 104729 + 13);
    const fn = painters[terrain] || painters.grass;
    fn(ctx, rnd);
    return c;
  }
  G.getTileArt = function (terrain, variant) {
    const v = ((variant % VARIANTS) + VARIANTS) % VARIANTS;
    const key = terrain + ':' + v;
    if (!cache[key]) cache[key] = buildTile(terrain, v);
    return cache[key];
  };

  /* ================= sjednocený model postavy =================
     Koncept od uživatele: **všichni na jednom základním modelu** (stejná
     silueta, žádná zbraň), roli nese **erb kreslený v kódu** a výbavu jen
     **tón zbroje + odznak**. Důvod je čitelnost: postava je na mapě vysoká
     ~26 px, takže šest různých archetypů se zbraněmi se stejně nerozezná —
     zato barva erbu a materiál zbroje ano. Zároveň tím končí stav, kdy měl
     každý „svůj“ obrázek a styl se rozpadal.

     Plán kresby (`G.figurePlan`) je čistá funkce bez canvasu, takže se dá
     ověřit v Node (`test/figures.js`). */

  /** Vzhled figurek: 'unified' (výchozí, nový koncept) nebo 'classic' (zbraně). */
  G.figureStyle = function () {
    const s = (G.state && G.state.settings) || {};
    return s.figureStyle === 'classic' ? 'classic' : 'unified';
  };
  G.setFigureStyle = function (v) {
    if (!G.state) return 'unified';
    if (!G.state.settings) G.state.settings = {};
    G.state.settings.figureStyle = (v === 'classic') ? 'classic' : 'unified';
    if (G.drawWorldFrame) G.drawWorldFrame();
    return G.state.settings.figureStyle;
  };

  /** Materiál zbroje podle profese (a přilby) — dává tón trupu. */
  const ARMOR_TIER = {
    woodcutter:'leather', miner:'leather', herbalist:'cloth', hunter:'leather',
    smith:'leather', alchemist:'cloth', cook:'cloth', scout:'leather',
    merchant:'cloth', adventurer:'mail'
  };
  const ARMOR_COLOR = { cloth:null, leather:'#6b4a2f', mail:'#7c8288', plate:'#9aa0a6' };
  const ARMOR_ORDER = ['cloth', 'leather', 'mail', 'plate'];

  function armorOf(u) {
    const prof = (G.professionOf && G.professionOf(u)) || null;
    let tier = ARMOR_TIER[(prof && prof.id) || ''] || 'cloth';
    if (u.gear && u.gear.helm) {
      const i = ARMOR_ORDER.indexOf(tier);
      if (i >= 0 && i < ARMOR_ORDER.length - 1) tier = ARMOR_ORDER[i + 1];
    }
    return tier;
  }

  /** Heraldika role: dělení štítu + znamení. Malé číslo drží konzistenci. */
  const ROLE_HERALDRY = {
    leader:  { division:1, charge:2 },   // svisle dělený + břevno
    quarter: { division:2, charge:1 },   // vodorovně + koule
    medic:   { division:0, charge:3 },   // plný + kříž
    scout:   { division:3, charge:1 },   // krokev + koule
    fighter: { division:1, charge:3 },   // svisle + kříž
    trader:  { division:2, charge:2 },   // vodorovně + břevno
    none:    { division:0, charge:0 }    // bez role: prostý štít (nebo žádný)
  };

  /**
   * Čistý plán kresby postavy. Vrací jen data (žádný canvas, žádné řetězce
   * navíc), takže se dá testovat a je vidět, že silueta je pro všechny stejná.
   */
  G.figurePlan = function (u) {
    const role = (u.role && G.ROLES) ? G.ROLES[u.role] : null;
    const prof = (G.professionOf && G.professionOf(u)) || null;
    const armor = armorOf(u);
    const her = ROLE_HERALDRY[(role && role.id) || 'none'] || ROLE_HERALDRY.none;
    const herColor = (role && role.color) || (prof && prof.color) || null;
    return {
      height: 24.5,                       // jeden základní model pro všechny
      cloth: u.color || '#7a5f3a',
      armor: armor,
      armorColor: armor === 'cloth' ? null : ARMOR_COLOR[armor],
      heraldry: {
        show: !!herColor,
        color: herColor || '#cfc3a8',
        division: her.division,
        charge: her.charge
      },
      helm: !!(u.gear && u.gear.helm),
      // zbraně jen v klasickém vzhledu — nový koncept je „na modelu jen zbroj"
      weapon: G.figureStyle() === 'classic' ? ((u.gear && u.gear.weapon) || 'axe') : null
    };
  };

  /** Erb: štítek s dělením a znamením, kreslený vektorově (žádný obrázek). */
  function drawHeraldry(ctx, cx, cy, r, her) {
    if (!her.show) return;
    ctx.beginPath();
    ctx.moveTo(cx - r, cy - r);
    ctx.lineTo(cx + r, cy - r);
    ctx.lineTo(cx + r, cy + r*0.25);
    ctx.quadraticCurveTo(cx, cy + r*1.35, cx - r, cy + r*0.25);
    ctx.closePath();
    ctx.fillStyle = her.color;
    ctx.fill();
    ctx.save();
    ctx.clip();
    const light = shade(her.color, 0.35);
    const dark = '#241f18';
    if (her.division === 1) { ctx.fillStyle = light; ctx.fillRect(cx, cy - r, r*1.2, r*2.6); }
    else if (her.division === 2) { ctx.fillStyle = light; ctx.fillRect(cx - r, cy - r, r*2.4, r*0.9); }
    else if (her.division === 3) {
      ctx.fillStyle = light;
      ctx.beginPath();
      ctx.moveTo(cx - r, cy + r*0.1); ctx.lineTo(cx, cy - r*0.55);
      ctx.lineTo(cx + r, cy + r*0.1); ctx.lineTo(cx + r, cy + r*0.6);
      ctx.lineTo(cx, cy - r*0.05); ctx.lineTo(cx - r, cy + r*0.6);
      ctx.closePath(); ctx.fill();
    }
    if (her.charge === 1) {
      ctx.fillStyle = dark;
      ctx.beginPath(); ctx.arc(cx, cy - r*0.05, r*0.30, 0, Math.PI*2); ctx.fill();
    } else if (her.charge === 2) {
      ctx.fillStyle = dark;
      ctx.fillRect(cx - r*0.8, cy - r*0.15, r*1.6, r*0.32);
    } else if (her.charge === 3) {
      ctx.fillStyle = dark;
      ctx.fillRect(cx - r*0.14, cy - r*0.72, r*0.28, r*1.5);
      ctx.fillRect(cx - r*0.62, cy - r*0.24, r*1.24, r*0.28);
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(18,15,11,0.85)';
    ctx.lineWidth = Math.max(0.7, r*0.26);
    ctx.stroke();
  }

  /**
   * Erb role pro postavu na dané místo. Kreslí se i **přes malované (AI)
   * sprity** — role tak zůstává čitelná v obou vzhledech, protože sprite sám
   * o sobě roli neříká. `scale` je stejné měřítko jako u `G.drawFigure`.
   */
  G.drawFigureHeraldry = function (ctx, u, x, y, scale, face) {
    const plan = G.figurePlan(u);
    const s = scale, f = face || u.facing || 1;
    const bob = u._bob || 0;
    drawHeraldry(ctx, x - f*5.4*s, y - 15*s + bob, 4.1*s, plan.heraldry);
    return plan;
  };

  G.drawFigure = function (ctx, u, x, y, scale) {
    const s = scale;
    const bob = u._bob || 0, walk = u._walk || 0, face = u.facing || 1;
    const plan = G.figurePlan(u);
    ctx.globalAlpha = 0.32; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(x, y + 1.5*s, 6.5*s, 2.4*s, 0, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1;
    const legSwing = Math.sin(walk) * 2.2 * s;
    ctx.strokeStyle = '#2a2318'; ctx.lineWidth = 2.4*s; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - 1.6*s, y - 6*s); ctx.lineTo(x - 1.6*s + legSwing, y);
    ctx.moveTo(x + 1.6*s, y - 6*s); ctx.lineTo(x + 1.6*s - legSwing, y);
    ctx.stroke();
    // trup: oblečení + tón materiálu zbroje (kůže/kroužky/plát)
    const cloth = plan.cloth;
    ctx.fillStyle = shade(cloth, -0.35);
    ctx.beginPath();
    ctx.moveTo(x - 4.4*s, y - 6*s + bob); ctx.lineTo(x + 4.4*s, y - 6*s + bob);
    ctx.lineTo(x + 3.4*s, y - 13*s + bob); ctx.lineTo(x - 3.4*s, y - 13*s + bob);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = plan.armorColor ? mixHex(cloth, plan.armorColor, 0.45) : cloth;
    ctx.beginPath();
    ctx.moveTo(x - 4.2*s, y - 12*s + bob); ctx.lineTo(x + 4.2*s, y - 12*s + bob);
    ctx.lineTo(x + 3.6*s, y - 20*s + bob); ctx.lineTo(x - 3.6*s, y - 20*s + bob);
    ctx.closePath(); ctx.fill();
    // odznak zbroje: kovový pás přes hruď (jen když není jen látka)
    if (plan.armorColor) {
      ctx.fillStyle = plan.armorColor;
      ctx.globalAlpha = 0.75;
      ctx.fillRect(x - 3.6*s, y - 17.4*s + bob, 7.2*s, 1.5*s);
      ctx.globalAlpha = 1;
    }
    // jemný obrys — figura se tím oddělí od terénu i ve větším měřítku
    ctx.strokeStyle = 'rgba(18,15,11,0.85)';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 1.1*s;
    ctx.beginPath();
    ctx.moveTo(x - 4.2*s, y - 12*s + bob); ctx.lineTo(x + 4.2*s, y - 12*s + bob);
    ctx.lineTo(x + 3.6*s, y - 20*s + bob); ctx.lineTo(x - 3.6*s, y - 20*s + bob);
    ctx.closePath(); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y - 23.5*s + bob, 3.5*s, 0, Math.PI*2); ctx.stroke();
    ctx.fillStyle = '#3a2c1c';
    ctx.fillRect(x - 4.2*s, y - 13.2*s + bob, 8.4*s, 1.8*s);
    // ERB role (vždy na levé paži) — nese roli místo zbraně. Jen ve
    // sjednoceném vzhledu; klasický je původní figura se zbraní.
    if (plan.weapon === null) G.drawFigureHeraldry(ctx, u, x, y, s, face);
    if (plan.weapon) drawWeapon(ctx, u, x, y, s, face, bob, plan.weapon);
    ctx.fillStyle = '#c9a077';
    ctx.beginPath(); ctx.arc(x, y - 23.5*s + bob, 3.5*s, 0, Math.PI*2); ctx.fill();
    if (plan.helm) {
      ctx.fillStyle = '#6e6a62';
      ctx.beginPath(); ctx.arc(x, y - 24*s + bob, 3.8*s, Math.PI, Math.PI*2); ctx.fill();
      ctx.fillRect(x - 3.8*s, y - 24.3*s + bob, 7.6*s, 1.6*s);
    } else {
      ctx.fillStyle = '#3b2a1b';
      ctx.beginPath(); ctx.arc(x, y - 24.5*s + bob, 3.5*s, Math.PI, Math.PI*2); ctx.fill();
    }
  };
  function drawWeapon(ctx, u, x, y, s, face, bob, weapon) {
    const w = weapon || (u.gear && u.gear.weapon) || 'axe';
    const hx = x + face*4.6*s, hy = y - 15*s + bob;
    ctx.strokeStyle = '#8a7550'; ctx.lineWidth = 1.4*s; ctx.lineCap = 'round';
    if (w === 'axe') {
      ctx.beginPath(); ctx.moveTo(hx, hy + 4*s); ctx.lineTo(hx + face*1*s, hy - 8*s); ctx.stroke();
      ctx.fillStyle = '#9a958c';
      ctx.beginPath();
      ctx.moveTo(hx + face*0.5*s, hy - 9*s); ctx.lineTo(hx + face*5*s, hy - 11*s);
      ctx.lineTo(hx + face*5*s, hy - 5*s); ctx.lineTo(hx + face*0.5*s, hy - 6*s);
      ctx.closePath(); ctx.fill();
    } else if (w === 'pick') {
      ctx.beginPath(); ctx.moveTo(hx, hy + 4*s); ctx.lineTo(hx + face*1*s, hy - 9*s); ctx.stroke();
      ctx.strokeStyle = '#9a958c'; ctx.lineWidth = 2*s;
      ctx.beginPath(); ctx.moveTo(hx - face*1*s, hy - 10*s);
      ctx.quadraticCurveTo(hx + face*3*s, hy - 13*s, hx + face*6*s, hy - 7*s); ctx.stroke();
    } else if (w === 'sword') {
      ctx.beginPath(); ctx.moveTo(hx, hy + 3*s); ctx.lineTo(hx + face*1*s, hy - 5*s); ctx.stroke();
      ctx.strokeStyle = '#a8a49b'; ctx.lineWidth = 2*s;
      ctx.beginPath(); ctx.moveTo(hx + face*1*s, hy - 5*s); ctx.lineTo(hx + face*3*s, hy - 18*s); ctx.stroke();
    } else if (w === 'bow') {
      ctx.strokeStyle = '#7a5c38'; ctx.lineWidth = 1.6*s;
      ctx.beginPath(); ctx.arc(hx + face*2*s, hy - 4*s, 6.5*s, -1.2, 1.2); ctx.stroke();
    } else if (w === 'staff') {
      ctx.beginPath(); ctx.moveTo(hx, hy + 6*s); ctx.lineTo(hx + face*0.6*s, hy - 16*s); ctx.stroke();
      ctx.fillStyle = '#7ac6d8';
      ctx.beginPath(); ctx.arc(hx + face*0.6*s, hy - 18*s, 2.4*s, 0, Math.PI*2); ctx.fill();
    }
  }
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n>>16)&255, g = (n>>8)&255, b = n&255;
    if (amt < 0) { r *= (1+amt); g *= (1+amt); b *= (1+amt); }
    else { r += (255-r)*amt; g += (255-g)*amt; b += (255-b)*amt; }
    return 'rgb(' + (r|0) + ',' + (g|0) + ',' + (b|0) + ')';
  }
  G.shade = shade;
  G.drawBadge = function (ctx, x, y, r, tint, icon, size) {
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = 'rgba(16,15,12,0.72)';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = tint; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.font = (size || r*1.25) + 'px serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(icon, x, y + 1);
  };

  /* ================= krajinné prvky uzlů =================
     Uzel (les, jezero, pole…) se nekreslí jako ikona, ale jako skutečný kus
     krajiny. Kreslí se v jednotkách staré dlaždice (46), takže se dá použít
     stávající tree/pine/boulder/ripple a výsledek se jen přeškáluje. */

  const FEATURE_PROP_COUNT = {
    forest: 6, deep_forest: 8, grove: 4, meadow: 7, marsh: 5,
    quarry: 5, mine: 4, cave: 4, lake: 5
  };
  /** Deterministické rozvržení prvku — počítá se jednou na uzel a drží se. */
  function nodeProps(node) {
    if (node._feat) return node._feat;
    const rnd = rndFrom(hash(node.id) * 7717 + 31);
    const n = FEATURE_PROP_COUNT[node.kind] || 4;
    const list = [];
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2;
      const r = 6 + rnd() * 17;                 // vzdálenost od středu (v jednotkách 46)
      list.push({
        x: Math.cos(a) * r,
        y: Math.sin(a) * r * 0.62,
        s: 0.68 + rnd() * 0.55,
        v: (rnd() * 3) | 0
      });
    }
    list.sort((p, q) => p.y - q.y);
    node._feat = { list, seed: (rnd() * 1000) | 0 };
    return node._feat;
  }
  G.nodeFeatureProps = nodeProps;

  /* Bodové prvky (kamenolom, důl, jeskyně) — kreslí se na střed. */
  const POINT_FEATURES = {
    quarry(ctx, rnd, props) {
      shadow(ctx, 0, 6, 19, 7);
      ctx.fillStyle = '#6b6350';
      ctx.beginPath();
      ctx.moveTo(-20, 8); ctx.lineTo(-13, -6); ctx.lineTo(-4, -9);
      ctx.lineTo(6, -4); ctx.lineTo(17, 7); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#7d7663';
      ctx.beginPath();
      ctx.moveTo(-16, 6); ctx.lineTo(-10, -3); ctx.lineTo(-2, -5);
      ctx.lineTo(4, -1); ctx.lineTo(12, 6); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#4e4838'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-13, -1); ctx.lineTo(9, 1); ctx.moveTo(-9, 4); ctx.lineTo(4, 5); ctx.stroke();
      for (const p of props.list) boulder(ctx, rnd, p.x, p.y + 7, 3.2 + p.s * 2.4, '#8a8272', '#665f4e', '#413c31');
    },
    mine(ctx, rnd, props) {
      shadow(ctx, 0, 7, 20, 7);
      ctx.fillStyle = '#544e44';
      ctx.beginPath();
      ctx.moveTo(-21, 8); ctx.lineTo(-6, -13); ctx.lineTo(9, -9); ctx.lineTo(21, 8); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#6b6353';
      ctx.beginPath(); ctx.moveTo(-21, 8); ctx.lineTo(-8, -9); ctx.lineTo(-1, 8); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#15130f';
      ctx.beginPath();
      ctx.moveTo(-6, 8); ctx.lineTo(-6, -1); ctx.quadraticCurveTo(0, -7, 6, -1); ctx.lineTo(6, 8);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = G.PAL_WOOD; ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(-6.5, 8); ctx.lineTo(-6.5, -2); ctx.moveTo(6.5, 8); ctx.lineTo(6.5, -2);
      ctx.moveTo(-8, -2); ctx.lineTo(8, -2); ctx.stroke();
      for (const p of props.list.slice(0, 2)) {
        ctx.fillStyle = '#6f6a60';
        ctx.beginPath(); ctx.ellipse(p.x + 10, p.y + 9, 4.2, 2.4, 0, 0, Math.PI * 2); ctx.fill();
      }
    },
    cave(ctx, rnd, props) {
      shadow(ctx, 0, 7, 18, 6);
      for (const p of props.list) boulder(ctx, rnd, p.x, p.y + 7, 4.2 + p.s * 3, '#6d675d', '#4e4a44', '#332f2b');
      ctx.fillStyle = '#3a3730';
      ctx.beginPath();
      ctx.moveTo(-14, 8); ctx.lineTo(-10, -9); ctx.lineTo(3, -12); ctx.lineTo(14, 8);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#0f0e0c';
      ctx.beginPath();
      ctx.moveTo(-5, 8); ctx.lineTo(-5, -1); ctx.quadraticCurveTo(0, -8, 5, -1); ctx.lineTo(5, 8);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(122,198,216,.5)';
      ctx.beginPath(); ctx.moveTo(-9, -2); ctx.lineTo(-7, -7); ctx.lineTo(-5.5, -2); ctx.closePath(); ctx.fill();
    }
  };

  function shadow(ctx, x, y, rx, ry) {
    ctx.globalAlpha = 0.20; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
  function tileSeed(node, tile) {
    return hash(node.id + ':' + tile[0] + ':' + tile[1]) * 7919 + 13;
  }
  function atTile(ctx, tile, ox, oy, tilePx, fn) {
    ctx.save();
    ctx.translate(ox + (tile[0] + 0.5) * tilePx, oy + (tile[1] + 0.5) * tilePx);
    ctx.scale(tilePx / 46, tilePx / 46);
    try { fn(); } finally { ctx.restore(); }
  }

  /** Plošné prvky: les, hluboký les, háj a močál se kreslí na každou dlaždici. */
  function areaScatter(ctx, node, tiles, ox, oy, tilePx) {
    const kind = node.kind;
    for (const t of tiles) {
      atTile(ctx, t, ox, oy, tilePx, () => {
        const rnd = rndFrom(tileSeed(node, t));
        shadow(ctx, 0, 6, 17, 5);
        const n = kind === 'deep_forest' ? 3 + ((rnd() * 2) | 0) : 2 + ((rnd() * 2) | 0);
        for (let i = 0; i < n; i++) {
          const x = (rnd() - 0.5) * 30, y = (rnd() - 0.5) * 16, s = 0.7 + rnd() * 0.5;
          if (kind === 'forest') {
            if (i % 2) pine(ctx, rnd, x, y + 8, s, '#243019', '#33421f', '#5c6f42');
            else tree(ctx, rnd, x, y + 8, s, '#26301c', '#39472a', '#6a7a4a');
          } else if (kind === 'deep_forest') {
            pine(ctx, rnd, x, y + 8, s, '#161d10', '#212b16', '#3d4c2b');
          } else if (kind === 'grove') {
            tree(ctx, rnd, x, y + 8, s * 0.9, '#2f3d22', '#48592f', '#7d8f57');
            for (let b = 0; b < 4; b++) {
              ctx.fillStyle = b % 2 ? 'rgba(240,225,235,.5)' : 'rgba(245,215,225,.4)';
              ctx.beginPath();
              ctx.arc(x + (rnd() - 0.5) * 12 * s, y - 2 + (rnd() - 0.5) * 10 * s, 1.0, 0, Math.PI * 2);
              ctx.fill();
            }
          } else if (kind === 'marsh') {
            ctx.globalAlpha = 0.5; ctx.fillStyle = '#2f3f3a';
            ctx.beginPath(); ctx.ellipse(x, y, 6 * s, 3 * s, 0, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1;
            ctx.strokeStyle = '#6d7a4e'; ctx.lineWidth = 1.1;
            for (let r = 0; r < 4; r++) {
              const rx = x + (rnd() - 0.5) * 16;
              ctx.beginPath(); ctx.moveTo(rx, y + 4); ctx.lineTo(rx + (rnd() - 0.5) * 3, y - 2 - rnd() * 6); ctx.stroke();
            }
          }
        }
      });
    }
  }

  /** Louka = jedno souvislé pole přes celý shluk. */
  function areaField(ctx, node, tiles, ox, oy, tilePx) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const t of tiles) { minX = Math.min(minX, t[0]); maxX = Math.max(maxX, t[0]); minY = Math.min(minY, t[1]); maxY = Math.max(maxY, t[1]); }
    const cx = ox + (minX + maxX + 1) * 0.5 * tilePx;
    const cy = oy + (minY + maxY + 1) * 0.5 * tilePx;
    const w = (maxX - minX + 1) * tilePx, h = (maxY - minY + 1) * tilePx;
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#6d6a3c';
    ctx.beginPath(); ctx.ellipse(cx, cy, w * 0.48, h * 0.42, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#8f8a4a'; ctx.lineWidth = Math.max(1, tilePx * 0.03);
    const rows = Math.max(3, Math.floor(h / (tilePx * 0.5)));
    for (let i = 0; i < rows; i++) {
      const ry = cy - h * 0.30 + (i / Math.max(1, rows - 1)) * h * 0.60;
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.40, ry);
      ctx.quadraticCurveTo(cx, ry + tilePx * 0.06, cx + w * 0.40, ry);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    const rnd = rndFrom(tileSeed(node, tiles[0]));
    for (let i = 0; i < 3; i++) {                       // snopy
      const x = cx + (rnd() - 0.5) * w * 0.6, y = cy + (rnd() - 0.5) * h * 0.5;
      ctx.fillStyle = '#c9a94e';
      ctx.beginPath(); ctx.ellipse(x, y, tilePx * 0.07, tilePx * 0.10, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#8a7332'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, y + tilePx * 0.10); ctx.lineTo(x, y + tilePx * 0.16); ctx.stroke();
    }
    ctx.restore();
  }

  /** Jezero je vodní plocha — kreslí se jen rákosí u břehu a molo. */
  function drawLake(ctx, node, tiles, ox, oy, tilePx) {
    const shore = [];
    for (const t of tiles) {
      let land = false;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (G.WORLD.terrainAt(t[0] + dx, t[1] + dy) !== 'water') { land = true; break; }
      }
      if (land) shore.push(t);
    }
    let i = 0;
    for (const t of shore) {
      if (i++ > 8) break;
      atTile(ctx, t, ox, oy, tilePx, () => {
        const rnd = rndFrom(tileSeed(node, t));
        ctx.strokeStyle = '#5d6b3e'; ctx.lineWidth = 1.1;
        for (let r = 0; r < 3; r++) {
          const x = (rnd() - 0.5) * 20, y = 4 + rnd() * 6;
          ctx.beginPath(); ctx.moveTo(x, y + 4); ctx.lineTo(x + (rnd() - 0.5) * 3, y - 3 - rnd() * 5); ctx.stroke();
        }
      });
    }
    if (shore.length) {
      const t = shore[0];
      atTile(ctx, t, ox, oy, tilePx, () => {
        ctx.strokeStyle = '#6a523a'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-8, 4); ctx.lineTo(8, -2); ctx.stroke();
        ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(-6, 7); ctx.lineTo(10, 1); ctx.stroke();
      });
    }
  }

  /**
   * Vykreslí uzel jako krajinný prvek přes všechny jeho dlaždice.
   * Vrací true, když se prvek nakreslil (jinak se použije symbol).
   */
  G.drawNodeFeature = function (ctx, node, ox, oy, tilePx) {
    const tiles = G.nodeTiles(node);
    if (!tiles.length) return false;
    const kind = node.kind;
    if (kind === 'lake') { drawLake(ctx, node, tiles, ox, oy, tilePx); return true; }
    if (kind === 'meadow') { areaField(ctx, node, tiles, ox, oy, tilePx); return true; }
    if (POINT_FEATURES[kind]) {
      const props = nodeProps(node);
      const rnd = rndFrom(props.seed + 13);
      atTile(ctx, tiles[0], ox, oy, tilePx, () => POINT_FEATURES[kind](ctx, rnd, props));
      return true;
    }
    areaScatter(ctx, node, tiles, ox, oy, tilePx);
    return true;
  };

  // ==========================================================================
  // FOUNDRY — světová vrstva mapy (podklad, přechody terénů, dekorace)
  //
  // Proč takhle: dlaždice jako obrázek má dvě nemoci — šev na hranici a
  // opakování po několika dlaždicích. Obě zmizí, když se krajina kreslí jako
  // FUNKCE SVĚTA místo dlaždice:
  //   - podklad  = štětce na světové mřížce (hash ze světových souřadnic),
  //   - přechody = pásy na hranicích, kde se mění terén (každá hrana jednou),
  //   - dekorace = trsy, kameny, rákosí na hrubší světové mřížce.
  // Nic z toho se neopakuje (hash nemá periodu) a nic se neřeže na hranici
  // dlaždice — kreslí se přes celou viditelnou oblast naráz, takže prvek přes
  // hranici je prostě prvek na svém světovém místě.
  //
  // Plánování je oddělené od kreslení: `G.foundryOps` je ČISTÁ funkce (žádný
  // canvas, žádné řetězce), takže se dá ověřit v Node — viz `test/foundry.js`.
  // ==========================================================================

  /** Terény v pevném pořadí (index se používá v plánu místo jména). */
  const TER = ['grass','forest','deep_forest','hills','mountain','water','swamp','snow','road','dirt'];
  const TER_IDX = {};
  for (let i = 0; i < TER.length; i++) TER_IDX[TER[i]] = i;

  /** Laditelné hodnoty foundry (debug panel je umí měnit, ukládají se). */
  G.FOUNDRY = {
    daub: 1.0,      // dlaždic na jeden štětec podkladu
    deco: 2.2,      // dlaždic na jednu dekoraci
    edge: 1,        // 1 = kreslit přechody terénů
    quality: 1      // <1 = řidší štětce (přehledový LOD)
  };
  /** Meze pro ladění — z panelu se nedá dostat mimo rozumný rozsah. */
  const FOUNDRY_LIMITS = { daub:[0.6, 2.6], deco:[1.2, 6.0], quality:[0.25, 1] };

  /**
   * Nastaví jednu hodnotu foundry a **uloží ji do `settings.foundry`**, takže
   * vyladěný vzhled přežije reload. Vrací true, když se něco změnilo.
   */
  G.setFoundry = function (key, value) {
    if (G.FOUNDRY[key] === undefined) return false;
    if (key === 'edge') G.FOUNDRY.edge = value ? 1 : 0;
    else {
      const lim = FOUNDRY_LIMITS[key];
      let v = parseFloat(value);
      if (isNaN(v)) return false;
      if (lim) v = Math.max(lim[0], Math.min(lim[1], v));
      G.FOUNDRY[key] = v;
    }
    if (G.state && G.state.settings) {
      const f = G.state.settings.foundry || (G.state.settings.foundry = {});
      f[key] = G.FOUNDRY[key];
    }
    if (G.drawWorldFrame) G.drawWorldFrame();
    return true;
  };

  /** Promítne uložené `settings.foundry` do G.FOUNDRY (volá se při kreslení). */
  G.applyFoundrySettings = function () {
    const s = (G.state && G.state.settings && G.state.settings.foundry) || null;
    if (s) {
      for (const k of ['daub', 'deco', 'edge', 'quality']) {
        if (s[k] !== undefined) G.FOUNDRY[k] = s[k];
      }
    }
    return G.FOUNDRY;
  };

  /** 32bitový hash dvou celých souřadnic -> [0,1). Bez periody. */
  function fhash(x, y, s) {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 2246822519);
    h = Math.imul(h ^ (h >>> 15), 1274126177);
    h ^= h >>> 13;
    h = Math.imul(h, 2654435761);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function smoothstep(t) { return t * t * (3 - 2 * t); }

  /**
   * Hladké hodnotové pole ve světových dlaždicových souřadnicích.
   * `cell` = velikost oktávy v dlaždicích. Vrací 0..1.
   */
  G.foundryField = function (x, y, cell, salt) {
    const gx = x / cell, gy = y / cell;
    const ix = Math.floor(gx), iy = Math.floor(gy);
    const fx = smoothstep(gx - ix), fy = smoothstep(gy - iy);
    const s = salt | 0;
    const a = fhash(ix, iy, s), b = fhash(ix + 1, iy, s);
    const c = fhash(ix, iy + 1, s), d = fhash(ix + 1, iy + 1, s);
    return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
  };

  /** Základní barva terénu pro plošný podklad. */
  G.foundryBase = function (terrain) {
    const pal = G.PAL[terrain] || G.PAL.grass;
    return pal.base;
  };

  const RGB_CACHE = {};
  function rgbOf(hex) {
    let v = RGB_CACHE[hex];
    if (!v) {
      const n = parseInt(hex.slice(1), 16);
      v = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      RGB_CACHE[hex] = v;
    }
    return v;
  }
  /** Smíchá dvě barvy `#rrggbb` (t = 0 → a, 1 → b). */
  function mixHex(a, b, t) {
    const A = rgbOf(a), B = rgbOf(b);
    return 'rgb(' + Math.round(A[0] + (B[0] - A[0]) * t) + ',' +
                    Math.round(A[1] + (B[1] - A[1]) * t) + ',' +
                    Math.round(A[2] + (B[2] - A[2]) * t) + ')';
  }

  // Předpočítané barvy přechodů (10×10 dvojic) — ať se ve smyčce nealokuje.
  const EDGE_COLOR = [], EDGE_LIGHT = [];
  for (let a = 0; a < TER.length; a++) {
    EDGE_COLOR[a] = []; EDGE_LIGHT[a] = [];
    for (let b = 0; b < TER.length; b++) {
      const pa = G.PAL[TER[a]] || G.PAL.grass, pb = G.PAL[TER[b]] || G.PAL.grass;
      EDGE_COLOR[a][b] = mixHex(pa.base, pb.base, 0.5);
      EDGE_LIGHT[a][b] = mixHex(pa.light || pa.base, pb.light || pb.base, 0.5);
    }
  }

  /** Hustota dekorace podle terénu (pravděpodobnost na buňku mřížky). */
  const DECO_DENSITY = {
    grass: 0.55, forest: 0.60, deep_forest: 0.55, hills: 0.40, mountain: 0.30,
    water: 0.30, swamp: 0.60, snow: 0.35, road: 0.18, dirt: 0.22
  };

  /**
   * Naplánuje světové prvky mapy. Nic nekreslí, jen volá `emit`:
   *   emit(kind, sx, sy, size, p1, p2, p3, p4)
   *   kind 0 = štětec podkladu: p1 terén, p2 varianta barvy, p3 světlo (-0.5..0.5)
   *   kind 1 = přechod terénů:  p1 terén A, p2 terén B, p3 jitter, p4 0=svislá/1=vodorovná
   *   kind 2 = dekorace:        p1 terén, p2 varianta, p3 tvar, p4 jitter
   *
   * `view` = { x0, x1, y0, y1 (dlaždice), ox, oy, tilePx (px), mode, terrainAt }
   */
  G.foundryOps = function (view, emit) { foundryPlan(view, emit, 2); };

  /**
   * Vykreslí podklad a přechody terénů. `what`: 0 = jen podklad, 1 = jen
   * dekorace, 2 = obojí (používá se i pro test plánu).
   */
  function foundryPlan(view, emit, what) {
    // Uložené ladění (debug panel) se promítne před každým plánem — je to pár
    // čtení vlastností, tedy zdarma, a vyladěný vzhled tak přežije reload.
    G.applyFoundrySettings();
    const px = view.tilePx, ox = view.ox, oy = view.oy;
    const tAt = view.terrainAt;
    const detail = view.mode === 'detail';
    // `view.quality` = jak ředit v tomhle LOD; G.FOUNDRY.quality je globální
    // hustota z ladění (násobí se, takže se obojí respektuje).
    const q = (view.quality === undefined ? 1 : view.quality) * G.FOUNDRY.quality;

    // --- štětce podkladu -------------------------------------------------
    if (what !== 1) {
      const cell = detail ? G.FOUNDRY.daub : G.FOUNDRY.daub * 1.8;
      const gx0 = Math.floor(view.x0 / cell) - 1, gx1 = Math.ceil(view.x1 / cell) + 1;
      const gy0 = Math.floor(view.y0 / cell) - 1, gy1 = Math.ceil(view.y1 / cell) + 1;
      for (let gy = gy0; gy <= gy1; gy++) {
        for (let gx = gx0; gx <= gx1; gx++) {
          const r1 = fhash(gx, gy, 11);
          if (!detail && r1 > q) continue;      // v přehledu kreslit řidčeji
          const r2 = fhash(gx, gy, 23), r3 = fhash(gx, gy, 37), r4 = fhash(gx, gy, 53);
          const wx = (gx + 0.12 + r1 * 0.76) * cell;
          const wy = (gy + 0.12 + r2 * 0.76) * cell;
          const ti = TER_IDX[tAt(Math.floor(wx), Math.floor(wy))];
          if (ti === undefined) continue;
          const light = G.foundryField(wx, wy, 7, 5) - 0.5;
          emit(0, ox + wx * px, oy + wy * px, (0.30 + r3 * 0.55) * cell * px, ti, r4, light, 0);
        }
      }

      // --- přechody terénů (každá hrana jednou: pravý a spodní soused) ----
      if (G.FOUNDRY.edge) {
        const m = 1;
        for (let y = view.y0 - m; y <= view.y1 + m; y++) {
          for (let x = view.x0 - m; x <= view.x1 + m; x++) {
            const a = TER_IDX[tAt(x, y)];
            if (a === undefined) continue;
            if (!detail && fhash(x, y, 97) > q) continue;   // v přehledu řidší přechody
            const bR = TER_IDX[tAt(x + 1, y)];
            if (bR !== undefined && bR !== a) {
              emit(1, ox + (x + 1) * px, oy + (y + 0.5) * px, px, a, bR, fhash(x, y, 71), 0);
            }
            const bD = TER_IDX[tAt(x, y + 1)];
            if (bD !== undefined && bD !== a) {
              emit(1, ox + (x + 0.5) * px, oy + (y + 1) * px, px, a, bD, fhash(x, y, 89), 1);
            }
          }
        }
      }
    }

    // --- dekorace (jen v detailu) ---------------------------------------
    if (what !== 0 && detail) {
      const cell = G.FOUNDRY.deco;
      const gx0 = Math.floor(view.x0 / cell) - 1, gx1 = Math.ceil(view.x1 / cell) + 1;
      const gy0 = Math.floor(view.y0 / cell) - 1, gy1 = Math.ceil(view.y1 / cell) + 1;
      for (let gy = gy0; gy <= gy1; gy++) {
        for (let gx = gx0; gx <= gx1; gx++) {
          const r1 = fhash(gx, gy, 101);
          const wx = (gx + 0.15 + r1 * 0.7) * cell;
          const wy = (gy + 0.15 + fhash(gx, gy, 103) * 0.7) * cell;
          const terr = tAt(Math.floor(wx), Math.floor(wy));
          const ti = TER_IDX[terr];
          if (ti === undefined) continue;
          if (r1 > (DECO_DENSITY[terr] === undefined ? 0.3 : DECO_DENSITY[terr])) continue;
          const r2 = fhash(gx, gy, 113), r3 = fhash(gx, gy, 127), r4 = fhash(gx, gy, 139);
          emit(2, ox + wx * px, oy + wy * px, (0.09 + r2 * 0.15) * px, ti, r3, r4, r2);
        }
      }
    }
  }

  /** Vykreslí dlaždici terénu jako plochu podkladu (foundry). */
  G.foundryGround = function (ctx, view) {
    foundryPlan(view, function (kind, sx, sy, size, p1, p2, p3, p4) {
      if (kind === 0) paintDaub(ctx, sx, sy, size, p1, p2, p3);
      else paintEdge(ctx, sx, sy, size, p1, p2, p3, p4);
    }, 0);
  };

  /** Vykreslí dekoraci krajiny (foundry). */
  G.foundryDeco = function (ctx, view) {
    foundryPlan(view, function (kind, sx, sy, size, p1, p2, p3) {
      if (kind === 2) paintDeco(ctx, sx, sy, size, p1, p2, p3);
    }, 1);
  };

  function paintDaub(ctx, sx, sy, size, ti, variant, light) {
    const t = TER[ti], pal = G.PAL[t] || G.PAL.grass;
    const daubs = pal.daubs || [pal.base];
    ctx.globalAlpha = 0.10 + variant * 0.13;
    ctx.fillStyle = daubs[(variant * daubs.length) | 0] || pal.base;
    const flat = (t === 'water') ? 0.42 : 0.60 + variant * 0.20;
    ctx.beginPath();
    ctx.ellipse(sx, sy, size, size * flat, variant * 3.1, 0, Math.PI * 2);
    ctx.fill();
    // velkoplošné světlo: prosvětlení/ztmavení podle světového pole
    if (light > 0.10 || light < -0.10) {
      ctx.globalAlpha = Math.min(0.13, Math.abs(light) * 0.26);
      ctx.fillStyle = light > 0 ? '#ffffff' : '#000000';
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /** Pás na hranici dvou terénů — pěna, obrubník lesa, závěj. */
  function paintEdge(ctx, sx, sy, size, ti, tj, jitter, horizontal) {
    const A = TER[ti], B = TER[tj];
    const water = A === 'water' || B === 'water';
    const snow = A === 'snow' || B === 'snow';
    const column = jitter * 1000 | 0;      // deterministický "seed" pásu

    if (water) {
      // pěna: světlé obloučky podél břehu
      ctx.fillStyle = EDGE_LIGHT[ti][tj];
      for (let i = 0; i < 3; i++) {
        const a1 = fhash(column, i, 7), a2 = fhash(column, i, 13), a3 = fhash(column, i, 19);
        const off = (i - 1) * size * 0.26 + (a1 - 0.5) * size * 0.18;
        const along = (a2 - 0.5) * size * 0.5;
        const rx = size * (0.16 + a3 * 0.16), ry = size * (0.06 + a1 * 0.07);
        ctx.globalAlpha = 0.10 + a3 * 0.14;
        ctx.beginPath();
        if (horizontal) ctx.ellipse(sx + along, sy + off, ry * 1.6, ry, 0, 0, Math.PI * 2);
        else ctx.ellipse(sx + off, sy + along, ry, ry * 1.6, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      return;
    }

    if (snow) {
      ctx.fillStyle = '#e9eff5';
      ctx.globalAlpha = 0.13 + jitter * 0.10;
      ctx.beginPath();
      if (horizontal) ctx.ellipse(sx, sy, size * 0.5, size * 0.11, 0, 0, Math.PI * 2);
      else ctx.ellipse(sx, sy, size * 0.11, size * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      return;
    }

    // ostatní dvojice: drobné kamínky / obruba v barvě přechodu
    ctx.fillStyle = EDGE_COLOR[ti][tj];
    const n = 2 + ((jitter * 3) | 0);
    for (let i = 0; i < n; i++) {
      const a1 = fhash(column, i, 31), a2 = fhash(column, i, 41), a3 = fhash(column, i, 47);
      const along = ((i + 0.5) / n - 0.5) * size * 0.9 + (a1 - 0.5) * size * 0.12;
      const off = (a2 - 0.5) * size * 0.16;
      ctx.globalAlpha = 0.08 + a3 * 0.14;
      ctx.beginPath();
      if (horizontal) ctx.ellipse(sx + along, sy + off, size * (0.06 + a3 * 0.06), size * (0.04 + a1 * 0.05), 0, 0, Math.PI * 2);
      else ctx.ellipse(sx + off, sy + along, size * (0.04 + a1 * 0.05), size * (0.06 + a3 * 0.06), 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /** Dekorace podle terénu: trs, kamínek, rákosí, závěj, vyjetá kolej. */
  function paintDeco(ctx, sx, sy, size, ti, variant, shape) {
    const t = TER[ti], pal = G.PAL[t] || G.PAL.grass;
    const dark = pal.dark || pal.base, light = pal.light || pal.base;
    const seed = (shape * 4096) | 0;

    if (t === 'water') {
      ctx.globalAlpha = 0.16 + variant * 0.16;
      ctx.strokeStyle = light; ctx.lineWidth = Math.max(1, size * 0.5);
      const len = size * (2.2 + variant * 1.6);
      ctx.beginPath(); ctx.moveTo(sx - len / 2, sy); ctx.lineTo(sx + len / 2, sy); ctx.stroke();
      ctx.globalAlpha = 1;
      return;
    }

    if (t === 'road') {
      ctx.globalAlpha = 0.18 + variant * 0.14;
      ctx.strokeStyle = dark; ctx.lineWidth = Math.max(1, size * 0.35);
      const len = size * (2.4 + variant * 1.4), gap = size * 0.5;
      ctx.beginPath();
      ctx.moveTo(sx - len / 2, sy - gap); ctx.lineTo(sx + len / 2, sy - gap * 0.6);
      ctx.moveTo(sx - len / 2, sy + gap); ctx.lineTo(sx + len / 2, sy + gap * 0.6);
      ctx.stroke();
      ctx.globalAlpha = 1;
      return;
    }

    if (t === 'forest' || t === 'deep_forest') {
      // podrost: dva tmavé trsy
      ctx.globalAlpha = 0.30 + variant * 0.22;
      ctx.fillStyle = dark;
      for (let i = 0; i < 2; i++) {
        const a1 = fhash(seed, i, 3), a2 = fhash(seed, i, 9);
        ctx.beginPath();
        ctx.ellipse(sx + (a1 - 0.5) * size, sy + (a2 - 0.5) * size * 0.6,
                    size * (0.7 + a1 * 0.6), size * (0.45 + a2 * 0.4), 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      return;
    }

    if (t === 'swamp') {
      ctx.globalAlpha = 0.5 + variant * 0.3;
      ctx.strokeStyle = '#6d7a4e'; ctx.lineWidth = Math.max(1, size * 0.28);
      for (let i = 0; i < 4; i++) {
        const a1 = fhash(seed, i, 5), a2 = fhash(seed, i, 11);
        const bx = sx + (a1 - 0.5) * size * 1.4, by = sy + (a2 - 0.5) * size * 0.6;
        ctx.beginPath();
        ctx.moveTo(bx, by); ctx.lineTo(bx + (a1 - 0.5) * size * 0.6, by - size * (1.4 + a2));
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      return;
    }

    if (t === 'snow') {
      ctx.globalAlpha = 0.20 + variant * 0.18;
      ctx.fillStyle = '#f2f6fa';
      ctx.beginPath();
      ctx.ellipse(sx, sy, size * (1.2 + variant), size * (0.5 + variant * 0.5), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      return;
    }

    if (t === 'hills' || t === 'mountain' || t === 'dirt') {
      // kamínek s osvětlenou hranou
      const r = size * (0.55 + variant * 0.5);
      ctx.globalAlpha = 0.22; ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(sx, sy + r * 0.5, r * 1.05, r * 0.35, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = pal.base;
      ctx.beginPath(); ctx.ellipse(sx, sy, r, r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = light;
      ctx.beginPath(); ctx.ellipse(sx - r * 0.2, sy - r * 0.3, r * 0.5, r * 0.35, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      return;
    }

    // louka: trs trávy, občas květ
    ctx.globalAlpha = 0.45 + variant * 0.3;
    ctx.strokeStyle = variant > 0.7 ? light : dark;
    ctx.lineWidth = Math.max(1, size * 0.25);
    for (let i = 0; i < 3; i++) {
      const a1 = fhash(seed, i, 17), a2 = fhash(seed, i, 29);
      const bx = sx + (a1 - 0.5) * size * 1.2, by = sy + (a2 - 0.5) * size * 0.5;
      ctx.beginPath();
      ctx.moveTo(bx, by); ctx.lineTo(bx + (a1 - 0.5) * size * 0.7, by - size * (0.9 + a2 * 0.8));
      ctx.stroke();
    }
    if (variant > 0.86) {
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = variant > 0.93 ? '#d9c07a' : '#c98b8b';
      ctx.beginPath(); ctx.arc(sx + size * 0.4, sy - size * 0.7, size * 0.28, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
})();
