(function () {
  const G = window.Game;
  G.PAL = {
    grass:      { base:'#5f6b45', dark:'#485232', light:'#7b8858', daubs:['#66734a','#556139','#707d4f','#4d5834','#6b7850'] },
    forest:     { base:'#414d31', dark:'#2b3421', light:'#57653f', daubs:['#45522f','#384328','#4e5b38','#313a22'] },
    deep_forest:{ base:'#2f3a25', dark:'#1d2517', light:'#414f30', daubs:['#2b3420','#232b1a','#37422a','#1f2718'] },
    hills:      { base:'#6e6551', dark:'#524b3b', light:'#877d63', daubs:['#6a624c','#5c5542','#786f57','#4e4838'] },
    mountain:   { base:'#5b5751', dark:'#3b3833', light:'#7d766c', daubs:['#57524b','#48443e','#67625a','#3f3b36'] },
    water:      { base:'#3a4a59', dark:'#27333f', light:'#54697b', daubs:['#384855','#2f3d49','#44566a','#2a3641'] },
    swamp:      { base:'#4a5140', dark:'#333a2c', light:'#5f6853', daubs:['#474d3c','#3c4433','#525b45','#2e3527'] },
    snow:       { base:'#b3bac2', dark:'#8f98a3', light:'#d4d9df', daubs:['#b0b7bf','#a3abb5','#c0c6cd','#9aa3ae'] },
    road:       { base:'#7e7055', dark:'#60553f', light:'#9a8b6b', daubs:['#786b51','#6b5f47','#877a5d','#5a5040'] },
    dirt:       { base:'#6f6349', dark:'#544a36', light:'#8b7d5d', daubs:['#6a5e46','#5e533d','#786b50','#514736'] }
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
  function vignette(ctx) {
    const g = ctx.createLinearGradient(0, 0, SIZE, SIZE);
    g.addColorStop(0, 'rgba(255,255,255,0.07)');
    g.addColorStop(0.5, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.16)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, SIZE, SIZE);
  }
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
      vignette(ctx);
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
    fn(ctx, rnd); vignette(ctx);
    return c;
  }
  G.getTileArt = function (terrain, variant) {
    const v = ((variant % VARIANTS) + VARIANTS) % VARIANTS;
    const key = terrain + ':' + v;
    if (!cache[key]) cache[key] = buildTile(terrain, v);
    return cache[key];
  };

  G.drawFigure = function (ctx, u, x, y, scale) {
    const s = scale;
    const bob = u._bob || 0, walk = u._walk || 0, face = u.facing || 1;
    ctx.globalAlpha = 0.32; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(x, y + 1.5*s, 6.5*s, 2.4*s, 0, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1;
    const legSwing = Math.sin(walk) * 2.2 * s;
    ctx.strokeStyle = '#2a2318'; ctx.lineWidth = 2.4*s; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - 1.6*s, y - 6*s); ctx.lineTo(x - 1.6*s + legSwing, y);
    ctx.moveTo(x + 1.6*s, y - 6*s); ctx.lineTo(x + 1.6*s - legSwing, y);
    ctx.stroke();
    ctx.fillStyle = shade(u.color, -0.35);
    ctx.beginPath();
    ctx.moveTo(x - 4.4*s, y - 6*s + bob); ctx.lineTo(x + 4.4*s, y - 6*s + bob);
    ctx.lineTo(x + 3.4*s, y - 13*s + bob); ctx.lineTo(x - 3.4*s, y - 13*s + bob);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = u.color;
    ctx.beginPath();
    ctx.moveTo(x - 4.2*s, y - 12*s + bob); ctx.lineTo(x + 4.2*s, y - 12*s + bob);
    ctx.lineTo(x + 3.6*s, y - 20*s + bob); ctx.lineTo(x - 3.6*s, y - 20*s + bob);
    ctx.closePath(); ctx.fill();
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
    drawWeapon(ctx, u, x, y, s, face, bob);
    if (u.gear && u.gear.shield) {
      ctx.fillStyle = '#5d4a34';
      ctx.beginPath(); ctx.ellipse(x - face*5.6*s, y - 15*s + bob, 4*s, 5*s, 0, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#8a7550'; ctx.lineWidth = 1*s; ctx.stroke();
    }
    ctx.fillStyle = '#c9a077';
    ctx.beginPath(); ctx.arc(x, y - 23.5*s + bob, 3.5*s, 0, Math.PI*2); ctx.fill();
    if (u.gear && u.gear.helm) {
      ctx.fillStyle = '#6e6a62';
      ctx.beginPath(); ctx.arc(x, y - 24*s + bob, 3.8*s, Math.PI, Math.PI*2); ctx.fill();
      ctx.fillRect(x - 3.8*s, y - 24.3*s + bob, 7.6*s, 1.6*s);
    } else {
      ctx.fillStyle = '#3b2a1b';
      ctx.beginPath(); ctx.arc(x, y - 24.5*s + bob, 3.5*s, Math.PI, Math.PI*2); ctx.fill();
    }
  };
  function drawWeapon(ctx, u, x, y, s, face, bob) {
    const w = (u.gear && u.gear.weapon) || 'axe';
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

  const FEATURES = {
    forest(ctx, rnd, props) {
      shadow(ctx, 0, 7, 19, 6);
      for (const p of props.list) {
        if ((p.v + 1) % 2) pine(ctx, rnd, p.x, p.y + 8, p.s, '#243019', '#33421f', '#5c6f42');
        else tree(ctx, rnd, p.x, p.y + 8, p.s, '#26301c', '#39472a', '#6a7a4a');
      }
    },
    deep_forest(ctx, rnd, props) {
      shadow(ctx, 0, 7, 21, 7);
      for (const p of props.list) pine(ctx, rnd, p.x, p.y + 8, p.s * 1.08, '#161d10', '#212b16', '#3d4c2b');
    },
    grove(ctx, rnd, props) {
      shadow(ctx, 0, 8, 18, 6);
      for (const p of props.list) {
        tree(ctx, rnd, p.x, p.y + 8, p.s * 0.9, '#2f3d22', '#48592f', '#7d8f57');
        for (let i = 0; i < 5; i++) {                       // jarní květy
          ctx.fillStyle = i % 2 ? 'rgba(240,225,235,.55)' : 'rgba(245,215,225,.45)';
          ctx.beginPath();
          ctx.arc(p.x + (rnd() - 0.5) * 13 * p.s, p.y - 2 + (rnd() - 0.5) * 10 * p.s, 1.1, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    },
    meadow(ctx, rnd, props) {
      // obdělávané pole s řádky
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = '#6d6a3c';
      ctx.beginPath(); ctx.ellipse(0, 1, 20, 13, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#8f8a4a'; ctx.lineWidth = 1.4;
      for (let i = -4; i <= 4; i++) {
        ctx.beginPath();
        ctx.moveTo(-18, i * 2.7);
        ctx.quadraticCurveTo(0, i * 2.7 + 3, 18, i * 2.7);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.restore();
      for (const p of props.list.slice(0, 3)) {             // snopy
        ctx.fillStyle = '#c9a94e';
        ctx.beginPath(); ctx.ellipse(p.x, p.y, 2.6 * p.s, 3.4 * p.s, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#8a7332'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(p.x, p.y + 3 * p.s); ctx.lineTo(p.x, p.y + 5 * p.s); ctx.stroke();
      }
    },
    marsh(ctx, rnd, props) {
      for (let i = 0; i < 4; i++) {
        ctx.globalAlpha = 0.5; ctx.fillStyle = '#2f3f3a';
        const p = props.list[i % props.list.length];
        ctx.beginPath(); ctx.ellipse(p.x, p.y, 6.5 * p.s, 3.2 * p.s, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      for (let i = 0; i < 22; i++) {                        // rákosí
        const x = (rnd() - 0.5) * 34, y = (rnd() - 0.5) * 18;
        ctx.strokeStyle = i % 3 ? '#6d7a4e' : '#57623c'; ctx.lineWidth = 1.1;
        ctx.beginPath(); ctx.moveTo(x, y + 6); ctx.lineTo(x + (rnd() - 0.5) * 3, y - 3 - rnd() * 7); ctx.stroke();
      }
      ctx.fillStyle = '#4a3a28';                            // ztrouchnivělý kmen
      ctx.save(); ctx.rotate(-0.28);
      ctx.fillRect(-17, -1.4, 15, 2.8); ctx.restore();
    },
    quarry(ctx, rnd, props) {
      shadow(ctx, 0, 6, 19, 7);
      ctx.fillStyle = '#6b6350';                            // stupňovitá stěna
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
      ctx.fillStyle = '#544e44';                            // horský hřbet
      ctx.beginPath();
      ctx.moveTo(-21, 8); ctx.lineTo(-6, -13); ctx.lineTo(9, -9); ctx.lineTo(21, 8); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#6b6353';
      ctx.beginPath(); ctx.moveTo(-21, 8); ctx.lineTo(-8, -9); ctx.lineTo(-1, 8); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#15130f';                            // vstup do dolu
      ctx.beginPath();
      ctx.moveTo(-6, 8); ctx.lineTo(-6, -1); ctx.quadraticCurveTo(0, -7, 6, -1); ctx.lineTo(6, 8);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = G.PAL_WOOD; ctx.lineWidth = 2.2;    // výztuha
      ctx.beginPath();
      ctx.moveTo(-6.5, 8); ctx.lineTo(-6.5, -2); ctx.moveTo(6.5, 8); ctx.lineTo(6.5, -2);
      ctx.moveTo(-8, -2); ctx.lineTo(8, -2); ctx.stroke();
      for (const p of props.list.slice(0, 2)) {
        ctx.fillStyle = '#6f6a60';                          // hromada rudy
        ctx.beginPath(); ctx.ellipse(p.x + 10, p.y + 9, 4.2, 2.4, 0, 0, Math.PI * 2); ctx.fill();
      }
    },
    cave(ctx, rnd, props) {
      shadow(ctx, 0, 7, 18, 6);
      for (const p of props.list) boulder(ctx, rnd, p.x, p.y + 7, 4.2 + p.s * 3, '#6d675d', '#4e4a44', '#332f2b');
      ctx.fillStyle = '#3a3730';                            // skalní výchoz
      ctx.beginPath();
      ctx.moveTo(-14, 8); ctx.lineTo(-10, -9); ctx.lineTo(3, -12); ctx.lineTo(14, 8);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#0f0e0c';                            // ústí jeskyně
      ctx.beginPath();
      ctx.moveTo(-5, 8); ctx.lineTo(-5, -1); ctx.quadraticCurveTo(0, -8, 5, -1); ctx.lineTo(5, 8);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(122,198,216,.5)';               // záblesk krystalu
      ctx.beginPath(); ctx.moveTo(-9, -2); ctx.lineTo(-7, -7); ctx.lineTo(-5.5, -2); ctx.closePath(); ctx.fill();
    },
    lake(ctx, rnd, props) {
      ctx.fillStyle = '#3d5a68';                            // jezírko
      ctx.beginPath(); ctx.ellipse(0, 2, 21, 13, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#4f7183';
      ctx.beginPath(); ctx.ellipse(-3, 0, 15, 9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(220,235,240,.28)'; ctx.lineWidth = 1.2;
      for (let i = 0; i < 6; i++) {                         // vlnky
        const x = -14 + rnd() * 28, y = -7 + rnd() * 16;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 5, y - 2, x + 10, y); ctx.stroke();
      }
      ctx.strokeStyle = '#6a523a'; ctx.lineWidth = 2;       // molo
      ctx.beginPath(); ctx.moveTo(6, 8); ctx.lineTo(16, 3); ctx.stroke();
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(9, 10.5); ctx.lineTo(19, 5.5); ctx.stroke();
      for (const p of props.list) {                         // rákosí u břehu
        ctx.strokeStyle = '#5d6b3e'; ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(p.x - 12, p.y + 9);
        ctx.lineTo(p.x - 12 + (rnd() - 0.5) * 3, p.y + 2 - rnd() * 6);
        ctx.stroke();
      }
    }
  };

  function shadow(ctx, x, y, rx, ry) {
    ctx.globalAlpha = 0.20; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  /**
   * Vykreslí uzel jako krajinný prvek. Kreslí se ve starých jednotkách
   * dlaždice (46), takže se škáluje podle aktuální velikosti dlaždice.
   */
  G.drawNodeFeature = function (ctx, node, x, y, tilePx) {
    const painter = FEATURES[node.kind];
    if (!painter) return false;
    const props = nodeProps(node);
    const rnd = rndFrom(props.seed + 13);
    ctx.save();
    ctx.translate(x, y + tilePx * 0.10);
    ctx.scale(tilePx / 46, tilePx / 46);
    try { painter(ctx, rnd, props); } finally { ctx.restore(); }
    return true;
  };
})();
