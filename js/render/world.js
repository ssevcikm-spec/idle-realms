(function () {
  const G = window.Game;
  const BASE_TILE = 46;
  const MIN_ZOOM = 0.55, MAX_ZOOM = 2.0;
  const UNIT_SPEED = 2.4;
  let canvas, ctx, dpr = 1, cw = 0, ch = 0, lastTs = 0;
  let dragging = false, dragged = false, lastX = 0, lastY = 0;

  G.initWorld = function (el) {
    canvas = el; ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', () => setTimeout(resize, 200));
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    document.querySelectorAll('#map-controls .map-btn').forEach(b => {
      b.addEventListener('click', () => mapButton(b.dataset.map));
    });
    // automatické přizpůsobení canvasu při změně velikosti kontejneru (sbalení panelu apod.)
    if (window.ResizeObserver) {
      const wrap = document.getElementById('world-wrap');
      if (wrap) new ResizeObserver(() => resize()).observe(wrap);
    }
    lastTs = performance.now();
    requestAnimationFrame(loop);
  };

  function resize() {
    if (!canvas) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();
    cw = rect.width; ch = rect.height;
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function onDown(e) { dragging = true; dragged = false; lastX = e.clientX; lastY = e.clientY; try { canvas.setPointerCapture(e.pointerId); } catch (_) {} }
  function onMove(e) {
    if (!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    if (Math.abs(dx) + Math.abs(dy) > 2) dragged = true;
    const tilePx = tileSize();
    G.state.camera.x -= dx / tilePx;
    G.state.camera.y -= dy / tilePx;
    clampCamera();
    lastX = e.clientX; lastY = e.clientY;
  }
  function onUp(e) { if (!dragging) return; dragging = false; if (!dragged) handleTap(e.clientX, e.clientY); }
  function onWheel(e) { e.preventDefault(); zoomBy(e.deltaY < 0 ? 1.12 : 1/1.12); }
  function mapButton(cmd) {
    if (cmd === 'zoom-in') return zoomBy(1.2);
    if (cmd === 'zoom-out') return zoomBy(1/1.2);
    if (cmd === 'toggle-panel') return setPanelCollapsed(!isPanelCollapsed());
    if (cmd === 'toggle-fullscreen') return setFullscreen(!isFullscreen());
    if (cmd === 'center') {
      const g = G.state.groups.find(x => x.memberIds.length) || null;
      const focus = g ? G.groupMembers(g)[0] : G.state.units[0];
      if (focus) { G.state.camera.x = focus.pos.x; G.state.camera.y = focus.pos.y; clampCamera(); }
    }
  }
  function isPanelCollapsed() {
    const app = document.getElementById('app');
    return app ? app.classList.contains('panel-collapsed') : false;
  }
  function setPanelCollapsed(collapsed) {
    const app = document.getElementById('app');
    if (app) app.classList.toggle('panel-collapsed', collapsed);
    const btn = document.getElementById('panel-toggle');
    if (btn) btn.textContent = collapsed ? '▴' : '▾';
  }
  G.setPanelCollapsed = setPanelCollapsed;
  function isFullscreen() {
    const app = document.getElementById('app');
    return app ? app.classList.contains('map-fullscreen') : false;
  }
  function setFullscreen(full) {
    const app = document.getElementById('app');
    if (app) app.classList.toggle('map-fullscreen', full);
    const btn = document.getElementById('map-fullscreen-btn');
    if (btn) btn.textContent = full ? '✕' : '⛶';
  }
  G.setFullscreen = setFullscreen;
  function zoomBy(mult) { G.state.camera.zoom = G.clamp(G.state.camera.zoom * mult, MIN_ZOOM, MAX_ZOOM); clampCamera(); }
  function clampCamera() {
    const c = G.state.camera;
    c.x = G.clamp(c.x, 0, G.WORLD.w);
    c.y = G.clamp(c.y, 0, G.WORLD.h);
  }

  function handleTap(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const sx = clientX - rect.left, sy = clientY - rect.top;
    const tilePx = tileSize(), cam = G.state.camera;
    const tx = cam.x + (sx - cw/2) / tilePx;
    const ty = cam.y + (sy - ch/2) / tilePx;
    if (G.state.base && G.state.base.unlocked) {
      const bx = G.BASE_POS.x + 0.5, by = G.BASE_POS.y + 0.5;
      if (Math.hypot(bx - tx, by - ty) < 1.3) {
        G.state.selected = { type: 'base' };
        if (G.selectTab) G.selectTab('place');
        return;
      }
    }
    for (const s of G.WORLD.settlements) {
      if (Math.hypot(s.x + 0.5 - tx, s.y + 0.5 - ty) < 1.2) {
        G.state.selected = { type: 'settlement', id: s.id };
        if (G.state.stats) {
          if (!G.state.stats.settlementsVisited) G.state.stats.settlementsVisited = [];
          if (!G.state.stats.settlementsVisited.includes(s.id)) G.state.stats.settlementsVisited.push(s.id);
        }
        if (G.selectTab) G.selectTab('place');
        return;
      }
    }
    for (const n of G.WORLD.nodes) {
      if (Math.hypot(n.x + 0.5 - tx, n.y + 0.5 - ty) < 0.9) {
        G.state.selected = { type: 'node', id: n.id };
        if (G.selectTab) G.selectTab('place');
        return;
      }
    }
    G.state.selected = null;
  }
  function tileSize() { return BASE_TILE * (G.state.camera.zoom || 1); }

  function loop(ts) {
    const dt = Math.min(0.1, (ts - lastTs) / 1000 || 0);
    lastTs = ts;
    updateUnits(dt);
    draw();
    requestAnimationFrame(loop);
  }

  function updateUnits(dt) {
    for (const u of G.state.units) {
      if (u.merchantState && u.merchantState.active) {
        u._walk = (u._walk || 0) + dt * 8;
        u._bob = Math.sin(u._walk) * 0.5;
        continue;
      }
      let target = null, working = false;
      if (u.resting) {
        if (u.restingAt) {
          const s = G.WORLD.settlementById[u.restingAt];
          if (s) {
            const off = hashOffset(u.id + 'rest');
            target = { x: s.x + 0.5 + off.x, y: s.y + 0.9 + off.y };
          }
        }
      } else if (u.assignedTaskId) {
        const t = G.state.tasks.find(x => x.id === u.assignedTaskId);
        if (t) {
          const node = G.WORLD.nodes.find(n => n.id === t.nodeId);
          if (node) {
            const off = hashOffset(u.id);
            target = { x: node.x + 0.5 + off.x, y: node.y + 0.5 + off.y };
            working = true;
          }
        }
      }
      if (!target) {
        u._working = false;
        u._walk = (u._walk || 0) + dt * 1.4;
        u._bob = Math.sin(u._walk) * 0.25;
        continue;
      }
      const dx = target.x - u.pos.x, dy = target.y - u.pos.y;
      const d = Math.hypot(dx, dy);
      if (d > 0.35) {
        const step = Math.min(d, UNIT_SPEED * dt);
        u.pos.x += (dx/d) * step; u.pos.y += (dy/d) * step;
        if (Math.abs(dx) > 0.05) u.facing = dx > 0 ? 1 : -1;
        u._walk = (u._walk || 0) + dt * 8;
        u._bob = Math.sin(u._walk) * 0.5;
        u._working = false;
      } else {
        u._working = working && !u.resting;
        u._walk = (u._walk || 0) + dt * (working ? 9 : 2.2);
        u._bob = Math.sin(u._walk) * (working ? 0.9 : 0.35);
      }
    }
  }

  let vignetteCache = null, vigW = 0, vigH = 0;

  function draw() {
    if (!G.state || !ctx) return;
    ctx.clearRect(0, 0, cw, ch);
    const cam = G.state.camera, tilePx = tileSize(), w = G.WORLD;
    const halfW = cw/2/tilePx, halfH = ch/2/tilePx;
    const x0 = Math.floor(cam.x - halfW) - 1;
    const x1 = Math.ceil(cam.x + halfW) + 1;
    const y0 = Math.floor(cam.y - halfH) - 1;
    const y1 = Math.ceil(cam.y + halfH) + 1;
    const ox = cw/2 - cam.x*tilePx, oy = ch/2 - cam.y*tilePx;
    ctx.fillStyle = '#1b1a17'; ctx.fillRect(0, 0, cw, ch);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (x < 0 || y < 0 || x >= w.w || y >= w.h) continue;
      const name = w.terrainAt(x, y);
      const v = ((x*7 + y*13) % 4 + 4) % 4;
      const art = G.getTileArt(name, v);
      ctx.drawImage(art, ox + x*tilePx, oy + y*tilePx, tilePx + 0.5, tilePx + 0.5);
    }
    if (G.state.base && G.state.base.unlocked) drawBase(ox, oy, tilePx);
    for (const n of w.nodes) {
      if (n.x < x0-1 || n.x > x1+1 || n.y < y0-1 || n.y > y1+1) continue;
      const kind = G.NODE_KINDS[n.kind];
      const cx = ox + (n.x + 0.5)*tilePx, cy = oy + (n.y + 0.5)*tilePx;
      const r = tilePx * 0.34;
      G.drawBadge(ctx, cx, cy, r, G.NODE_TINT[n.kind] || '#5a5347', kind.icon, r*1.15);
      const danger = G.nodeDanger ? G.nodeDanger(n.kind) : 0;
      if (danger >= 2) {
        const d = G.DANGER_LABEL[danger];
        ctx.font = (tilePx*0.24) + 'px serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = d.color;
        ctx.fillText('⚠', cx + r*0.85, cy - r*0.85);
      }
    }
    for (const s of w.settlements) {
      if (s.x < x0-3 || s.x > x1+3 || s.y < y0-3 || s.y > y1+3) continue;
      drawSettlement(s, ox, oy, tilePx);
    }
    drawCaravans(ox, oy, tilePx, x0, x1, y0, y1);
    drawSelection(ox, oy, tilePx);
    const sorted = G.state.units.slice().sort((a, b) => a.pos.y - b.pos.y);
    for (const u of sorted) {
      if (u.pos.x < x0-1 || u.pos.x > x1+1 || u.pos.y < y0-1 || u.pos.y > y1+1) continue;
      const sx = ox + u.pos.x*tilePx, sy = oy + u.pos.y*tilePx;
      if (u.resting) ctx.globalAlpha = 0.55;
      G.drawFigure(ctx, u, sx, sy, tilePx/44);
      ctx.globalAlpha = 1;
      if (u.merchantState && u.merchantState.active) drawFloatIcon(ctx, '🐎', sx + tilePx*0.30, sy - tilePx*0.6, tilePx*0.4);
      else if (u.resting) drawFloatIcon(ctx, '💤', sx + tilePx*0.28, sy - tilePx*0.6, tilePx*0.4);
      else if (u.injuries && u.injuries.length) {
        const worst = G.worstInjury(u);
        const wd = worst ? G.INJURIES[worst.id] : null;
        if (wd) drawFloatIcon(ctx, wd.icon, sx + tilePx*0.28, sy - tilePx*0.6, tilePx*0.35);
      } else if (u.assignedTaskId) {
        const t = G.state.tasks.find(x => x.id === u.assignedTaskId);
        if (t) drawUnitProgress(sx, sy - tilePx*0.72, tilePx*0.20, G.taskProgress(t));
      }
      drawStaminaBar(sx, sy + tilePx*0.22, tilePx*0.55, u.stamina / u.maxStamina);
      drawMoodBar(sx, sy + tilePx*0.30, tilePx*0.55, (u.mood || 70) / 100);
    }
    if (!vignetteCache || vigW !== cw || vigH !== ch) {
      const g = ctx.createRadialGradient(cw/2, ch/2, Math.min(cw,ch)*0.35, cw/2, ch/2, Math.max(cw,ch)*0.75);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.35)');
      vignetteCache = g; vigW = cw; vigH = ch;
    }
    ctx.fillStyle = vignetteCache; ctx.fillRect(0, 0, cw, ch);
  }

  function drawBase(ox, oy, tilePx) {
    const bx = ox + (G.BASE_POS.x + 0.5)*tilePx;
    const by = oy + (G.BASE_POS.y + 0.5)*tilePx;
    ctx.globalAlpha = 0.3; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(bx, by + tilePx*0.4, tilePx*1.1, tilePx*0.4, 0, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#5d4a34';
    ctx.beginPath();
    ctx.moveTo(bx - tilePx*0.55, by + tilePx*0.15);
    ctx.lineTo(bx, by - tilePx*0.55);
    ctx.lineTo(bx + tilePx*0.55, by + tilePx*0.15);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#8a6f4a';
    ctx.beginPath();
    ctx.moveTo(bx, by - tilePx*0.55);
    ctx.lineTo(bx + tilePx*0.55, by + tilePx*0.15);
    ctx.lineTo(bx + tilePx*0.1, by + tilePx*0.15);
    ctx.closePath(); ctx.fill();
    const flick = 0.6 + 0.4 * Math.sin(performance.now()/180);
    ctx.fillStyle = '#e8c56a'; ctx.globalAlpha = 0.5 + 0.4*flick;
    ctx.beginPath(); ctx.arc(bx + tilePx*0.6, by + tilePx*0.25, tilePx*0.13, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.font = (tilePx*0.22) + 'px serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(232,197,106,0.9)';
    ctx.fillText('🏕️', bx, by - tilePx*0.8);
  }

  function drawCaravans(ox, oy, tilePx, x0, x1, y0, y1) {
    if (!G.state.caravans) return;
    for (const c of G.state.caravans) {
      if (!c.pos) continue;
      if (c.pos.x < x0-1 || c.pos.x > x1+1 || c.pos.y < y0-1 || c.pos.y > y1+1) continue;
      const type = G.CARAVAN_TYPES[c.type];
      const sx = ox + c.pos.x*tilePx, sy = oy + c.pos.y*tilePx;
      ctx.globalAlpha = 0.3; ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(sx, sy + tilePx*0.12, tilePx*0.22, tilePx*0.08, 0, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.font = (tilePx*0.5) + 'px serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(type.icon, sx, sy - tilePx*0.05);
    }
  }
  function drawFloatIcon(ctx, icon, x, y, size) {
    ctx.font = size + 'px serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(icon, x, y);
  }
  function drawStaminaBar(x, y, w, frac) {
    if (frac >= 0.99) return;
    const h = 2.4;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(x - w/2, y, w, h);
    ctx.fillStyle = frac > 0.5 ? '#8fbf7a' : frac > 0.25 ? '#e0bb5e' : '#c05a45';
    ctx.fillRect(x - w/2, y, w*frac, h);
  }
  function drawMoodBar(x, y, w, frac) {
    if (frac >= 0.99) return;
    const h = 1.8;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(x - w/2, y, w, h);
    ctx.fillStyle = frac > 0.6 ? '#9ed48c' : frac > 0.3 ? '#e0bb5e' : '#c05a45';
    ctx.fillRect(x - w/2, y, w*frac, h);
  }

  function drawSettlement(s, ox, oy, tilePx) {
    const list = buildingLayout(s);
    const cx = s.x + 0.5, cy = s.y + 0.5;
    const pal = G.PAL_BUILDING[s.size] || G.PAL_BUILDING.village;
    ctx.globalAlpha = 0.22; ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(ox + cx*tilePx, oy + (cy + 0.45)*tilePx, tilePx*1.6, tilePx*0.55, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.globalAlpha = 1;
    const sorted = list.slice().sort((a, b) => a.dy - b.dy);
    for (const b of sorted) drawHouse(ox + (cx + b.dx)*tilePx, oy + (cy + b.dy)*tilePx, b.w*tilePx, b.h*tilePx, pal, b.seed);
    const facId = G.SETTLEMENT_FACTION && G.SETTLEMENT_FACTION[s.id];
    const fac = facId && G.FACTIONS ? G.FACTIONS[facId] : null;
    if (fac) {
      const bx = ox + cx*tilePx, by = oy + (cy - 1.05)*tilePx;
      ctx.strokeStyle = '#3b3327'; ctx.lineWidth = Math.max(1, tilePx*0.04);
      ctx.beginPath(); ctx.moveTo(bx, by + tilePx*0.35); ctx.lineTo(bx, by - tilePx*0.55); ctx.stroke();
      ctx.fillStyle = fac.color;
      ctx.beginPath();
      ctx.moveTo(bx, by - tilePx*0.55);
      ctx.lineTo(bx + tilePx*0.42, by - tilePx*0.42);
      ctx.lineTo(bx, by - tilePx*0.28);
      ctx.closePath(); ctx.fill();
    }
    const v = (G.state.settlementRep && G.state.settlementRep[s.id]) || 0;
    if (Math.abs(v) > 15) {
      ctx.font = (tilePx*0.20) + 'px serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = v > 0 ? '#8fbf7a' : '#c05a45';
      ctx.fillText(v > 0 ? '♥' : '✖', ox + (cx + 0.8)*tilePx, oy + (cy - 0.8)*tilePx);
    }
  }

  function drawHouse(x, y, w, h, pal, seed) {
    const rnd = G.rngFrom(seed + 17);
    ctx.fillStyle = pal.wall;
    ctx.fillRect(x - w/2, y - h*0.55, w, h*0.55);
    ctx.fillStyle = pal.wallDark;
    ctx.fillRect(x - w/2, y - h*0.15, w, h*0.15);
    ctx.fillStyle = pal.roof;
    ctx.beginPath();
    ctx.moveTo(x - w*0.62, y - h*0.55);
    ctx.lineTo(x, y - h*1.05);
    ctx.lineTo(x + w*0.62, y - h*0.55);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = pal.roofDark;
    ctx.beginPath();
    ctx.moveTo(x, y - h*1.05);
    ctx.lineTo(x + w*0.62, y - h*0.55);
    ctx.lineTo(x + w*0.10, y - h*0.55);
    ctx.closePath(); ctx.fill();
    if (rnd() < 0.85) {
      ctx.fillStyle = '#e8c56a';
      ctx.fillRect(x - w*0.10, y - h*0.42, w*0.20, h*0.14);
    }
  }

  function drawSelection(ox, oy, tilePx) {
    const sel = G.state.selected; if (!sel) return;
    let tx, ty;
    if (sel.type === 'node') {
      const n = G.WORLD.nodes.find(x => x.id === sel.id); if (!n) return;
      tx = n.x + 0.5; ty = n.y + 0.5;
    } else if (sel.type === 'settlement') {
      const s = G.WORLD.settlementById[sel.id]; if (!s) return;
      tx = s.x + 0.5; ty = s.y + 0.5;
    } else if (sel.type === 'base') { tx = G.BASE_POS.x + 0.5; ty = G.BASE_POS.y + 0.5; }
    else return;
    const x = ox + tx*tilePx, y = oy + ty*tilePx;
    const pulse = 0.5 + 0.5 * Math.sin(performance.now()/350);
    ctx.strokeStyle = 'rgba(216,180,90,' + (0.45 + pulse*0.45) + ')';
    ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.arc(x, y, tilePx*0.60 + pulse*2, 0, Math.PI*2); ctx.stroke();
    ctx.strokeStyle = 'rgba(216,180,90,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x, y, tilePx*0.74 + pulse*3, 0, Math.PI*2); ctx.stroke();
  }
  function drawUnitProgress(x, y, r, p) {
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.stroke();
    ctx.strokeStyle = '#d8b45a';
    ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.arc(x, y, r, -Math.PI/2, -Math.PI/2 + p*Math.PI*2); ctx.stroke();
  }
  function buildingLayout(s) {
    if (s._bld) return s._bld;
    const rnd = G.rngFrom(hashStr(s.id) + 991);
    const count = G.SETTLEMENT_SIZE[s.size].houses;
    const arr = [];
    for (let i = 0; i < count; i++) {
      const a = rnd()*Math.PI*2;
      const r = 0.40 + rnd()*1.05;
      arr.push({
        dx: Math.cos(a)*r, dy: Math.sin(a)*r*0.78,
        w: 0.55 + rnd()*0.35, h: 0.55 + rnd()*0.35,
        seed: (rnd()*1000)|0
      });
    }
    s._bld = arr;
    return arr;
  }
  function hashStr(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h*31 + s.charCodeAt(i)) | 0; return Math.abs(h) || 1; }
  function hashOffset(s) {
    const h = hashStr(s);
    const a = ((h >>> 0) % 1000) / 1000;
    const b = (((h >>> 8) >>> 0) % 1000) / 1000;
    return { x: (a - 0.5)*0.42, y: (b - 0.5)*0.35 };
  }
})();
