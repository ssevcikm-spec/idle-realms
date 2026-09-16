(function () {
  const G = window.Game;

  const TAB_STRUCTURE = {
    world:   { label:'Svět',     icon:'🗺️', subs:[
      { id:'place',      label:'Místo',  icon:'📍' },
      { id:'activities', label:'Práce',  icon:'⚒️' }
    ]},
    people:  { label:'Lidé',     icon:'👥', subs:[
      { id:'units',       label:'Postavy',  icon:'🧙' },
      { id:'groups',      label:'Skupiny',  icon:'👥' },
      { id:'expeditions', label:'Expedice', icon:'⛵' }
    ]},
    craft:   { label:'Řemeslo',  icon:'⚒️', subs:[
      { id:'craft',     label:'Výroba', icon:'🔨' },
      { id:'inventory', label:'Batoh',  icon:'🎒' }
    ]},
    economy: { label:'Obchod',   icon:'💰', subs:[
      { id:'trade',      label:'Obchodníci', icon:'🐎' },
      { id:'reputation', label:'Vztahy',     icon:'⭐' },
      { id:'politics',   label:'Politika',   icon:'🏛️' }
    ]},
    more:    { label:'Více',     icon:'📜', subs:[
      { id:'log',          label:'Log',     icon:'📜' },
      { id:'achievements', label:'Cíle',    icon:'🏆' },
      { id:'prestige',     label:'Prestiž', icon:'🌟' }
    ]}
  };
  const SUB_TO_PARENT = {};
  for (const parentId in TAB_STRUCTURE) {
    for (const sub of TAB_STRUCTURE[parentId].subs) SUB_TO_PARENT[sub.id] = parentId;
  }

  let activeParent = 'world';
  let activeSub = 'place';
  let modal = null;
  let pendingAssign = null;
  let pickedExpedition = null;
  let pickedPrestigeUnlock = null;

  function captureDetailsState() {
    const states = [];
    const root = document.getElementById('panel-content');
    if (!root) return states;
    root.querySelectorAll('details').forEach(d => states.push(d.open));
    return states;
  }
  function restoreDetailsState(states) {
    const root = document.getElementById('panel-content');
    if (!root) return;
    root.querySelectorAll('details').forEach((d, i) => {
      if (states[i]) d.setAttribute('open', '');
      else d.removeAttribute('open');
    });
  }

  G.initUI = function () {
    if (G._uiInited) {   // opětovné spuštění (nová hra z menu) — jen překresli
      lastPanelHtml = null;
      render(); renderHud();
      return;
    }
    G._uiInited = true;
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const parentId = btn.dataset.tab;
        if (!TAB_STRUCTURE[parentId]) return;
        activeParent = parentId;
        activeSub = TAB_STRUCTURE[parentId].subs[0].id;
        if (G.setPanelCollapsed) G.setPanelCollapsed(false);
        render();
      });
    });

    const subtabsEl = document.getElementById('subtabs');
    subtabsEl.addEventListener('click', e => {
      const btn = e.target.closest('.subtab-btn');
      if (!btn) return;
      activeSub = btn.dataset.sub;
      render();
    });

    const content = document.getElementById('panel-content');
    content.addEventListener('click', e => {
      const el = e.target.closest('[data-action]'); if (!el) return;
      handleAction(el.dataset.action, el.dataset);
    });
    content.addEventListener('input', e => {
      if (e.target && e.target.id === 'log-search') {
        G.state.logSearch = e.target.value;
        if (G.renderLog) G.renderLog();
        return;
      }
      const el = e.target.closest('input[data-qty-key]');
      if (!el) return;
      const v = parseInt(el.value, 10);
      if (!isFinite(v)) return;
      const max = parseInt(el.dataset.qtyMax, 10) || 500;
      const v2 = Math.max(1, Math.min(max, v));
      G.qtySet(el.dataset.qtyKey, v2);
      applyQtySideEffect(el.dataset.qtyKey, v2);
    });
    content.addEventListener('change', e => {
      const el = e.target.closest('[data-change]'); if (!el) return;
      handleChange(el.dataset.change, el.dataset, el.value);
    });
    content.addEventListener('click', e => {
      const el = e.target.closest('[data-log-filter]');
      if (!el) return;
      G.state.logFilter = el.dataset.logFilter;
      render();
    });

    const modalRoot = document.getElementById('modal-root');
    modalRoot.addEventListener('click', e => {
      const choice = e.target.closest('[data-choice]');
      if (choice) { G.resolveEvent(choice.dataset.event, parseInt(choice.dataset.choice, 10)); return; }
      const story = e.target.closest('[data-story-choice]');
      if (story) { G.resolveStory(parseInt(story.dataset.storyChoice, 10)); return; }
      const routeToggle = e.target.closest('[data-action="toggle-route"]');
      if (routeToggle) {
        const cur = routeToggle.dataset.selected === 'true';
        routeToggle.dataset.selected = cur ? 'false' : 'true';
        routeToggle.classList.toggle('selected', !cur);
        return;
      }
      const memberToggle = e.target.closest('[data-action="toggle-exp-member"]');
      if (memberToggle) {
        const cur = memberToggle.dataset.selected === 'true';
        memberToggle.dataset.selected = cur ? 'false' : 'true';
        memberToggle.classList.toggle('selected', !cur);
        updateExpCounter();
        return;
      }
      const expPick = e.target.closest('[data-action="select-expedition"]');
      if (expPick) {
        pickedExpedition = expPick.dataset.expedition;
        modalRoot.querySelectorAll('.expedition-pick').forEach(b => b.classList.remove('selected'));
        expPick.classList.add('selected');
        updateExpCounter();
        return;
      }
      const prestigePick = e.target.closest('[data-action="select-prestige-unlock"]');
      if (prestigePick) {
        pickedPrestigeUnlock = prestigePick.dataset.unlock;
        modalRoot.querySelectorAll('.unlock-pick').forEach(b => b.classList.remove('selected'));
        prestigePick.classList.add('selected');
        return;
      }
      const act = e.target.closest('[data-action]');
      if (act) handleAction(act.dataset.action, act.dataset);
    });
    const hint = document.getElementById('map-hint');
    if (hint) {
      const canvas = document.getElementById('world');
      if (canvas) canvas.addEventListener('pointerdown', () => hint.classList.add('hide'), { once: true });
    }

    // Tlačítko menu na hlavní liště (uložit / nová hra / obtížnost)
    const menuBtn = document.getElementById('hud-menu');
    if (menuBtn) menuBtn.addEventListener('click', () => { if (G.openGameMenu) G.openGameMenu(); });
    window.addEventListener('keydown', e => {
      if (e.key === 'Escape' && G.isGameMenuOpen && G.isGameMenuOpen()) { if (G.closeGameMenu) G.closeGameMenu(); }
    });

    // Přehled surovin: sbalení/rozbalení + odkaz do batohu
    const matsToggle = document.getElementById('mats-toggle');
    if (matsToggle) matsToggle.addEventListener('click', toggleMatsBar);
    const matsScroll = document.getElementById('mats-scroll');
    if (matsScroll) matsScroll.addEventListener('click', e => {
      if (e.target.closest('[data-mats="inventory"]')) G.selectTab('inventory');
    });
    const matsBar = document.getElementById('hud-mats');
    if (matsBar) matsBar.addEventListener('click', e => {
      if (e.target.closest('.mat-chip') || e.target.closest('.mats-toggle')) return;
      toggleMatsBar();   // ťuknutí na prázdné místo lišty ji sbalí/rozbalí
    });
    applyMatsBar();

    render(); renderHud();
    setInterval(renderHud, 400);
    setInterval(autoRefresh, 1000);
  };

  G.selectTab = function (subId) {
    if (!SUB_TO_PARENT[subId]) return;
    activeSub = subId;
    activeParent = SUB_TO_PARENT[subId];
    render();
  };
  /** Vynutí překreslení panelu i když je HTML stejné (změna stavu mimo panel). */
  G.refreshPanel = function () { lastPanelHtml = null; render(); };
  G.getActiveTab = function () { return activeSub; };
  G.getActiveParentTab = function () { return activeParent; };

  function autoRefresh() {
    const ae = document.activeElement;
    if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'SELECT' || ae.tagName === 'TEXTAREA')) return;
    if (modal) return;
    if (document.hidden) return;
    const app = document.getElementById('app');
    if (app && app.classList && app.classList.contains && app.classList.contains('panel-collapsed')) return;
    render();
  }

  /* ---------- plovoucí hlášky (toast) ---------- */
  G.toast = function (text, kind) {
    const root = document.getElementById('toast-root');
    if (!root || !text) return;
    const el = document.createElement('div');
    el.className = 'toast' + (kind ? ' toast-' + kind : '');
    el.textContent = text;
    root.appendChild(el);
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => { if (el.remove) el.remove(); }, 400);
    }, 6000);
    // drž nejvýš 3 hlášky
    while (root.children && root.children.length > 3) {
      const first = root.children[0];
      if (first && first.remove) first.remove(); else break;
    }
  };

  /* ---------- horní lišta: přehled surovin + tlačítko menu ---------- */

  /** Kanonické pořadí surovin v liště (obchodované napřed). */
  function hudMatOrder() {
    const traded = G.TRADED || [];
    const rest = Object.keys(G.MATERIALS).filter(m => traded.indexOf(m) === -1 && !G.MATERIALS[m].currency);
    return traded.concat(rest);
  }
  function matQualityTitle(mid) {
    const m = (G.state.materials || {})[mid];
    if (!m) return '';
    const parts = [];
    for (const q in m) if (m[q] > 0) parts.push(`${G.QUALITY_LABEL[q] || q} ${m[q]}`);
    return parts.length > 1 ? ' — ' + parts.join(', ') : '';
  }
  /** HTML obsahu lišty se surovinami (jen to, co hráč skutečně má). */
  G.hudMaterialsHtml = function () {
    const chips = [];
    for (const mid of hudMatOrder()) {
      const def = G.MATERIALS[mid];
      if (!def) continue;
      const n = G.matCount(mid);
      if (n <= 0) continue;
      chips.push(`<span class="mat-chip" title="${G.esc(def.name)}${G.esc(matQualityTitle(mid))}">${def.icon}<b>${n}</b></span>`);
      if (chips.length >= 26) break;
    }
    for (const gid in G.GEMS) {
      const n = G.matCount('gem_' + gid);
      if (n > 0) chips.push(`<span class="mat-chip" title="${G.esc(G.GEMS[gid].name)} (gem)">${G.GEMS[gid].icon}<b>${n}</b></span>`);
    }
    return chips.join('');
  };
  G.hudMaterialKinds = function () {
    let n = 0;
    for (const mid in G.MATERIALS) if (G.matCount(mid) > 0) n++;
    for (const gid in G.GEMS) if (G.matCount('gem_' + gid) > 0) n++;
    return n;
  };

  function matsBarOpen() {
    const s = G.state.settings || {};
    if (s.matsBar === true || s.matsBar === false) return s.matsBar;
    return (window.innerWidth || 1024) >= 900;   // auto: na desktopu rovnou otevřeno
  }
  function applyMatsBar() {
    const el = document.getElementById('hud-mats');
    if (!el) return;
    const open = matsBarOpen();
    el.classList.toggle('collapsed', !open);
    const btn = document.getElementById('mats-toggle');
    if (btn) { btn.textContent = open ? '▾' : '▸'; btn.title = open ? 'Sbalit přehled surovin' : 'Rozbalit přehled surovin'; }
    renderMatsBar();
  }
  function toggleMatsBar() {
    const next = !matsBarOpen();
    if (!G.state.settings) G.state.settings = {};
    G.state.settings.matsBar = next;
    applyMatsBar();
  }
  function renderMatsBar() {
    const scroll = document.getElementById('mats-scroll');
    const summary = document.getElementById('mats-summary');
    if (!scroll) return;
    const html = G.hudMaterialsHtml();
    if (scroll._sig !== html) {
      scroll._sig = html;
      const keep = scroll.scrollLeft;
      scroll.innerHTML = html + (html ? '<button class="mat-chip mat-more" data-mats="inventory" title="Otevřít batoh">🎒 vše</button>' : '');
      scroll.scrollLeft = keep;
    }
    if (summary) summary.textContent = `🎒 ${G.hudMaterialKinds()} druhů surovin`;
  }
  G.applyMatsBar = applyMatsBar;

  function renderHud() {
    if (!G.state) return;
    setText('hud-time', formatTime(G.state.time));
    setText('hud-gold', Math.floor(G.state.resources.gold).toLocaleString('cs-CZ'));
    setText('hud-renown', Math.floor(G.state.resources.renown));
    const alive = G.state.units.filter(u => !u.dead).length;
    setText('hud-units', alive);
    const lvl = (G.state.prestige && G.state.prestige.level) || 0;
    const pEl = document.getElementById('hud-prestige');
    if (pEl) {
      if (lvl > 0) { pEl.style.display = 'inline-flex'; pEl.title = `Prestiž ${lvl}`; pEl.textContent = '⭐' + lvl; }
      else pEl.style.display = 'none';
    }
    renderMatsBar();
    const ordersBadge = document.getElementById('tab-badge-orders');
    if (ordersBadge) {
      const n = (G.state.orders || []).length;
      if (n > 0) { ordersBadge.style.display = 'inline-block'; ordersBadge.textContent = n; ordersBadge.title = `${n}× příkaz ve frontě`; }
      else ordersBadge.style.display = 'none';
    }
    const season = G.seasonInfo ? G.seasonInfo() : null;
    const phase = G.phaseInfo ? G.phaseInfo() : null;
    const sel = G.state.selected;
    let label = 'Divočina';
    if (sel && sel.type === 'settlement') { const s = G.WORLD.settlementById[sel.id]; label = s ? s.name : 'Divočina'; }
    else if (sel && sel.type === 'node') { const n = G.WORLD.nodes.find(x => x.id === sel.id); label = n ? G.NODE_KINDS[n.kind].name : 'Divočina'; }
    else if (sel && sel.type === 'base') label = 'Základna';
    if (season && phase) label = `${season.icon} ${phase.icon} ${label}`;
    setText('hud-place', label);

    const weBar = document.getElementById('we-bar');
    if (weBar) {
      const evs = G.state.worldEvents || [];
      const expeds = G.expeditionList ? G.expeditionList() : [];
      const parts = [];
      if (season) parts.push(`<span class="we-chip" style="border-color:${season.color};color:${season.color}">${season.icon} ${G.esc(season.name)} (den ${(G.state.day||0)+1}/${G.TIME.daysPerSeason})</span>`);
      if (phase) parts.push(`<span class="we-chip" style="border-color:${phase.color};color:${phase.color}">${phase.icon} ${G.esc(phase.name)}</span>`);
      for (const ev of evs) {
        const tpl = G.WORLD_EVENTS[ev.templateId]; if (!tpl) continue;
        const left = G.worldEventTimeLeft(ev);
        parts.push(`<span class="we-chip" style="border-color:${tpl.color};color:${tpl.color}" title="${G.esc(tpl.desc)}">${tpl.icon} ${G.esc(tpl.name)} <small>${formatShort(left)}</small></span>`);
      }
      if (expeds.length) {
        const active = expeds.filter(e => !e.outcome).length;
        if (active > 0) parts.push(`<span class="we-chip" style="border-color:#7aa8e0;color:#7aa8e0">⛵ ${active} expedice</span>`);
      }
      if (!parts.length) weBar.style.display = 'none';
      else { weBar.style.display = 'flex'; weBar.innerHTML = parts.join(''); }
    }
  }
  function formatShort(s) {
    s = Math.max(0, Math.floor(s));
    const h = Math.floor(s/3600), m = Math.floor((s%3600)/60);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m`;
    return `${s}s`;
  }
  function setText(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }
  function formatTime(t) {
    const h = Math.floor(t/3600), m = Math.floor((t%3600)/60), s = Math.floor(t%60);
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function renderSubtabs() {
    const el = document.getElementById('subtabs');
    if (!el) return;
    const parent = TAB_STRUCTURE[activeParent];
    if (!parent) { el.innerHTML = ''; return; }
    el.innerHTML = parent.subs.map(s => {
      const active = s.id === activeSub ? ' active' : '';
      return `<button class="subtab-btn${active}" data-sub="${s.id}">
        <span class="subtab-icon">${s.icon}</span><span>${G.esc(s.label)}</span>
      </button>`;
    }).join('');
  }

  /* Překreslujeme jen když se obsah skutečně změní — stejný HTML řetězec znamená
     žádný innerHTML, takže si DOM drží identitu (fokus, rozepsané hodnoty, scroll). */
  let lastPanelHtml = null;

  function buildPanelHtml() {
    switch (activeSub) {
      case 'place':        return G.panelPlace();
      case 'activities':   return G.panelActivities();
      case 'units':        return G.panelUnits();
      case 'groups':       return G.panelGroups();
      case 'expeditions':  return G.panelExpeditions();
      case 'craft':        return G.panelCraft();
      case 'inventory':    return G.panelInventory();
      case 'trade':        return G.panelMerchant();
      case 'reputation':   return G.panelReputation();
      case 'politics':     return G.panelPolitics();
      case 'log':          return G.panelLog();
      case 'achievements': return G.panelAchievements();
      case 'prestige':     return G.panelPrestige();
      default:             return `<div class="empty">Neznámý panel: ${G.esc(activeSub)}</div>`;
    }
  }

  function renderPanelContent() {
    const el = document.getElementById('panel-content');
    if (!el) return;
    const html = buildPanelHtml();
    if (html === lastPanelHtml) {
      if (activeSub === 'log' && G.renderLog) G.renderLog();
      return;
    }
    lastPanelHtml = html;
    el.innerHTML = html;
    if (activeSub === 'log' && G.renderLog) G.renderLog();
  }

  function render() {
    if (!G.state) return;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === activeParent));
    const panel = document.getElementById('panel');
    const scrollTop = panel ? panel.scrollTop : 0;
    const detailsState = captureDetailsState();
    renderSubtabs();
    renderPanelContent();
    restoreDetailsState(detailsState);
    if (panel) panel.scrollTop = scrollTop;
    if (activeSub === 'place') renderHud();
  }

  function updateExpCounter() {
    const root = document.getElementById('modal-root');
    if (!root) return;
    const el = root.querySelector('#exp-pick-count');
    if (!el) return;
    const picked = Array.from(root.querySelectorAll('.member-pick.selected')).map(b => b.dataset.unit);
    const n = picked.length;
    const tpl = pickedExpedition ? G.EXPEDITIONS[pickedExpedition] : null;
    const food = tpl && G.expeditionFoodCost ? G.expeditionFoodCost(pickedExpedition, Math.max(1, n)) : 0;
    let chanceTxt = '— vyber expedici';
    if (tpl) {
      const power = picked.reduce((s, id) => {
        const u = G.getUnit(id);
        return s + (u ? G.unitCombatPower(u) + G.unitSkill(u, 'scouting') * 3 : 0);
      }, 0);
      const need = tpl.difficulty * 30;
      const chance = G.clamp(0.30 + (power / Math.max(1, need)) * 0.40, 0.20, 0.95);
      chanceTxt = `${Math.round(chance * 100)} %`;
    }
    const ok = n >= G.EXPEDITION_MIN_PARTY && n <= G.EXPEDITION_MAX_PARTY;
    el.classList.toggle('warn', !ok);
    el.innerHTML = `Vybráno <b>${n}</b> / ${G.EXPEDITION_MIN_PARTY}–${G.EXPEDITION_MAX_PARTY} • 🍞 ${food} jídla • šance ≈ ${chanceTxt}`;
  }

  function openModal(type, unitId) {
    modal = { type, unitId };
    const root = document.getElementById('modal-root');
    let content = '';
    if (type === 'perks') content = G.perkPanel(unitId);
    else if (type === 'mentor') content = G.mentorPanel(unitId);
    else if (type === 'merchant') content = G.merchantPanel(unitId);
    else if (type === 'expedition') { pickedExpedition = null; content = G.expeditionModal(); }
    else if (type === 'prestige') { pickedPrestigeUnlock = null; content = prestigeModal(); }
    else if (type === 'export') content = exportPanel();
    else if (type === 'import') content = importPanel();
    else if (type === 'socket') content = G.socketModal(unitId);
    else if (type === 'task-assign') content = G.taskAssignModal(pendingAssign);
    root.innerHTML = `<div class="modal-backdrop"><div class="modal wide">${content}</div></div>`;
    root.classList.add('show');
  }
  function closeModal() {
    modal = null;
    pendingAssign = null;
    pickedExpedition = null;
    pickedPrestigeUnlock = null;
    const root = document.getElementById('modal-root');
    root.innerHTML = ''; root.classList.remove('show');
    render();
  }

  function prestigeModal() {
    const lvl = (G.state.prestige && G.state.prestige.level) || 0;
    const pool = G.availablePrestigeUnlocks();
    let html = `<div class="perk-panel">
      <div class="perk-header">🌟 Prestiž ${lvl + 1}</div>
      <div class="perk-hint">Vygeneruje nový svět (novou mapu). Vyber si <b>jeden</b> trvalý unlock, který se přenese do dalších her.</div>`;
    if (!pool.length) {
      html += `<div class="empty">Už máš všechny trvalé unlocky.</div>`;
    } else {
      html += `<div class="panel-title">Vyber trvalý unlock</div>`;
      for (const uid of pool) {
        const u = G.UNLOCKS[uid];
        html += `<button class="unlock-pick" data-action="select-prestige-unlock" data-unlock="${uid}" data-selected="false">
          <div class="unlock-pick-head"><span class="unlock-icon">${u.icon}</span> <b>${G.esc(u.name)}</b></div>
          <div class="unlock-pick-desc">${G.esc(u.desc)}</div>
        </button>`;
      }
    }
    html += `<div class="perk-actions">
      <button class="btn" data-action="confirm-prestige">🌟 Přechod do nového světa</button>
      <button class="btn ghost" data-action="close-modal">Zrušit</button>
    </div></div>`;
    return html;
  }

  function exportPanel() {
    const diff = G.currentDifficulty ? G.currentDifficulty() : null;
    if (diff && diff.noExport) {
      return `<div class="perk-panel"><div class="perk-header">🚫 Export zakázán</div><div class="perk-hint">Na obtížnosti <b>${G.esc(diff.name)}</b> nelze ukládat mimo hru.</div><div class="perk-actions"><button class="btn" data-action="close-modal">Zavřít</button></div></div>`;
    }
    const b64 = G.exportSave();
    if (!b64) return `<div class="perk-panel"><div class="perk-header">Export selhal</div><div class="perk-actions"><button class="btn" data-action="close-modal">Zavřít</button></div></div>`;
    return `<div class="perk-panel">
      <div class="perk-header">💾 Export save</div>
      <div class="perk-hint">Zkopíruj celý text a ulož si ho.</div>
      <textarea class="save-textarea" readonly onclick="this.select()">${G.esc(b64)}</textarea>
      <div class="perk-actions">
        <button class="btn" data-action="copy-export">📋 Zkopírovat</button>
        <button class="btn ghost" data-action="close-modal">Zavřít</button>
      </div>
    </div>`;
  }
  function importPanel() {
    return `<div class="perk-panel">
      <div class="perk-header">📥 Import save</div>
      <div class="perk-hint">Vlož text zálohy. <b>Pozor:</b> přepíše aktuální hru!</div>
      <textarea class="save-textarea" id="import-textarea" placeholder="Vlož sem base64 text…"></textarea>
      <div class="perk-actions">
        <button class="btn" data-action="confirm-import">⚠️ Importovat</button>
        <button class="btn ghost" data-action="close-modal">Zrušit</button>
      </div>
    </div>`;
  }

  function handleAction(action, ds) {
    switch (action) {
      case 'qty-step':      return doQtyStep(ds.qtyKey, parseInt(ds.delta, 10) || 0);
      case 'qty-set':       return doQtySet(ds.qtyKey, ds.qtyValue);
      case 'start-task':    return doStartTask(ds.activity, ds.node);
      case 'cancel-task':   return doCancelTask(ds.task);
      case 'assign-task-unit': return doAssignTaskUnit(ds.unit);
      case 'assign-task-all':  return doAssignTaskAll();
      case 'assign-task-group': return doAssignTaskGroup(ds.group);
      case 'queue-task':    return doQueueTask();
      case 'cancel-order':  return doCancelOrder(ds.order);
      case 'order-up':      return doMoveOrder(ds.order, -1);
      case 'order-down':    return doMoveOrder(ds.order, 1);
      case 'wake-all':      return doWakeAll();
      case 'recruit':       return doRecruit();
      case 'create-group':  return doCreateGroup();
      case 'kick':          return doKick(ds.unit);
      case 'rename-group':  return doRenameGroup(ds.group);
      case 'craft':         return doCraft(ds.recipe);
      case 'trade-buy':     return doTrade('buy', ds);
      case 'trade-sell':    return doTrade('sell', ds);
      case 'trade-tab':     return doTradeTab(ds.tab);
      case 'build':         return doBuild(ds.settlement, ds.building);
      case 'build-base':    return doBuildBase(ds.building);
      case 'pick-base-spot': return doPickBaseSpot();
      case 'auto-place-base': return doAutoPlaceBase();
      case 'move-base':     return doMoveBase();
      case 'center-base':   return doCenterBase();
      case 'cancel-base-placement': return doCancelBasePlacement();
      case 'buy-equip':     return doBuyEquip(ds.settlement, ds.item);
      case 'buy-gem':       return doBuyGem(ds.settlement, ds.gem);
      case 'sell-equip':    return doSellEquip(ds.item);
      case 'unequip':       return doUnequip(ds.unit, ds.slot);
      case 'rest':          return doRest(ds.unit);
      case 'wake':          return doWake(ds.unit);
      case 'toggle-manual': return doToggleManual(ds.unit);
      case 'heal-all':      return doHealAll(ds.unit);
      case 'resurrect':     return doResurrect(ds.unit);
      case 'quest-accept':  return doQuestAccept(ds.settlement, ds.quest);
      case 'quest-decline': return doQuestDecline(ds.settlement, ds.quest);
      case 'quest-turnin':  return doQuestTurnIn(ds.settlement, ds.quest);
      case 'open-perks':    return openModal('perks', ds.unit);
      case 'open-mentor':   return openModal('mentor', ds.unit);
      case 'open-merchant': return openModal('merchant', ds.unit);
      case 'open-expedition-modal': return openModal('expedition');
      case 'socket-modal': return openModal('socket', ds.item);
      case 'socket-gem': return doSocketGem(ds);
      case 'unsocket-gem': return doUnsocketGem(ds);
      case 'close-modal':   return closeModal();
      case 'pick-perk':     return doPickPerk(ds);
      case 'respec':        return doRespec(ds);
      case 'set-mentor':    return doSetMentor(ds);
      case 'clear-mentor':  return doClearMentor(ds);
      case 'do-prestige':   return openModal('prestige');
      case 'set-merchant-route': return doSetMerchantRoute(ds);
      case 'stop-merchant': return doStopMerchant(ds.unit);
      case 'merchant-instant-trade': return doMerchantInstant(ds.unit);
      case 'set-custom-merchant-route': return doSetCustomMerchantRoute(ds.unit);
      case 'attack-here':   return doAttackHere(ds.node, ds.recommended === '1');
      case 'set-tactic':    return G.setTactic(ds.tactic);
      case 'toggle-auto-abilities': return G.toggleAutoAbilities();
      case 'queue-ability': return doQueueAbility(ds);
      case 'combat-round':  return doCombatRound();
      case 'combat-auto':   return doCombatAuto();
      case 'combat-close':  return doCombatClose();
      case 'export-save':   return openModal('export');
      case 'import-save':   return openModal('import');
      case 'copy-export':   return doCopyExport();
      case 'confirm-import':return doConfirmImport();
      case 'support-candidate': return doSupportCandidate(ds);
      case 'confirm-expedition': return doConfirmExpedition();
      case 'confirm-prestige': return doConfirmPrestige();
      case 'set-directive-focus': return doSetDirectiveFocus(ds.material || null);
      case 'toggle-directive-danger': return doToggleDirectiveDanger();
      case 'skip-tutorial':   return doSkipTutorial();
      case 'new-chapter':     return doNewChapter();
      case 'victory-continue':return doVictoryContinue();
      case 'hardcore-reset':  return doHardcoreReset();
    }
  }

  /* --- ovládání množství: hodnoty drží paměť v panels.js --- */
  function qtyInputEl(key) { return document.querySelector(`input[data-qty-key="${key}"]`); }
  function qtyMaxOf(el) { return (el && parseInt(el.dataset.qtyMax, 10)) || 500; }
  function readQty(key, fallback, max) {
    const el = qtyInputEl(key);
    const raw = (el && el.value !== '') ? el.value : G.qtyGet(key, fallback);
    const v = G.qtyClamp(parseInt(raw, 10), max || qtyMaxOf(el));
    if (G.qtySet) G.qtySet(key, v);
    return v;
  }
  function doQtyStep(key, delta) {
    if (!key || !delta) return;
    const el = qtyInputEl(key);
    const max = qtyMaxOf(el);
    const cur = readQty(key, 1, max);
    const next = G.qtyClamp(cur + delta, max);
    G.qtySet(key, next);
    if (el) el.value = next;
    applyQtySideEffect(key, next);
  }
  function doQtySet(key, value) {
    if (!key) return;
    const el = qtyInputEl(key);
    const max = qtyMaxOf(el);
    const next = (value === 'max') ? max : G.qtyClamp(parseInt(value, 10), max);
    G.qtySet(key, next);
    if (el) el.value = next;
    applyQtySideEffect(key, next);
  }
  /** Hodnoty, které kromě paměti patří i do stavu hry. */
  function applyQtySideEffect(key, value) {
    if (key === 'directive:target' && G.setDirective) G.setDirective('focusTarget', value);
  }
  function doMoveOrder(orderId, dir) {
    if (G.moveOrder) G.moveOrder(orderId, dir);
    render();
  }
  function doWakeAll() {
    if (!G.wakeAllUnits) return;
    const n = G.wakeAllUnits();
    if (n) G.log(`☀️ Probuzeno ${n} postav — vracejí se k práci (i s nižší výdrží).`, 'social');
    render();
  }

  function doSocketGem(ds) {
    const res = G.socketGem(ds.item, ds.gem);
    if (!res.ok) G.log('⚠️ ' + res.reason, 'info');
    if (modal) openModal('socket', ds.item); else render();
  }
  function doUnsocketGem(ds) {
    const idx = parseInt(ds.index, 10);
    const res = G.unsocketGem(ds.item, idx);
    if (!res.ok) G.log('⚠️ ' + res.reason, 'info');
    if (modal) openModal('socket', ds.item); else render();
  }

  function handleChange(change, ds, value) {
    if (change === 'group-focus') {
      const g = G.getGroup(ds.group);
      if (g) g.focus = value || null;
      render();
    } else if (change === 'add-to-group') {
      if (value) { G.addUnitToGroup(value, ds.group); render(); }
    } else if (change === 'assign-equip') {
      if (value) {
        const res = G.equipUnit(value, ds.item);
        if (!res.ok) G.log('⚠️ ' + res.reason, 'info');
        render();
      }
    } else if (change === 'prod-order') {
      if (G.setProductionOrder) G.setProductionOrder(ds.material, parseInt(value, 10) || 0);
      render();
    } else if (change === 'unit-task') {
      if (value) { doUnitTask(ds.unit, value); return; }
      render();
    }
  }

  function doSetDirectiveFocus(material) {
    if (G.setDirective) G.setDirective('focusMaterial', material || null);
    render();
  }
  function doToggleDirectiveDanger() {
    if (G.setDirective) G.setDirective('avoidDanger', !(G.getDirective && G.getDirective('avoidDanger')));
    render();
  }
  function doUnitTask(unitId, activityId) {
    const u = G.getUnit(unitId);
    const act = G.ACTIVITIES[activityId];
    if (!u || !act) return render();
    if (u.resting && G.wakeUnit) G.wakeUnit(u);
    const blocked = G.workBlockReason ? G.workBlockReason(u) : null;
    if (blocked) { G.log(`⚠️ ${u.name} teď nemůže pracovat — ${blocked}.`, 'info'); return render(); }
    if (u.assignedTaskId && G.detachUnit) G.detachUnit(unitId);
    const t = G.startTask(activityId, [unitId], { targetQty: act.mode === 'quantity' ? (act.defaultQty || 10) : 1 });
    if (!t) { G.log('⚠️ Není dostupný vhodný uzel pro tuto práci.', 'info'); return render(); }
    G.log(`⚒️ ${u.name} dostal úkol: ${act.name}.`, 'work');
    render();
  }
  function doStartTask(activityId, nodeId) {
    const act = G.ACTIVITIES[activityId]; if (!act) return;
    const targetQty = act.mode === 'quantity' ? readQty('act:' + activityId, act.defaultQty || 10, 500) : 1;
    const idle = idleUnits();
    if (!idle.length) {
      // Žádné volné postavy → nabídni volbu (fronta / přiřadit hned / skupina)
      pendingAssign = { activityId: activityId, nodeId: nodeId || null, targetQty: targetQty };
      openModal('task-assign');
      return;
    }
    const t = G.startTask(activityId, idle.map(u => u.id), { nodeId: nodeId || undefined, targetQty });
    if (!t) { G.log('⚠️ Nenašel se vhodný uzel.', 'info'); return render(); }
    G.log(`⚒️ Zahájen úkol: ${act.name} (${idle.length} postav).`, 'work');
    render();
  }
  /** Volné postavy (nikdo je nepřerušuje). */
  function idleUnits() {
    return G.state.units.filter(u =>
      !u.dead && !u.isChild && !u.onExpedition && !u.assignedTaskId && !u.resting
      && !(G.hasSevereInjury && G.hasSevereInjury(u))
      && !(u.merchantState && u.merchantState.active)
      && !(G.unitRefusesWork && G.unitRefusesWork(u))
      && !(u._refuseUntil && G.state.time < u._refuseUntil));
  }
  /** Explicitní varianta: přeruší autonomní práci a pošle na úkol všechny schopné. */
  function doAssignTaskAll() {
    const pa = pendingAssign;
    const act = pa ? G.ACTIVITIES[pa.activityId] : null;
    if (!pa || !act) return closeModal();
    let freed = 0;
    for (const t of G.state.tasks.slice()) if (t.auto) { G.cancelTask(t.id); freed++; }
    const able = idleUnits();
    if (!able.length) { G.log('⚠️ Nikdo teď nemůže pracovat.', 'info'); return; }
    const t = G.startTask(pa.activityId, able.map(u => u.id), {
      nodeId: pa.nodeId || undefined,
      targetQty: act.mode === 'quantity' ? (pa.targetQty || act.defaultQty || 10) : 1
    });
    if (!t) G.log('⚠️ Nenašel se vhodný uzel pro tuto práci.', 'info');
    else G.log(`⚒️ ${act.name}: přiřazeno ${able.length} postav (přerušeno ${freed} autonomních úkolů).`, 'work');
    pendingAssign = null;
    closeModal();
  }
  /** Přiřadí úkol volným členům skupiny (jejich autonomní práci ukončí). */
  function doAssignTaskGroup(groupId) {
    const pa = pendingAssign;
    const act = pa ? G.ACTIVITIES[pa.activityId] : null;
    const g = G.getGroup(groupId);
    if (!pa || !act || !g) return closeModal();
    for (const u of G.groupMembers(g)) {
      if (!u || !u.assignedTaskId) continue;
      const t = G.state.tasks.find(x => x.id === u.assignedTaskId);
      if (t && t.auto) G.cancelTask(t.id);
    }
    const members = G.groupMembers(g).filter(u => u && !u.dead && !u.isChild && !u.onExpedition
      && !u.assignedTaskId && !u.resting
      && !(G.hasSevereInjury && G.hasSevereInjury(u))
      && !(u.merchantState && u.merchantState.active)
      && !(G.unitRefusesWork && G.unitRefusesWork(u)));
    if (!members.length) { G.log(`⚠️ Ve skupině ${g.name} teď nikdo nemůže pracovat.`, 'info'); return; }
    const t = G.startTask(pa.activityId, members.map(u => u.id), {
      nodeId: pa.nodeId || undefined,
      targetQty: act.mode === 'quantity' ? (pa.targetQty || act.defaultQty || 10) : 1
    });
    if (!t) G.log('⚠️ Nenašel se vhodný uzel pro tuto práci.', 'info');
    else G.log(`👥 ${g.name}: ${act.name} (${members.length} členů).`, 'work');
    pendingAssign = null;
    closeModal();
  }
  function doCancelTask(taskId) { G.cancelTask(taskId); render(); }
  function doAssignTaskUnit(unitId) {
    const pa = pendingAssign; const u = G.getUnit(unitId);
    const act = pa ? G.ACTIVITIES[pa.activityId] : null;
    if (!pa || !u || !act) return closeModal();
    if (u.resting && G.wakeUnit) G.wakeUnit(u);
    const blocked = G.workBlockReason ? G.workBlockReason(u) : null;
    if (blocked) { G.log(`⚠️ ${u.name} teď nemůže pracovat — ${blocked}.`, 'info'); return; }
    if (u.assignedTaskId && G.detachUnit) G.detachUnit(unitId);
    const t = G.startTask(pa.activityId, [unitId], {
      nodeId: pa.nodeId || undefined,
      targetQty: act.mode === 'quantity' ? (pa.targetQty || act.defaultQty || 10) : 1
    });
    if (!t) G.log('⚠️ Není dostupný vhodný uzel pro tuto práci.', 'info');
    else G.log(`⚒️ ${u.name} dostal úkol: ${act.name}.`, 'work');
    pendingAssign = null;
    closeModal();
  }
  function doQueueTask() {
    const pa = pendingAssign;
    const act = pa ? G.ACTIVITIES[pa.activityId] : null;
    if (!pa || !act) return closeModal();
    if (G.addOrder) G.addOrder({ activityId: pa.activityId, nodeId: pa.nodeId, targetQty: pa.targetQty || null });
    const qtyTxt = act.mode === 'quantity' && pa.targetQty ? ` (${pa.targetQty}×)` : '';
    G.log(`📋 Do fronty: ${act.name}${qtyTxt} — vyřídí se, až bude někdo volný.`, 'work');
    pendingAssign = null;
    closeModal();
  }
  function doCancelOrder(orderId) { if (G.cancelOrder) G.cancelOrder(orderId); render(); }
  function doToggleManual(unitId) {
    const u = G.getUnit(unitId);
    if (!u) return;
    u.manual = !u.manual;
    G.log(u.manual ? `🎮 ${u.name} je nyní pod manuální kontrolou.` : `🤖 ${u.name} se vrátil k autonomní práci.`, 'info');
    render();
  }
  function doRecruit() {
    const cost = G.recruitCost();
    if (G.state.resources.gold < cost) { G.log('⚠️ Nedostatek zlata.', 'info'); return render(); }
    G.state.resources.gold -= cost;
    const u = G.createUnit(); G.state.units.push(u);
    G.log(`🧙 Najat: ${u.name}.`, 'social');
    render();
  }
  function doCreateGroup() { const g = G.createGroup(); G.log(`👥 Skupina ${g.name}.`, 'social'); render(); }
  function doKick(unitId) {
    const u = G.getUnit(unitId);
    if (!u) return;
    if (!confirm(`Opravdu vyhodit ${u.name} ze skupiny?`)) return;
    G.removeUnitFromGroup(unitId);
    render();
  }
  function doRenameGroup(groupId) {
    const g = G.getGroup(groupId);
    if (!g) return;
    const name = prompt('Nový název skupiny:', g.name);
    if (name == null) return;   // zrušeno
    const res = G.renameGroup ? G.renameGroup(groupId, name) : { ok:false, reason:'renameGroup není k dispozici.' };
    if (!res.ok) G.log('⚠️ ' + res.reason, 'info');
    render();
  }
  function doCraft(recipeId) {
    const r = G.RECIPES[recipeId];
    const max = r && G.maxCraftable ? G.maxCraftable(r) : 1;
    const qty = readQty('recipe:' + recipeId, 1, max);
    const res = G.craft(recipeId, qty);
    if (!res.ok) G.log('⚠️ ' + res.reason, 'info');
    render();
  }
  function doTrade(mode, ds) {
    const sid = ds.settlement, mid = ds.material;
    const qty = readQty('mat:' + mid, 1, 999);
    const res = mode === 'buy' ? G.buyMaterial(sid, mid, qty) : G.sellMaterial(sid, mid, qty);
    if (!res.ok) G.log('⚠️ ' + res.reason, 'info');
    render();
  }
  function doTradeTab(tab) { if (G.setTradeTab) G.setTradeTab(tab); render(); }
  function doBuild(settlementId, buildingId) {
    const res = G.build(settlementId, buildingId);
    if (!res.ok) G.log('⚠️ ' + res.reason, 'info');
    render();
  }
  function doBuildBase(buildingId) {
    const res = G.buildBase(buildingId);
    if (!res.ok) G.log('⚠️ ' + res.reason, 'info');
    render();
  }
  /* --- základna: výběr a přesun místa --- */
  function doPickBaseSpot() {
    if (!G.startBasePlacement) return;
    G.startBasePlacement(false);
    const s = G.baseSuggestion ? G.baseSuggestion() : null;
    if (s && G.centerMapOn) G.centerMapOn(s.x + 0.5, s.y + 0.5);
    if (G.updatePlacementHint) G.updatePlacementHint();
    G.log('🏕️ Ťukni na mapu, kde chceš základnu založit.', 'info');
    render();
  }
  function doAutoPlaceBase() {
    const s = G.baseSuggestion ? G.baseSuggestion() : null;
    if (!s) { G.log('⚠️ Nenašel se vhodný kout pro základnu.', 'info'); return render(); }
    const res = G.placeBaseAt ? G.placeBaseAt(s.x, s.y) : { ok:false, reason:'Základnu teď nelze postavit.' };
    if (!res.ok) G.log('⚠️ ' + res.reason, 'info');
    if (G.updatePlacementHint) G.updatePlacementHint();
    render();
  }
  function doMoveBase() {
    if (!G.canMoveBase || !G.canMoveBase()) { G.log('⚠️ Základnu s postavenými budovami přesunout nelze.', 'info'); return render(); }
    G.startBasePlacement(true);
    if (G.updatePlacementHint) G.updatePlacementHint();
    G.log('🚚 Ťukni na mapu, kam základnu přesunout.', 'info');
    render();
  }
  function doCenterBase() {
    const p = G.basePos ? G.basePos() : null;
    if (p && G.centerMapOn) G.centerMapOn(p.x + 0.5, p.y + 0.5);
    G.state.selected = { type: 'base' };
    render();
  }
  function doCancelBasePlacement() {
    if (G.cancelBasePlacement) G.cancelBasePlacement();
    if (G.updatePlacementHint) G.updatePlacementHint();
    render();
  }
  function doBuyEquip(settlementId, itemId) {
    const res = G.buyEquipment(settlementId, itemId);
    if (!res.ok) G.log('⚠️ ' + res.reason, 'info');
    render();
  }
  function doBuyGem(settlementId, gemId) {
    if (!G.buyGem) return;
    const res = G.buyGem(settlementId, gemId);
    if (!res.ok) G.log('⚠️ ' + res.reason, 'info');
    render();
  }
  function doSellEquip(instanceId) {
    const item = G.equipFind && G.equipFind(instanceId);
    const def = item ? G.EQUIPMENT[item.itemId] : null;
    if (def && !confirm(`Opravdu prodat ${def.name}?`)) return;
    const res = G.sellEquipment(instanceId);
    if (!res.ok) G.log('⚠️ ' + res.reason, 'info');
    render();
  }
  function doUnequip(unitId, slot) { G.unequipUnit(unitId, slot); render(); }
  function doRest(unitId) { const u = G.getUnit(unitId); if (!u) return; G.sendToRest(u, false); render(); }
  function doWake(unitId) { const u = G.getUnit(unitId); if (!u) return; G.wakeUnit(u); render(); }
  function doHealAll(unitId) {
    const u = G.getUnit(unitId);
    if (!u || !u.injuries || !u.injuries.length) return;
    let best = null, bestD = Infinity;
    for (const s of G.WORLD.settlements) {
      const d = Math.hypot(s.x + 0.5 - u.pos.x, s.y + 0.5 - u.pos.y);
      if (d < bestD) { bestD = d; best = s; }
    }
    if (!best || bestD > 4) {
      G.log(best
        ? `⚠️ ${u.name} je příliš daleko od sídla ${best.name} (${bestD.toFixed(1)} polí, max 4).`
        : '⚠️ V dosahu není žádné sídlo.', 'info');
      return render();
    }
    let count = 0;
    const copy = u.injuries.slice();
    for (const inj of copy) {
      const res = G.treatInjury(best.id, u.id, inj.id);
      if (res.ok) count++; else break;
    }
    if (count === 0) G.log('⚠️ Léčení se nezdařilo.', 'info');
    render();
  }
  function doResurrect(unitId) {
    const res = G.resurrect(unitId);
    if (!res.ok) G.log('⚠️ ' + res.reason, 'info');
    render();
  }
  function doQuestAccept(settlementId, questId) {
    const res = G.acceptQuest(settlementId, questId);
    if (!res.ok) G.log('⚠️ ' + res.reason, 'info');
    render();
  }
  function doQuestDecline(settlementId, questId) { G.declineQuest(settlementId, questId); render(); }
  function doQuestTurnIn(settlementId, questId) {
    const res = G.turnInQuest(settlementId, questId);
    if (!res.ok) G.log('⚠️ ' + res.reason, 'info');
    render();
  }
  function doPickPerk(ds) {
    const level = parseInt(ds.level, 10);
    const res = G.pickPerk(ds.unit, ds.skill, level, ds.perk);
    if (!res.ok) G.log('⚠️ ' + res.reason, 'info');
    if (modal) openModal(modal.type, modal.unitId);
  }
  function doRespec(ds) {
    const res = G.respecSkill(ds.unit, ds.skill);
    if (!res.ok) G.log('⚠️ ' + res.reason, 'info');
    if (modal) openModal(modal.type, modal.unitId);
  }
  function doSetMentor(ds) {
    const res = G.setMentor(ds.apprentice, ds.mentor);
    if (!res.ok) G.log('⚠️ ' + res.reason, 'info');
    if (modal) openModal(modal.type, modal.unitId);
  }
  function doClearMentor(ds) {
    G.clearMentor(ds.unit);
    if (modal) openModal(modal.type, modal.unitId);
  }
  function doSetMerchantRoute(ds) {
    const route = JSON.parse(ds.route);
    const res = G.setMerchant(ds.unit, route);
    if (!res.ok) G.log('⚠️ ' + res.reason, 'info');
    else closeModal();
  }
  function doSetCustomMerchantRoute(unitId) {
    const root = document.getElementById('modal-root');
    const picked = Array.from(root.querySelectorAll('.route-pick.selected')).map(el => el.dataset.settlement);
    if (picked.length < 2) { G.log('⚠️ Vyber alespoň 2 sídla.', 'info'); return; }
    const res = G.setMerchant(unitId, picked);
    if (!res.ok) G.log('⚠️ ' + res.reason, 'info');
    else closeModal();
  }
  function doStopMerchant(unitId) {
    const u = G.getUnit(unitId);
    if (u && u.merchantState && u.merchantState.active) {
      if (!confirm(`Opravdu ukončit obchodníka ${u.name}? Rozehraná trasa se zruší.`)) return;
    }
    G.clearMerchant(unitId);
    if (modal) closeModal(); else render();
  }
  function doMerchantInstant(unitId) {
    const res = G.merchantInstantTrade(unitId);
    if (!res.ok) G.log('⚠️ ' + res.reason, 'info');
    if (modal) openModal(modal.type, modal.unitId); else render();
  }
  function doAttackHere(nodeId, recommended) {
    const node = G.WORLD.nodes.find(n => n.id === nodeId); if (!node) return;
    const idle = G.state.units.filter(u => !u.dead && !u.isChild && !u.onExpedition && !u.resting
      && !(G.hasSevereInjury && G.hasSevereInjury(u))
      && !(u.merchantState && u.merchantState.active));
    if (!idle.length) { G.log('⚠️ Žádné volné postavy.', 'info'); return; }
    const party = (recommended && G.recommendParty) ? G.recommendParty(G.nodeDanger(node.kind), idle) : idle;
    G.startCombat(node, party, { tactic:'balanced' });
  }
  function doQueueAbility(ds) { if (G.queueAbility) G.queueAbility(ds.ally, ds.ability); }
  function doCombatRound() { G.combatRound(); }
  function doCombatAuto() {
    const cb = G.state.combat.active; if (!cb) return;
    let guard = 0;
    while (!cb.finished && guard++ < 20) G.combatRound();
  }
  function doCombatClose() { G.closeCombat(); render(); }

  function doSupportCandidate(ds) {
    const res = G.supportCandidate(ds.faction, ds.candidate);
    if (!res.ok) G.log('⚠️ ' + res.reason, 'info');
    render();
  }

  function doConfirmExpedition() {
    if (!pickedExpedition) { G.log('⚠️ Vyber expedici.', 'info'); return; }
    const root = document.getElementById('modal-root');
    const picked = Array.from(root.querySelectorAll('.member-pick.selected')).map(el => el.dataset.unit);
    if (picked.length < G.EXPEDITION_MIN_PARTY) { G.log(`⚠️ Vyber alespoň ${G.EXPEDITION_MIN_PARTY}.`, 'info'); return; }
    const res = G.startExpedition(pickedExpedition, picked);
    if (!res.ok) G.log('⚠️ ' + res.reason, 'info');
    else closeModal();
  }

  function doConfirmPrestige() {
    const pool = G.availablePrestigeUnlocks();
    if (pool.length && !pickedPrestigeUnlock) { G.log('⚠️ Vyber si trvalý unlock.', 'info'); return; }
    if (!confirm('Opravdu? Vygeneruje se nová mapa a svět se resetuje.')) return;
    const res = G.doPrestige(pickedPrestigeUnlock);
    if (!res.ok) G.log('⚠️ ' + res.reason, 'info');
    else { G.log('🌟 Restartuji s novým světem…', 'story'); setTimeout(() => location.reload(), 700); }
  }

  function doCopyExport() {
    const b64 = G.exportSave();
    if (!b64) return;
    try { navigator.clipboard.writeText(b64); G.log('📋 Save zkopírován.', 'info'); }
    catch (e) { G.log('⚠️ Nepodařilo se zkopírovat.', 'info'); }
  }
  function doConfirmImport() {
    const ta = document.getElementById('import-textarea');
    if (!ta) return;
    const txt = ta.value.trim();
    if (!txt) { G.log('⚠️ Vlož text.', 'info'); return; }
    if (!confirm('Opravdu přepsat aktuální hru?')) return;
    const res = G.importSave(txt);
    if (res.ok) { G.log('📥 Import OK. Restartuji…', 'info'); setTimeout(() => location.reload(), 500); }
    else G.log('⚠️ Import selhal: ' + res.reason, 'info');
  }

  G.showEventModal = function (ev) {
    const root = document.getElementById('modal-root');
    root.innerHTML = `<div class="modal-backdrop"><div class="modal">
      <div class="modal-title">${G.esc(ev.title)}</div>
      <div class="modal-text">${G.esc(ev.text)}</div>
      <div class="modal-choices">
        ${ev.choices.map((c, i) => `<button class="btn" data-choice="${i}" data-event="${ev.instanceId}">${G.esc(c.text)}</button>`).join('')}
      </div>
    </div></div>`;
    root.classList.add('show');
  };
  G.hideEventModal = function () {
    const root = document.getElementById('modal-root');
    root.innerHTML = ''; root.classList.remove('show');
  };
  G.showStoryModal = function (ps) {
    const root = document.getElementById('modal-root');
    root.innerHTML = `<div class="modal-backdrop"><div class="modal story-modal">
      <div class="story-label">📖 Příběh</div>
      <div class="modal-title">${G.esc(ps.title)}</div>
      <div class="modal-text">${G.esc(ps.text)}</div>
      <div class="modal-choices">
        ${ps.choices.map(c => `<button class="btn story-choice" data-story-choice="${c.index}" title="${G.esc(c.preview || '')}">
          <span class="story-choice-text">${G.esc(c.text)}</span>
          ${c.preview ? `<span class="story-choice-preview">${G.esc(c.preview)}</span>` : ''}
        </button>`).join('')}
      </div>
      <div class="story-hint">Volba se projeví hned (materiály, renomé, reputace) a některé mají <b>trvalý efekt</b> do další hry.</div>
    </div></div>`;
    root.classList.add('show');
    modal = { type: 'story' };
  };
  G.hideStoryModal = function () {
    const root = document.getElementById('modal-root');
    root.innerHTML = ''; root.classList.remove('show');
    modal = null;
  };

  /* === DIFFICULTY MODAL === */
  G.showDifficultyModal = function (onPick) {
    const root = document.getElementById('modal-root');
    let selected = null;
    function renderD() {
      let html = `<div class="modal-backdrop"><div class="modal wide">
        <div class="story-label">Vítej ve Idle Realm</div>
        <div class="modal-title">Vyber si obtížnost</div>
        <div class="modal-text">Každá hra má svůj charakter. Volba ovlivní délku běhu, smrt v boji a offline progres. (U Ironmanu ji nelze měnit.)</div>
        <div class="diff-grid">`;
      for (const id in G.DIFFICULTIES) {
        const d = G.DIFFICULTIES[id];
        html += `<button class="diff-pick ${selected === id ? 'selected' : ''}" data-diff="${id}">
          <span class="diff-icon">${d.icon}</span>
          <div class="diff-main">
            <div class="diff-name">${G.esc(d.name)}</div>
            <div class="diff-desc">${G.esc(d.desc)}</div>
            <div class="diff-stats">
              <span>🪙 Start: <b>${d.startGold}</b></span>
              <span>🧙 Postavy: <b>${d.startUnits}</b></span>
              <span>💀 Smrt: <b>${Math.round(d.combatDeathChance*100)} %</b></span>
              <span>💤 Offline: <b>${Math.round(d.offlineCap/3600)} h</b></span>
            </div>
          </div>
        </button>`;
      }
      html += `</div><div class="perk-actions"><button class="btn" id="diff-confirm" ${selected ? '' : 'disabled'}>▶️ Začít hru</button></div></div></div>`;
      root.innerHTML = html;
      root.classList.add('show');
      root.querySelectorAll('[data-diff]').forEach(b => {
        b.addEventListener('click', () => { selected = b.dataset.diff; renderD(); });
      });
      const btn = document.getElementById('diff-confirm');
      if (btn) btn.addEventListener('click', () => {
        if (!selected) return;
        root.innerHTML = ''; root.classList.remove('show');
        onPick(selected);
      });
    }
    renderD();
  };

  /* === VICTORY MODAL === */
  G.showVictoryModal = function () {
    const root = document.getElementById('modal-root');
    const sm = G.runSummary();
    const chapter = G.chapterName ? G.chapterName(sm.prestige) : 'Neznámá';
    root.innerHTML = `<div class="modal-backdrop"><div class="modal wide victory-modal">
      <div class="victory-title">🏆 VÍTĚZSTVÍ!</div>
      <div class="victory-sub">Přivedl jsi svou dynastii z popela až do hvězd.<br>Příběh je dokonán — ale svět volá dál.</div>
      <div class="chapter-tag">📖 Kapitola ${sm.prestige}: ${G.esc(chapter)}</div>
      <div class="summary-grid">
        <div class="summary-item"><span>Obtížnost</span><span>${sm.difficulty.icon} ${G.esc(sm.difficulty.name)}</span></div>
        <div class="summary-item"><span>Titul</span><span>${G.esc(sm.difficulty.honorTitle || '—')}</span></div>
        <div class="summary-item"><span>Odehráno</span><span>${formatTime(sm.timePlayed)}</span></div>
        <div class="summary-item"><span>Živé postavy</span><span>${sm.unitsAlive}</span></div>
        <div class="summary-item"><span>Zesnulí</span><span>${sm.unitsDead}</span></div>
        <div class="summary-item"><span>Generace</span><span>${sm.generations}</span></div>
        <div class="summary-item"><span>Vyděláno</span><span>${sm.goldEarned} 🪙</span></div>
        <div class="summary-item"><span>Úkolů</span><span>${sm.tasksDone}</span></div>
        <div class="summary-item"><span>Vítězství</span><span>${sm.combatsWon}</span></div>
        <div class="summary-item"><span>Bossů</span><span>${sm.bossesKilled}</span></div>
        <div class="summary-item"><span>Zakázek</span><span>${sm.questsCompleted}</span></div>
        <div class="summary-item"><span>Expedic</span><span>${sm.expeditions}</span></div>
        <div class="summary-item"><span>Mistrovská díla</span><span>${sm.masterworks}</span></div>
        <div class="summary-item"><span>Cílů</span><span>${sm.achievements}</span></div>
      </div>
      <div class="perk-actions">
        <button class="btn prestige-btn" data-action="new-chapter">📖 Zahájit novou kapitolu</button>
        <button class="btn ghost" data-action="victory-continue">Pokračovat ve hře</button>
      </div>
    </div></div>`;
    root.classList.add('show');
    G.pauseGame();
  };

  /* === DEFEAT MODAL === */
  G.showDefeatModal = function () {
    const root = document.getElementById('modal-root');
    const sm = G.runSummary();
    root.innerHTML = `<div class="modal-backdrop"><div class="modal wide victory-modal">
      <div class="victory-title" style="color:#c05a45">💀 KONEC</div>
      <div class="victory-sub">Dynastie vyhasla. Pokladnice je prázdná.<br>Tvůj příběh zde končí — ale svět si tě pamatuje.</div>
      <div class="summary-grid">
        <div class="summary-item"><span>Obtížnost</span><span>${sm.difficulty.icon} ${G.esc(sm.difficulty.name)}</span></div>
        <div class="summary-item"><span>Odehráno</span><span>${formatTime(sm.timePlayed)}</span></div>
        <div class="summary-item"><span>Generace</span><span>${sm.generations}</span></div>
        <div class="summary-item"><span>Vyděláno</span><span>${sm.goldEarned} 🪙</span></div>
        <div class="summary-item"><span>Úkolů</span><span>${sm.tasksDone}</span></div>
        <div class="summary-item"><span>Vítězství</span><span>${sm.combatsWon}</span></div>
        <div class="summary-item"><span>Bossů</span><span>${sm.bossesKilled}</span></div>
        <div class="summary-item"><span>Cílů</span><span>${sm.achievements}</span></div>
      </div>
      <div class="perk-actions">
        <button class="btn danger" data-action="hardcore-reset">🔄 Začít znovu</button>
      </div>
    </div></div>`;
    root.classList.add('show');
    G.pauseGame();
  };

  /* === AKCE pro handleAction === */
  function doSkipTutorial() {
    if (G.skipTutorial) G.skipTutorial();
    render();
  }
  function doNewChapter() {
    if (!confirm('Opravdu zahájit novou kapitolu? Vše se resetuje (kromě trvalých unlocků).')) return;
    const res = G.newChapter();
    if (res && res.ok) { G.log('📖 Nová kapitola…', 'story'); setTimeout(() => location.reload(), 600); }
  }
  function doVictoryContinue() {
    const root = document.getElementById('modal-root');
    root.innerHTML = ''; root.classList.remove('show');
    G.resumeGame();
  }
  function doHardcoreReset() {
    if (!confirm('Opravdu smazat tento běh a začít znovu?')) return;
    G.resetSave();
  }

})();
