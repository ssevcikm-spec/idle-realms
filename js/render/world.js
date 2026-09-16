(function () {
  const G = window.Game;
  /** Velikost dlaždice na obrazovce při zoomu 1 (px). Mění se v debug panelu. */
  let tileBase = 64;
  /** Výška postavy ve zlomcích dlaždice (1 = přesně jedna dlaždice). */
  let figureHeight = 0.94;
  const MIN_ZOOM = 0.7, MAX_ZOOM = 2.0;
  const UNIT_SPEED = 2.4;
  let canvas, ctx, dpr = 1, cw = 0, ch = 0, lastTs = 0;
  let dragging = false, dragged = false, lastX = 0, lastY = 0;

  G.setTileBase = function (v) {
    const n = parseFloat(v);
    if (!isFinite(n)) return tileBase;
    tileBase = G.clamp(n, 32, 96);
    return tileBase;
  };
  G.getTileBase = function () { return tileBase; };
  G.setFigureHeight = function (v) {
    const n = parseFloat(v);
    if (!isFinite(n)) return figureHeight;
    figureHeight = G.clamp(n, 0.4, 1.6);
    return figureHeight;
  };
  G.getFigureHeight = function () { return figureHeight; };

  G.initWorld = function (el) {
    if (G._worldInited) {          // nová hra ze hry: jen přesměruj na nový canvas
      if (el) { canvas = el; ctx = canvas.getContext('2d'); resize(); lastTs = performance.now(); }
      return;
    }
    G._worldInited = true;
    canvas = el; ctx = canvas.getContext('2d');
    // uložené zvětšení mapy
    if (G.state && G.state.settings) {
      if (G.state.settings.tileBase) G.setTileBase(G.state.settings.tileBase);
      if (G.state.settings.figHeight) G.setFigureHeight(G.state.settings.figHeight);
    }
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
    const cancelPlace = document.getElementById('placement-cancel');
    if (cancelPlace) cancelPlace.addEventListener('click', () => {
      if (G.cancelBasePlacement) G.cancelBasePlacement();
      updatePlacementHint();
      if (G.refreshPanel) G.refreshPanel();
    });
    updatePlacementHint();
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
    if (cmd === 'base') return baseButton();
    if (cmd === 'center') {
      const g = G.state.groups.find(x => x.memberIds.length) || null;
      const focus = g ? G.groupMembers(g)[0] : G.state.units[0];
      if (focus) { G.state.camera.x = focus.pos.x; G.state.camera.y = focus.pos.y; clampCamera(); }
    }
  }
  /* ---------- základna: tlačítko na mapě, výběr místa ---------- */

  function baseButton() {
    const b = G.state.base || {};
    if (b.unlocked) {
      const p = G.basePos ? G.basePos() : G.BASE_POS;
      centerMapOn(p.x + 0.5, p.y + 0.5);
      G.state.selected = { type: 'base' };
      if (G.selectTab) G.selectTab('place');
      return;
    }
    if (b.placementOffered) {
      const s = G.baseSuggestion ? G.baseSuggestion() : null;
      if (G.startBasePlacement) G.startBasePlacement(false);
      if (s) centerMapOn(s.x + 0.5, s.y + 0.5);
      updatePlacementHint();
      G.state.selected = { type: 'base' };
      if (G.selectTab) G.selectTab('place');
      return;
    }
    // ještě není splněné renomé — jen otevři panel, ať hráč ví, co chybí
    G.state.selected = { type: 'base' };
    if (G.selectTab) G.selectTab('place');
  }

  function centerMapOn(x, y) {
    G.state.camera.x = x; G.state.camera.y = y; clampCamera();
  }
  G.centerMapOn = centerMapOn;

  function updatePlacementHint() {
    const el = document.getElementById('placement-hint');
    if (!el) return;
    const placing = G.isBasePlacing && G.isBasePlacing();
    if (!placing) { el.style.display = 'none'; return; }
    const moving = !!(G.state.base && G.state.base.moving);
    const txt = document.getElementById('placement-hint-text');
    if (txt) txt.textContent = moving
      ? '🚚 Ťukni na mapu, kam základnu přesunout'
      : '🏕️ Ťukni na mapu, kde založit základnu';
    el.style.display = 'flex';
  }
  G.updatePlacementHint = updatePlacementHint;

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
    // režim výběru místa pro základnu
    if (G.isBasePlacing && G.isBasePlacing()) {
      const gx = Math.floor(tx), gy = Math.floor(ty);
      const res = G.placeBaseAt ? G.placeBaseAt(gx, gy) : { ok:false, reason:'Základnu teď nelze postavit.' };
      if (!res.ok) { if (G.log) G.log('⚠️ ' + res.reason, 'info'); return; }
      updatePlacementHint();
      G.state.selected = { type: 'base' };
      if (G.selectTab) G.selectTab('place');
      if (G.refreshPanel) G.refreshPanel();
      return;
    }
    if (G.state.base && G.state.base.unlocked) {
      const bp = G.basePos ? G.basePos() : G.BASE_POS;
      const bx = bp.x + 0.5, by = bp.y + 0.5;
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
    // Uzly jsou oblasti — klik se počítá na kteroukoli dlaždici plochy.
    let hitNode = null, hitD = 1.25;
    for (const n of G.WORLD.nodes) {
      const d = G.nodeDistance ? G.nodeDistance(n, tx, ty) : Math.hypot(n.x + 0.5 - tx, n.y + 0.5 - ty);
      if (d < hitD) { hitD = d; hitNode = n; }
    }
    if (hitNode) {
      G.state.selected = { type: 'node', id: hitNode.id };
      if (G.selectTab) G.selectTab('place');
      return;
    }
    G.state.selected = null;
  }
  function tileSize() { return tileBase * (G.state.camera.zoom || 1); }
  /** Měřítko pro G.drawFigure — figura má být vysoká `figureHeight` dlaždice (24,5 jednotek). */
  function figScale(tilePx) { return (tilePx * figureHeight) / 24.5; }

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
            const a = G.nodeAnchor ? G.nodeAnchor(node, u.pos.x, u.pos.y) : { x: node.x + 0.5, y: node.y + 0.5 };
            target = { x: a.x + off.x, y: a.y + off.y };
            working = true;
          } else if (t.site) {
            // stavba (nemá uzel) — stavitelé jdou ke staveništi
            const off = hashOffset(u.id);
            target = { x: t.site.x + off.x, y: t.site.y + off.y };
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
    // Cesty se kreslí zvlášť a spojitě — dlaždice sama neví, kterým směrem cesta vede.
    drawRoads(ox, oy, tilePx, x0, x1, y0, y1);
    if (G.state.base && G.state.base.unlocked) drawBase(ox, oy, tilePx);
    if (G.isBasePlacing && G.isBasePlacing()) {
      const s = G.baseSuggestion ? G.baseSuggestion() : null;
      if (s) drawGhostBase(ox, oy, tilePx, s.x, s.y);
    }
    for (const n of w.nodes) {
      if (n.x < x0-1 || n.x > x1+1 || n.y < y0-1 || n.y > y1+1) continue;
      const kind = G.NODE_KINDS[n.kind];
      const cx = ox + (n.x + 0.5)*tilePx, cy = oy + (n.y + 0.5)*tilePx;
      const r = tilePx * 0.34;
      // Uzel je skutečný kus krajiny (les, jezero, pole…). Když je mapa hodně
      // oddálená, prvek by se slil s terénem — pak se přepne na symbol.
      const asFeature = tilePx >= 34 && G.drawNodeFeature && G.drawNodeFeature(ctx, n, ox, oy, tilePx);
      if (!asFeature) G.drawBadge(ctx, cx, cy, r, G.NODE_TINT[n.kind] || '#5a5347', kind.icon, r*1.15);
      const danger = G.nodeDanger ? G.nodeDanger(n.kind) : 0;
      if (danger >= 2) {
        const d = G.DANGER_LABEL[danger];
        ctx.font = (tilePx*0.24) + 'px serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = d.color;
        ctx.fillText('⚠', cx + tilePx*0.30, cy - tilePx*0.30);
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
      G.drawFigure(ctx, u, sx, sy, figScale(tilePx));
      ctx.globalAlpha = 1;
      const iconY = sy - tilePx*(0.62 + figureHeight);   // ikony nad hlavou
      if (u.merchantState && u.merchantState.active) drawFloatIcon(ctx, '🐎', sx + tilePx*0.30, iconY, tilePx*0.4);
      else if (u.resting) drawFloatIcon(ctx, '💤', sx + tilePx*0.28, iconY, tilePx*0.4);
      else if (u.injuries && u.injuries.length) {
        const worst = G.worstInjury(u);
        const wd = worst ? G.INJURIES[worst.id] : null;
        if (wd) drawFloatIcon(ctx, wd.icon, sx + tilePx*0.28, iconY, tilePx*0.35);
      } else if (u.assignedTaskId) {
        const t = G.state.tasks.find(x => x.id === u.assignedTaskId);
        if (t) drawUnitProgress(sx, sy - tilePx*(0.58 + figureHeight), tilePx*0.20, G.taskProgress(t));
      }
      drawStaminaBar(sx, sy + tilePx*0.24, tilePx*0.55, u.stamina / u.maxStamina);
      drawMoodBar(sx, sy + tilePx*0.32, tilePx*0.55, (u.mood || 70) / 100);
    }
    if (!vignetteCache || vigW !== cw || vigH !== ch) {
      const g = ctx.createRadialGradient(cw/2, ch/2, Math.min(cw,ch)*0.35, cw/2, ch/2, Math.max(cw,ch)*0.75);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.35)');
      vignetteCache = g; vigW = cw; vigH = ch;
    }
    ctx.fillStyle = vignetteCache; ctx.fillRect(0, 0, cw, ch);
  }

  /* ---------- cesty ---------- */

  /** Je na dlaždici cesta? */
  function roadAt(x, y) {
    const r = G.WORLD && G.WORLD.roads;
    if (!r) return false;
    return r.has(x + ',' + y) || G.WORLD.terrainAt(x, y) === 'road';
  }
  /** Do kterých stran z dlaždice cesta pokračuje (jen ortogonálně — bez úhlopříček). */
  G.roadLinks = function (x, y) {
    const out = [];
    if (roadAt(x + 1, y)) out.push([1, 0]);
    if (roadAt(x - 1, y)) out.push([-1, 0]);
    if (roadAt(x, y + 1)) out.push([0, 1]);
    if (roadAt(x, y - 1)) out.push([0, -1]);
    return out;
  };

  /** Cesta = spojité pruhy od středu k hranám; bez šumu, jen dvě vrstvy barvy. */
  function drawRoads(ox, oy, tilePx, x0, x1, y0, y1) {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (x < 0 || y < 0 || x >= G.WORLD.w || y >= G.WORLD.h) continue;
        if (!roadAt(x, y)) continue;
        const links = G.roadLinks(x, y);
        const cx = ox + (x + 0.5)*tilePx, cy = oy + (y + 0.5)*tilePx;
        if (!links.length) {
          // osamocená dlaždice (např. okraj štětce) — jen zem
          ctx.fillStyle = G.PAL.road.base;
          ctx.beginPath(); ctx.arc(cx, cy, tilePx*0.28, 0, Math.PI*2); ctx.fill();
          continue;
        }
        const seg = () => {
          ctx.beginPath(); ctx.moveTo(cx, cy);
          for (const [dx, dy] of links) ctx.lineTo(cx + dx*tilePx*0.5, cy + dy*tilePx*0.5);
        };
        ctx.lineCap = 'butt';
        ctx.strokeStyle = '#51483a'; ctx.lineWidth = tilePx*0.46; seg(); ctx.stroke();
        ctx.strokeStyle = '#776a51'; ctx.lineWidth = tilePx*0.34; seg(); ctx.stroke();
      }
    }
  }

  function drawBase(ox, oy, tilePx) {
    const bp = G.basePos ? G.basePos() : G.BASE_POS;
    const bx = ox + (bp.x + 0.5)*tilePx;
    const by = oy + (bp.y + 0.5)*tilePx;
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

  /** Duch základny na doporučeném místě při výběru polohy. */
  function drawGhostBase(ox, oy, tilePx, gx, gy) {
    const cx = ox + (gx + 0.5)*tilePx, cy = oy + (gy + 0.5)*tilePx;
    const pulse = 0.5 + 0.5 * Math.sin(performance.now()/320);
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#1b1a17';
    ctx.beginPath(); ctx.ellipse(cx, cy, tilePx*0.62 + pulse*2, tilePx*0.62 + pulse*2, 0, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 0.9;
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = 'rgba(143,191,122,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, tilePx*0.58 + pulse*2, 0, Math.PI*2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = (tilePx*0.5) + 'px serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🏕️', cx, cy);
    ctx.font = 'bold ' + Math.max(9, tilePx*0.17) + 'px sans-serif';
    ctx.fillStyle = 'rgba(143,191,122,0.95)';
    ctx.fillText('doporučeno', cx, cy + tilePx*0.82);
    ctx.restore();
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

  /** Jak široko se sídlo rozlézá (násobek půdorysu) a jak silné má hradby. */
  const SETTLEMENT_SPREAD = { village: 1.0, town: 1.5, city: 2.1 };
  const SETTLEMENT_WALL = { village: 0, town: 1.75, city: 2.45 };
  G.settlementSpread = function (size) { return SETTLEMENT_SPREAD[size] || 1; };

  function drawSettlement(s, ox, oy, tilePx) {
    const list = buildingLayout(s);
    const cx = s.x + 0.5, cy = s.y + 0.5;
    const pal = G.PAL_BUILDING[s.size] || G.PAL_BUILDING.village;
    const px = ox + cx*tilePx, py = oy + cy*tilePx;
    ctx.globalAlpha = 0.22; ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(px, py + tilePx*0.45, tilePx*(1.6 * G.settlementSpread(s.size)), tilePx*0.55, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.globalAlpha = 1;
    drawSettlementWall(px, py, tilePx, s.size);
    const sorted = list.slice().sort((a, b) => a.dy - b.dy);
    for (const b of sorted) drawHouse(ox + (cx + b.dx)*tilePx, oy + (cy + b.dy)*tilePx, b.w*tilePx, b.h*tilePx, pal, b.seed);
    drawSettlementProps(s, px, py, tilePx);
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

  /** Vizuální specializace sídla: těžní věž, pila, silo, stánky… */
  function drawSettlementProps(s, px, py, tilePx) {
    const spec = s.spec;
    if (spec === 'mining') {
      // těžní věž na severu
      const x = px, y = py - tilePx * 1.15;
      ctx.strokeStyle = '#3a332a'; ctx.lineWidth = Math.max(1.5, tilePx * 0.06);
      ctx.beginPath();
      ctx.moveTo(x - tilePx * 0.24, y + tilePx * 0.30); ctx.lineTo(x - tilePx * 0.24, y - tilePx * 0.28);
      ctx.lineTo(x - tilePx * 0.05, y - tilePx * 0.62); ctx.lineTo(x + tilePx * 0.24, y - tilePx * 0.28);
      ctx.lineTo(x + tilePx * 0.24, y + tilePx * 0.30); ctx.closePath(); ctx.stroke();
      ctx.strokeStyle = '#4a3a2a'; ctx.lineWidth = Math.max(1, tilePx * 0.04);
      ctx.beginPath(); ctx.moveTo(x, y - tilePx * 0.62); ctx.lineTo(x, y - tilePx * 0.05); ctx.stroke();
      ctx.fillStyle = '#6d5b45';
      ctx.beginPath(); ctx.arc(x, y - tilePx * 0.02, tilePx * 0.10, 0, Math.PI * 2); ctx.fill();
      // haldy rudy
      for (let i = 0; i < 3; i++) {
        const hx = px + (i - 1) * tilePx * 0.85, hy = py + tilePx * 0.55;
        ctx.fillStyle = i % 2 ? '#6f6a60' : '#7a6f5a';
        ctx.beginPath(); ctx.ellipse(hx, hy, tilePx * 0.28, tilePx * 0.15, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#8a8175';
        ctx.beginPath(); ctx.arc(hx + tilePx * 0.1, hy - tilePx * 0.06, tilePx * 0.05, 0, Math.PI * 2); ctx.fill();
      }
    } else if (spec === 'forestry') {
      // kruhová pila
      const sx = px + tilePx * 0.95, sy = py - tilePx * 0.55;
      ctx.strokeStyle = '#8a8a92'; ctx.lineWidth = Math.max(1, tilePx * 0.05);
      ctx.beginPath(); ctx.arc(sx, sy, tilePx * 0.28, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#5d6b7a'; ctx.beginPath(); ctx.arc(sx, sy, tilePx * 0.06, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#4a3a28'; ctx.lineWidth = Math.max(1, tilePx * 0.05);
      ctx.beginPath(); ctx.moveTo(sx, sy + tilePx * 0.28); ctx.lineTo(sx, sy + tilePx * 0.48); ctx.stroke();
      // skládané klády
      for (let i = 0; i < 3; i++) {
        const lx = px + (i - 1) * tilePx * 0.8, ly = py + tilePx * 0.55;
        ctx.strokeStyle = '#6a523a'; ctx.lineWidth = tilePx * 0.13; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(lx - tilePx * 0.3, ly); ctx.lineTo(lx + tilePx * 0.3, ly); ctx.stroke();
        ctx.fillStyle = '#c9a06a';
        ctx.beginPath(); ctx.arc(lx - tilePx * 0.3, ly, tilePx * 0.065, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(lx + tilePx * 0.3, ly, tilePx * 0.065, 0, Math.PI * 2); ctx.fill();
      }
    } else if (spec === 'farming') {
      // silo
      const x = px - tilePx * 1.05, y = py;
      ctx.fillStyle = '#9c8b6f'; ctx.fillRect(x - tilePx * 0.22, y - tilePx * 0.68, tilePx * 0.44, tilePx * 0.68);
      ctx.fillStyle = '#8a6a44';
      ctx.beginPath(); ctx.moveTo(x - tilePx * 0.22, y - tilePx * 0.68); ctx.lineTo(x, y - tilePx * 1.0); ctx.lineTo(x + tilePx * 0.22, y - tilePx * 0.68); ctx.closePath(); ctx.fill();
      // stohy sena
      for (let i = 0; i < 2; i++) {
        const hx = px + tilePx * (0.3 + i * 0.6), hy = py + tilePx * 0.52;
        ctx.fillStyle = '#c9a94e';
        ctx.beginPath(); ctx.ellipse(hx, hy, tilePx * 0.24, tilePx * 0.18, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#8a7332'; ctx.lineWidth = 1;
        for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(hx - tilePx * 0.2 + k * tilePx * 0.2, hy + tilePx * 0.16); ctx.lineTo(hx - tilePx * 0.2 + k * tilePx * 0.2, hy + tilePx * 0.26); ctx.stroke(); }
      }
    } else if (spec === 'trade') {
      // stánky s plachtou
      for (let i = 0; i < 2; i++) {
        const x = px + (i - 0.5) * tilePx * 1.4, y = py + tilePx * 0.42;
        ctx.fillStyle = '#7a6a50';
        ctx.fillRect(x - tilePx * 0.30, y - tilePx * 0.08, tilePx * 0.60, tilePx * 0.38);
        ctx.fillStyle = i ? '#6d4a35' : '#7a3f32';
        ctx.beginPath(); ctx.moveTo(x - tilePx * 0.38, y - tilePx * 0.08); ctx.lineTo(x, y - tilePx * 0.50); ctx.lineTo(x + tilePx * 0.38, y - tilePx * 0.08); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#3a3128'; ctx.lineWidth = 1; ctx.stroke();
      }
      // vůz
      const wx = px + tilePx * 1.0, wy = py + tilePx * 0.45;
      ctx.fillStyle = '#5d4a34';
      ctx.fillRect(wx - tilePx * 0.28, wy - tilePx * 0.08, tilePx * 0.56, tilePx * 0.30);
      ctx.fillStyle = '#2a2318';
      ctx.beginPath(); ctx.arc(wx - tilePx * 0.22, wy + tilePx * 0.24, tilePx * 0.12, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(wx + tilePx * 0.22, wy + tilePx * 0.24, tilePx * 0.12, 0, Math.PI * 2); ctx.fill();
    }
  }

  /** Hradby / palisáda kolem větších sídel + věže u metropole. */
  function drawSettlementWall(px, py, tilePx, size) {
    const r = SETTLEMENT_WALL[size] || 0;
    if (!r) return;
    const rr = r * tilePx, ry = rr * 0.72;
    const stone = size === 'city';
    ctx.save();
    // základ hradby
    ctx.strokeStyle = stone ? '#6f6659' : G.PAL_WOOD;
    ctx.lineWidth = Math.max(2.5, tilePx*0.10);
    ctx.globalAlpha = 0.95;
    ctx.beginPath(); ctx.ellipse(px, py, rr, ry, 0, 0, Math.PI*2); ctx.stroke();
    // kolíky / cimbuří
    const posts = stone ? 22 : 16;
    ctx.lineWidth = 1;
    for (let i = 0; i < posts; i++) {
      const a = (i/posts)*Math.PI*2;
      const qx = px + Math.cos(a)*rr, qy = py + Math.sin(a)*ry;
      const s = tilePx*0.10;
      ctx.fillStyle = stone ? '#8a8175' : '#6a523a';
      ctx.fillRect(qx - s*0.35, qy - s*0.75, s*0.7, s*1.5);
    }
    // brána dole
    ctx.globalAlpha = 1;
    ctx.strokeStyle = stone ? '#4a443b' : '#3f3122';
    ctx.lineWidth = Math.max(3, tilePx*0.14);
    ctx.beginPath(); ctx.moveTo(px - tilePx*0.22, py + ry); ctx.lineTo(px + tilePx*0.22, py + ry); ctx.stroke();
    // věže u metropole
    if (stone) {
      for (const a of [Math.PI*0.25, Math.PI*0.75, Math.PI*1.25, Math.PI*1.75]) {
        const qx = px + Math.cos(a)*rr, qy = py + Math.sin(a)*ry;
        ctx.fillStyle = '#7d7365';
        ctx.beginPath(); ctx.arc(qx, qy, tilePx*0.20, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = palRoof(size);
        ctx.beginPath();
        ctx.moveTo(qx, qy - tilePx*0.42); ctx.lineTo(qx + tilePx*0.22, qy - tilePx*0.10);
        ctx.lineTo(qx - tilePx*0.22, qy - tilePx*0.10); ctx.closePath(); ctx.fill();
      }
    }
    ctx.restore();
  }
  function palRoof(size) {
    const pal = G.PAL_BUILDING[size] || G.PAL_BUILDING.town;
    return pal.roofDark;
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
    let tx, ty, rx = tilePx*0.60, ry = tilePx*0.60;
    if (sel.type === 'node') {
      const n = G.WORLD.nodes.find(x => x.id === sel.id); if (!n) return;
      const tiles = G.nodeTiles(n);
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const t of tiles) { minX = Math.min(minX, t[0]); maxX = Math.max(maxX, t[0]); minY = Math.min(minY, t[1]); maxY = Math.max(maxY, t[1]); }
      tx = (minX + maxX + 1) * 0.5; ty = (minY + maxY + 1) * 0.5;
      rx = tilePx * ((maxX - minX + 1) * 0.5 + 0.12);
      ry = tilePx * ((maxY - minY + 1) * 0.5 + 0.10);
    } else if (sel.type === 'settlement') {
      const s = G.WORLD.settlementById[sel.id]; if (!s) return;
      tx = s.x + 0.5; ty = s.y + 0.5;
      const sp = G.settlementSpread ? G.settlementSpread(s.size) : 1;   // kroužek kopíruje velikost sídla
      rx = tilePx*(0.55 + (sp - 1)*0.55);
      ry = tilePx*(0.50 + (sp - 1)*0.38);
    } else if (sel.type === 'base') {
      const bp = G.basePos ? G.basePos() : G.BASE_POS;
      tx = bp.x + 0.5; ty = bp.y + 0.5;
      rx = tilePx*0.72; ry = tilePx*0.50;
    }
    else return;
    const x = ox + tx*tilePx, y = oy + ty*tilePx;
    const pulse = 0.5 + 0.5 * Math.sin(performance.now()/350);
    ctx.strokeStyle = 'rgba(216,180,90,' + (0.45 + pulse*0.45) + ')';
    ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.ellipse(x, y, rx + pulse*2, ry + pulse*2, 0, 0, Math.PI*2); ctx.stroke();
    ctx.strokeStyle = 'rgba(216,180,90,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(x, y, rx*1.22 + pulse*3, ry*1.22 + pulse*3, 0, 0, Math.PI*2); ctx.stroke();
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
    const spread = G.settlementSpread(s.size);
    const arr = [];
    for (let i = 0; i < count; i++) {
      const a = rnd()*Math.PI*2;
      const r = (0.40 + rnd()*1.05) * spread;
      arr.push({
        dx: Math.cos(a)*r, dy: Math.sin(a)*r*0.78,
        w: (0.55 + rnd()*0.35) * (1 + (spread - 1)*0.30),
        h: (0.55 + rnd()*0.35) * (1 + (spread - 1)*0.30),
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
