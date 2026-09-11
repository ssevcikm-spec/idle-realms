(function () {
  const G = window.Game;
  function esc(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  G.esc = esc;
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

  /* ===================== MÍSTO ===================== */

  function renderDirectives() {
    const dir = G.state.directives || { focusMaterial: null, avoidDanger: false };
    const mats = ['wood','stone','fiber','herb','grain','hide','fish','coal','iron_ore','crystal'];
    const chips = mats.map(m => {
      const active = dir.focusMaterial === m ? ' active' : '';
      const def = G.MATERIALS[m];
      return `<button class="dir-chip${active}" data-action="set-directive-focus" data-material="${m}">${def.icon} ${esc(def.name)}</button>`;
    }).join('');
    const autoActive = dir.focusMaterial ? '' : ' active';
    const dangerActive = dir.avoidDanger ? ' active' : '';
    return `<div class="directives">
      <div class="panel-title">🧭 Směrnice — čemu se autonomně věnovat</div>
      <button class="dir-chip${autoActive}" data-action="set-directive-focus" data-material="">✨ Auto</button>${chips}
      <div class="dir-row"><button class="dir-chip${dangerActive}" data-action="toggle-directive-danger">🛡️ Vyhýbat se nebezpečí</button></div>
    </div>`;
  }

  function unitStatusLabel(u) {
    if (u.dead) return { icon:'💀', text:'Mrtev' };
    if (u.onExpedition) return { icon:'⛵', text:'Na expedici' };
    if (u.resting) return { icon:'😴', text:'Odpočívá' };
    if (u.merchantState && u.merchantState.active) return { icon:'🐎', text:'Obchoduje' };
    if (u.assignedTaskId) {
      const t = G.state.tasks.find(x => x.id === u.assignedTaskId);
      if (t) { const a = G.ACTIVITIES[t.activityId]; return { icon: a ? a.icon : '⚒️', text: a ? a.name : 'Pracuje' }; }
    }
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

  G.panelPlace = function () {
    const sel = G.state.selected;
    let html = renderDirectives() + renderActivityDashboard() + renderExpeditions();
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
    if (G.politicsOverview) {
      const overview = G.politicsOverview();
      const elections = overview.filter(o => o.phase === 'election');
      if (elections.length) {
        html += `<div class="panel-title">🏛️ Probíhající volby</div>`;
        for (const o of elections) {
          html += `<div class="task-row" style="border-color:${o.faction.color}">
            <div class="task-icon">${o.faction.icon}</div>
            <div class="task-main">
              <div class="task-name" style="color:${o.faction.color}">${esc(o.faction.name)}</div>
              <div class="task-sub">zbývá ${formatSec(o.phaseEndsAt - G.state.time)}</div>
            </div>
          </div>`;
        }
      }
    }
    if (active.length) {
      html += `<div class="panel-title">Aktivní zakázky (${active.length}/${G.MAX_ACTIVE_QUESTS})</div>`;
      for (const q of active) html += questMiniRow(q);
    }
    if (G.storySection) { const s = G.storySection(); if (s) html += s; }
    html += `<div class="hint">Tažením posouváš • ＋/− přibližuješ • 🎯 na skupinu</div>`;
    return html;
  }

  function renderExpeditions() {
    if (!G.EXPEDITIONS) return '';
    const list = G.expeditionList();
    let html = `<div class="panel-title">⛵ Expedice (${list.length})</div>`;
    if (!list.length) {
      html += `<div class="expedition-hint">Vyšli skupinu na 2–9 herních dní mimo mapu. Riskantní, ale s velkými odměnami.</div>`;
    }
    for (const exp of list) {
      const tpl = G.EXPEDITIONS[exp.templateId];
      if (!tpl) continue;
      const units = exp.unitIds.map(id => G.getUnit(id)).filter(Boolean);
      const prog = exp.expeditionProgress(exp);
      const left = Math.max(0, exp.endsAt - G.state.time);
      const outcome = exp.outcome;
      html += `<div class="expedition-card ${outcome ? 'done' : ''}">
        <div class="exp-head">
          <span class="exp-icon">${tpl.icon}</span>
          <span class="exp-name">${esc(tpl.name)}</span>
          ${outcome
            ? (outcome === 'success' ? '<span class="exp-outcome win">🎉 Úspěch</span>' : '<span class="exp-outcome lose">💀 Selhání</span>')
            : `<span class="exp-days">${exp.days} dní • zbývá ${formatSec(left)}</span>`}
        </div>
        <div class="exp-members">${units.map(u => esc(u.name.split(' ')[0])).join(', ')}</div>
        <div class="progress"><div class="progress-bar" style="width:${(prog*100).toFixed(1)}%"></div></div>
      </div>`;
    }
    html += `<button class="btn" data-action="open-expedition-modal">➕ Vyslat novou expedici</button>`;
    return html;
  }

  G.expeditionModal = function () {
    const avail = G.availableForExpedition();
    if (avail.length < G.EXPEDITION_MIN_PARTY) {
      return `<div class="perk-panel">
        <div class="perk-header">⛵ Vyslat expedici</div>
        <div class="perk-hint">Potřebuješ alespoň ${G.EXPEDITION_MIN_PARTY} volné postavy.</div>
        <div class="perk-actions"><button class="btn" data-action="close-modal">Zavřít</button></div>
      </div>`;
    }
    let html = `<div class="perk-panel">
      <div class="perk-header">⛵ Vyslat expedici</div>
      <div class="perk-hint">Vyber expedici a označ ${G.EXPEDITION_MIN_PARTY}–${G.EXPEDITION_MAX_PARTY} postav.</div>
      <div class="panel-title">1. Vyber expedici</div>`;
    for (const id in G.EXPEDITIONS) {
      const tpl = G.EXPEDITIONS[id];
      html += `<button class="expedition-pick" data-action="select-expedition" data-expedition="${id}">
        <div class="exp-pick-head"><span class="exp-pick-icon">${tpl.icon}</span> <b>${esc(tpl.name)}</b></div>
        <div class="exp-pick-desc">${esc(tpl.desc)}</div>
        <div class="exp-pick-info">${tpl.minDays}–${tpl.maxDays} dní • obtížnost ${tpl.difficulty}/5</div>
      </button>`;
    }
    html += `<div class="panel-title">2. Označ postavy</div>
      <div class="member-picker" id="exp-member-picker">`;
    for (const u of avail) {
      html += `<button class="member-pick" data-action="toggle-exp-member" data-unit="${u.id}" data-selected="false">
        ${esc(u.name)} <span style="opacity:.6">(Lv${u.level}, ⚔${Math.round(G.unitCombatPower(u))})</span>
      </button>`;
    }
    html += `</div>
      <div class="perk-actions">
        <button class="btn" data-action="confirm-expedition">⛵ Vyslat</button>
        <button class="btn ghost" data-action="close-modal">Zavřít</button>
      </div>
    </div>`;
    return html;
  };

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
        <div class="loc-sub">poloha ${n.x}, ${n.y} • bohatost ${Math.round(n.richness*100)} %</div>
        <div class="loc-sub" style="color:${dLabel.color}">⚠️ ${dLabel.text}${risk ? ` • ${risk.text}` : ''}</div>
      </div>
    </div>`;
    if (danger >= 2 && idleUnits.length) {
      html += `<div class="warn-box">💡 Posíláš ${idleUnits.length} postav. Odhad síly: ${Math.round(G.partySafety(idleUnits))} / potřeba ${Math.round(danger*22)}.</div>`;
      html += `<button class="btn attack-btn" data-action="attack-here" data-node="${n.id}">⚔️ Zaútočit</button>`;
    }
    html += `<div class="panel-title">Dostupné práce</div>`;
    if (!acts.length) html += `<div class="empty">Tady se nedá nic dělat.</div>`;
    else {
      for (const a of acts) {
        const req = meetsReq(n, a);
        const tm = G.timeWorkMod ? G.timeWorkMod(a.skill) : 1;
        const tmTag = tm !== 1 ? ` <span style="color:${tm > 1 ? '#8fbf7a' : '#c05a45'}">(${tm > 1 ? '+' : ''}${Math.round((tm-1)*100)} % čas)</span>` : '';
        html += `<div class="act-row ${req.ok ? '' : 'locked'}">
          <div class="act-icon">${a.icon}</div>
          <div class="act-main">
            <div class="act-name">${esc(a.name)}</div>
            <div class="act-sub">${G.SKILLS[a.skill].icon} ${esc(G.SKILLS[a.skill].name)} • ${G.ATTR_LABEL[a.attr]}${tmTag}</div>
            ${req.ok ? '' : `<div class="act-sub">🔒 ${esc(req.reason)}</div>`}
          </div>
          <div class="act-actions">
            ${a.mode === 'quantity' ? `<input type="number" min="1" max="500" value="${a.defaultQty || 10}" class="qty-input" data-qty-for="${a.id}" />` : ''}
            <button class="btn-sm" ${(req.ok && idleUnits.length) ? '' : 'disabled'} data-action="start-task" data-activity="${a.id}" data-node="${n.id}" title="${req.ok ? (idleUnits.length ? '' : 'Žádné volné postavy') : esc(req.reason)}">Start</button>
          </div>
        </div>`;
      }
      html += `<div class="hint">Start přiřadí ${idleUnits.length} volných postav.</div>`;
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
    const names = t.unitIds.map(id => {
      const u = G.getUnit(id); if (!u) return '?';
      return esc(u.name.split(' ')[0]) + (u.mentorId ? ' 🎓' : '');
    }).join(', ');
    const label = t.mode === 'quantity' ? `${t.producedQty} / ${t.targetQty}` : `${Math.floor(t.workDone)} / ${t.workRequired}`;
    return `<div class="task-row">
      <div class="task-icon">${a.icon}</div>
      <div class="task-main">
        <div class="task-name">${esc(a.name)}</div>
        <div class="task-sub">${names}</div>
        <div class="progress"><div class="progress-bar" style="width:${(p*100).toFixed(1)}%"></div></div>
        <div class="task-sub">${label}</div>
      </div>
      <button class="btn-sm danger" data-action="cancel-task" data-task="${t.id}">✕</button>
    </div>`;
  }

  G.panelActivities = function () {
    let html = `<div class="panel-title">Všechny práce</div>`;
    html += `<div class="hint" style="text-align:left;margin-bottom:10px">Start přiřadí <b>všem volným postavám</b> nejbližší vhodný uzel.</div>`;
    for (const a of Object.values(G.ACTIVITIES)) {
      const req = meetsReq(null, a);
      const node = G.WORLD.nearestNode(a.nodeKinds, G.state.camera.x, G.state.camera.y);
      let nodeInfo = '— žádný uzel v dosahu';
      if (node) {
        const kind = G.NODE_KINDS[node.kind];
        const danger = G.nodeDanger ? G.nodeDanger(node.kind) : 0;
        const dLabel = G.DANGER_LABEL[danger] || G.DANGER_LABEL[0];
        nodeInfo = `${kind.icon} ${esc(kind.name)} <span style="color:${dLabel.color}">(${dLabel.text})</span>`;
      }
      html += `<div class="act-row ${(req.ok && node) ? '' : 'locked'}">
        <div class="act-icon">${a.icon}</div>
        <div class="act-main">
          <div class="act-name">${esc(a.name)}</div>
          <div class="act-sub">${G.SKILLS[a.skill].icon} ${esc(G.SKILLS[a.skill].name)} • ${nodeInfo}</div>
          ${req.ok ? '' : `<div class="act-sub">🔒 ${esc(req.reason)}</div>`}
        </div>
        <div class="act-actions">
          ${a.mode === 'quantity' ? `<input type="number" min="1" max="500" value="${a.defaultQty || 10}" class="qty-input" data-qty-for="${a.id}" />` : ''}
          <button class="btn-sm" ${(req.ok && node) ? '' : 'disabled'} data-action="start-task" data-activity="${a.id}" title="${req.ok ? (node ? '' : 'Žádný vhodný uzel') : esc(req.reason)}">Start</button>
        </div>
      </div>`;
    }
    if (G.state.tasks.length) {
      html += `<div class="panel-title">Probíhá (${G.state.tasks.length})</div>`;
      for (const t of G.state.tasks) html += taskRowHtml(t);
    }
    return html;
  };

  G.recruitCost = function () {
    const alive = G.state.units.filter(u => !u.dead).length;
    return Math.max(15, Math.floor(15 * Math.pow(1.55, alive - 3)));
  };

  G.panelUnits = function () {
    const s = G.state;
    const alive = s.units.filter(u => !u.dead);
    const dead = s.units.filter(u => u.dead);
    const kids = s.family && s.family.children ? s.family.children : [];
    let html = `<div class="panel-title">Postavy (${alive.length})</div>`;
    html += `<button class="btn" data-action="recruit">🧙 Najmout postavu (${G.recruitCost()} zlata)</button>`;
    for (const u of alive) html += unitCardHtml(u);
    if (kids.length) {
      html += `<div class="panel-title">Děti (${kids.length})</div>`;
      for (const c of kids) html += childCardHtml(c);
    }
    if (dead.length) {
      html += `<div class="panel-title">Zesnulí (${dead.length})</div>`;
      for (const u of dead) html += deadCardHtml(u);
    }
    html += dynastySection();
    return html;
  };

  function dynastySection() {
    if (!G.dynastySummary) return '';
    const d = G.dynastySummary();
    let html = `<div class="panel-title">🌳 Dynastie — generace ${d.generations}</div>`;
    html += `<div class="base-summary">
      <span class="base-mat">Narození <b>${d.totalBirths}</b></span>
      <span class="base-mat">Úmrtí <b>${d.totalDeaths}</b></span>
    </div>`;
    const gens = Object.keys(d.byGeneration).sort((a, b) => a - b);
    for (const g of gens) {
      const members = d.byGeneration[g];
      html += `<div class="gen-row">
        <div class="gen-label">Gen. ${g}</div>
        <div class="gen-members">`;
      for (const u of members) {
        const parents = (u.parentIds || []).map(id => G.getUnit(id)).filter(Boolean);
        const parentInfo = parents.length
          ? `<span class="gen-parents">(${parents.map(p => esc(p.name.split(' ')[0])).join('+')})</span>`
          : '';
        html += `<span class="gen-member" style="color:${u.color}">${esc(u.name.split(' ')[0])}${parentInfo}</span>`;
      }
      html += `</div></div>`;
    }
    if (d.historicalNames.length) {
      html += `<div class="hint">Historie jmen: ${d.historicalNames.slice(-8).map(esc).join(', ')}</div>`;
    }
    return html;
  }

  function childCardHtml(c) {
    const age = (G.state.time - c.birthTime) / G.AGE_YEAR;
    const a = G.getUnit(c.parentA), b = G.getUnit(c.parentB);
    const parentNames = [a ? a.name.split(' ')[0] : '?', b ? b.name.split(' ')[0] : '?'].join(' & ');
    return `<div class="unit-card child-card">
      <div class="unit-head">
        <div class="unit-color" style="background:${c.color}"></div>
        <div class="unit-name">${esc(c.name)}</div>
        <div class="unit-lvl">${age.toFixed(1)} let</div>
      </div>
      <div class="unit-task">👶 Dítě rodičů ${esc(parentNames)} — dospěje v ${G.AGE_ADULT} letech.</div>
      <div class="unit-attrs">
        ${G.ATTRS.map(k => `<span class="attr"><b>${k.toUpperCase()}</b>${c.attrs[k]}</span>`).join('')}
      </div>
    </div>`;
  }

  function deadCardHtml(u) {
    const ageStr = u.deathAge ? `${Math.round(u.deathAge)} let` : '?';
    const reason = u.deserted ? 'dezertoval' : (u.deathReason || 'neznámý');
    const canRes = !u.deserted && G.matCount('potion') >= 3 && G.state.resources.gold >= G.resurrectCost();
    return `<div class="unit-card dead-card">
      <div class="unit-head">
        <div class="unit-color" style="background:#3a362c"></div>
        <div class="unit-name">⚰️ ${esc(u.name)}</div>
        <div class="unit-lvl">${esc(ageStr)}</div>
      </div>
      <div class="unit-task">Zemřel: ${esc(reason)}${u.generation ? ` • generace ${u.generation}` : ''}</div>
      ${!u.deserted ? `<button class="btn-sm" ${canRes ? '' : 'disabled'} data-action="resurrect" data-unit="${u.id}">✨ Vzkřísit (${G.resurrectCost()} 🪙 + 3 🧪)</button>` : ''}
    </div>`;
  }

  function personalityBar(axisId, value) {
    const axis = G.PERSONALITY_AXES[axisId];
    const label = G.personalityLabel(axisId, value);
    return `<div class="pers-bar">
      <div class="pers-bar-head">
        <span>${axis.icon} ${esc(axis.name)}</span>
        <span style="color:${axis.color}">${Math.round(value)} — ${esc(label.text)}</span>
      </div>
      <div class="progress"><div class="progress-bar" style="width:${value}%;background:${axis.color}"></div></div>
    </div>`;
  }

  function journalSection(u) {
    const entries = G.getJournal ? G.getJournal(u) : [];
    if (!entries.length) return '';
    const items = entries.slice(0, 10).map(e => `
      <div class="journal-entry">
        <span class="journal-icon">${e.icon || '📌'}</span>
        <div class="journal-main">
          <div class="journal-msg">${esc(e.msg)}</div>
          <div class="journal-date">${esc(G.journalDateShort(e))}</div>
        </div>
      </div>`).join('');
    return `<details class="unit-journal">
      <summary>📖 Deník (${entries.length})</summary>
      <div class="journal-list">${items}</div>
    </details>`;
  }

  function unitCardHtml(u) {
    const s = G.state;
    const age = G.unitAge(u);
    const ageInfo = G.ageLabel(age);
    const task = u.assignedTaskId ? s.tasks.find(t => t.id === u.assignedTaskId) : null;
    let taskName = 'Volno';
    if (u.onExpedition) taskName = '⛵ Na expedici';
    else if (u.merchantState && u.merchantState.active) taskName = `Obchodník`;
    else if (task) taskName = G.ACTIVITIES[task.activityId].name;
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
    if (u.mentorId) {
      const m = G.getUnit(u.mentorId);
      if (m) mentorTag = `<span class="mentor-tag">🎓 ${esc(m.name.split(' ')[0])}</span>`;
    }
    const statusTags = [];
    if (u.generation && u.generation > 1) statusTags.push(`<span class="status-tag gen">G${u.generation}</span>`);
    if (u.legacy > 0) statusTags.push(`<span class="status-tag legacy">🌳 +${u.legacy}</span>`);
    if (grief) statusTags.push('<span class="status-tag grief">🕊️</span>');
    if (insp) statusTags.push('<span class="status-tag insp">✨</span>');
    if (u._resurrected) statusTags.push('<span class="status-tag res">✨</span>');

    const abilities = G.abilitiesFor ? G.abilitiesFor(u) : [];
    const abilitiesHtml = abilities.length
      ? `<div class="unit-abilities">${abilities.map(a =>
          `<span class="ability-tag" title="${esc(a.desc)}">${a.icon} ${esc(a.name)}</span>`
        ).join('')}</div>`
      : '';

    const injuries = u.injuries || [];
    const injuryHtml = injuries.map(inj => {
      const d = G.INJURIES[inj.id];
      const left = Math.max(0, inj.healsAt - s.time);
      const color = G.INJURY_COLOR[d.severity];
      return `<div class="injury-row" style="border-color:${color}">
        <span class="injury-icon">${d.icon}</span>
        <span class="injury-name" style="color:${color}">${esc(d.name)}</span>
        <span class="injury-time">${formatSec(left)}</span>
      </div>`;
    }).join('');

    let pendingPerks = 0;
    if (G.PERK_LEVELS) for (const sid in u.skills) for (const lv of G.PERK_LEVELS) {
      if (G.unitSkill(u, sid) >= lv && G.canPickPerk(u, sid, lv)) pendingPerks++;
    }
    const perkTag = pendingPerks > 0 ? `<span class="perk-badge">✨ ${pendingPerks}</span>` : '';

    const ambitionsHtml = (u.ambitions || []).map(a => {
      const def = G.getAmbitionDef(a.id); if (!def) return '';
      return `<div class="ambition-item ${a.done ? 'done' : ''}">
        <span class="ambition-icon">${def.icon}</span>
        <span class="ambition-text">${esc(def.text)}</span>
        ${a.done ? '<span class="ambition-done">✓</span>' : ''}
      </div>`;
    }).join('');

    const rels = Object.entries(u.relationships || {})
      .map(([id, v]) => ({ unit: G.getUnit(id), v }))
      .filter(x => x.unit && !x.unit.dead && Math.abs(x.v) > 20)
      .sort((a, b) => Math.abs(b.v) - Math.abs(a.v))
      .slice(0, 4);
    const relHtml = rels.length
      ? `<div class="unit-relationships">${rels.map(r => {
          const lbl = G.relLabel(r.v);
          return `<span class="rel-tag" style="color:${lbl.color}">${esc(r.unit.name.split(' ')[0])}: ${lbl.text}</span>`;
        }).join('')}</div>`
      : '';

    const fam = G.familyOf ? G.familyOf(u) : { parents: [], children: [], pendingChildren: [] };
    const famParts = [];
    if (fam.parents.length) famParts.push(`Rodiče: ${fam.parents.map(p => esc(p.name.split(' ')[0])).join(', ')}`);
    if (fam.children.length) famParts.push(`Děti: ${fam.children.map(c => esc(c.name.split(' ')[0])).join(', ')}`);
    if (fam.pendingChildren.length) famParts.push(`Malé děti: ${fam.pendingChildren.length}`);
    const famHtml = famParts.length ? `<div class="unit-family">${famParts.join(' • ')}</div>` : '';

    const persBars = ['conscientious','openness','stability','agreeableness','extraversion']
      .map(axisId => personalityBar(axisId, u.personality ? u.personality[axisId] : 50))
      .join('');

    return `<div class="unit-card ${injuries.length ? 'injured' : ''}">
      <div class="unit-head">
        <div class="unit-color" style="background:${u.color}"></div>
        <div class="unit-name">${esc(u.name)}</div>
        <span class="age-tag" style="color:${ageInfo.color}">${Math.floor(age)} let • ${esc(ageInfo.text)}</span>
        ${perkTag}
        <div class="unit-lvl">Lv ${u.level}</div>
      </div>
      <div class="unit-badges">${profTag}${mentorTag}${statusTags.join('')}</div>
      ${abilitiesHtml}
      <div class="unit-attrs">
        ${G.ATTRS.map(a => `<span class="attr"><b>${a.toUpperCase()}</b>${u.attrs[a]}</span>`).join('')}
      </div>
      <div class="unit-traits">${u.traits.map(t => `<span class="trait" title="${esc(t.desc)}">${esc(t.name)}</span>`).join('')}</div>
      ${injuryHtml}
      <div class="unit-bars">
        <div class="unit-bar">
          <div class="unit-bar-label">💤 Výdrž <span style="color:${stamColor}">${stamPct} %</span></div>
          <div class="progress"><div class="progress-bar" style="width:${stamPct}%;background:${stamColor}"></div></div>
        </div>
        <div class="unit-bar">
          <div class="unit-bar-label">${moodPct >= 80 ? '😄' : moodPct >= 50 ? '🙂' : moodPct >= 25 ? '😐' : '😞'} Nálada <span style="color:${moodInfo.color}">${moodInfo.text} (${moodPct})</span></div>
          <div class="progress"><div class="progress-bar" style="width:${moodPct}%;background:${moodInfo.color}"></div></div>
        </div>
      </div>
      ${famHtml}
      ${ambitionsHtml ? `<div class="ambitions-box"><div class="ambitions-label">🎯 Ambice</div>${ambitionsHtml}</div>` : ''}
      ${journalSection(u)}
      <details class="unit-personality">
        <summary>🎭 Osobnost</summary>
        <div class="pers-grid">${persBars}</div>
      </details>
      ${relHtml}
      <div class="unit-equip">
        ${renderSlot(u, 'tool', '🔧 Nástroj')}
        ${renderSlot(u, 'weapon', '⚔️ Zbraň')}
        ${renderSlot(u, 'armor', '🛡️ Zbroj')}
      </div>
      <div class="unit-task">${u.onExpedition ? '⛵' : u.merchantState && u.merchantState.active ? '🐎' : u.resting ? '💤' : task ? '⚒️' : '🟢'} ${esc(taskName)}</div>
      <div class="unit-actions">
        <button class="btn-sm ghost" data-action="toggle-manual" data-unit="${u.id}">${u.manual ? '🤖 Auto' : '🎮 Manuálně'}</button>
        ${u.resting ? `<button class="btn-sm ghost" data-action="wake" data-unit="${u.id}">Vzbudit</button>` : ''}
        ${!u.resting && !task && !u.onExpedition && !(u.merchantState && u.merchantState.active) ? `<button class="btn-sm ghost" data-action="rest" data-unit="${u.id}">Odpočívat</button>` : ''}
        ${injuries.length ? `<button class="btn-sm ghost" data-action="heal-all" data-unit="${u.id}">Vyléčit</button>` : ''}
        <button class="btn-sm ghost" data-action="open-perks" data-unit="${u.id}">✨ Perky${pendingPerks > 0 ? ' (' + pendingPerks + ')' : ''}</button>
        <button class="btn-sm ghost" data-action="open-mentor" data-unit="${u.id}">🎓 Učednictví</button>
        ${!u.onExpedition && !(u.merchantState && u.merchantState.active)
          ? `<button class="btn-sm ghost" data-action="open-merchant" data-unit="${u.id}">🐎 Obchodník</button>`
          : ''}
        ${u.onExpedition
          ? `<span class="hint">⛵ na expedici</span>`
          : (u.merchantState && u.merchantState.active
            ? `<button class="btn-sm ghost danger" data-action="stop-merchant" data-unit="${u.id}">🛑 Ukončit</button>`
            : '')}
      </div>
      <details class="unit-skills">
        <summary>Dovednosti</summary>
        <div class="skill-grid">
          ${Object.keys(G.SKILLS).map(sid => {
            const lv = G.unitSkill(u, sid);
            const xp = G.unitSkillXp(u, sid);
            const need = G.xpForLevel(lv);
            const pm = G.professionSkillMult ? G.professionSkillMult(u, sid) : 1;
            const profLabel = pm > 1 ? `<span class="prof-up">+${Math.round((pm-1)*100)}%</span>`
                            : pm < 1 ? `<span class="prof-down">${Math.round((pm-1)*100)}%</span>` : '';
            const pickedCount = u.perks && u.perks[sid] ? Object.keys(u.perks[sid]).length : 0;
            return `<div class="skill-row">
              <span>${G.SKILLS[sid].icon} ${esc(G.SKILLS[sid].name)} ${profLabel}${pickedCount ? ` ✨${pickedCount}` : ''}</span>
              <span class="skill-lv">${lv} <small>(${Math.floor(xp)}/${need})</small></span>
            </div>`;
          }).join('')}
        </div>
      </details>
      <div class="unit-groups">👥 Skupina: ${esc(groupName)}</div>
    </div>`;
  }

  function renderSlot(unit, slot, label) {
    const item = unit.equipment[slot];
    if (!item) return `<div class="equip-slot empty"><span class="equip-label">${label}</span><span class="equip-item">— prázdné —</span></div>`;
    const def = G.EQUIPMENT[item.itemId];
    const durPct = Math.round(item.durability / def.durability * 100);
    const durColor = durPct > 60 ? '#8fbf7a' : durPct > 25 ? '#e0bb5e' : '#c05a45';
    const broken = item.durability <= 0;
    return `<div class="equip-slot ${broken ? 'broken' : ''}">
      <span class="equip-label">${label}</span>
      <span class="equip-item">${def.icon} ${esc(def.name)}</span>
      <span class="equip-dur" style="color:${durColor}">${Math.round(item.durability)}/${def.durability}</span>
      <button class="btn-sm ghost" data-action="unequip" data-unit="${unit.id}" data-slot="${slot}">Sundat</button>
    </div>`;
  }

  G.panelGroups = function () {
    const s = G.state;
    let html = `<div class="panel-title">Skupiny (${s.groups.length})</div>`;
    html += `<button class="btn" data-action="create-group">➕ Vytvořit skupinu</button>`;
    const acts = Object.values(G.ACTIVITIES);
    for (const g of s.groups) {
      const members = G.groupMembers(g).filter(u => u && !u.dead);
      const ch = G.groupChemistry(g);
      const avgSafety = G.partySafety(members);
      html += `<div class="group-card">
        <div class="group-head">
          <div class="group-name">👥 ${esc(g.name)}</div>
          <div class="group-count">${members.length}</div>
        </div>
        <div class="group-stats">
          <span>Chemie: <b style="color:${ch.color}">${ch.label}</b></span>
          <span>Síla: <b>${Math.round(avgSafety)}</b></span>
        </div>
        <div class="group-roles">`;
      for (const roleId in G.ROLES) {
        const r = G.ROLES[roleId];
        const holder = g.roles && g.roles[roleId] ? G.getUnit(g.roles[roleId]) : null;
        const valid = holder && !holder.dead;
        html += `<span class="role-chip ${valid ? 'has' : 'empty'}" title="${r.desc}">
          ${r.icon} ${r.name}: ${valid ? esc(holder.name.split(' ')[0]) : '—'}
        </span>`;
      }
      html += `</div>`;
      html += `<div class="group-focus">
        <label class="v-label">Zaměření</label>
        <select data-change="group-focus" data-group="${g.id}">
          <option value="">— volná vůle —</option>
          ${acts.map(a => `<option value="${a.id}" ${g.focus === a.id ? 'selected' : ''}>${a.icon} ${esc(a.name)}</option>`).join('')}
        </select>
      </div>
      <div class="group-members">
        ${members.map(u => `<span class="member-chip" style="border-color:${u.color}">
          ${esc(u.name.split(' ')[0])}${u.resting ? ' 💤' : ''}${(u.injuries && u.injuries.length) ? ' 🩹' : ''}${u.mentorId ? ' 🎓' : ''}${u.merchantState && u.merchantState.active ? ' 🐎' : ''}${u.onExpedition ? ' ⛵' : ''}
          <button class="chip-x" data-action="kick" data-unit="${u.id}">×</button>
        </span>`).join('') || '<span class="hint">Žádní členové</span>'}
      </div>
      <div class="group-add">
        <select data-change="add-to-group" data-group="${g.id}">
          <option value="">+ přidat člena…</option>
          ${s.units.filter(u => !u.dead && u.groupId !== g.id).map(u => `<option value="${u.id}">${esc(u.name)}</option>`).join('')}
        </select>
      </div>
    </div>`;
    }
    return html;
  };

  G.panelCraft = function () {
    let html = `<div class="panel-title">Dílny</div>`;
    const status = G.workshopStatus();
    for (const st of status) {
      const w = st.workshop;
      const access = G.workshopAccessCount(w.id);
      let statusText = '', statusColor = '#8d8570';
      if (access > 0) { statusText = `${access} postav má přístup`; statusColor = '#8fbf7a'; }
      else if (st.onBase) { statusText = 'na základně'; statusColor = '#e0bb5e'; }
      else if (st.available) { statusText = `v sídle ${st.where}`; statusColor = '#e0bb5e'; }
      else { statusText = 'nedostupná'; statusColor = '#c05a45'; }
      html += `<div class="workshop-status-row">
        <span class="ws-icon">${w.icon}</span>
        <span class="ws-name">${esc(w.name)}</span>
        <span class="ws-state" style="color:${statusColor}">${esc(statusText)}</span>
      </div>`;
    }
    html += `<div class="panel-title">Recepty</div>`;
    for (const rid in G.RECIPES) {
      const r = G.RECIPES[rid];
      const check = G.canCraft(rid);
      const best = bestSkill(r.skill);
      const io = r.inputs.map(i =>
        `${G.MATERIALS[i.material].icon} ${i.qty}× ${esc(G.MATERIALS[i.material].name)} (${G.matCount(i.material)})`
      ).join(' + ') + ` → ${G.MATERIALS[r.output.material].icon} ${r.output.qty || 1}×`;
      const wInfo = r.workshop ? ` • ${G.WORKSHOPS[r.workshop].icon}` : '';
      html += `<div class="recipe-row ${check.ok ? '' : 'locked'}">
        <div class="recipe-icon">${r.icon}</div>
        <div class="recipe-main">
          <div class="recipe-name">${esc(r.name)}</div>
          <div class="recipe-sub">${G.SKILLS[r.skill].icon} ${esc(G.SKILLS[r.skill].name)} ${r.reqLevel} (máš ${best})${wInfo}</div>
          <div class="recipe-io">${io}</div>
          ${check.ok ? '' : `<div class="act-sub" style="color:#c05a45">🔒 ${esc(check.reason)}</div>`}
        </div>
        <button class="btn-sm" ${check.ok ? '' : 'disabled'} data-action="craft" data-recipe="${rid}">Vyrobit</button>
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
      rows.push(`<div class="inv-row">
        <div class="inv-icon">${G.MATERIALS[mid].icon}</div>
        <div class="inv-main">
          <div class="inv-name">${esc(G.MATERIALS[mid].name)} <span style="color:#8d8570;font-weight:400">×${count}</span></div>
          <div class="inv-q">${qualities.map(q => `<span class="q-tag q-${q}">${G.QUALITY_LABEL[q]}: ${m[q]}</span>`).join(' ')}</div>
        </div>
      </div>`);
    }
    html += rows.length ? rows.join('') : `<div class="empty">Zatím nic nemáš.</div>`;

    const mw = G.state.masterworks || [];
    if (mw.length) {
      html += `<div class="panel-title">✨ Mistrovská díla (${mw.length})</div>`;
      for (const item of mw.slice(-10).reverse()) {
        html += `<div class="masterwork-row">
          <span class="mw-icon">✨</span>
          <div class="mw-main">
            <div class="mw-name">${esc(item.name)}</div>
            <div class="mw-sub">${esc(item.craftsman)} • ${esc(item.recipe)}</div>
          </div>
        </div>`;
      }
    }

    html += renderPoliticsSection();
    html += renderPrestigeSection();

    html += `<div class="panel-title">Reputace frakcí</div>`;
    for (const r of G.reputationSummary()) {
      html += `<div class="rep-row">
        <div class="rep-icon" style="color:${r.faction.color}">${r.faction.icon}</div>
        <div class="rep-main">
          <div class="rep-name">${esc(r.faction.name)}</div>
          <div class="rep-motto">${esc(r.faction.motto)}</div>
        </div>
        <div class="rep-value" style="color:${r.tier.color}">${r.value.toFixed(1)}<small>${esc(r.tier.name)}</small></div>
      </div>`;
    }

    if (G.achievementsSection) html += G.achievementsSection();
    html += renderSaveSection();
    return html;
  };

  function renderPoliticsSection() {
    if (!G.politicsOverview) return '';
    const overview = G.politicsOverview();
    let html = `<div class="panel-title">🏛️ Politika</div>`;
    for (const o of overview) {
      const f = o.faction, st = o.phase;
      if (st === 'election') {
        html += `<div class="politics-card active" style="border-color:${f.color}">
          <div class="politics-head">
            <span style="color:${f.color}">${f.icon} ${esc(f.name)}</span>
            <span class="politics-badge">VOLBY</span>
          </div>`;
        for (const c of o.candidates) {
          const prog = G.POLITICAL_PROGRAMS[c.program];
          const isPlayer = c.isPlayer;
          const supportPrice = G.supportPrice(f.id);
          html += `<div class="politics-candidate ${isPlayer ? 'player' : ''}">
            <div class="candidate-name">${isPlayer ? '👑 ' : ''}${esc(c.name)}</div>
            <div class="candidate-program">${prog.icon} ${esc(prog.name)}</div>
            ${!isPlayer ? `<button class="btn-sm ghost" data-action="support-candidate" data-faction="${f.id}" data-candidate="${c.id}">Podpořit (${supportPrice} 🪙)</button>` : ''}
          </div>`;
        }
        html += `</div>`;
      } else if (o.winner) {
        const prog = G.POLITICAL_PROGRAMS[o.winner.program];
        html += `<div class="politics-card" style="border-color:${f.color}">
          <div class="politics-head">
            <span style="color:${f.color}">${f.icon} ${esc(f.name)}</span>
            <span class="politics-badge">${esc(o.winner.name.split(' ')[0])}</span>
          </div>
          <div class="politics-winner">${prog.icon} ${esc(prog.name)}</div>
        </div>`;
      }
    }
    return html;
  }

  function renderSaveSection() {
    return `<div class="panel-title">Záloha hry</div>
      <div class="save-section">
        <div class="save-info">Uložení je v prohlížeči. Pro jistotu si udělej export.</div>
        <button class="btn" data-action="export-save">💾 Exportovat save</button>
        <button class="btn ghost" data-action="import-save">📥 Importovat save</button>
      </div>`;
  }

  function renderPrestigeSection() {
    if (!G.prestigeStatus) return '';
    const st = G.prestigeStatus();
    const lvl = (G.state.prestige && G.state.prestige.level) || 0;
    const unlocks = (G.state.prestige && G.state.prestige.unlocks) || [];
    let html = `<div class="panel-title">Prestiž (New Game+) — úr. ${lvl}</div>`;
    html += `<div class="prestige-card ${st.ok ? 'ready' : ''}">`;
    if (lvl > 0) {
      html += `<div class="prestige-head">
        <div class="prestige-level">⭐ Úroveň ${lvl}</div>
        <div class="prestige-bonus">+${lvl*15} % XP</div>
      </div>`;
    }
    if (unlocks.length) {
      html += `<div class="unlock-list">`;
      for (const uid of unlocks) {
        const u = G.UNLOCKS[uid];
        if (!u) continue;
        html += `<div class="unlock-chip" title="${esc(u.desc)}">${u.icon} ${esc(u.name)}</div>`;
      }
      html += `</div>`;
    }
    html += `<div class="prestige-reqs">`;
    for (const it of st.items) {
      const pct = Math.min(100, it.need > 0 ? (it.have/it.need)*100 : 100);
      html += `<div class="prestige-req ${it.ok ? 'done' : ''}">
        <div class="prestige-req-top">
          <span>${it.ok ? '✅' : '⬜'} ${esc(it.label)}</span>
          <span>${Math.floor(it.have)} / ${it.need}</span>
        </div>
        <div class="progress"><div class="progress-bar" style="width:${pct.toFixed(1)}%;${it.ok ? 'background:#8fbf7a' : ''}"></div></div>
      </div>`;
    }
    html += `</div>`;
    if (st.ok) {
      html += `<button class="btn prestige-btn" data-action="do-prestige">🌟 Prestiž ${lvl+1} — nový svět</button>`;
    } else {
      html += `<div class="hint">Splň všechny 4 podmínky. Přechod vygeneruje novou mapu.</div>`;
    }
    html += `</div>`;
    return html;
  }

  G.perkPanel = function (unitId) {
    const u = G.getUnit(unitId); if (!u) return null;
    let html = `<div class="perk-panel">
      <div class="perk-header">${G.esc(u.name)} — Perky</div>
      <div class="perk-hint">Respec ${G.RESPEC_COST} 🪙.</div>`;
    let any = false;
    for (const sid in G.SKILLS) {
      const lvl = G.unitSkill(u, sid);
      const levels = G.PERK_LEVELS.filter(l => lvl >= l);
      if (!levels.length) continue;
      any = true;
      html += `<div class="perk-skill">
        <div class="perk-skill-title">${G.SKILLS[sid].icon} ${G.esc(G.SKILLS[sid].name)} <span class="perk-skill-lvl">úr. ${lvl}</span></div>`;
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
    if (!any) html += `<div class="empty">Zatím žádné perky.</div>`;
    html += `<div class="perk-actions"><button class="btn" data-action="close-modal">Zavřít</button></div></div>`;
    return html;
  };

  G.mentorPanel = function (unitId) {
    const u = G.getUnit(unitId); if (!u) return null;
    let html = `<div class="perk-panel"><div class="perk-header">${G.esc(u.name)} — Učednictví</div>`;
    if (u.mentorId) {
      const m = G.getUnit(u.mentorId);
      if (m) html += `<div class="mentor-current"><div>Mistr: <b>${G.esc(m.name)}</b></div><button class="btn-sm danger" data-action="clear-mentor" data-unit="${u.id}">Zrušit</button></div>`;
    } else {
      html += `<div class="perk-hint">Mistr musí mít dovednost o ${G.MENTOR_MIN_DIFF} úrovní výš.</div>`;
    }
    const mentors = G.availableMentors(unitId);
    if (!mentors.length) html += `<div class="empty">Žádný vhodný mistr.</div>`;
    else {
      html += `<div class="mentor-list">`;
      for (const m of mentors) {
        const mm = m.mentor;
        html += `<button class="mentor-pick" data-action="set-mentor" data-apprentice="${u.id}" data-mentor="${mm.id}">
          <div class="mentor-name">${G.esc(mm.name)} <span class="mentor-diff">+${m.diff}</span></div>
          <div class="mentor-skill">${G.SKILLS[m.skill].icon} ${G.esc(G.SKILLS[m.skill].name)}</div>
        </button>`;
      }
      html += `</div>`;
    }
    html += `<div class="perk-actions"><button class="btn" data-action="close-modal">Zavřít</button></div></div>`;
    return html;
  };

  G.renderLog = function () {
    const el = document.getElementById('log-list');
    if (!el || !G.state) return;
    const filter = G.state.logFilter || 'all';
    const lines = G.state.log.slice(-150).reverse();
    const filtered = filter === 'all' ? lines : lines.filter(l => l.cat === filter);
    el.innerHTML = filtered.slice(0, 80)
      .map(e => `<div class="log-line log-${e.cat || 'info'}">${esc(e.msg)}</div>`).join('');
  };
})();
