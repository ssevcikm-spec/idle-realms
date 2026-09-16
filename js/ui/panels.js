(function () {
  const G = window.Game;
  function esc(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  G.esc = esc;
  /** Prázdný stav s tlačítkem „kam jít" (přepne záložku). */
  G.emptyState = function (text, subId, btnLabel, icon) {
    const btn = subId && btnLabel
      ? `<br><button class="btn-sm ghost" data-action="select-tab" data-tab="${subId}" style="margin-top:8px">${icon || ''}${esc(btnLabel)}</button>`
      : '';
    return `<div class="empty">${text}${btn}</div>`;
  };
  function bestSkill(sid) { return G.bestSkill(sid); }
  function meetsReq(node, act) {
    if (!act.requires || !act.requires.skillLevel) return { ok:true };
    for (const sid in act.requires.skillLevel) {
      const need = act.requires.skillLevel[sid], have = bestSkill(sid);
      if (have < need) return { ok:false, reason:`${G.SKILLS[sid].name} ${need} (máš ${have})` };
    }
    return { ok:true };
  }
  function formatSec(s) {
    s = Math.max(0, Math.floor(s));
    const h = Math.floor(s/3600), m = Math.floor((s%3600)/60);
    if (h > 0) return `${h} h ${m} min`;
    if (m > 0) return `${m} min`;
    return `${s} s`;
  }
  G.formatSec = formatSec;
  function formatClock(sec) {
    sec = Math.max(0, Math.floor(sec));
    const h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60), s = Math.floor(sec%60);
    return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }
  function nodeName(nodeId) {
    const n = G.WORLD.nodes.find(x => x.id === nodeId);
    return n && G.NODE_KINDS[n.kind] ? G.NODE_KINDS[n.kind].name : null;
  }
  function taskEtaText(t) {
    if (!G.taskEta) return '';
    const eta = G.taskEta(t);
    if (eta == null) return ' • ⏸ nikdo nepracuje';
    return ` • ⏳ ≈ ${formatSec(eta)}`;
  }

  /* ---------- ovládání množství (qty) ----------
     Hodnoty se drží v paměti podle klíče, takže je překreslení panelu nesmaže. */
  const qtyMemory = {};
  G.qtyGet = function (key, fallback) {
    const v = qtyMemory[key];
    return (v == null || !isFinite(v)) ? fallback : v;
  };
  G.qtySet = function (key, v) {
    v = Math.floor(v);
    if (isFinite(v) && v > 0) qtyMemory[key] = v;
    return qtyMemory[key];
  };
  G.qtyClamp = function (v, max) {
    v = Math.floor(v);
    if (!isFinite(v)) return 1;
    return Math.max(1, Math.min(max || 500, v));
  };
  /** Ovládací prvek množství: [−] [input] [+] + čipy (1 / 10 / 50 / Max). */
  G.qtyControl = function (key, opts) {
    opts = opts || {};
    const min = opts.min || 1;
    const max = opts.max || 500;
    const presetList = opts.presets || [1, 10, 50];
    const value = G.qtyClamp(G.qtyGet(key, opts.value || 10), max);
    const chips = presetList
      .filter(p => p >= min && p <= max)
      .map(p => `<button class="qty-chip" data-action="qty-set" data-qty-key="${key}" data-qty-value="${p}">${p}</button>`).join('');
    const maxChip = (opts.maxLabel !== false) ? `<button class="qty-chip" data-action="qty-set" data-qty-key="${key}" data-qty-value="max">Max</button>` : '';
    return `<div class="qty-ctl" data-qty-for="${key}">
      <button class="qty-step" data-action="qty-step" data-qty-key="${key}" data-delta="-1" title="Ubrat">−</button>
      <input type="number" class="qty-input" data-qty-key="${key}" data-qty-max="${max}" min="${min}" max="${max}" value="${value}" title="Kolik kusů" />
      <button class="qty-step" data-action="qty-step" data-qty-key="${key}" data-delta="1" title="Přidat">＋</button>
      <div class="qty-chips">${chips}${maxChip}</div>
    </div>`;
  };
  /** Odhad času práce pro dané množství a dané postavy na daném uzlu. */
  G.activityEta = function (act, qty, units, node) {
    if (!act || !node || !units || !units.length) return null;
    const rich = node.richness || 1;
    let rate = 0;
    for (const u of units) {
      let r = G.unitWorkRate(u, act);
      const g = u.groupId ? G.getGroup(u.groupId) : null;
      if (g) r *= G.groupWorkMult(g);
      rate += r;
    }
    if (rate <= 0) return null;
    const remaining = act.mode === 'quantity' ? qty * (act.workPerUnit || 4) : (act.workRequired || 0);
    return remaining / (rate * rich);
  };
  function activityYieldText(act) {
    if (!act.output || !act.output.length) return '';
    const per = act.output.map(o => `${G.MATERIALS[o.material].icon}${o.qty}× ${G.MATERIALS[o.material].name}`).join(' + ');
    return act.mode === 'timed' ? `Za dokončení: ${per}` : `Za kus: ${per}`;
  }
  function idleWorkers() {
    return G.state.units.filter(u =>
      !u.dead && !u.isChild && !u.onExpedition && !u.assignedTaskId && !u.resting
      && !(G.hasSevereInjury && G.hasSevereInjury(u))
      && !(u.merchantState && u.merchantState.active)
      && !(G.unitRefusesWork && G.unitRefusesWork(u)));
  }
  /** Kolik kusů receptu jde vyrobit z aktuálních zásob. */
  G.maxCraftable = function (r) {
    let m = 999;
    for (const inp of r.inputs) m = Math.min(m, Math.floor(G.matCount(inp.material) / inp.qty));
    return Math.max(1, m);
  };

  function renderDirectives() {
    const dir = G.state.directives || { focusMaterial: null, avoidDanger: false };
    const mats = ['wood','stone','fiber','herb','grain','hide','fish','coal','iron_ore','crystal'];
    const chips = mats.map(m => {
      const active = dir.focusMaterial === m ? ' active' : '';
      const def = G.MATERIALS[m];
      return `<button class="dir-chip${active}" data-action="set-directive-focus" data-material="${m}" title="Postavy budou přednostně dělat práce, které dávají ${esc(def.name)} — dokud ho nemáš dost.">${def.icon} ${esc(def.name)}</button>`;
    }).join('');
    const autoActive = dir.focusMaterial ? '' : ' active';
    const dangerActive = dir.avoidDanger ? ' active' : '';
    const targetRow = dir.focusMaterial
      ? `<div class="dir-row dir-target"><span class="v-label">Držet alespoň</span>${G.qtyControl('directive:target', { value: dir.focusTarget || 30, max: 200, presets: [10, 30, 60, 100] })}<span class="hint">kusů ${esc(G.MATERIALS[dir.focusMaterial].name)} — pod tuto hranici se práce na materiál upřednostní</span></div>`
      : '';
    return `<div class="directives">
      <div class="panel-title">🧭 Směrnice — čemu se autonomně věnovat</div>
      <div class="hint" style="text-align:left">Ovlivňuje jen <b>automatické</b> rozhodování postav bez příkazu (příkazy ve frontě a zaměření skupin mají přednost).</div>
      <button class="dir-chip${autoActive}" data-action="set-directive-focus" data-material="" title="Žádné zaměření — postavy si vybírají podle toho, čeho je nedostatek.">✨ Auto</button>${chips}
      ${targetRow}
      <div class="dir-row"><button class="dir-chip${dangerActive}" data-action="toggle-directive-danger" title="Postavy nebudou chodit na nebezpečné uzly (důl, jeskyně, močál).">🛡️ Vyhýbat se nebezpečí</button></div>
    </div>`;
  }

  function unitStatusLabel(u) {
    if (u.dead) return { icon:'💀', text:'Mrtev' };
    if (u.onExpedition) return { icon:'⛵', text:'Na expedici' };
    if (u.resting) return { icon:'😴', text:'Odpočívá' };
    if (u.merchantState && u.merchantState.active) return { icon:'🐎', text:'Obchoduje' };
    if (u.assignedTaskId) { const t = G.state.tasks.find(x => x.id === u.assignedTaskId); if (t) { const a = G.ACTIVITIES[t.activityId]; return { icon: a ? a.icon : '⚒️', text: a ? a.name : 'Pracuje' }; } }
    if (u.isChild) return { icon:'👶', text:'Dítě' };
    return { icon:'💤', text:'Nečinný' };
  }
  function renderActivityDashboard() {
    const units = G.state.units.filter(u => !u.dead && !u.isChild);
    if (!units.length) return '';
    const chips = units.map(u => {
      const s = unitStatusLabel(u);
      return `<span class="act-chip" title="${esc(s.text)}">${s.icon} ${esc(u.name.split(' ')[0])}</span>`;
    }).join('');
    return `<div class="activity-dash"><div class="panel-title">👥 Aktivity</div><div class="activity-chips">${chips}</div></div>`;
  }

  function tutorialBanner() {
    if (!G.tutorialCurrentStep) return '';
    const step = G.tutorialCurrentStep();
    if (!step) return '';
    const hint = step.hint ? step.hint(G.state) : '';
    return `<div class="tutorial-banner">
      <span class="tut-icon">${step.icon}</span>
      <div class="tut-main">
        <div class="tut-title">📘 Úkol: ${G.esc(step.title)}</div>
        <div class="tut-text">${G.esc(step.text)}</div>
        <div class="tut-hint">${G.esc(hint)}</div>
      </div>
      <button class="tut-skip" data-action="skip-tutorial" title="Přeskočit">⏭</button>
    </div>`;
  }

  G.taskAssignModal = function (pending) {
    const closeBtn = '<div class="perk-actions"><button class="btn ghost" data-action="close-modal">Zavřít</button></div></div>';
    if (!pending) return '<div class="perk-panel"><div class="perk-header">Přiřadit úkol</div>' + closeBtn;
    const act = G.ACTIVITIES[pending.activityId];
    if (!act) return '<div class="perk-panel"><div class="perk-header">Neznámá aktivita</div>' + closeBtn;
    const alive = G.state.units.filter(u => !u.dead && !u.isChild && !u.onExpedition);
    const qtyTxt = act.mode === 'quantity' && pending.targetQty ? ` — ${pending.targetQty}×` : '';

    // Kandidáti: stav, vzdálenost k uzlu, který použije právě tato postava, a cena přerušení
    const cand = alive.map(u => {
      const node = G.findNodeFor ? G.findNodeFor(pending.activityId, [u.id]) : null;
      const d = (node && u.pos) ? Math.hypot(node.x - u.pos.x, node.y - u.pos.y) : null;
      const blocked = G.workBlockReason ? G.workBlockReason(u) : null;
      const wakeable = blocked === 'odpočívá';
      const usable = !blocked || wakeable;
      let stateTxt, note = '';
      if (u.assignedTaskId) {
        const t = G.state.tasks.find(x => x.id === u.assignedTaskId);
        const ta = t ? G.ACTIVITIES[t.activityId] : null;
        stateTxt = `⚒️ ${ta ? ta.name : 'pracuje'}`;
        if (t) note = ` — přeruší se${G.taskEta ? ', zbývá ≈ ' + formatSec(G.taskEta(t)) : ''}`;
      } else if (u.resting) stateTxt = '😴 odpočívá (vzbudí se)';
      else if (blocked) stateTxt = `🚫 ${blocked}`;
      else stateTxt = '🟢 volný';
      return { u, d, usable, stateTxt, note, busy: !!u.assignedTaskId };
    }).sort((a, b) => (a.usable === b.usable ? 0 : a.usable ? -1 : 1)
      || (a.busy - b.busy)
      || ((a.d == null ? 1e9 : a.d) - (b.d == null ? 1e9 : b.d)));

    let html = `<div class="perk-panel">
      <div class="perk-header">${act.icon} ${esc(act.name)}${esc(qtyTxt)}</div>
      <div class="perk-hint">Nejsou volné postavy. Vyber, co má hra udělat: <b>zařadit do fronty</b> (nikoho nevyruší), nebo práci přidělit hned — tomu, kdo je nejblíž, celé skupině, nebo všem schopným.</div>
      <button class="btn" data-action="queue-task">📋 Zařadit do fronty</button>
      <button class="btn ghost" data-action="assign-task-all" title="Zruší autonomní práci všem, kdo mohou pracovat, a pošle je na tento úkol.">⚡ Přerušit autonomní práci a přiřadit všem</button>`;

    const usableList = cand.filter(c => c.usable);
    const blockedList = cand.filter(c => !c.usable);
    html += `<div class="panel-title">Přiřadit jedné postavě</div>`;
    if (!usableList.length) html += G.emptyState('Nikdo teď nemůže pracovat — probuď odpočívající nebo počkej na uzdravení.', 'units', '🧙 Postavy');
    usableList.forEach((c, i) => {
      const u = c.u;
      const dist = c.d != null ? ` • ${Math.round(c.d)} polí` : '';
      const rec = i === 0 ? ' <span class="rec-tag">doporučeno</span>' : '';
      html += `<button class="btn-sm ghost" data-action="assign-task-unit" data-unit="${u.id}" style="display:block;width:100%;text-align:left;margin:4px 0">${esc(u.name)} — ${esc(c.stateTxt)}${esc(c.note)}${dist}${rec}</button>`;
    });
    if (blockedList.length) {
      html += `<details class="unit-skills" style="margin-top:6px"><summary>Nemohou pracovat (${blockedList.length})</summary>`;
      for (const c of blockedList) html += `<div class="task-sub" style="margin:4px 0">🚫 ${esc(c.u.name)} — ${esc(c.stateTxt.replace(/^🚫 /, ''))}</div>`;
      html += `</details>`;
    }

    const groups = (G.state.groups || []).map(g => ({
      g, members: G.groupMembers(g).filter(u => u && !u.dead && !u.isChild && !u.onExpedition
        && !(G.hasSevereInjury && G.hasSevereInjury(u)) && !(u.merchantState && u.merchantState.active))
    })).filter(x => x.members.length);
    if (groups.length) {
      html += `<div class="panel-title">Přiřadit celé skupině</div>`;
      for (const { g, members } of groups) {
        html += `<button class="btn-sm ghost" data-action="assign-task-group" data-group="${g.id}" style="display:block;width:100%;text-align:left;margin:4px 0">👥 ${esc(g.name)} — ${members.length} členů (${members.map(u => esc(u.name.split(' ')[0])).join(', ')})</button>`;
      }
    }
    html += `<div class="perk-actions"><button class="btn ghost" data-action="close-modal">Zrušit</button></div></div>`;
    return html;
  };

  function renderOrders() {
    const orders = G.state.orders || [];
    if (!orders.length) return '';
    let soonest = null;
    for (const t of G.state.tasks) {
      if (!G.taskEta) break;
      const e = G.taskEta(t);
      if (e != null && (soonest == null || e < soonest)) soonest = e;
    }
    const waitTxt = soonest != null ? ` Nejbližší uvolnění ≈ ${formatSec(soonest)}.` : '';
    const sorted = G.sortedOrders ? G.sortedOrders() : orders;
    let html = `<div class="panel-title">📋 Příkazy ve frontě (${orders.length})</div>
      <div class="hint" style="text-align:left">Vyřídí se shora dolů, jakmile bude některá postava volná.${waitTxt}</div>`;
    sorted.forEach((o, idx) => {
      const act = G.ACTIVITIES[o.activityId];
      if (!act) return;
      const qty = act.mode === 'quantity' && o.targetQty ? ` ${o.targetQty}×` : '';
      const place = nodeName(o.nodeId);
      const who = o.targetType === 'group' ? 'čeká na skupinu' : o.targetType === 'unit' ? 'čeká na postavu' : 'čeká na volnou postavu';
      html += `<div class="task-row">
        <div class="task-icon">${idx === 0 ? '1️⃣' : act.icon}</div>
        <div class="task-main"><div class="task-name">${esc(act.name)}${qty}${place ? ` <span style="color:#8d8570;font-weight:400">— ${esc(place)}</span>` : ''}</div>
          <div class="task-sub">${esc(who)} • priorita ${o.priority || 0}</div></div>
        <div class="order-actions">
          <button class="btn-sm ghost order-move" data-action="order-up" data-order="${o.id}" title="Posunout nahoru (vyřídí se dřív)" ${idx === 0 ? 'disabled' : ''}>▲</button>
          <button class="btn-sm ghost order-move" data-action="order-down" data-order="${o.id}" title="Posunout dolů" ${idx === sorted.length - 1 ? 'disabled' : ''}>▼</button>
          <button class="btn-sm ghost" data-action="cancel-order" data-order="${o.id}" title="Zrušit příkaz z fronty">Zrušit</button>
        </div>
      </div>`;
    });
    return html;
  }

  G.panelPlace = function () {
    const sel = G.state.selected;
    let html = tutorialBanner() + renderDirectives() + renderActivityDashboard() + renderOrders();
    if (!sel) { html += panelNoSelection(); return html; }
    if (sel.type === 'node') return html + panelNode(sel.id);
    if (sel.type === 'settlement') return html + G.panelTrade(sel.id);
    if (sel.type === 'base') return html + G.panelBase();
    return html + panelNoSelection();
  };

  function panelNoSelection() {
    const active = G.activeQuests ? G.activeQuests() : [];
    let html = `<div class="panel-title">Vyber místo na mapě</div>
      <div class="empty">Ťukni na <b>uzel</b>, <b>sídlo</b> nebo <b>základnu</b>.</div>`;
    if (G.state.worldEvents && G.state.worldEvents.length) {
      html += `<div class="panel-title">Světové události (${G.state.worldEvents.length})</div>`;
      for (const ev of G.state.worldEvents) html += worldEventRow(ev);
    }
    if (active.length) {
      html += `<div class="panel-title">Aktivní zakázky (${active.length}/${G.MAX_ACTIVE_QUESTS})</div>`;
      for (const q of active) html += questMiniRow(q);
    }
    html += `<div class="hint">Tažením posouváš • ＋/− přibližuješ • 🎯 na skupinu</div>`;
    return html;
  }

  function panelNode(nodeId) {
    const n = G.WORLD.nodes.find(x => x.id === nodeId);
    if (!n) return panelNoSelection();
    const kind = G.NODE_KINDS[n.kind];
    const acts = Object.values(G.ACTIVITIES).filter(a => a.nodeKinds.includes(n.kind));
    const danger = G.nodeDanger ? G.nodeDanger(n.kind) : 0;
    const dLabel = G.DANGER_LABEL[danger] || G.DANGER_LABEL[0];
    const idleUnits = G.state.units.filter(u =>
      !u.dead && !u.isChild && !u.onExpedition && !u.assignedTaskId && !u.resting
      && !(G.hasSevereInjury && G.hasSevereInjury(u))
      && !(u.merchantState && u.merchantState.active));
    const risk = G.riskLabel ? G.riskLabel(danger, idleUnits) : null;
    let html = `<div class="loc-head">
      <div class="loc-icon">${kind.icon}</div>
      <div class="loc-main">
        <div class="loc-name">${esc(kind.name)}</div>
        <div class="loc-sub">poloha ${n.x}, ${n.y} • ${G.nodeTiles ? G.nodeTiles(n).length : 1} polí • bohatost ${Math.round(n.richness*100)} %</div>
        <div class="loc-sub" style="color:${dLabel.color}">⚠️ ${dLabel.text}${risk ? ` • ${risk.text}` : ''}</div>
      </div>
    </div>`;
    // Bojovat se dá na každém uzlu, kde se dá narazit na nepřítele (ENCOUNTER_TABLE).
    const canFight = G.ENCOUNTER_TABLE && G.ENCOUNTER_TABLE[n.kind] && idleUnits.length;
    if (canFight) {
      const safety = Math.round(G.partySafety(idleUnits));
      const need = Math.round(Math.max(1, danger) * 22);
      const verdict = danger <= 0 ? 'bezpečný lov' : safety >= need * 1.2 ? 'mělo by to vyjít' : safety >= need * 0.8 ? 'bude to těsné' : 'je to nad síly družiny';
      const rec = G.recommendParty ? G.recommendParty(Math.max(1, danger), idleUnits) : idleUnits;
      html += `<div class="warn-box">⚔️ Můžeš tu bojovat — v okolí se vyskytují nepřátelé. Odhad síly družiny <b>${safety}</b> vs. potřeba <b>${need}</b> — ${verdict}. Doporučená družina: <b>${rec.length}</b> postav.</div>`;
      html += `<button class="btn attack-btn" data-action="attack-here" data-node="${n.id}" title="Pošle do boje všechny volné postavy, ne jen ty u tohoto uzlu">⚔️ Bojovat (všichni)</button>`;
      if (rec.length < idleUnits.length) {
        html += `<button class="btn ghost attack-btn" data-action="attack-here" data-node="${n.id}" data-recommended="1" title="Menší družina s rozumnou šancí — zbytek může dál pracovat">🛡️ Bojovat s doporučenou družinou (${rec.length})</button>`;
      }
    }
    html += `<div class="panel-title">Dostupné práce</div>`;
    if (!acts.length) html += `<div class="empty">Tady se nedá nic dělat.</div>`;
    else {
      for (const a of acts) {
        const req = meetsReq(n, a);
        const tm = G.timeWorkMod ? G.timeWorkMod(a.skill) : 1;
        const tmTag = tm !== 1 ? ` <span style="color:${tm > 1 ? '#8fbf7a' : '#c05a45'}">(${tm > 1 ? '+' : ''}${Math.round((tm-1)*100)} % čas)</span>` : '';
        const qty = a.mode === 'quantity' ? G.qtyClamp(G.qtyGet('act:' + a.id, a.defaultQty || 10), 500) : 1;
        const eta = req.ok ? G.activityEta(a, qty, idleUnits, n) : null;
        const yieldTxt = activityYieldText(a);
        const etaTxt = eta != null ? ` • ⏳ ≈ ${formatSec(eta)} pro ${idleUnits.length} postav` : '';
        html += `<div class="act-row ${req.ok ? '' : 'locked'}">
          <div class="act-icon">${a.icon}</div>
          <div class="act-main">
            <div class="act-name">${esc(a.name)}</div>
            <div class="act-sub">${G.SKILLS[a.skill].icon} ${esc(G.SKILLS[a.skill].name)} • ${G.ATTR_LABEL[a.attr]}${tmTag}</div>
            ${yieldTxt ? `<div class="act-sub" style="color:#8fbf7a">${yieldTxt}${etaTxt}</div>` : ''}
            ${req.ok ? '' : `<div class="act-sub">🔒 ${esc(req.reason)}</div>`}
          </div>
          <div class="act-actions">
            ${a.mode === 'quantity' ? G.qtyControl('act:' + a.id, { value: a.defaultQty || 10, max: 500 }) : ''}
            <button class="btn-sm" ${req.ok ? '' : 'disabled'} data-action="start-task" data-activity="${a.id}" data-node="${n.id}" title="${req.ok ? 'Zadat úkol' : esc(req.reason)}">Start</button>
          </div>
        </div>`;
      }
      html += `<div class="hint">${idleUnits.length ? 'Start přiřadí ' + idleUnits.length + ' volných postav.' : 'Nejsou volné postavy — Start nabídne volbu (přiřadit hned / zařadit do fronty).'}</div>`;
    }
    const local = G.state.tasks.filter(t => t.nodeId === n.id);
    if (local.length) {
      html += `<div class="panel-title">Probíhá zde</div>`;
      for (const t of local) html += taskRowHtml(t);
    }
    return html;
  }

  function taskRowHtml(t) {
    const a = G.ACTIVITIES[t.activityId]; if (!a) return '';
    const p = G.taskProgress(t);
    const names = t.unitIds.map(id => { const u = G.getUnit(id); if (!u) return '?'; return esc(u.name.split(' ')[0]) + (u.mentorId ? ' 🎓' : ''); }).join(', ');
    const label = t.mode === 'quantity' ? `${t.producedQty} / ${t.targetQty}` : `${Math.floor(t.workDone)} / ${t.workRequired}`;
    const place = t.siteName || nodeName(t.nodeId);
    return `<div class="task-row">
      <div class="task-icon">${a.icon}</div>
      <div class="task-main">
        <div class="task-name">${esc(a.name)}${place ? ` <span style="color:#8d8570;font-weight:400">— ${esc(place)}</span>` : ''}</div>
        <div class="task-sub">${names}</div>
        <div class="progress"><div class="progress-bar" style="width:${(p*100).toFixed(1)}%"></div></div>
        <div class="task-sub">${label}${taskEtaText(t)}</div>
      </div>
      <button class="btn-sm danger" data-action="cancel-task" data-task="${t.id}" title="Zrušit úkol (postavy se uvolní)">✕</button>
    </div>`;
  }

  function worldEventRow(ev) {
    const tpl = G.WORLD_EVENTS[ev.templateId]; if (!tpl) return '';
    const left = G.worldEventTimeLeft(ev);
    return `<div class="task-row" style="border-color:${tpl.color}">
      <div class="task-icon">${tpl.icon}</div>
      <div class="task-main">
        <div class="task-name" style="color:${tpl.color}">${esc(tpl.name)}</div>
        <div class="task-sub">${esc(tpl.desc)} • zbývá ${formatSec(left)}</div>
      </div>
    </div>`;
  }
  function questMiniRow(q) {
    const left = G.questTimeLeft(q);
    return `<div class="task-row">
      <div class="task-icon">📜</div>
      <div class="task-main">
        <div class="task-name">${esc(q.text)}</div>
        <div class="task-sub">${q.settlementId && G.WORLD.settlementById[q.settlementId] ? esc(G.WORLD.settlementById[q.settlementId].name) : ''} • zbývá ${formatSec(left)}</div>
      </div>
    </div>`;
  }

  G.panelActivities = function () {
    let html = `<div class="panel-title">Všechny práce</div>`;
    html += `<div class="hint" style="text-align:left;margin-bottom:10px">Start přiřadí <b>všem volným postavám</b> nejbližší vhodný uzel. Když volné nejsou, nabídne se zařazení do fronty.</div>`;
    html += renderOrders();
    for (const a of Object.values(G.ACTIVITIES)) {
      if (a.hidden) continue;
      const req = meetsReq(null, a);
      const node = G.WORLD.nearestNode(a.nodeKinds, G.state.camera.x, G.state.camera.y);
      let nodeInfo = '— žádný uzel v dosahu';
      if (node) { const kind = G.NODE_KINDS[node.kind]; const danger = G.nodeDanger ? G.nodeDanger(node.kind) : 0; const dLabel = G.DANGER_LABEL[danger] || G.DANGER_LABEL[0]; nodeInfo = `${kind.icon} ${esc(kind.name)} <span style="color:${dLabel.color}">(${dLabel.text})</span>`; }
      const idle = idleWorkers();
      const qty = a.mode === 'quantity' ? G.qtyClamp(G.qtyGet('act:' + a.id, a.defaultQty || 10), 500) : 1;
      const eta = (req.ok && node) ? G.activityEta(a, qty, idle, node) : null;
      const yieldTxt = activityYieldText(a);
      const etaTxt = eta != null ? ` • ⏳ ≈ ${formatSec(eta)} pro ${idle.length} postav` : '';
      html += `<div class="act-row ${(req.ok && node) ? '' : 'locked'}">
        <div class="act-icon">${a.icon}</div>
        <div class="act-main">
          <div class="act-name">${esc(a.name)}</div>
          <div class="act-sub">${G.SKILLS[a.skill].icon} ${esc(G.SKILLS[a.skill].name)} • ${nodeInfo}</div>
          ${yieldTxt ? `<div class="act-sub" style="color:#8fbf7a">${yieldTxt}${etaTxt}</div>` : ''}
          ${req.ok ? '' : `<div class="act-sub">🔒 ${esc(req.reason)}</div>`}
        </div>
        <div class="act-actions">
          ${a.mode === 'quantity' ? G.qtyControl('act:' + a.id, { value: a.defaultQty || 10, max: 500 }) : ''}
          <button class="btn-sm" ${(req.ok && node) ? '' : 'disabled'} data-action="start-task" data-activity="${a.id}" title="${req.ok ? (node ? 'Zadat úkol' : 'Žádný vhodný uzel') : esc(req.reason)}">Start</button>
        </div>
      </div>`;
    }
    if (G.state.tasks.length) { html += `<div class="panel-title">Probíhá (${G.state.tasks.length})</div>`; for (const t of G.state.tasks) html += taskRowHtml(t); }
    return html;
  };

  G.recruitCost = function () { const alive = G.state.units.filter(u => !u.dead).length; return Math.max(15, Math.floor(15 * Math.pow(1.55, alive - 3))); };
  function unitMeetsReq(u, a) { if (!a.requires || !a.requires.skillLevel) return true; for (const sid in a.requires.skillLevel) if (G.unitSkill(u, sid) < a.requires.skillLevel[sid]) return false; return true; }
  function unitActivityOptions(u) {
    const out = [];
    for (const aid in G.ACTIVITIES) {
      const a = G.ACTIVITIES[aid];
      if (a.hidden) continue;
      if (!unitMeetsReq(u, a)) continue;
      const node = G.findNodeFor ? G.findNodeFor(aid, [u.id]) : null;
      if (!node) continue;
      out.push(`<option value="${a.id}">${a.icon} ${esc(a.name)}</option>`);
    }
    return out.join('');
  }

  G.panelUnits = function () {
    const s = G.state;
    const alive = s.units.filter(u => !u.dead);
    const dead = s.units.filter(u => u.dead);
    const kids = s.family && s.family.children ? s.family.children : [];
    const resting = alive.filter(u => u.resting);
    let html = `<div class="panel-title">Postavy (${alive.length})</div>`;
    html += `<button class="btn" data-action="recruit">🧙 Najmout postavu (${G.recruitCost()} zlata)</button>`;
    if (resting.length) {
      const lowest = Math.round(Math.min.apply(null, resting.map(u => u.stamina)));
      html += `<button class="btn ghost" data-action="wake-all" title="Odpočívající postavy se vrátí k práci i s nižší výdrží.">☀️ Vzbudit všechny (${resting.length}) — nejnižší výdrž ${lowest} %</button>`;
    }
    for (const u of alive) html += unitCardHtml(u);
    if (kids.length) { html += `<div class="panel-title">Děti (${kids.length})</div>`; for (const c of kids) html += childCardHtml(c); }
    if (dead.length) { html += `<div class="panel-title">Zesnulí (${dead.length})</div>`; for (const u of dead) html += deadCardHtml(u); }
    html += dynastySection();
    return html;
  };

  function dynastySection() {
    if (!G.dynastySummary) return '';
    const d = G.dynastySummary();
    let html = `<div class="panel-title">🌳 Dynastie — generace ${d.generations}</div>`;
    html += `<div class="base-summary"><span class="base-mat">Narození <b>${d.totalBirths}</b></span><span class="base-mat">Úmrtí <b>${d.totalDeaths}</b></span></div>`;
    const gens = Object.keys(d.byGeneration).sort((a, b) => a - b);
    for (const g of gens) {
      const members = d.byGeneration[g];
      html += `<div class="gen-row"><div class="gen-label">Gen. ${g}</div><div class="gen-members">`;
      for (const u of members) {
        const parents = (u.parentIds || []).map(id => G.getUnit(id)).filter(Boolean);
        const parentInfo = parents.length ? `<span class="gen-parents">(${parents.map(p => esc(p.name.split(' ')[0])).join('+')})</span>` : '';
        html += `<span class="gen-member" style="color:${u.color}">${esc(u.name.split(' ')[0])}${parentInfo}</span>`;
      }
      html += `</div></div>`;
    }
    return html;
  }

  function childCardHtml(c) {
    const age = (G.state.time - c.birthTime) / G.AGE_YEAR;
    const a = G.getUnit(c.parentA), b = G.getUnit(c.parentB);
    const parentNames = [a ? a.name.split(' ')[0] : '?', b ? b.name.split(' ')[0] : '?'].join(' & ');
    return `<div class="unit-card child-card">
      <div class="unit-head"><div class="unit-color" style="background:${c.color}"></div><div class="unit-name">${esc(c.name)}</div><div class="unit-lvl">${age.toFixed(1)} let</div></div>
      <div class="unit-task">👶 Dítě rodičů ${esc(parentNames)} — dospěje v ${G.AGE_ADULT} letech.</div>
      <div class="unit-attrs">${G.ATTRS.map(k => `<span class="attr"><b>${k.toUpperCase()}</b>${c.attrs[k]}</span>`).join('')}</div>
    </div>`;
  }

  function deadCardHtml(u) {
    const ageStr = u.deathAge ? `${Math.round(u.deathAge)} let` : '?';
    const reason = u.deserted ? 'dezertoval' : (u.deathReason || 'neznámý');
    const perma = G.currentDifficulty && G.currentDifficulty().permaDeath;
    const canRes = !u.deserted && !perma && G.matCount('potion') >= 3 && G.state.resources.gold >= G.resurrectCost();
    return `<div class="unit-card dead-card">
      <div class="unit-head"><div class="unit-color" style="background:#3a362c"></div><div class="unit-name">⚰️ ${esc(u.name)}</div><div class="unit-lvl">${esc(ageStr)}</div></div>
      <div class="unit-task">Zemřel: ${esc(reason)}${u.generation ? ` • generace ${u.generation}` : ''}</div>
      ${!u.deserted ? `<button class="btn-sm" ${canRes ? '' : 'disabled'} data-action="resurrect" data-unit="${u.id}">✨ Vzkřísit (${G.resurrectCost()} 🪙 + 3 🧪)</button>` : ''}
    </div>`;
  }

  function personalityBar(axisId, value) {
    const axis = G.PERSONALITY_AXES[axisId];
    const label = G.personalityLabel(axisId, value);
    return `<div class="pers-bar"><div class="pers-bar-head"><span>${axis.icon} ${esc(axis.name)}</span><span style="color:${axis.color}">${Math.round(value)} — ${esc(label.text)}</span></div><div class="progress"><div class="progress-bar" style="width:${value}%;background:${axis.color}"></div></div></div>`;
  }

  function journalSection(u) {
    const entries = G.getJournal ? G.getJournal(u) : [];
    if (!entries.length) return '';
    const items = entries.slice(0, 10).map(e => `<div class="journal-entry"><span class="journal-icon">${e.icon || '📌'}</span><div class="journal-main"><div class="journal-msg">${esc(e.msg)}</div><div class="journal-date">${esc(G.journalDateShort(e))}</div></div></div>`).join('');
    return `<details class="unit-journal"><summary>📖 Deník (${entries.length})</summary><div class="journal-list">${items}</div></details>`;
  }

  function synergySection(u) {
    if (!G.activeSynergies) return '';
    const syns = G.activeSynergies(u);
    if (!syns.length) return '';
    return `<div class="unit-abilities" style="background:#1f2a1c;border-radius:6px;padding:4px 8px;margin:4px 0">
      <span style="font-size:10px;color:#8d8570;text-transform:uppercase;letter-spacing:.05em;margin-right:4px">Synergie:</span>
      ${syns.map(s => `<span class="ability-tag" style="background:#2f4a2a;color:#8fbf7a" title="${esc(s.desc)}">${s.icon} ${esc(s.name)}</span>`).join('')}
    </div>`;
  }

  function setBonusSection(u) {
    if (!G.setSummary) return '';
    const sets = G.setSummary(u);
    if (!sets.length) return '';
    return `<div class="unit-abilities" style="background:#332912;border-radius:6px;padding:4px 8px;margin:4px 0">
      <span style="font-size:10px;color:#8d8570;text-transform:uppercase;letter-spacing:.05em;margin-right:4px">Sety:</span>
      ${sets.map(s => `<span class="ability-tag" style="background:#6d5423;color:#e0bb5e" title="${esc(s.desc)}">${s.icon} ${esc(s.name)} (${s.count})</span>`).join('')}
    </div>`;
  }

  function unitCardHtml(u) {
    const s = G.state;
    const age = G.unitAge(u);
    const ageInfo = G.ageLabel(age);
    const task = u.assignedTaskId ? s.tasks.find(t => t.id === u.assignedTaskId) : null;
    let taskName = 'Volno';
    let taskExtra = '';
    if (u.onExpedition) taskName = '⛵ Na expedici';
    else if (u.merchantState && u.merchantState.active) taskName = `Obchodník`;
    else if (task) {
      const ta = G.ACTIVITIES[task.activityId];
      taskName = ta ? ta.name : 'Práce';
      const place = task.siteName || nodeName(task.nodeId);
      taskExtra = (place ? ` • 📍 ${esc(place)}` : '') + esc(taskEtaText(task));
    }
    else if (u.resting) taskName = 'Odpočívá';
    else if (u._refuseUntil && G.state.time < u._refuseUntil) taskName = 'Odmítá pracovat';
    const groupName = u.groupId && G.getGroup(u.groupId) ? G.getGroup(u.groupId).name : '—';
    const stamPct = Math.round(u.stamina);
    const stamColor = stamPct > 50 ? '#8fbf7a' : stamPct > 25 ? '#e0bb5e' : '#c05a45';
    const moodPct = Math.round(u.mood || 70);
    const moodInfo = G.moodLabel ? G.moodLabel(moodPct) : { text:'?', color:'#8d8570' };
    const grief = u.griefUntil && G.state.time < u.griefUntil;
    const insp = G.hasInspiration && G.hasInspiration(u);
    const prof = G.professionOf ? G.professionOf(u) : null;
    const profTag = prof ? `<span class="prof-tag" style="border-color:${prof.color};color:${prof.color}">${prof.icon} ${esc(prof.name)}</span>` : '';
    let mentorTag = '';
    if (u.mentorId) { const m = G.getUnit(u.mentorId); if (m) mentorTag = `<span class="mentor-tag">🎓 ${esc(m.name.split(' ')[0])}</span>`; }
    const statusTags = [];
    if (u.generation && u.generation > 1) statusTags.push(`<span class="status-tag gen">G${u.generation}</span>`);
    if (u.legacy > 0) statusTags.push(`<span class="status-tag legacy">🌳 +${u.legacy}</span>`);
    if (grief) statusTags.push('<span class="status-tag grief">🕊️</span>');
    if (insp) statusTags.push('<span class="status-tag insp">✨</span>');
    if (u._resurrected) statusTags.push('<span class="status-tag res">✨</span>');

    const abilities = G.abilitiesFor ? G.abilitiesFor(u) : [];
    const abilitiesByTier = { 3: [], 8: [], 15: [] };
    for (const a of abilities) {
      if (a.minLevel >= 15) abilitiesByTier[15].push(a);
      else if (a.minLevel >= 8) abilitiesByTier[8].push(a);
      else abilitiesByTier[3].push(a);
    }
    const abilitiesHtml = abilities.length
      ? `<details class="unit-skills" style="margin:6px 0">
          <summary>⚔️ Schopnosti (${abilities.length})</summary>
          <div class="skill-grid" style="gap:6px;margin-top:6px">
            ${abilitiesByTier[15].length ? `<div class="skill-row" style="border:0"><span style="color:#e0bb5e;font-weight:700;font-size:11px">🌟 MISTROVSKÉ (L15)</span></div>` : ''}
            ${abilitiesByTier[15].map(a => `<div class="skill-row"><span>${a.icon} ${esc(a.name)}</span><span class="skill-lv"><small title="${esc(a.desc)}">${G.SKILLS[a.skill].name} 15</small></span></div>`).join('')}
            ${abilitiesByTier[8].length ? `<div class="skill-row" style="border:0;margin-top:4px"><span style="color:#b3a4e8;font-weight:700;font-size:11px">✨ POKROČILÉ (L8)</span></div>` : ''}
            ${abilitiesByTier[8].map(a => `<div class="skill-row"><span>${a.icon} ${esc(a.name)}</span><span class="skill-lv"><small title="${esc(a.desc)}">${G.SKILLS[a.skill].name} 8</small></span></div>`).join('')}
            ${abilitiesByTier[3].length ? `<div class="skill-row" style="border:0;margin-top:4px"><span style="color:#8d8570;font-weight:700;font-size:11px">ZÁKLADNÍ (L3)</span></div>` : ''}
            ${abilitiesByTier[3].map(a => `<div class="skill-row"><span>${a.icon} ${esc(a.name)}</span><span class="skill-lv"><small title="${esc(a.desc)}">${G.SKILLS[a.skill].name} 3</small></span></div>`).join('')}
          </div>
        </details>` : '';

    const injuries = u.injuries || [];
    let healBtn = '';
    if (injuries.length) {
      let bestD = Infinity, bestName = '';
      for (const s of G.WORLD.settlements) {
        const d = Math.hypot(s.x + 0.5 - u.pos.x, s.y + 0.5 - u.pos.y);
        if (d < bestD) { bestD = d; bestName = s.name; }
      }
      const inRange = bestD <= 4;
      healBtn = `<button class="btn-sm ghost" data-action="heal-all" data-unit="${u.id}" ${inRange ? '' : 'disabled'} title="${inRange ? `Vyléčí všechna zranění v sídle ${esc(bestName)}.` : `Nejbližší sídlo ${esc(bestName)} je ${bestD.toFixed(1)} polí daleko — léčba jde jen do 4 polí.`}">Vyléčit</button>`;
    }
    const injuryHtml = injuries.map(inj => {
      const d = G.INJURIES[inj.id];
      const left = Math.max(0, inj.healsAt - s.time);
      const color = G.INJURY_COLOR[d.severity];
      return `<div class="injury-row" style="border-color:${color}"><span class="injury-icon">${d.icon}</span><span class="injury-name" style="color:${color}">${esc(d.name)}</span><span class="injury-time">${formatSec(left)}</span></div>`;
    }).join('');

    let pendingPerks = 0;
    if (G.PERK_LEVELS) for (const sid in u.skills) for (const lv of G.PERK_LEVELS) if (G.unitSkill(u, sid) >= lv && G.canPickPerk(u, sid, lv)) pendingPerks++;
    const perkTag = pendingPerks > 0 ? `<span class="perk-badge">✨ ${pendingPerks}</span>` : '';

    const ambitionsHtml = (u.ambitions || []).map(a => {
      const def = G.getAmbitionDef(a.id); if (!def) return '';
      return `<div class="ambition-item ${a.done ? 'done' : ''}"><span class="ambition-icon">${def.icon}</span><span class="ambition-text">${esc(def.text)}</span>${a.done ? '<span class="ambition-done">✓</span>' : ''}</div>`;
    }).join('');

    const rels = Object.entries(u.relationships || {}).map(([id, v]) => ({ unit: G.getUnit(id), v })).filter(x => x.unit && !x.unit.dead && Math.abs(x.v) > 20).sort((a, b) => Math.abs(b.v) - Math.abs(a.v)).slice(0, 4);
    const relHtml = rels.length ? `<div class="unit-relationships">${rels.map(r => { const lbl = G.relLabel(r.v); return `<span class="rel-tag" style="color:${lbl.color}">${esc(r.unit.name.split(' ')[0])}: ${lbl.text}</span>`; }).join('')}</div>` : '';

    const fam = G.familyOf ? G.familyOf(u) : { parents: [], children: [], pendingChildren: [] };
    const famParts = [];
    if (fam.parents.length) famParts.push(`Rodiče: ${fam.parents.map(p => esc(p.name.split(' ')[0])).join(', ')}`);
    if (fam.children.length) famParts.push(`Děti: ${fam.children.map(c => esc(c.name.split(' ')[0])).join(', ')}`);
    if (fam.pendingChildren.length) famParts.push(`Malé děti: ${fam.pendingChildren.length}`);
    const famHtml = famParts.length ? `<div class="unit-family">${famParts.join(' • ')}</div>` : '';

    const persBars = ['conscientious','openness','stability','agreeableness','extraversion'].map(axisId => personalityBar(axisId, u.personality ? u.personality[axisId] : 50)).join('');

    return `<div class="unit-card ${injuries.length ? 'injured' : ''}">
      <div class="unit-head">
        <div class="unit-color" style="background:${u.color}"></div>
        <div class="unit-name">${esc(u.name)}</div>
        <span class="age-tag" style="color:${ageInfo.color}">${Math.floor(age)} let • ${esc(ageInfo.text)}</span>
        ${perkTag}
        <div class="unit-lvl">Lv ${u.level}</div>
      </div>
      <div class="unit-badges">${profTag}${mentorTag}${statusTags.join('')}</div>
      ${synergySection(u)}
      ${setBonusSection(u)}
      ${abilitiesHtml}
      <div class="unit-attrs">${G.ATTRS.map(a => `<span class="attr"><b>${a.toUpperCase()}</b>${u.attrs[a]}</span>`).join('')}</div>
      <div class="unit-traits">${u.traits.map(t => `<span class="trait" title="${esc(t.desc)}">${esc(t.name)}</span>`).join('')}</div>
      ${injuryHtml}
      <div class="unit-bars">
        <div class="unit-bar"><div class="unit-bar-label">💤 Výdrž <span style="color:${stamColor}">${stamPct} %</span></div><div class="progress"><div class="progress-bar" style="width:${stamPct}%;background:${stamColor}"></div></div></div>
        <div class="unit-bar"><div class="unit-bar-label">${moodPct >= 80 ? '😄' : moodPct >= 50 ? '🙂' : moodPct >= 25 ? '😐' : '😞'} Nálada <span style="color:${moodInfo.color}">${moodInfo.text} (${moodPct})</span></div><div class="progress"><div class="progress-bar" style="width:${moodPct}%;background:${moodInfo.color}"></div></div></div>
      </div>
      ${famHtml}
      ${ambitionsHtml ? `<div class="ambitions-box"><div class="ambitions-label">🎯 Ambice</div>${ambitionsHtml}</div>` : ''}
      ${journalSection(u)}
      <details class="unit-personality"><summary>🎭 Osobnost</summary><div class="pers-grid">${persBars}</div></details>
      ${relHtml}
      <div class="unit-equip">${renderSlot(u, 'tool', '🔧 Nástroj')}${renderSlot(u, 'weapon', '⚔️ Zbraň')}${renderSlot(u, 'armor', '🛡️ Zbroj')}</div>
      <div class="unit-task">${u.onExpedition ? '⛵' : u.merchantState && u.merchantState.active ? '🐎' : u.resting ? '💤' : task ? '⚒️' : '🟢'} ${esc(taskName)}${taskExtra}</div>
      ${(!u.onExpedition && !(u.merchantState && u.merchantState.active) && !u.dead) ? `<select class="unit-task-select" data-change="unit-task" data-unit="${u.id}"><option value="">⚒️ Přiřadit práci…</option>${unitActivityOptions(u)}</select>` : ''}
      <div class="unit-actions">
        <button class="btn-sm ghost" data-action="toggle-manual" data-unit="${u.id}">${u.manual ? '🤖 Auto' : '🎮 Manuálně'}</button>
        ${u.resting ? `<button class="btn-sm ghost" data-action="wake" data-unit="${u.id}">Vzbudit</button>` : ''}
        ${!u.resting && !task && !u.onExpedition && !(u.merchantState && u.merchantState.active) ? `<button class="btn-sm ghost" data-action="rest" data-unit="${u.id}">Odpočívat</button>` : ''}
        ${healBtn}
        <button class="btn-sm ghost" data-action="open-perks" data-unit="${u.id}">✨ Perky${pendingPerks > 0 ? ' (' + pendingPerks + ')' : ''}</button>
        <button class="btn-sm ghost" data-action="open-mentor" data-unit="${u.id}">🎓 Učednictví</button>
        ${!u.onExpedition && !(u.merchantState && u.merchantState.active) ? `<button class="btn-sm ghost" data-action="open-merchant" data-unit="${u.id}">🐎 Obchodník</button>` : ''}
        ${u.onExpedition ? `<span class="hint">⛵ na expedici</span>` : (u.merchantState && u.merchantState.active ? `<button class="btn-sm ghost danger" data-action="stop-merchant" data-unit="${u.id}">🛑 Ukončit</button>` : '')}
      </div>
      <details class="unit-skills"><summary>Dovednosti</summary><div class="skill-grid">
        ${Object.keys(G.SKILLS).map(sid => {
          const lv = G.unitSkill(u, sid); const xp = G.unitSkillXp(u, sid); const need = G.xpForLevel(lv);
          const pm = G.professionSkillMult ? G.professionSkillMult(u, sid) : 1;
          const profLabel = pm > 1 ? `<span class="prof-up">+${Math.round((pm-1)*100)}%</span>` : pm < 1 ? `<span class="prof-down">${Math.round((pm-1)*100)}%</span>` : '';
          const pickedCount = u.perks && u.perks[sid] ? Object.keys(u.perks[sid]).length : 0;
          return `<div class="skill-row"><span>${G.SKILLS[sid].icon} ${esc(G.SKILLS[sid].name)} ${profLabel}${pickedCount ? ` ✨${pickedCount}` : ''}</span><span class="skill-lv">${lv} <small>(${Math.floor(xp)}/${need})</small></span></div>`;
        }).join('')}
      </div></details>
      <div class="unit-groups">👥 Skupina: ${esc(groupName)}</div>
    </div>`;
  }

  function renderSlot(unit, slot, label) {
    const item = unit.equipment[slot];
    if (!item) return `<div class="equip-slot empty"><span class="equip-label">${label}</span><span class="equip-item">— prázdné —</span></div>`;
    const def = G.EQUIPMENT[item.itemId];
    if (!def) return `<div class="equip-slot broken"><span class="equip-label">${label}</span><span class="equip-item">— neznámý předmět (${item.itemId}) —</span></div>`;
    const durPct = Math.round(item.durability / def.durability * 100);
    const durColor = durPct > 60 ? '#8fbf7a' : durPct > 25 ? '#e0bb5e' : '#c05a45';
    const broken = item.durability <= 0;
    const qTag = item.quality && item.quality !== 'common' ? `<span class="q-tag q-${item.quality}">${G.QUALITY_LABEL[item.quality]}</span>` : '';
    const legTag = def.legendary ? `<span class="q-tag q-masterwork">✨ Leg.</span>` : '';
    const gemsTag = item.gems && item.gems.length ? `<span class="q-tag" style="background:#4a3a6b;color:#d8d0f5">${item.gems.map(g => G.GEMS[g] ? G.GEMS[g].icon : '?').join('')}</span>` : '';
    const socketInfo = def.slot === 'armor' || def.slot === 'weapon' ? ` <button class="btn-sm ghost" data-action="socket-modal" data-item="${item.id}">💎</button>` : '';
    return `<div class="equip-slot ${broken ? 'broken' : ''}">
      <span class="equip-label">${label}</span>
      <span class="equip-item">${def.icon} ${esc(def.name)}${qTag}${legTag}${gemsTag}</span>
      <span class="equip-dur" style="color:${durColor}">${Math.round(item.durability)}/${def.durability}</span>
      ${socketInfo}
      <button class="btn-sm ghost" data-action="unequip" data-unit="${unit.id}" data-slot="${slot}">Sundat</button>
    </div>`;
  }

  G.panelGroups = function () {
    const s = G.state;
    let html = `<div class="panel-title">Skupiny (${s.groups.length})</div>`;
    html += `<button class="btn" data-action="create-group">➕ Vytvořit skupinu</button>`;
    const acts = Object.values(G.ACTIVITIES).filter(a => !a.hidden);
    for (const g of s.groups) {
      const members = G.groupMembers(g).filter(u => u && !u.dead);
      const ch = G.groupChemistry(g);
      const avgSafety = G.partySafety(members);
      html += `<div class="group-card">
        <div class="group-head"><div class="group-name">👥 ${esc(g.name)}</div><div class="group-count">${members.length}</div><button class="btn-sm ghost group-rename" data-action="rename-group" data-group="${g.id}" title="Přejmenovat skupinu">✎</button></div>
        <div class="group-stats"><span>Chemie: <b style="color:${ch.color}">${ch.label}</b></span><span>Síla: <b>${Math.round(avgSafety)}</b></span></div>
        <div class="hint" style="text-align:left">Chemie = průměr vztahů mezi členy. Kladná zvyšuje produktivitu i boj, záporná je sráží.</div>
        <div class="group-roles">`;
      for (const roleId in G.ROLES) {
        const r = G.ROLES[roleId];
        const holder = g.roles && g.roles[roleId] ? G.getUnit(g.roles[roleId]) : null;
        const valid = holder && !holder.dead;
        html += `<span class="role-chip ${valid ? 'has' : 'empty'}" title="${r.desc}">${r.icon} ${r.name}: ${valid ? esc(holder.name.split(' ')[0]) : '—'}</span>`;
      }
      html += `</div><div class="group-focus"><label class="v-label">Zaměření</label><select data-change="group-focus" data-group="${g.id}"><option value="">— volná vůle —</option>${acts.map(a => `<option value="${a.id}" ${g.focus === a.id ? 'selected' : ''}>${a.icon} ${esc(a.name)}</option>`).join('')}</select></div>
      <div class="hint" style="text-align:left">Zaměření = trvalý úkol skupiny: jakmile jsou členové volní, sami se na něj vydají.</div>
      <div class="group-members">${members.map(u => `<span class="member-chip" style="border-color:${u.color}">${esc(u.name.split(' ')[0])}${u.resting ? ' 💤' : ''}${(u.injuries && u.injuries.length) ? ' 🩹' : ''}${u.mentorId ? ' 🎓' : ''}${u.merchantState && u.merchantState.active ? ' 🐎' : ''}${u.onExpedition ? ' ⛵' : ''}<button class="chip-x" data-action="kick" data-unit="${u.id}">×</button></span>`).join('') || '<span class="hint">Žádní členové</span>'}</div>
      <div class="group-add"><select data-change="add-to-group" data-group="${g.id}"><option value="">+ přidat člena…</option>${s.units.filter(u => !u.dead && u.groupId !== g.id).sort((a, b) => (a.groupId ? 1 : 0) - (b.groupId ? 1 : 0) || a.name.localeCompare(b.name)).map(u => {
        const og = u.groupId ? G.getGroup(u.groupId) : null;
        return `<option value="${u.id}">${esc(u.name)} — ${og ? `z „${esc(og.name)}"` : 'volný'}</option>`;
      }).join('')}</select></div>
    </div>`;
    }
    return html;
  };

  G.panelExpeditions = function () {
    const list = G.expeditionList ? G.expeditionList() : [];
    let html = `<div class="panel-title">⛵ Expedice (${list.length})</div>`;
    html += `<div class="expedition-hint">Vyšli skupinu na 2–9 herních dní mimo mapu. Riskantní, ale s velkými odměnami. Expedice vyžaduje jídlo (chléb nebo rybu). Na cestě se může stát cokoli.</div>`;
    if (!list.length) html += G.emptyState('Žádná expedice neprobíhá.', 'units', '👥 Vybrat postavy');
    for (const exp of list) {
      const tpl = G.EXPEDITIONS[exp.templateId];
      if (!tpl) continue;
      const units = exp.unitIds.map(id => G.getUnit(id)).filter(Boolean);
      const prog = G.expeditionProgress(exp);
      const left = Math.max(0, exp.endsAt - G.state.time);
      const outcome = exp.outcome;
      const eventCount = (exp.events || []).filter(e => e.resolved).length;
      html += `<div class="expedition-card ${outcome ? 'done' : ''}">
        <div class="exp-head">
          <span class="exp-icon">${tpl.icon}</span>
          <span class="exp-name">${esc(tpl.name)}</span>
          ${outcome ? (outcome === 'success' ? '<span class="exp-outcome win">🎉 Úspěch</span>' : '<span class="exp-outcome lose">💀 Selhání</span>') : `<span class="exp-days">${exp.days} dní • zbývá ${formatSec(left)}</span>`}
        </div>
        <div class="exp-members">${units.map(u => esc(u.name.split(' ')[0])).join(', ')}</div>
        <div class="progress"><div class="progress-bar" style="width:${(prog*100).toFixed(1)}%"></div></div>
        ${exp.foodCost ? `<div class="exp-members" style="color:#8d8570;font-size:11px">🍞 Spotřeba: ${exp.foodCost} jídla</div>` : ''}
        ${eventCount > 0 ? `<div class="exp-members" style="color:#b3a4e8;font-size:11px">🎲 ${eventCount} událostí na cestě</div>` : ''}
        ${exp.drops && exp.drops.length ? `<div class="exp-members" style="color:#8fbf7a">${exp.drops.map(esc).join(' • ')}</div>` : ''}
      </div>`;
    }
    html += `<button class="btn" data-action="open-expedition-modal">➕ Vyslat novou expedici</button>`;
    return html;
  };

  G.expeditionModal = function () {
    const avail = G.availableForExpedition();
    if (avail.length < G.EXPEDITION_MIN_PARTY) {
      return `<div class="perk-panel"><div class="perk-header">⛵ Vyslat expedici</div><div class="perk-hint">Potřebuješ alespoň ${G.EXPEDITION_MIN_PARTY} volné postavy.</div><div class="perk-actions"><button class="btn" data-action="close-modal">Zavřít</button></div></div>`;
    }
    let html = `<div class="perk-panel"><div class="perk-header">⛵ Vyslat expedici</div><div class="perk-hint">Vyber expedici a označ ${G.EXPEDITION_MIN_PARTY}–${G.EXPEDITION_MAX_PARTY} postav. Expedice spotřebuje jídlo (chléb/ryba) na cestu. Postavy, které zrovna pracují, o svůj úkol přijdou.</div><div class="panel-title">1. Vyber expedici</div>`;
    for (const id in G.EXPEDITIONS) {
      const tpl = G.EXPEDITIONS[id];
      const rewards = (tpl.rewardPool || []).map(r => G.MATERIALS[r.material] ? G.MATERIALS[r.material].icon : '💎').join(' ');
      const food = G.expeditionFoodCost ? G.expeditionFoodCost(id, G.EXPEDITION_MIN_PARTY) : 0;
      html += `<button class="expedition-pick" data-action="select-expedition" data-expedition="${id}">
        <div class="exp-pick-head"><span class="exp-pick-icon">${tpl.icon}</span> <b>${esc(tpl.name)}</b></div>
        <div class="exp-pick-desc">${esc(tpl.desc)}</div>
        <div class="exp-pick-info">${tpl.minDays}–${tpl.maxDays} dní • obtížnost ${tpl.difficulty}/5 • 🍞 ${food} jídla za ${G.EXPEDITION_MIN_PARTY} postavy${rewards ? ` • odměny: ${rewards}` : ''}</div>
      </button>`;
    }
    html += `<div class="panel-title">2. Označ postavy</div><div class="member-picker" id="exp-member-picker">`;
    for (const u of avail) {
      const busy = u.assignedTaskId ? ' • ⚒️ pracuje (přeruší se)' : ' • 🟢 volný';
      html += `<button class="member-pick" data-action="toggle-exp-member" data-unit="${u.id}" data-selected="false">${esc(u.name)} <span style="opacity:.6">(Lv${u.level}, ⚔${Math.round(G.unitCombatPower(u))}${busy})</span></button>`;
    }
    html += `</div><div class="exp-pick-count" id="exp-pick-count">Vybráno <b>0</b> / ${G.EXPEDITION_MIN_PARTY}–${G.EXPEDITION_MAX_PARTY} • 🍞 0 • šance ≈ —</div>`;
    html += `<div class="perk-actions"><button class="btn" data-action="confirm-expedition">⛵ Vyslat</button><button class="btn ghost" data-action="close-modal">Zavřít</button></div></div>`;
    return html;
  };

  G.panelCraft = function () {
    let html = `<div class="panel-title">Dílny</div>
      <div class="hint" style="text-align:left">Přístup = postava je v dosahu sídla (nebo základny), kde dílna stojí.</div>`;
    const status = G.workshopStatus();
    for (const st of status) {
      const w = st.workshop;
      const access = G.workshopAccessCount(w.id);
      let statusText = '', statusColor = '#8d8570';
      if (access > 0) { statusText = `${access} postav má přístup`; statusColor = '#8fbf7a'; }
      else if (st.onBase) { statusText = 'na základně'; statusColor = '#e0bb5e'; }
      else if (st.available) { statusText = `v sídle ${st.where}`; statusColor = '#e0bb5e'; }
      else { statusText = 'nedostupná'; statusColor = '#c05a45'; }
      html += `<div class="workshop-status-row"><span class="ws-icon">${w.icon}</span><span class="ws-name">${esc(w.name)}</span><span class="ws-state" style="color:${statusColor}">${esc(statusText)}</span></div>`;
    }
    html += `<div class="panel-title">Recepty</div>`;
    for (const rid in G.RECIPES) {
      const r = G.RECIPES[rid];
      const check = G.canCraft(rid);
      const best = bestSkill(r.skill);
      const io = r.inputs.map(i => `${G.MATERIALS[i.material].icon} ${i.qty}× ${esc(G.MATERIALS[i.material].name)} (${G.matCount(i.material)})`).join(' + ') + ` → ${G.MATERIALS[r.output.material].icon} ${r.output.qty || 1}×`;
      const wInfo = r.workshop ? ` • ${G.WORKSHOPS[r.workshop].icon}` : '';
      html += `<div class="recipe-row ${check.ok ? '' : 'locked'}">
        <div class="recipe-icon">${r.icon}</div>
        <div class="recipe-main">
          <div class="recipe-name">${esc(r.name)}</div>
          <div class="recipe-sub">${G.SKILLS[r.skill].icon} ${esc(G.SKILLS[r.skill].name)} ${r.reqLevel} (máš ${best})${wInfo}</div>
          <div class="recipe-io">${io}</div>
          ${check.ok ? '' : `<div class="act-sub" style="color:#c05a45">🔒 ${esc(check.reason)}</div>`}
        </div>
        <div class="act-actions">
          ${G.qtyControl('recipe:' + rid, { value: 1, max: G.maxCraftable(r), maxLabel: true })}
          <button class="btn-sm" ${check.ok ? '' : 'disabled'} data-action="craft" data-recipe="${rid}" title="${check.ok ? 'Vyrobit zvolené množství' : esc(check.reason)}">Vyrobit</button>
        </div>
      </div>`;
    }
    // Automatická výroba — hra si sama doplní zásobu, když je pod cílem
    html += `<div class="panel-title">Udržovat zásobu</div>
      <div class="hint" style="text-align:left">Hra bude tyhle výrobky <b>vyrábět sama</b>, dokud jich nebudeš mít tolik, kolik nastavíš. Potřebuje k tomu dílnu (v sídle nebo na základně) a postavu v jejím dosahu.</div>`;
    const prodOpts = [0, 5, 10, 25, 50];
    for (const mid in G.PRODUCTION_RECIPES) {
      const target = G.productionOrder(mid);
      const m = G.MATERIALS[mid];
      html += `<div class="prod-row"><span class="prod-name">${m.icon} ${esc(m.name)} <small style="color:#8d8570">(máš ${G.matCount(mid)})</small></span>
        <select data-change="prod-order" data-material="${mid}">${prodOpts.map(v => `<option value="${v}" ${target === v ? 'selected' : ''}>${v === 0 ? 'vypnuto' : 'držet ' + v + '×'}</option>`).join('')}</select>
      </div>`;
    }
    return html;
  };

  G.panelInventory = function () {
    let html = `<div class="panel-title">Materiály</div>`;
    const rows = [];
    for (const mid in G.MATERIALS) {
      const count = G.matCount(mid);
      if (count === 0) continue;
      const m = G.state.materials[mid] || {};
      const qualities = Object.keys(m).filter(q => m[q] > 0);
      rows.push(`<div class="inv-row"><div class="inv-icon">${G.MATERIALS[mid].icon}</div><div class="inv-main"><div class="inv-name">${esc(G.MATERIALS[mid].name)} <span style="color:#8d8570;font-weight:400">×${count}</span></div><div class="inv-q">${qualities.map(q => `<span class="q-tag q-${q}">${G.QUALITY_LABEL[q]}: ${m[q]}</span>`).join(' ')}</div></div></div>`);
    }
    // Gemy
    const gemRows = [];
    for (const gid in G.GEMS) {
      const cnt = G.matCount('gem_' + gid);
      if (cnt === 0) continue;
      gemRows.push(`<div class="inv-row"><div class="inv-icon">${G.GEMS[gid].icon}</div><div class="inv-main"><div class="inv-name">${esc(G.GEMS[gid].name)} <span style="color:#8d8570;font-weight:400">×${cnt}</span></div><div class="inv-q">${esc(G.GEMS[gid].desc)}</div></div></div>`);
    }
    html += rows.length ? rows.join('') : G.emptyState('Batoh je prázdný — pošli postavy sbírat suroviny.', 'activities', '⚒️ Práce');
    if (gemRows.length) { html += `<div class="panel-title">💎 Gemy</div>`; html += gemRows.join(''); }
    const mw = G.state.masterworks || [];
    if (mw.length) {
      html += `<div class="panel-title">✨ Mistrovská díla (${mw.length})</div>`;
      for (const item of mw.slice(-10).reverse()) html += `<div class="masterwork-row"><span class="mw-icon">✨</span><div class="mw-main"><div class="mw-name">${esc(item.name)}</div><div class="mw-sub">${esc(item.craftsman)} • ${esc(item.recipe)}</div></div></div>`;
    }
    return html;
  };

  G.panelReputation = function () {
    let html = `<div class="panel-title">Vztahy se sídly</div>`;
    for (const s of G.WORLD.settlements) {
      const v = (G.state.settlementRep && G.state.settlementRep[s.id]) || 0;
      const mods = G.settlementRepMods(s.id);
      const color = v >= 40 ? '#8fbf7a' : v >= 15 ? '#9ed48c' : v >= -15 ? '#9c937c' : '#c05a45';
      const pct = Math.min(100, Math.max(0, (v + 100) / 220 * 100));
      html += `<div class="rep-row"><div class="rep-icon">${G.SETTLEMENT_SIZE[s.size].icon}</div><div class="rep-main"><div class="rep-name">${esc(s.name)}</div><div class="rep-motto">${mods.tier} • nákup ×${mods.buyMult.toFixed(2)} • prodej ×${mods.sellMult.toFixed(2)}</div><div class="progress"><div class="progress-bar" style="width:${pct}%;background:${color}"></div></div></div><div class="rep-value" style="color:${color}">${v.toFixed(0)}</div></div>`;
    }
    html += `<div class="panel-title">Reputace frakcí</div>`;
    for (const r of G.reputationSummary()) {
      html += `<div class="rep-row"><div class="rep-icon" style="color:${r.faction.color}">${r.faction.icon}</div><div class="rep-main"><div class="rep-name">${esc(r.faction.name)}</div><div class="rep-motto">${esc(r.faction.motto)}</div></div><div class="rep-value" style="color:${r.tier.color}">${r.value.toFixed(1)}<small>${esc(r.tier.name)}</small></div></div>`;
    }
    return html;
  };

  G.panelPolitics = function () {
    if (!G.politicsOverview) return `<div class="empty">Politika není dostupná.</div>`;
    const overview = G.politicsOverview();
    let html = `<div class="panel-title">🏛️ Politika</div>
      <div class="hint" style="text-align:left">Vítězný program platí pro celou frakci do dalších voleb. Podpora stojí zlato — každá další podpora stejného kandidáta je o 100 🪙 dražší.</div>`;
    for (const o of overview) {
      const f = o.faction, st = o.phase;
      if (st === 'election') {
        html += `<div class="politics-card active" style="border-color:${f.color}"><div class="politics-head"><span style="color:${f.color}">${f.icon} ${esc(f.name)}</span><span class="politics-badge">VOLBY</span></div><div class="hint" style="text-align:left">Zbývá ${formatSec(o.phaseEndsAt - G.state.time)}</div>`;
        for (const c of o.candidates) {
          const prog = G.POLITICAL_PROGRAMS[c.program];
          const isPlayer = c.isPlayer;
          const supportPrice = G.supportPrice(f.id);
          const effects = G.programEffectsText ? G.programEffectsText(prog) : '';
          html += `<div class="politics-candidate ${isPlayer ? 'player' : ''}"><div class="candidate-name">${isPlayer ? '👑 ' : ''}${esc(c.name)}</div><div class="candidate-program" title="${esc(prog.desc)}">${prog.icon} ${esc(prog.name)}</div>${effects ? `<div class="candidate-effects">${esc(prog.desc)} — <b>${esc(effects)}</b></div>` : ''}${!isPlayer ? `<button class="btn-sm ghost" data-action="support-candidate" data-faction="${f.id}" data-candidate="${c.id}" title="${esc(prog.desc)}">Podpořit (${supportPrice} 🪙)</button>` : ''}</div>`;
        }
        html += `</div>`;
      } else if (o.winner) {
        const prog = G.POLITICAL_PROGRAMS[o.winner.program];
        const effects = G.programEffectsText ? G.programEffectsText(prog) : '';
        html += `<div class="politics-card" style="border-color:${f.color}"><div class="politics-head"><span style="color:${f.color}">${f.icon} ${esc(f.name)}</span><span class="politics-badge">${esc(o.winner.name.split(' ')[0])}</span></div><div class="politics-winner">${prog.icon} ${esc(prog.name)}</div><div class="candidate-effects">${esc(prog.desc)}${effects ? ` — <b>${esc(effects)}</b>` : ''}</div></div>`;
      } else {
        const left = o.nextElection - G.state.time;
        html += `<div class="politics-card" style="border-color:${f.color}"><div class="politics-head"><span style="color:${f.color}">${f.icon} ${esc(f.name)}</span><span class="politics-badge">klid</span></div><div class="rep-motto">Další volby za ${formatSec(left)}</div></div>`;
      }
    }
    return html;
  };

  G.panelLog = function () {
    const filter = G.state.logFilter || 'all';
    const time = G.state.logTime || 'all';
    const cats = ['all'].concat(G.LOG_CATEGORIES || []);
    const labels = { all:'Vše', info:'Info', work:'Práce', economy:'Ekonomika', combat:'Boj', story:'Příběh', social:'Social', politics:'Politika' };
    const timeOpts = { all:'Celá historie', '5m':'Posledních 5 min', '1h':'Poslední hodina', '1d':'Poslední den', '1w':'Poslední týden' };
    let html = `<div class="panel-title">Log</div><div class="log-filters">`;
    for (const c of cats) html += `<button class="log-filter ${filter === c ? 'active' : ''}" data-log-filter="${c}">${labels[c] || c}</button>`;
    html += `</div><select id="log-time" class="log-time" data-change="log-time" title="Filtr podle herního času">`;
    for (const k in timeOpts) html += `<option value="${k}" ${time === k ? 'selected' : ''}>${timeOpts[k]}</option>`;
    html += `</select><input type="text" id="log-search" class="log-search" placeholder="🔍 Hledat v logu…" value="${esc(G.state.logSearch || '')}" />`;
    html += `<div id="log-count" class="log-count"></div>`;
    html += `<div id="log-list" class="log-list"></div>`;
    return html;
  };

  G.panelAchievements = function () {
    let html = '';
    if (G.storySection) { const s = G.storySection(); if (s) html += s; }
    if (G.achievementsSection) html += G.achievementsSection();
    return html || `<div class="empty">Žádné cíle.</div>`;
  };

  G.panelPrestige = function () {
    let html = '';
    if (G.prestigeStatus) {
      const st = G.prestigeStatus();
      const lvl = (G.state.prestige && G.state.prestige.level) || 0;
      const unlocks = (G.state.prestige && G.state.prestige.unlocks) || [];
      html += `<div class="panel-title">Prestiž (New Game+) — úr. ${lvl}</div><div class="prestige-card ${st.ok ? 'ready' : ''}">`;
      if (lvl > 0) html += `<div class="prestige-head"><div class="prestige-level">⭐ Úroveň ${lvl}</div><div class="prestige-bonus">+${lvl*15} % XP</div></div>`;
      if (unlocks.length) {
        html += `<div class="unlock-list">`;
        for (const uid of unlocks) { const u = G.UNLOCKS[uid]; if (!u) continue; html += `<div class="unlock-chip" title="${esc(u.desc)}">${u.icon} ${esc(u.name)}</div>`; }
        html += `</div>`;
      }
      html += `<div class="prestige-reqs">`;
      for (const it of st.items) {
        const pct = Math.min(100, it.need > 0 ? (it.have/it.need)*100 : 100);
        html += `<div class="prestige-req ${it.ok ? 'done' : ''}"><div class="prestige-req-top"><span>${it.ok ? '✅' : '⬜'} ${esc(it.label)}</span><span>${Math.floor(it.have)} / ${it.need}</span></div><div class="progress"><div class="progress-bar" style="width:${pct.toFixed(1)}%;${it.ok ? 'background:#8fbf7a' : ''}"></div></div></div>`;
      }
      html += `</div>`;
      if (st.ok) html += `<button class="btn prestige-btn" data-action="do-prestige">🌟 Prestiž ${lvl+1} — nový svět</button>`;
      else html += `<div class="hint">Splň všechny 4 podmínky.</div>`;
      html += `</div>`;
    }
    html += `<div class="panel-title">Záloha hry</div><div class="save-section"><div class="save-info">Uložení je v prohlížeči. Pro jistotu si udělej export.</div><button class="btn" data-action="export-save">💾 Exportovat save</button><button class="btn ghost" data-action="import-save">📥 Importovat save</button></div>`;
    return html;
  };

  G.perkPanel = function (unitId) {
    const u = G.getUnit(unitId); if (!u) return null;
    let html = `<div class="perk-panel"><div class="perk-header">${G.esc(u.name)} — Perky</div><div class="perk-hint">Respec ${G.RESPEC_COST} 🪙.</div>`;
    let any = false;
    for (const sid in G.SKILLS) {
      const lvl = G.unitSkill(u, sid);
      const levels = G.PERK_LEVELS.filter(l => lvl >= l);
      if (!levels.length) continue;
      any = true;
      html += `<div class="perk-skill"><div class="perk-skill-title">${G.SKILLS[sid].icon} ${G.esc(G.SKILLS[sid].name)} <span class="perk-skill-lvl">úr. ${lvl}</span></div>`;
      for (const l of levels) {
        const picked = G.perkAt(u, sid, l);
        const choices = G.perkChoices(u, sid, l);
        if (picked) {
          const p = choices.find(c => c.id === picked);
          html += `<div class="perk-chosen"><span class="perk-lvl">L${l}</span><span class="perk-name">${p ? G.esc(p.name) : picked}</span></div>`;
        } else {
          html += `<div class="perk-choices"><div class="perk-lvl-badge">L${l}</div>${choices.map(c => `<button class="perk-pick" data-action="pick-perk" data-unit="${u.id}" data-skill="${sid}" data-level="${l}" data-perk="${c.id}"><span class="perk-name">${G.esc(c.name)}</span><span class="perk-desc">${G.esc(c.desc)}</span></button>`).join('')}</div>`;
        }
      }
      html += `</div>`;
    }
    if (!any) html += G.emptyState('Zatím žádné perky — zvyšuj dovednosti postav.', 'units', '🧙 Postavy');
    html += `<div class="perk-actions"><button class="btn" data-action="close-modal">Zavřít</button></div></div>`;
    return html;
  };

  G.mentorPanel = function (unitId) {
    const u = G.getUnit(unitId); if (!u) return null;
    let html = `<div class="perk-panel"><div class="perk-header">${G.esc(u.name)} — Učednictví</div>`;
    if (u.mentorId) { const m = G.getUnit(u.mentorId); if (m) html += `<div class="mentor-current"><div>Mistr: <b>${G.esc(m.name)}</b></div><button class="btn-sm danger" data-action="clear-mentor" data-unit="${u.id}">Zrušit</button></div>`; }
    else html += `<div class="perk-hint">Mistr musí mít dovednost o ${G.MENTOR_MIN_DIFF} úrovní výš.</div>`;
    const mentors = G.availableMentors(unitId);
    if (!mentors.length) html += G.emptyState('Žádný vhodný mistr — někdo s dovedností o 8+ úrovní výš.', 'units', '🧙 Postavy');
    else {
      html += `<div class="mentor-list">`;
      for (const m of mentors) { const mm = m.mentor; html += `<button class="mentor-pick" data-action="set-mentor" data-apprentice="${u.id}" data-mentor="${mm.id}"><div class="mentor-name">${G.esc(mm.name)} <span class="mentor-diff">+${m.diff}</span></div><div class="mentor-skill">${G.SKILLS[m.skill].icon} ${G.esc(G.SKILLS[m.skill].name)}</div></button>`; }
      html += `</div>`;
    }
    html += `<div class="perk-actions"><button class="btn" data-action="close-modal">Zavřít</button></div></div>`;
    return html;
  };

  /* SOCKET MODAL — Fáze 8 */
  G.socketModal = function (equipInstanceId) {
    const item = G.equipFind(equipInstanceId);
    if (!item) return `<div class="empty">Předmět nenalezen.</div>`;
    const def = G.EQUIPMENT[item.itemId];
    const max = G.maxSockets(item.itemId);
    if (max <= 0) return `<div class="empty">Tento předmět nemá sockety.</div>`;
    const gemsIn = G.gemsIn(item);
    let html = `<div class="perk-panel"><div class="perk-header">💎 ${esc(def.name)}</div>`;
    html += `<div class="perk-hint">Sockety ${gemsIn.length}/${max}. Vyjmutí gemy má 50 % šanci na zničení.</div>`;
    html += `<div class="panel-title">Aktivní gemy</div>`;
    if (!gemsIn.length) html += `<div class="empty">Žádné gemy.</div>`;
    else {
      for (let i = 0; i < gemsIn.length; i++) {
        const g = G.GEMS[gemsIn[i]];
        html += `<div class="task-row"><div class="task-icon">${g.icon}</div><div class="task-main"><div class="task-name">${esc(g.name)}</div><div class="task-sub">${esc(g.desc)}</div></div><button class="btn-sm danger" data-action="unsocket-gem" data-item="${item.id}" data-index="${i}">Vyjmout</button></div>`;
      }
    }
    html += `<div class="panel-title">Dostupné gemy</div>`;
    let any = false;
    for (const gid in G.GEMS) {
      const cnt = G.matCount('gem_' + gid);
      if (cnt === 0) continue;
      any = true;
      const g = G.GEMS[gid];
      html += `<div class="task-row"><div class="task-icon">${g.icon}</div><div class="task-main"><div class="task-name">${esc(g.name)} <span style="color:#8d8570;font-weight:400">×${cnt}</span></div><div class="task-sub">${esc(g.desc)}</div></div><button class="btn-sm" data-action="socket-gem" data-item="${item.id}" data-gem="${gid}">Vložit</button></div>`;
    }
    if (!any) html += `<div class="empty">Nemáš žádné gemy.</div>`;
    html += `<div class="perk-actions"><button class="btn ghost" data-action="close-modal">Zavřít</button></div></div>`;
    return html;
  };

  G.renderLog = function () {
    const el = document.getElementById('log-list');
    if (!el || !G.state) return;
    const filter = G.state.logFilter || 'all';
    const time = G.state.logTime || 'all';
    const query = String(G.state.logSearch || '').trim().toLowerCase();
    const win = { '5m':300, '1h':3600, '1d':86400, '1w':604800 }[time] || 0;
    const now = G.state.time;
    const lines = G.state.log.slice(-150).reverse();
    let filtered = filter === 'all' ? lines : lines.filter(l => l.cat === filter);
    if (win) filtered = filtered.filter(l => (now - l.t) <= win);
    if (query) filtered = filtered.filter(l => String(l.msg).toLowerCase().indexOf(query) !== -1);
    const counter = document.getElementById('log-count');
    if (counter) {
      const active = (query || filter !== 'all' || time !== 'all');
      counter.textContent = active
        ? `Zobrazeno ${Math.min(80, filtered.length)} / ${filtered.length} zpráv`
        : `${filtered.length} zpráv (zobrazuji posledních 80)`;
    }
    el.innerHTML = filtered.slice(0, 80).map(e => `<div class="log-line log-${e.cat || 'info'}"><span class="log-time" title="Herní čas">${formatClock(e.t)}</span>${esc(e.msg)}</div>`).join('');
  };
})();
