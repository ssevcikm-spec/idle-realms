(function () {
  const G = window.Game;
  let tradeTab = 'market';
  G.setTradeTab = function (t) { tradeTab = t; };

  G.panelTrade = function (settlementId) {
    const def = G.WORLD.settlementById[settlementId];
    const st = G.state.economy[settlementId];
    if (!def || !st) return `<div class="empty">Sídlo nenalezeno.</div>`;
    const sizeDef = G.SETTLEMENT_SIZE[def.size];
    const spec = G.SETTLEMENT_SPECS[def.spec];
    const bonuses = G.settlementBonuses(settlementId);
    const facId = G.SETTLEMENT_FACTION[settlementId];
    const fac = facId ? G.FACTIONS[facId] : null;
    const repInfo = G.repPriceMods(settlementId);
    const srep = (G.state.settlementRep && G.state.settlementRep[settlementId]) || 0;
    const srepMods = G.settlementRepMods(settlementId);
    const workshops = G.workshopsInSettlement(settlementId);
    const polMods = G.politicsMods ? G.politicsMods(facId) : null;

    const facLine = fac ? `<div class="loc-sub" style="color:${fac.color}">
      ${fac.icon} ${G.esc(fac.name)} • reputace ${repInfo.rep.toFixed(1)}
    </div>` : '';
    const srepLine = `<div class="loc-sub" style="color:${srep >= 40 ? '#8fbf7a' : srep >= 15 ? '#9ed48c' : srep >= -15 ? '#9c937c' : '#c05a45'}">
      🏘️ Vztah: ${srep.toFixed(1)} (${srepMods.tier})
    </div>`;
    const wsLine = workshops.length
      ? `<div class="loc-sub">Dílny: ${workshops.map(wid => G.WORKSHOPS[wid].icon + ' ' + G.WORKSHOPS[wid].name).join(' • ')}</div>`
      : '';
    const polLine = polMods ? `<div class="loc-sub" style="color:#d8b45a">
      🏛️ Politický efekt: ${Object.keys(polMods.priceMods || {}).length ? 'změna cen' : 'žádný'}${polMods.xpBonus ? ' • +' + Math.round((polMods.xpBonus-1)*100) + ' % XP' : ''}
    </div>` : '';

    let html = `<div class="loc-head">
      <div class="loc-icon">${sizeDef.icon}</div>
      <div class="loc-main">
        <div class="loc-name">${G.esc(def.name)} <span class="loc-tag">${sizeDef.label}</span></div>
        <div class="loc-sub">Specializace: <b style="color:#d8b45a">${spec.label}</b></div>
        ${facLine}
        ${srepLine}
        ${wsLine}
        ${polLine}
        <div class="loc-sub">Sklad zlata: ${Math.floor(st.gold).toLocaleString('cs-CZ')} 🪙</div>
      </div>
    </div>`;

    html += `<div class="trade-head">
      <span>Ty: <b>${Math.floor(G.state.resources.gold).toLocaleString('cs-CZ')} 🪙</b></span>
      <span>Renomé: <b>${Math.floor(G.state.resources.renown)} ⭐</b></span>
    </div>`;

    const tabs = [['market','Trh'],['buildings','Budovy'],['equipment','Vybavení'],['quests','Zakázky']];
    html += `<div class="trade-tabs">${tabs.map(([k, l]) =>
      `<button class="trade-tab ${tradeTab === k ? 'active' : ''}" data-action="trade-tab" data-tab="${k}">${l}</button>`
    ).join('')}</div>`;

    if (tradeTab === 'market') html += renderMarket(settlementId, spec, bonuses, repInfo);
    else if (tradeTab === 'buildings') html += renderBuildings(settlementId);
    else if (tradeTab === 'equipment') html += renderEquipment(settlementId, bonuses);
    else if (tradeTab === 'quests') html += renderQuests(settlementId);
    return html;
  };

  function renderMarket(settlementId, spec, bonuses, repInfo) {
    let html = '';
    const mats = G.settlementMarket(settlementId);
    if (!mats.length) return `<div class="empty">Tady se neobchoduje.</div>`;
    for (const mid of mats) {
      const m = G.MATERIALS[mid];
      const stock = Math.floor(stockOf(settlementId, mid));
      const buy = G.priceAt(settlementId, mid, 'buy');
      const sell = G.priceAt(settlementId, mid, 'sell');
      const have = G.matCount(mid);
      const isProduced = spec.produces.includes(mid);
      const isConsumed = spec.consumes.includes(mid);
      let tag = '';
      if (isProduced) tag = ' <span class="loc-tag" style="background:#1f2a1c;color:#8fbf7a">výroba</span>';
      else if (isConsumed) tag = ' <span class="loc-tag" style="background:#2c1e1a;color:#cf8f6a">poptávka</span>';
      html += `<div class="trade-row">
        <div class="trade-icon">${m.icon}</div>
        <div class="trade-main">
          <div class="trade-name">${G.esc(m.name)}${tag}</div>
          <div class="trade-sub">sklad <b>${stock}</b> • ty máš <b>${have}</b></div>
          <div class="trade-prices">
            <span class="price-buy">koupíš ${buy} 🪙</span>
            <span class="price-sell">prodáš ${sell} 🪙</span>
          </div>
        </div>
        <div class="trade-actions">
          <input type="number" min="1" max="999" value="1" data-trade-qty="${mid}" />
          <button class="btn-sm" data-action="trade-buy" data-settlement="${settlementId}" data-material="${mid}">Koupit</button>
          <button class="btn-sm ghost" data-action="trade-sell" data-settlement="${settlementId}" data-material="${mid}">Prodat</button>
        </div>
      </div>`;
    }
    html += `<div class="hint">Kupuj levně tam, kde to vyrábí. Prodej tam, kde to poptávají.</div>`;
    return html;
  }
  function stockOf(sid, mid) {
    const st = G.state.economy[sid];
    return st && st.stock[mid] || 0;
  }

  function renderBuildings(settlementId) {
    let html = '';
    for (const bid in G.BUILDINGS) {
      const def = G.BUILDINGS[bid];
      const lvl = G.buildingLevel(settlementId, bid);
      const maxed = lvl >= def.maxLevel;
      const check = G.canBuild(settlementId, bid);
      const cost = maxed ? null : def.cost(lvl + 1);
      let costText = '';
      if (cost) {
        const mats = cost.materials.map(m => `${G.MATERIALS[m.material].icon} ${m.qty}×`).join(' + ');
        costText = `${cost.gold} 🪙${mats ? ' + ' + mats : ''}`;
      }
      let effText = '';
      if (lvl > 0) {
        const eff = def.effect(lvl);
        const parts = [];
        if (eff.sellMult) parts.push(`prodej ×${eff.sellMult.toFixed(2)}`);
        if (eff.buyMult) parts.push(`nákup ×${eff.buyMult.toFixed(2)}`);
        if (eff.craftQualityBonus) parts.push(`kvalita +${eff.craftQualityBonus}`);
        if (eff.restMult) parts.push(`odpočinek ×${eff.restMult.toFixed(2)}`);
        if (eff.stockMult) parts.push(`sklad ×${eff.stockMult.toFixed(2)}`);
        if (eff.healMult) parts.push(`hojení ×${eff.healMult.toFixed(2)}`);
        if (eff.safetyMult) parts.push(`bezpečí ×${eff.safetyMult.toFixed(2)}`);
        if (eff.moodMult) parts.push(`nálada ×${eff.moodMult.toFixed(2)}`);
        effText = `<div class="act-sub" style="color:#d8b45a">Aktivní: ${parts.join(' • ')}</div>`;
      }
      html += `<div class="recipe-row ${maxed || !check.ok ? 'locked' : ''}">
        <div class="recipe-icon">${def.icon}</div>
        <div class="recipe-main">
          <div class="recipe-name">${G.esc(def.name)} <span style="color:#8d8570;font-weight:400">— úr. ${lvl}/${def.maxLevel}</span></div>
          <div class="recipe-sub">${G.esc(def.desc)}</div>
          ${costText ? `<div class="recipe-io">Další: ${costText}</div>` : ''}
          ${!check.ok && !maxed ? `<div class="act-sub" style="color:#c05a45">🔒 ${G.esc(check.reason)}</div>` : ''}
          ${effText}
        </div>
        <button class="btn-sm" ${check.ok ? '' : 'disabled'} data-action="build" data-settlement="${settlementId}" data-building="${bid}">
          ${maxed ? 'MAX' : 'Postavit'}
        </button>
      </div>`;
    }
    return html;
  }

  function renderEquipment(settlementId, bonuses) {
    let html = '';
    html += `<div class="panel-title">V nabídce</div>`;
    for (const def of G.availableEquipment(settlementId)) {
      const srep = G.settlementRepMods(settlementId);
      const price = Math.max(1, Math.round(def.price * bonuses.buyMult * srep.buyMult));
      const afford = G.state.resources.gold >= price;
      const mods = Object.entries(def.mods || {}).map(([k, v]) => `${G.SKILLS[k].icon} +${Math.round(v*100)} %`).join(' ');
      const extras = [];
      if (def.staminaDrain) extras.push(`💤 ×${def.staminaDrain}`);
      if (def.combatBonus) extras.push(`⚔️ +${def.combatBonus}`);
      html += `<div class="trade-row">
        <div class="trade-icon">${def.icon}</div>
        <div class="trade-main">
          <div class="trade-name">${G.esc(def.name)} <span class="q-tag">${slotCz(def.slot)} • T${def.tier}</span></div>
          <div class="trade-sub">${mods} ${extras.join(' • ')}</div>
          <div class="trade-prices"><span class="price-buy">${price} 🪙</span></div>
        </div>
        <button class="btn-sm" ${afford ? '' : 'disabled'} data-action="buy-equip" data-settlement="${settlementId}" data-item="${def.id}">Koupit</button>
      </div>`;
    }
    const inv = G.state.equipment || [];
    html += `<div class="panel-title">Tvůj sklad (${inv.length})</div>`;
    if (!inv.length) html += `<div class="empty">Žádné vybavení.</div>`;
    else {
      for (const it of inv) {
        const def = G.EQUIPMENT[it.itemId];
        const durFrac = it.durability / def.durability;
        const durColor = durFrac > 0.6 ? '#8fbf7a' : durFrac > 0.25 ? '#e0bb5e' : '#c05a45';
        html += `<div class="trade-row">
          <div class="trade-icon">${def.icon}</div>
          <div class="trade-main">
            <div class="trade-name">${G.esc(def.name)} <span class="q-tag">${slotCz(def.slot)}</span></div>
            <div class="trade-sub">životnost <b style="color:${durColor}">${Math.round(it.durability)}/${def.durability}</b></div>
            <div class="unit-assign">
              <select data-change="assign-equip" data-item="${it.id}">
                <option value="">— přiřadit postavě —</option>
                ${G.state.units.filter(u => !u.dead).map(u => {
                  const cur = u.equipment[def.slot];
                  return `<option value="${u.id}">${G.esc(u.name)}${cur ? ' (nahradí)' : ''}</option>`;
                }).join('')}
              </select>
            </div>
          </div>
          <button class="btn-sm ghost" data-action="sell-equip" data-item="${it.id}">Prodat</button>
        </div>`;
      }
    }
    return html;
  }
  function slotCz(slot) { return { tool:'Nástroj', weapon:'Zbraň', armor:'Zbroj' }[slot] || slot; }

  function renderQuests(settlementId) {
    G.ensureQuests(settlementId);
    const list = (G.state.quests[settlementId] || []);
    const available = list.filter(q => q.status === 'available');
    const active = list.filter(q => q.status === 'active');
    let html = `<div class="hint" style="text-align:left">
      Aktivní: <b style="color:#d8b45a">${G.activeQuestCount()}/${G.MAX_ACTIVE_QUESTS}</b>
    </div>`;
    html += `<div class="panel-title">Vypsané</div>`;
    if (!available.length) html += `<div class="empty">Žádné nové zakázky.</div>`;
    else for (const q of available) html += questRow(q, 'available');
    if (active.length) {
      html += `<div class="panel-title">Přijaté</div>`;
      for (const q of active) html += questRow(q, 'active');
    }
    return html;
  }
  function questRow(q, mode) {
    const needHtml = q.need.map(n => {
      if (n.material) {
        const have = G.matCount(n.material);
        return `<span class="quest-need ${have >= n.qty ? 'ok' : ''}">
          ${G.MATERIALS[n.material].icon} ${have}/${n.qty}
        </span>`;
      }
      return '';
    }).join(' ');
    const r = q.reward;
    const rewardTxt = `+${r.gold} 🪙 • +${r.renown} ⭐${r.rep ? ` • +${r.rep} rep` : ''}`;
    let timeInfo;
    if (mode === 'active') {
      const left = G.questTimeLeft(q);
      const urgent = left < 120;
      timeInfo = `<div class="quest-time ${urgent ? 'urgent' : ''}">⏱ zbývá ${formatSec(left)}</div>
        <div class="progress"><div class="progress-bar" style="width:${Math.min(100, left/q.deadline*100).toFixed(1)}%;background:${urgent?'#c05a45':'#d8b45a'}"></div></div>`;
    } else {
      timeInfo = `<div class="quest-time">⏱ deadline ${formatSec(q.deadline)}</div>`;
    }
    const canTurnIn = mode === 'active' && q.need.every(n => !n.material || G.matCount(n.material) >= n.qty);
    let action;
    if (mode === 'available') {
      const canAccept = G.activeQuestCount() < G.MAX_ACTIVE_QUESTS;
      action = `<div class="quest-actions">
        <button class="btn-sm" ${canAccept ? '' : 'disabled'} data-action="quest-accept" data-settlement="${q.settlementId}" data-quest="${q.id}">Přijmout</button>
        <button class="btn-sm ghost" data-action="quest-decline" data-settlement="${q.settlementId}" data-quest="${q.id}">Odmítnout</button>
      </div>`;
    } else {
      action = `<div class="quest-actions">
        <button class="btn-sm" ${canTurnIn ? '' : 'disabled'} data-action="quest-turnin" data-settlement="${q.settlementId}" data-quest="${q.id}">Odevzdat</button>
      </div>`;
    }
    return `<div class="quest-card ${mode === 'active' ? 'active' : ''}">
      <div class="quest-head"><div class="quest-icon">📜</div><div class="quest-text">${G.esc(q.text)}</div></div>
      <div class="quest-needs">${needHtml}</div>
      <div class="quest-reward">${rewardTxt}</div>
      ${timeInfo}
      ${action}
    </div>`;
  }
  function formatSec(s) {
    s = Math.max(0, Math.floor(s));
    const h = Math.floor(s/3600), m = Math.floor((s%3600)/60);
    if (h > 0) return `${h} h ${m} min`;
    if (m > 0) return `${m} min`;
    return `${s} s`;
  }
})();
