(function () {
  const G = window.Game;
  let activeTab = 'place';
  let modal = null;
  let pickedExpedition = null;
  let pickedPrestigeUnlock = null;

  G.initUI = function () {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        activeTab = btn.dataset.tab;
        if (G.setPanelCollapsed) G.setPanelCollapsed(false);
        render();
      });
    });
    const panel = document.getElementById('panel');
    panel.addEventListener('click', e => {
      const el = e.target.closest('[data-action]'); if (!el) return;
      handleAction(el.dataset.action, el.dataset);
    });
    panel.addEventListener('change', e => {
      const el = e.target.closest('[data-change]'); if (!el) return;
      handleChange(el.dataset.change, el.dataset, el.value);
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
        return;
      }
      const expPick = e.target.closest('[data-action="select-expedition"]');
      if (expPick) {
        pickedExpedition = expPick.dataset.expedition;
        modalRoot.querySelectorAll('.expedition-pick').forEach(b => b.classList.remove('selected'));
        expPick.classList.add('selected');
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
    modalRoot.addEventListener('change', e => {
      const el = e.target.closest('[data-action="toggle-auto-abilities"]');
      if (!el) return;
      if (G.toggleAutoAbilities) G.toggleAutoAbilities();
    });

    panel.addEventListener('click', e => {
      const el = e.target.closest('[data-log-filter]');
      if (!el) return;
      G.state.logFilter = el.dataset.logFilter;
      render();
    });

    const hint = document.getElementById('map-hint');
    if (hint) setTimeout(() => hint.classList.add('hide'), 6000);
    render(); renderHud();
    setInterval(renderHud, 400);
    setInterval(autoRefresh, 1000);
  };

  G.selectTab = function (tab) { activeTab = tab; render(); };

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
    if (pEl) {
      if (lvl > 0) { pEl.style.display = 'inline-flex'; pEl.title = `Prestiž ${lvl}`; pEl.textContent = '⭐' + lvl; }
      else pEl.style.display = 'none';
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

  function render() {
    if (!G.state) return;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === activeTab));
    const panel = document.getElementById('panel');
    const scrollTop = panel.scrollTop;
    let html = '';
    switch (activeTab) {
      case 'place':      html = G.panelPlace(); break;
      case 'activities': html = G.panelActivities(); break;
      case 'groups':     html = G.panelGroups(); break;
      case 'units':      html = G.panelUnits(); break;
      case 'trade':      html = G.panelMerchant(); break;
      case 'craft':      html = G.panelCraft(); break;
      case 'inventory':  html = G.panelInventory(); break;
      case 'log':        html = renderLogPanel(); break;
    }
    panel.innerHTML = html;
    panel.scrollTop = scrollTop;
    if (activeTab === 'log') G.renderLog();
    if (activeTab === 'place') renderHud();
  }

  function renderLogPanel() {
    const filter = G.state.logFilter || 'all';
    const cats = ['all'].concat(G.LOG_CATEGORIES || []);
    const labels = {
      all:'Vše', info:'Info', work:'Práce', economy:'Ekonomika',
      combat:'Boj', story:'Příběh', social:'Social', politics:'Politika'
    };
    let html = `<div class="panel-title">Log</div><div class="log-filters">`;
    for (const c of cats) {
      html += `<button class="log-filter ${filter === c ? 'active' : ''}" data-log-filter="${c}">${labels[c] || c}</button>`;
    }
    html += `</div><div id="log-list" class="log-list"></div>`;
    return html;
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
    root.innerHTML = `<div class="modal-backdrop"><div class="modal wide">${content}</div></div>`;
    root.classList.add('show');
  }
  function closeModal() {
    modal = null;
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
      <button class="btn" data-action="confirm-prestige" ${pool.length ? '' : ''}>🌟 Přechod do nového světa</button>
      <button class="btn ghost" data-action="close-modal">Zrušit</button>
    </div></div>`;
    return html;
  }

  function exportPanel() {
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
      case 'start-task':    return doStartTask(ds.activity, ds.node);
      case 'cancel-task':   return doCancelTask(ds.task);
      case 'recruit':       return doRecruit();
      case 'create-group':  return doCreateGroup();
      case 'kick':          return doKick(ds.unit);
      case 'craft':         return doCraft(ds.recipe);
      case 'trade-buy':     return doTrade('buy', ds);
      case 'trade-sell':    return doTrade('sell', ds);
      case 'trade-tab':     return doTradeTab(ds.tab);
      case 'build':         return doBuild(ds.settlement, ds.building);
      case 'build-base':    return doBuildBase(ds.building);
      case 'buy-equip':     return doBuyEquip(ds.settlement, ds.item);
      case 'sell-equip':    return doSellEquip(ds.item);
      case 'unequip':       return doUnequip(ds.unit, ds.slot);
      case 'rest':          return doRest(ds.unit);
      case 'wake':          return doWake(ds.unit);
      case 'heal-all':      return doHealAll(ds.unit);
      case 'resurrect':     return doResurrect(ds.unit);
      case 'quest-accept':  return doQuestAccept(ds.settlement, ds.quest);
      case 'quest-decline': return doQuestDecline(ds.settlement, ds.quest);
      case 'quest-turnin':  return doQuestTurnIn(ds.settlement, ds.quest);
      case 'open-perks':    return openModal('perks', ds.unit);
      case 'open-mentor':   return openModal('mentor', ds.unit);
      case 'open-merchant': return openModal('merchant', ds.unit);
      case 'open-expedition-modal': return openModal('expedition');
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
      case 'attack-here':   return doAttackHere(ds.node);
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
    }
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
    }
  }

  function doStartTask(activityId, nodeId) {
    const act = G.ACTIVITIES[activityId]; if (!act) return;
    const idle = G.state.units.filter(u =>
      !u.dead && !u.isChild && !u.onExpedition && !u.assignedTaskId && !u.resting
      && !(G.hasSevereInjury && G.hasSevereInjury(u))
      && !(u.merchantState && u.merchantState.active)
      && !(G.unitRefusesWork && G.unitRefusesWork(u)));
    if (!idle.length) { G.log('⚠️ Žádné volné postavy.', 'info'); return render(); }
    let targetQty = 1;
    if (act.mode === 'quantity') {
      const input = document.querySelector(`input[data-qty-for="${activityId}"]`);
      targetQty = Math.max(1, Math.min(500, parseInt(input && input.value, 10) || act.defaultQty || 10));
    }
    const t = G.startTask(activityId, idle.map(u => u.id), { nodeId: nodeId || undefined, targetQty });
    if (!t) { G.log('⚠️ Nenašel se vhodný uzel.', 'info'); return render(); }
    G.log(`⚒️ Zahájen úkol: ${act.name} (${idle.length} postav).`, 'work');
    render();
  }
  function doCancelTask(taskId) { G.cancelTask(taskId); render(); }
  function doRecruit() {
    const cost = G.recruitCost();
    if (G.state.resources.gold < cost) { G.log('⚠️ Nedostatek zlata.', 'info'); return render(); }
    G.state.resources.gold -= cost;
    const u = G.createUnit(); G.state.units.push(u);
    G.log(`🧙 Najat: ${u.name}.`, 'social');
    render();
  }
  function doCreateGroup() { const g = G.createGroup(); G.log(`👥 Skupina ${g.name}.`, 'social'); render(); }
  function doKick(unitId) { G.removeUnitFromGroup(unitId); render(); }
  function doCraft(recipeId) {
    const res = G.craft(recipeId);
    if (!res.ok) G.log('⚠️ ' + res.reason, 'info');
    render();
  }
  function doTrade(mode, ds) {
    const sid = ds.settlement, mid = ds.material;
    const input = document.querySelector(`input[data-trade-qty="${mid}"]`);
    const qty = Math.max(1, Math.min(999, parseInt(input && input.value, 10) || 1));
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
  function doBuyEquip(settlementId, itemId) {
    const res = G.buyEquipment(settlementId, itemId);
    if (!res.ok) G.log('⚠️ ' + res.reason, 'info');
    render();
  }
  function doSellEquip(instanceId) {
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
    const sid = u.restingAt || (G.state.selected && G.state.selected.type === 'settlement' ? G.state.selected.id : null)
      || (G.WORLD.settlements[0] && G.WORLD.settlements[0].id);
    let count = 0;
    const copy = u.injuries.slice();
    for (const inj of copy) {
      const res = G.treatInjury(sid, u.id, inj.id);
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
  function doStopMerchant(unitId) { G.clearMerchant(unitId); if (modal) closeModal(); render(); }
  function doMerchantInstant(unitId) {
    const res = G.merchantInstantTrade(unitId);
    if (!res.ok) G.log('⚠️ ' + res.reason, 'info');
    if (modal) openModal(modal.type, modal.unitId); else render();
  }
  function doAttackHere(nodeId) {
    const node = G.WORLD.nodes.find(n => n.id === nodeId); if (!node) return;
    const idle = G.state.units.filter(u => !u.dead && !u.isChild && !u.onExpedition && !u.resting
      && !(G.hasSevereInjury && G.hasSevereInjury(u))
      && !(u.merchantState && u.merchantState.active));
    if (!idle.length) { G.log('⚠️ Žádné volné postavy.', 'info'); return; }
    G.startCombat(node, idle, { tactic:'balanced' });
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
    if (pool.length && !pickedPrestigeUnlock) {
      G.log('⚠️ Vyber si trvalý unlock.', 'info'); return;
    }
    if (!confirm('Opravdu? Vygeneruje se nová mapa a svět se resetuje.')) return;
    const res = G.doPrestige(pickedPrestigeUnlock);
    if (!res.ok) G.log('⚠️ ' + res.reason, 'info');
    else {
      G.log('🌟 Restartuji s novým světem…', 'story');
      setTimeout(() => location.reload(), 700);
    }
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
        ${ps.choices.map(c => `<button class="btn story-choice" data-story-choice="${c.index}">${G.esc(c.text)}</button>`).join('')}
      </div>
    </div></div>`;
    root.classList.add('show');
    modal = { type: 'story' };
  };
  G.hideStoryModal = function () {
    const root = document.getElementById('modal-root');
    root.innerHTML = ''; root.classList.remove('show');
    modal = null;
  };
})();
