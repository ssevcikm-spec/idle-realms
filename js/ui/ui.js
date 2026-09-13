(function () {
  const G = window.Game;

  const TAB_STRUCTURE = {
    world:   { label:'Svět',     icon:'🗺️', subs:[{ id:'place', label:'Místo', icon:'📍' }, { id:'activities', label:'Práce', icon:'⚒️' }] },
    people:  { label:'Lidé',     icon:'👥', subs:[{ id:'units', label:'Postavy', icon:'🧙' }, { id:'groups', label:'Skupiny', icon:'👥' }, { id:'expeditions', label:'Expedice', icon:'⛵' }] },
    craft:   { label:'Řemeslo',  icon:'⚒️', subs:[{ id:'craft', label:'Výroba', icon:'🔨' }, { id:'inventory', label:'Batoh', icon:'🎒' }] },
    economy: { label:'Obchod',   icon:'💰', subs:[{ id:'trade', label:'Obchodníci', icon:'🐎' }, { id:'reputation', label:'Vztahy', icon:'⭐' }, { id:'politics', label:'Politika', icon:'🏛️' }] },
    more:    { label:'Více',     icon:'📜', subs:[{ id:'log', label:'Log', icon:'📜' }, { id:'achievements', label:'Cíle', icon:'🏆' }, { id:'prestige', label:'Prestiž', icon:'🌟' }] }
  };
  const SUB_TO_PARENT = {};
  for (const parentId in TAB_STRUCTURE) for (const sub of TAB_STRUCTURE[parentId].subs) SUB_TO_PARENT[sub.id] = parentId;

  let activeParent = 'world';
  let activeSub = 'place';
  let modal = null;
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
    root.querySelectorAll('details').forEach((d, i) => { if (states[i]) d.setAttribute('open', ''); else d.removeAttribute('open'); });
  }

  G.initUI = function () {
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
    content.addEventListener('change', e => {
      const el = e.target.closest('[data-change]'); if (!el) return;
      handleChange(el.dataset.change, el.dataset, el.value);
    });
    content.addEventListener('click', e => {
      const el = e.target.closest('[data-log-filter]'); if (!el) return;
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
      if (routeToggle) { const cur = routeToggle.dataset.selected === 'true'; routeToggle.dataset.selected = cur ? 'false' : 'true'; routeToggle.classList.toggle('selected', !cur); return; }
      const memberToggle = e.target.closest('[data-action="toggle-exp-member"]');
      if (memberToggle) { const cur = memberToggle.dataset.selected === 'true'; memberToggle.dataset.selected = cur ? 'false' : 'true'; memberToggle.classList.toggle('selected', !cur); return; }
      const expPick = e.target.closest('[data-action="select-expedition"]');
      if (expPick) { pickedExpedition = expPick.dataset.expedition; modalRoot.querySelectorAll('.expedition-pick').forEach(b => b.classList.remove('selected')); expPick.classList.add('selected'); return; }
      const prestigePick = e.target.closest('[data-action="select-prestige-unlock"]');
      if (prestigePick) { pickedPrestigeUnlock = prestigePick.dataset.unlock; modalRoot.querySelectorAll('.unlock-pick').forEach(b => b.classList.remove('selected')); prestigePick.classList.add('selected'); return; }
      const act = e.target.closest('[data-action]');
      if (act) handleAction(act.dataset.action, act.dataset);
    });
    modalRoot.addEventListener('change', e => {
      const el = e.target.closest('[data-action="toggle-auto-abilities"]'); if (!el) return;
      if (G.toggleAutoAbilities) G.toggleAutoAbilities();
    });

    const hint = document.getElementById('map-hint');
    if (hint) { const canvas = document.getElementById('world'); if (canvas) canvas.addEventListener('pointerdown', () => hint.classList.add('hide'), { once: true }); }

    render(); renderHud();
    setInterval(renderHud, 400);
    setInterval(autoRefresh, 1000);
  };

  G.selectTab = function (subId) { if (!SUB_TO_PARENT[subId]) return; activeSub = subId; activeParent = SUB_TO_PARENT[subId]; render(); };
  G.getActiveTab = function () { return activeSub; };
  G.getActiveParentTab = function () { return activeParent; };

  function autoRefresh() {
    const ae = document.activeElement;
    if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'SELECT' || ae.tagName === 'TEXTAREA')) return;
    if (modal) return;
    render();
  }

  function renderHud() {
    if (!G.state) return;
    setText('hud-time', formatTime(G.state.time));
    setText('hud-gold', Math.floor(G.state.resources.gold).toLocaleString('cs-CZ'));
    setText('hud-renown', Math.floor(G.state.resources.renown));
    const alive = G.state.units.filter(u => !u.dead).length;
    setText('hud-units', alive);
    const lvl = (G.state.prestige && G.state.prestige.level) || 0;
    const pEl = document.getElementById('hud-prestige');
    if (pEl) { if (lvl > 0) { pEl.style.display = 'inline-flex'; pEl.title = `Prestiž ${lvl}`; pEl.textContent = '⭐' + lvl; } else pEl.style.display = 'none'; }
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
      if (expeds.length) { const active = expeds.filter(e => !e.outcome).length; if (active > 0) parts.push(`<span class="we-chip" style="border-color:#7aa8e0;color:#7aa8e0">⛵ ${active} expedice</span>`); }
      if (!parts.length) weBar.style.display = 'none';
      else { weBar.style.display = 'flex'; weBar.innerHTML = parts.join(''); }
    }
  }
  function formatShort(s) { s = Math.max(0, Math.floor(s)); const h = Math.floor(s/3600), m = Math.floor((s%3600)/60); if (h > 0) return `${h}h ${m}m`; if (m > 0) return `${m}m`; return `${s}s`; }
  function setText(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }
  function formatTime(t) { const h = Math.floor(t/3600), m = Math.floor((t%3600)/60), s = Math.floor(t%60); return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; }

  function renderSubtabs() {
    const el = document.getElementById('subtabs'); if (!el) return;
    const parent = TAB_STRUCTURE[activeParent];
    if (!parent) { el.innerHTML = ''; return; }
    el.innerHTML = parent.subs.map(s => {
      const active = s.id === activeSub ? ' active' : '';
      return `<button class="subtab-btn${active}" data-sub="${s.id}"><span class="subtab-icon">${s.icon}</span><span>${G.esc(s.label)}</span></button>`;
    }).join('');
  }

  function renderPanelContent() {
    const el = document.getElementById('panel-content'); if (!el) return;
    let html = '';
    switch (activeSub) {
      case 'place': html = G.panelPlace(); break;
      case 'activities': html = G.panelActivities(); break;
      case 'units': html = G.panelUnits(); break;
      case 'groups': html = G.panelGroups(); break;
      case 'expeditions': html = G.panelExpeditions(); break;
      case 'craft': html = G.panelCraft(); break;
      case 'inventory': html = G.panelInventory(); break;
      case 'trade': html = G.panelMerchant(); break;
      case 'reputation': html = G.panelReputation(); break;
      case 'politics': html = G.panelPolitics(); break;
      case 'log': html = G.panelLog(); break;
      case 'achievements': html = G.panelAchievements(); break;
      case 'prestige': html = G.panelPrestige(); break;
      default: html = `<div class="empty">Neznámý panel: ${G.esc(activeSub)}</div>`;
    }
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
    root.innerHTML = `<div class="modal-backdrop"><div class="modal wide">${content}</div></div>`;
    root.classList.add('show');
  }
  function closeModal() {
    modal = null; pickedExpedition = null; pickedPrestigeUnlock = null;
    const root = document.getElementById('modal-root');
    root.innerHTML = ''; root.classList.remove('show');
    render();
  }

  function prestigeModal() {
    const lvl = (G.state.prestige && G.state.prestige.level) || 0;
    const pool = G.availablePrestigeUnlocks();
    let html = `<div class="perk-panel"><div class="perk-header">🌟 Prestiž ${lvl + 1}</div><div class="perk-hint">Vygeneruje nový svět. Vyber si <b>jeden</b> trvalý unlock.</div>`;
    if (!pool.length) html += `<div class="empty">Už máš všechny trvalé unlocky.</div>`;
    else {
      html += `<div class="panel-title">Vyber trvalý unlock</div>`;
      for (const uid of pool) {
        const u = G.UNLOCKS[uid];
        html += `<button class="unlock-pick" data-action="select-prestige-unlock" data-unlock="${uid}" data-selected="false"><div class="unlock-pick-head"><span class="unlock-icon">${u.icon}</span> <b>${G.esc(u.name)}</b></div><div class="unlock-pick-desc">${G.esc(u.desc)}</div></button>`;
      }
    }
    html += `<div class="perk-actions"><button class="btn" data-action="confirm-prestige">🌟 Přechod do nového světa</button><button class="btn ghost" data-action="close-modal">Zrušit</button></div></div>`;
    return html;
  }
  function exportPanel() {
    const b64 = G.exportSave();
    if (!b64) return `<div class="perk-panel"><div class="perk-header">Export selhal</div><div class="perk-actions"><button class="btn" data-action="close-modal">Zavřít</button></div></div>`;
    return `<div class="perk-panel"><div class="perk-header">💾 Export save</div><div class="perk-hint">Zkopíruj celý text.</div><textarea class="save-textarea" readonly onclick="this.select()">${G.esc(b64)}</textarea><div class="perk-actions"><button class="btn" data-action="copy-export">📋 Zkopírovat</button><button class="btn ghost" data-action="close-modal">Zavřít</button></div></div>`;
  }
  function importPanel() {
    return `<div class="perk-panel"><div class="perk-header">📥 Import save</div><div class="perk-hint">Vlož text zálohy. <b>Pozor:</b> přepíše aktuální hru!</div><textarea class="save-textarea" id="import-textarea" placeholder="Vlož sem base64 text…"></textarea><div class="perk-actions"><button class="btn" data-action="confirm-import">⚠️ Importovat</button><button class="btn ghost" data-action="close-modal">Zrušit</button></div></div>`;
  }

  function handleAction(action, ds) {
    switch (action) {
      case 'start-task': return doStartTask(ds.activity, ds.node);
      case 'cancel-task': return doCancelTask(ds.task);
      case 'recruit': return doRecruit();
      case 'create-group': return doCreateGroup();
      case 'kick': return doKick(ds.unit);
      case 'craft': return doCraft(ds.recipe);
      case 'trade-buy': return doTrade('buy', ds);
      case 'trade-sell': return doTrade('sell', ds);
      case 'trade-tab': return doTradeTab(ds.tab);
      case 'build': return doBuild(ds.settlement, ds.building);
      case 'build-base': return doBuildBase(ds.building);
      case 'buy-equip': return doBuyEquip(ds.settlement, ds.item);
      case 'sell-equip': return doSellEquip(ds.item);
      case 'unequip': return doUnequip(ds.unit, ds.slot);
      case 'rest': return doRest(ds.unit);
      case 'wake': return doWake(ds.unit);
      case 'toggle-manual': return doToggleManual(ds.unit);
      case 'heal-all': return doHealAll(ds.unit);
      case 'resurrect': return doResurrect(ds.unit);
      case 'quest-accept': return doQuestAccept(ds.settlement, ds.quest);
      case 'quest-decline': return doQuestDecline(ds.settlement, ds.quest);
      case 'quest-turnin': return doQuestTurnIn(ds.settlement, ds.quest);
      case 'open-perks': return openModal('perks', ds.unit);
      case 'open-mentor': return openModal('mentor', ds.unit);
      case 'open-merchant': return openModal('merchant', ds.unit);
      case 'open-expedition-modal': return openModal('expedition');
      case 'socket-modal': return openModal('socket', ds.item);
      case 'socket-gem': return doSocketGem(ds);
      case 'unsocket-gem': return doUnsocketGem(ds);
      case 'close-modal': return closeModal();
      case 'pick-perk': return doPickPerk(ds);
      case 'respec': return doRespec(ds);
      case 'set-mentor': return doSetMentor(ds);
      case 'clear-mentor': return doClearMentor(ds);
      case 'do-prestige': return openModal('prestige');
      case 'set-merchant-route': return doSetMerchantRoute(ds);
      case 'stop-merchant': return doStopMerchant(ds.unit);
      case 'merchant-instant-trade': return doMerchantInstant(ds.unit);
      case 'set-custom-merchant-route': return doSetCustomMerchantRoute(ds.unit);
      case 'attack-here': return doAttackHere(ds.node);
      case 'set-tactic': return G.setTactic(ds.tactic);
      case 'toggle-auto-abilities': return G.toggleAutoAbilities();
      case 'queue-ability': return doQueueAbility(ds);
      case 'combat-round': return doCombatRound();
      case 'combat-auto': return doCombatAuto();
      case 'combat-close': return doCombatClose();
      case 'export-save': return openModal('export');
      case 'import-save': return openModal('import');
      case 'copy-export': return doCopyExport();
      case 'confirm-import': return doConfirmImport();
      case 'support-candidate': return doSupportCandidate(ds);
      case 'confirm-expedition': return doConfirmExpedition();
      case 'confirm-prestige': return doConfirmPrestige();
      case 'set-directive-focus': return doSetDirectiveFocus(ds.material || null);
      case 'toggle-directive-danger': return doToggleDirectiveDanger();
    }
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
    if (change === 'group-focus') { const g = G.getGroup(ds.group); if (g) g.f
