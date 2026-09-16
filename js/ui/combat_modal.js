(function () {
  const G = window.Game;

  G.showCombatModal = function (cb) {
    const root = document.getElementById('modal-root');
    root.innerHTML = renderCombat(cb);
    root.classList.add('show');
  };
  G.updateCombatModal = function (cb) {
    const root = document.getElementById('modal-root');
    if (!root.classList.contains('show')) return;
    root.innerHTML = renderCombat(cb);
  };
  G.hideCombatModal = function () {
    const root = document.getElementById('modal-root');
    root.innerHTML = '';
    root.classList.remove('show');
  };

  function renderCombat(cb) {
    const round = cb.round;
    const tact = G.TACTICS[cb.tactic] || G.TACTICS.balanced;
    let html = `<div class="modal-backdrop"><div class="modal wide combat-modal">
      <div class="combat-head">
        <div class="combat-title">⚔️ Souboj — kolo ${round}${cb.isBoss ? ' — BOSS' : ''}</div>
      </div>`;
    html += `<div class="combat-side enemy-side">
      <div class="combat-side-label">Nepřátelé — ${G.esc(cb.enemyName)}</div>
      <div class="combat-units">`;
    for (const e of cb.enemy) {
      const hpPct = Math.round((e.hp / e.hpMax) * 100);
      const hpColor = hpPct > 50 ? '#8fbf7a' : hpPct > 25 ? '#e0bb5e' : '#c05a45';
      const statusTags = [];
      if (e.poisons && e.poisons.length) statusTags.push('☠️');
      if (e.debuffs && Object.keys(e.debuffs).length) statusTags.push('⬇️');
      if (e.buffs && Object.keys(e.buffs).length) statusTags.push('⬆️');
      if (e.stunned && e.stunned > 0) statusTags.push('💫');
      if (e.enraged) statusTags.push('🔥');
      const eliteBorder = e.isElite ? 'style="border-color:#e0bb5e"' : (e.isBoss ? 'style="border-color:#c05a45;box-shadow:0 0 12px rgba(192,90,69,.5)"' : '');
      html += `<div class="combat-unit ${e.alive ? '' : 'dead'}" ${eliteBorder}>
        <div class="combat-unit-icon">${e.icon}${statusTags.length ? `<span class="cb-status">${statusTags.join('')}</span>` : ''}</div>
        <div class="combat-unit-name">${G.esc(e.name)}</div>
        <div class="progress"><div class="progress-bar" style="width:${hpPct}%;background:${hpColor}"></div></div>
        <div class="combat-unit-hp">${e.hp}/${e.hpMax}</div>
        ${e.abilities && e.abilities.length ? `<div class="cb-status" style="position:static;font-size:9px;opacity:.7;margin-top:2px">${e.abilities.map(a => G.ENEMY_ABILITIES[a.id] ? G.ENEMY_ABILITIES[a.id].icon : '?').join(' ')}</div>` : ''}
      </div>`;
    }
    html += `</div></div>`;
    html += `<div class="combat-vs">VS</div>`;
    html += `<div class="combat-side ally-side">
      <div class="combat-side-label">Tvá skupina</div>
      <div class="combat-units">`;
    for (const a of cb.ally) {
      const u = G.getUnit(a.unitId);
      const hpPct = Math.round((a.hp / a.hpMax) * 100);
      const hpColor = hpPct > 50 ? '#8fbf7a' : hpPct > 25 ? '#e0bb5e' : '#c05a45';
      const statusTags = [];
      if (a.buffs && Object.keys(a.buffs).length) statusTags.push('⬆️');
      if (a.debuffs && Object.keys(a.debuffs).length) statusTags.push('⬇️');
      if (a.poisons && a.poisons.length) statusTags.push('☠️');
      if (a.stunned && a.stunned > 0) statusTags.push('💫');
      html += `<div class="combat-unit ${a.alive ? '' : 'dead'}">
        <div class="combat-unit-icon" style="background:${u ? u.color : '#555'};color:#fff">${u ? G.esc(u.name.charAt(0)) : '?'}${statusTags.length ? `<span class="cb-status">${statusTags.join('')}</span>` : ''}</div>
        <div class="combat-unit-name">${u ? G.esc(u.name.split(' ')[0]) : '?'}</div>
        <div class="progress"><div class="progress-bar" style="width:${hpPct}%;background:${hpColor}"></div></div>
        <div class="combat-unit-hp">${a.hp}/${a.hpMax} • ${a.stamina || 0}⚡</div>
      </div>`;
    }
    html += `</div></div>`;

    if (!cb.finished) {
      html += `<div class="combat-tactics">
        <div class="combat-label">Taktika</div>
        <div class="combat-tactic-row">`;
      for (const tid in G.TACTICS) {
        const t = G.TACTICS[tid];
        html += `<button class="combat-tactic ${cb.tactic === tid ? 'active' : ''}" data-action="set-tactic" data-tactic="${tid}">
          ${t.icon} ${t.name}
        </button>`;
      }
      html += `</div><div class="hint">${tact.desc}</div></div>`;
      html += `<div class="combat-tactics">
        <div class="combat-label">Schopnosti</div>
        <label class="cb-toggle">
          <input type="checkbox" ${cb.autoAbilities ? 'checked' : ''} data-action="toggle-auto-abilities" />
          Automaticky používat schopnosti
        </label>
      </div>`;
      const abilitiesByAlly = cb.ally.filter(a => a.alive && a.abilities && a.abilities.length);
      if (abilitiesByAlly.length) {
        html += `<div class="combat-abilities">`;
        for (const a of abilitiesByAlly) {
          const u = G.getUnit(a.unitId);
          html += `<div class="cb-ability-row">
            <div class="cb-ability-name">${u ? G.esc(u.name.split(' ')[0]) : '?'}:</div>
            <div class="cb-ability-buttons">`;
          for (const aid of a.abilities) {
            const ab = G.ABILITIES[aid];
            if (!ab) continue;
            const cd = (a.cooldowns && a.cooldowns[aid]) || 0;
            const stamOk = (a.stamina || 0) >= ab.stamina;
            const disabled = cd > 0 || !stamOk;
            const queued = a.queuedAbility === aid;
            const tierMark = ab.minLevel >= 15 ? '🌟' : (ab.minLevel >= 8 ? '✨' : '');
            html += `<button class="cb-ability ${queued ? 'queued' : ''} ${disabled ? 'disabled' : ''}"
              data-action="queue-ability" data-ally="${a.unitId}" data-ability="${aid}"
              ${disabled ? 'disabled' : ''}
              title="${G.esc(ab.desc)} • ${G.SKILLS[ab.skill].name} ${ab.minLevel} • CD ${ab.cooldown} • ${ab.stamina}⚡">
              ${ab.icon} ${G.esc(ab.name)}${tierMark ? ' ' + tierMark : ''}${cd > 0 ? ` (${cd})` : ''}
            </button>`;
          }
          html += `</div></div>`;
        }
        html += `</div>`;
      }
    }

    html += `<div class="combat-log">`;
    const recent = cb.log.slice(-14);
    for (const entry of recent) {
      html += `<div class="combat-log-line ${entry.cls || ''}">${G.esc(entry.t)}</div>`;
    }
    html += `</div>`;

    if (!cb.finished) {
      html += `<div class="combat-actions">
        <button class="btn ${cb.auto ? '' : 'ghost'}" data-action="toggle-combat-auto" title="Souboj běží sám; pozastavíš ho pro ruční krok">${cb.auto ? '⏸ Pozastavit boj' : '▶︎ Spustit automaticky'}</button>
        <button class="btn ghost" data-action="combat-round" title="Odehraje jedno kolo ručně">▶︎ Další kolo</button>
      </div>`;
    } else {
      html += `<div class="combat-result ${cb.result}">
        ${cb.result === 'win' ? '🎉 Vítězství!' : '💀 Prohra'}
      </div>`;
      if (cb.result === 'win' && cb.dropList && cb.dropList.length) {
        html += `<div class="combat-loot">
          <div class="combat-label">Kořist</div>
          <div class="loot-list">
            ${cb.dropList.map(d => `<span class="loot-item">${G.esc(d.label)}</span>`).join('')}
          </div>
        </div>`;
      }
      html += `<div class="combat-actions">
        <button class="btn combat-next" data-action="combat-close">Zavřít</button>
      </div>`;
    }
    html += `</div></div>`;
    return html;
  }
})();
