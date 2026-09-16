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
        <div class="loc-sub" title="Sídlo zaplatí za tvé zboží jen do výše tohoto zlata — pak musí prodat, aby mělo zase čím platit.">Sklad zlata: ${Math.floor(st.gold).toLocaleString('cs-CZ')} 🪙</div>
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
    const econ = G.state.economy[settlementId] || { target: {} };
    for (const mid of mats) {
      const m = G.MATERIALS[mid];
      const stock = Math.floor(stockOf(settlementId, mid));
      const targetStock = Math.round((econ.target[mid] || 0) * ((bonuses && bonuses.stockMult) || 1));
      const buy = G.priceAt(settlementId, mid, 'buy');
      const sell = G.priceAt(settlementId, mid, 'sell');
      const have = G.matCount(mid);
      const isProduced = spec.produces.includes(mid);
      const isConsumed = spec.consumes.includes(mid);
      const buyDiff = Math.round((buy / m.price - 1) * 100);
      const sellDiff = Math.round((sell / m.price - 1) * 100);
      const trendOf = d => d <= -15 ? { i:'▼', c:'#8fbf7a', t:'výhodné' } : d >= 25 ? { i:'▲', c:'#c05a45', t:'drahé' } : { i:'•', c:'#9c937c', t:'normální' };
      const bt = trendOf(buyDiff), stt = trendOf(sellDiff);
      let tag = '';
      if (isProduced) tag = ' <span class="loc-tag" style="background:#1f2a1c;color:#8fbf7a">výroba</span>';
      else if (isConsumed) tag = ' <span class="loc-tag" style="background:#2c1e1a;color:#cf8f6a">poptávka</span>';
      html += `<div class="trade-row">
        <div class="trade-icon">${m.icon}</div>
        <div class="trade-main">
          <div class="trade-name">${G.esc(m.name)}${tag}</div>
          <div class="trade-sub">sklad <b>${stock}</b>${targetStock ? ` / ${targetStock}` : ''} • ty máš <b>${have}</b></div>
          <div class="trade-prices">
            <span class="price-buy" title="O kolik je cena nad/pod základní cenou ${m.price} 🪙">koupíš ${buy} 🪙 <small style="color:${bt.c}">${bt.i} ${buyDiff > 0 ? '+' : ''}${buyDiff} %</small></span>
            <span class="price-sell" title="O kolik je výkupní cena nad/pod základní cenou ${m.price} 🪙">prodáš ${sell} 🪙 <small style="color:${stt.c}">${stt.i} ${sellDiff > 0 ? '+' : ''}${sellDiff} %</small></span>
          </div>
        </div>
        <div class="trade-actions">
          ${G.qtyControl('mat:' + mid, { value: 1, max: 999, presets: [1, 10, 50] })}
          <button class="btn-sm" data-action="trade-buy" data-settlement="${settlementId}" data-material="${mid}" title="Koupit zvolené množství (sklad ${stock})">Koupit</button>
          <button class="btn-sm ghost" data-action="trade-sell" data-settlement="${settlementId}" data-material="${mid}" title="Prodat zvolené množství (máš ${have})">Prodat</button>
        </div>
      </div>`;
    }
    // Gemy u obchodníka (jen v metropoli a městech)
    const def = G.WORLD.settlementById[settlementId];
    if (def && (def.size === 'city' || def.size === 'town')) {
      html += `<div class="panel-title">💎 Gemy</div>`;
      for (const gid in G.GEMS) {
        const g = G.GEMS[gid];
        if (G.gemAvailableAt ? !G.gemAvailableAt(settlementId, gid) : (def.size === 'town' && g.tier >= 3)) continue;
        const price = G.gemPrice ? G.gemPrice(settlementId, gid) : Math.round(g.price * bonuses.buyMult);
        const afford = G.state.resources.gold >= price;
        const owned = G.matCount('gem_' + gid);
        html += `<div class="trade-row">
          <div class="trade-icon">${g.icon}</div>
          <div class="trade-main">
            <div class="trade-name">${G.esc(g.name)}</div>
            <div class="trade-sub">${G.esc(g.desc)} • T${g.tier}${owned ? ` • máš <b>${owned}</b>` : ''}</div>
          </div>
          <div class="trade-actions">
            <span class="price-buy">${price} 🪙</span>
            <button class="btn-sm" ${afford ? '' : 'disabled'} title="${afford ? 'Koupit gem' : `Chybí ${price - Math.floor(G.state.resources.gold)} zlata`}" data-action="buy-gem" data-settlement="${settlementId}" data-gem="${gid}">Koupit</button>
          </div>
        </div>`;
      }
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
    const settlement = G.WORLD.settlementById[settlementId];
    const spec = settlement ? G.SETTLEMENT_SPECS[settlement.spec] : null;
    // Rozestavěná budova v tomto sídle
    const st = G.constructionStatus ? G.constructionStatus(settlementId) : null;
    if (st) {
      html += `<div class="warn-box">🏗️ Staví se <b>${G.esc(G.buildingLabel(st.job))}</b>`;
      if (st.task) html += ` — ${Math.round(st.progress * 100)} %${st.eta != null ? `, zbývá ≈ ${formatSec(st.eta)}` : ''} • ${st.builders} stavitelů`;
      else html += ` — čeká na stavitele u sídla`;
      html += `</div>
        <div class="hint" style="text-align:left">Stavitelé musí být do 4 polí od sídla (až 3). Než stavba skončí, nelze v tomto sídle začít další.</div>`;
    }
    // Rozděl budovy na obecné a specializované
    const specialized = {
      mining: ['forge', 'training_ground'],
      forestry: ['hunters_lodge', 'herbal_garden'],
      farming: ['herbal_garden', 'library'],
      trade: ['alchemist_lab', 'library']
    };
    const specSet = new Set(spec ? (specialized[settlement.spec] || []) : []);
    for (const bid in G.BUILDINGS) {
      const def = G.BUILDINGS[bid];
      const isSpecialized = specSet.has(bid);
      if (!specSet.has(bid)) {
        const basic = ['market','workshop','tavern','warehouse','hospice','guardhouse'];
        if (!basic.includes(bid)) continue;
      }
      const lvl = G.buildingLevel(settlementId, bid);
      const maxed = lvl >= def.maxLevel;
      const check = G.canBuild(settlementId, bid);
      const cost = maxed ? null : G.buildingCost(settlementId, bid, lvl + 1);
      const baseCost = maxed ? null : def.cost(lvl + 1);
      const discounted = !!(cost && baseCost && (cost.gold !== baseCost.gold || (cost.materials[0] && baseCost.materials[0] && cost.materials[0].qty !== baseCost.materials[0].qty)));
      let costText = '';
      if (cost) {
        const mats = cost.materials.map(m => `${G.MATERIALS[m.material].icon} ${m.qty}× ${G.MATERIALS[m.material].name}`).join(' + ');
        costText = `${cost.gold} 🪙${mats ? ' + ' + mats : ''}`;
      }
      let effText = '';
      if (lvl > 0) effText = `<div class="act-sub" style="color:#d8b45a">Aktivní: ${G.esc(G.buildingEffectText(bid, lvl))}</div>`;
      const nextText = !maxed ? `<div class="act-sub" style="color:#9c937c">Na úr. ${lvl + 1}: ${G.esc(G.buildingEffectText(bid, lvl + 1))}</div>` : '';
      const specTag = isSpecialized ? ' <span class="loc-tag" style="background:#332912;color:#e0bb5e">specializace</span>' : '';
      html += `<div class="recipe-row ${maxed || !check.ok ? 'locked' : ''}">
        <div class="recipe-icon">${def.icon}</div>
        <div class="recipe-main">
          <div class="recipe-name">${G.esc(def.name)}${specTag} <span style="color:#8d8570;font-weight:400">— úr. ${lvl}/${def.maxLevel}</span></div>
          <div class="recipe-sub">${G.esc(def.desc)}</div>
          ${costText ? `<div class="recipe-io">Další: ${costText}${discounted ? ' <span style="color:#8fbf7a">(sleva z dílny)</span>' : ''}</div>` : ''}
          ${!check.ok && !maxed ? `<div class="act-sub" style="color:#c05a45">🔒 ${G.esc(check.reason)}</div>` : ''}
          ${effText}
          ${nextText}
        </div>
        <button class="btn-sm" ${check.ok ? '' : 'disabled'} data-action="build" data-settlement="${settlementId}" data-building="${bid}">${maxed ? 'MAX' : 'Postavit'}</button>
      </div>`;
    }
    return html;
  }

  function renderEquipment(settlementId, bonuses) {
    let html = `<div class="panel-title">V nabídce</div>`;
    for (const def of G.availableEquipment(settlementId)) {
      const srep = G.settlementRepMods(settlementId);
      const price = Math.max(1, Math.round(def.price * bonuses.buyMult * srep.buyMult));
      const afford = G.state.resources.gold >= price;
      const mods = Object.entries(def.mods || {}).map(([k, v]) => `${G.SKILLS[k].icon} +${Math.round(v*100)} %`).join(' ');
      const extras = [];
      if (def.staminaDrain) extras.push(`💤 ×${def.staminaDrain}`);
      if (def.combatBonus) extras.push(`⚔️ +${def.combatBonus}`);
      if (def.setId && G.SETS[def.setId]) extras.push(`${G.SETS[def.setId].icon} ${G.SETS[def.setId].name}`);
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
        const qTag = it.quality && it.quality !== 'common' ? ` <span class="q-tag q-${it.quality}">${G.QUALITY_LABEL[it.quality]}</span>` : '';
        const legTag = def.legendary ? ' <span class="q-tag q-masterwork">✨ Leg.</span>' : '';
        html += `<div class="trade-row">
          <div class="trade-icon">${def.icon}</div>
          <div class="trade-main">
            <div class="trade-name">${G.esc(def.name)} <span class="q-tag">${slotCz(def.slot)}</span>${qTag}${legTag}</div>
            <div class="trade-sub">životnost <b style="color:${durColor}">${Math.round(it.durability)}/${def.durability}</b></div>
            <div class="unit-assign"><select data-change="assign-equip" data-item="${it.id}"><option value="">— přiřadit postavě —</option>${G.state.units.filter(u => !u.dead).map(u => {
              const cur = u.equipment[def.slot];
              return `<option value="${u.id}">${G.esc(u.name)}${cur ? ' (nahradí)' : ''}</option>`;
            }).join('')}</select></div>
          </div>
          ${!def.legendary ? `<button class="btn-sm ghost" data-action="sell-equip" data-item="${it.id}">Prodat</button>` : ''}
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
    const needHtml = (q.need || []).map(n => {
      if (n.material) {
        const have = G.matCount(n.material);
        return `<span class="quest-need ${have >= n.qty ? 'ok' : ''}">${G.MATERIALS[n.material].icon} ${have}/${n.qty}</span>`;
      }
      return '';
    }).join(' ');
    const extraInfo = q.kind === 'kill' ? `<div class="act-sub">⚔️ Poraz ${q.killCount} (${q.killType})</div>` : q.kind === 'escort' ? `<div class="act-sub">🚶 Doprovod ${q.escortDays} dní — postavy vyrazí a cestou nemůžou dělat nic jiného</div>` : q.kind === 'explore' ? `<div class="act-sub">🗺️ Prozkoumej ${q.exploreCount || ''}</div>` : '';
    const r = q.reward;
    const rewardTxt = `+${r.gold} 🪙 • +${r.renown} ⭐${r.rep ? ` • +${r.rep} rep` : ''}`;
    let timeInfo;
    if (mode === 'active') {
      const left = G.questTimeLeft(q);
      const urgent = left < 120;
      const escortNote = (q.kind === 'escort' && q.escortUnitIds && q.escortUnitIds.length)
        ? `<div class="act-sub" style="color:#b3a4e8">Doprovází: ${q.escortUnitIds.map(id => { const u = G.getUnit(id); return u ? G.esc(u.name.split(' ')[0]) : '?'; }).join(', ')}</div>`
        : '';
      timeInfo = `<div class="quest-time ${urgent ? 'urgent' : ''}">⏱ zbývá ${formatSec(left)}</div>${escortNote}
        <div class="progress"><div class="progress-bar" style="width:${Math.min(100, left/q.deadline*100).toFixed(1)}%;background:${urgent?'#c05a45':'#d8b45a'}"></div></div>`;
    } else {
      timeInfo = `<div class="quest-time">⏱ deadline ${formatSec(q.deadline)}</div>`;
    }
    const canTurnIn = mode === 'active' && (G.canTurnInQuest ? G.canTurnInQuest(q) : false);
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
      ${extraInfo}
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
