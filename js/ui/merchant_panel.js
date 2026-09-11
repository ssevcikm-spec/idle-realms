(function () {
  const G = window.Game;

  G.merchantPanel = function (unitId) {
    const u = G.getUnit(unitId);
    if (!u) return null;
    const isMerchant = u.merchantState && u.merchantState.active;
    let html = `<div class="perk-panel">
      <div class="perk-header">${G.esc(u.name)} — Obchodník</div>
      <div class="perk-hint">Obchodník cestuje mezi sídly, prodává přebytky a skupuje nedostatkové zboží. Buduje vztahy se sídly.</div>`;

    if (isMerchant) {
      const st = u.merchantState;
      const from = st.fromId ? G.WORLD.settlementById[st.fromId] : null;
      const to = st.toId ? G.WORLD.settlementById[st.toId] : null;
      html += `<div class="merchant-active">
        <div class="merchant-active-head">🐎 Aktivní trasa</div>
        <div class="merchant-route">
          ${(u.merchantRoute || []).map((id, i) => {
            const s = G.WORLD.settlementById[id];
            const isCur = i === st.currentIdx;
            return `<span class="route-node ${isCur ? 'current' : ''}">${s ? s.name : '?'}</span>` +
              (i < u.merchantRoute.length - 1 ? `<span class="route-arrow">→</span>` : `<span class="route-arrow">↩</span>`);
          }).join('')}
        </div>
        ${from && to ? `<div class="hint">Na cestě: ${G.esc(from.name)} → ${G.esc(to.name)} (${Math.round((st.progress || 0) * 100)} %)</div>` : ''}
        <div class="merchant-stats">
          <span>Cest: <b>${st.totalTrades || 0}</b></span>
          <span>Zisk: <b>${Math.round(st.totalGold || 0)} 🪙</b></span>
          <span>Obchod: <b>${G.unitSkill(u, 'trading')}</b></span>
        </div>
        <div class="unit-actions" style="margin-top:8px">
          <button class="btn-sm" data-action="merchant-instant-trade" data-unit="${u.id}">⚡ Okamžitý obchod</button>
          <button class="btn-sm danger" data-action="stop-merchant" data-unit="${u.id}">🛑 Ukončit</button>
        </div>
      </div>`;
    } else {
      html += `<div class="perk-hint">Vyber trasu. Doporučujeme 3–4 sídla s různými specializacemi.</div>`;
      const allSet = G.WORLD.settlements.map(s => s.id);
      const presets = [
        { id:'central', name:'Střed světa', route:['kralov','svitavy','hluboka'] },
        { id:'north',   name:'Severní okruh', route:['kralov','brezova','stribrod'] },
        { id:'south',   name:'Jižní okruh',  route:['svitavy','hluboka','kamenice'] },
        { id:'full',    name:'Celý svět',    route: allSet }
      ];
      html += `<div class="panel-title">Přednastavené trasy</div>`;
      for (const p of presets) {
        html += `<button class="mentor-pick" data-action="set-merchant-route" data-unit="${u.id}" data-route='${JSON.stringify(p.route)}'>
          <div class="mentor-name">${p.name}</div>
          <div class="mentor-skill">${p.route.map(id => G.WORLD.settlementById[id].name).join(' → ')}</div>
        </button>`;
      }
      html += `<div class="panel-title">Vlastní trasa (klikni pro přidání/odebrání)</div>`;
      html += `<div class="route-picker" id="custom-route-picker">`;
      for (const s of G.WORLD.settlements) {
        html += `<button class="route-pick" data-action="toggle-route" data-unit="${u.id}" data-settlement="${s.id}" data-selected="false">
          ${G.SETTLEMENT_SIZE[s.size].icon} ${G.esc(s.name)}
        </button>`;
      }
      html += `</div>`;
      html += `<button class="btn" data-action="set-custom-merchant-route" data-unit="${u.id}">✅ Použít vlastní trasu</button>`;
    }
    html += `<div class="perk-actions"><button class="btn ghost" data-action="close-modal">Zavřít</button></div></div>`;
    return html;
  };

  G.panelMerchant = function () {
    const merchants = G.merchantList ? G.merchantList() : [];
    let html = `<div class="panel-title">🐎 Obchodníci (${merchants.length})</div>`;

    if (!merchants.length) {
      html += `<div class="empty">Zatím žádný obchodník. V panelu <b>Postavy</b> najdi vhodného kandidáta a klikni na <b>🐎 Obchodník</b>.</div>`;
      html += `<div class="hint">Obchodník cestuje mezi sídly, prodává přebytky a skupuje zboží. Zvyšuje vztahy se sídly.</div>`;
    } else {
      for (const u of merchants) {
        const st = u.merchantState;
        const from = st.fromId ? G.WORLD.settlementById[st.fromId] : null;
        const to = st.toId ? G.WORLD.settlementById[st.toId] : null;
        const skill = G.unitSkill(u, 'trading');
        html += `<div class="merchant-card">
          <div class="merchant-card-head">
            <div class="unit-color" style="background:${u.color}"></div>
            <div class="merchant-name">${G.esc(u.name)}</div>
            <div class="unit-lvl">Obchod ${skill}</div>
          </div>
          <div class="merchant-route">
            ${(u.merchantRoute || []).map((id, i) => {
              const s = G.WORLD.settlementById[id];
              const isCur = i === st.currentIdx;
              return `<span class="route-node ${isCur ? 'current' : ''}">${s ? s.name : '?'}</span>` +
                (i < u.merchantRoute.length - 1 ? `<span class="route-arrow">→</span>` : `<span class="route-arrow">↩</span>`);
            }).join('')}
          </div>
          ${from && to ? `<div class="hint">${G.esc(from.name)} → ${G.esc(to.name)} • ${Math.round((st.progress||0)*100)} %</div>` : ''}
          <div class="merchant-stats">
            <span>Cest: <b>${st.totalTrades || 0}</b></span>
            <span>Zisk: <b>${Math.round(st.totalGold || 0)} 🪙</b></span>
            ${st.lastTrade ? `<span>Poslední: <b>${G.WORLD.settlementById[st.lastTrade.settlementId].name}</b></span>` : ''}
          </div>
          <div class="unit-actions">
            <button class="btn-sm" data-action="open-merchant" data-unit="${u.id}">⚙️ Nastavit</button>
            <button class="btn-sm" data-action="merchant-instant-trade" data-unit="${u.id}">⚡ Obchod teď</button>
            <button class="btn-sm danger" data-action="stop-merchant" data-unit="${u.id}">🛑 Ukončit</button>
          </div>
        </div>`;
      }
    }

    html += `<div class="panel-title">Vztahy se sídly</div>`;
    for (const s of G.WORLD.settlements) {
      const v = (G.state.settlementRep && G.state.settlementRep[s.id]) || 0;
      const mods = G.settlementRepMods(s.id);
      const color = v >= 40 ? '#8fbf7a' : v >= 15 ? '#9ed48c' : v >= -15 ? '#9c937c' : '#c05a45';
      const pct = Math.min(100, Math.max(0, (v + 100) / 220 * 100));
      html += `<div class="rep-row">
        <div class="rep-icon">${G.SETTLEMENT_SIZE[s.size].icon}</div>
        <div class="rep-main">
          <div class="rep-name">${G.esc(s.name)}</div>
          <div class="rep-motto">${mods.tier} • nákup ×${mods.buyMult.toFixed(2)} • prodej ×${mods.sellMult.toFixed(2)}</div>
          <div class="progress"><div class="progress-bar" style="width:${pct}%;background:${color}"></div></div>
        </div>
        <div class="rep-value" style="color:${color}">${v.toFixed(0)}</div>
      </div>`;
    }
    return html;
  };
})();
