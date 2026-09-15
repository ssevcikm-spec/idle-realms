(function () {
  const G = window.Game;

  G.panelBase = function () {
    if (!G.state.base || !G.state.base.unlocked) {
      const need = G.baseUnlockRenown ? G.baseUnlockRenown() : G.BASE_UNLOCK.renown;
      const have = Math.floor(G.state.resources.renown);
      const offered = !!(G.state.base && G.state.base.placementOffered);
      let html = `<div class="loc-head">
        <div class="loc-icon">🏕️</div>
        <div class="loc-main">
          <div class="loc-name">Základna</div>
          <div class="loc-sub">${offered ? 'Máš dost renomé — zbývá vybrat místo' : 'Ještě není odemčena'}</div>
        </div>
      </div>`;
      if (!offered) {
        html += `<div class="warn-box">🔒 Základna se odemkne při renomé ${need}. Máš ${have}.</div>
          <div class="hint" style="text-align:left">Až ji odemkneš, <b>sám vybereš, kde vyroste</b> — ťukneš prostě na pole na mapě. Poloha rozhoduje, jak daleko to mají postavy do sídel a k surovinám.</div>`;
        return html;
      }
      const s = G.baseSuggestion ? G.baseSuggestion() : null;
      html += `<div class="warn-box">🏕️ Vyber, kde základna vyroste. Pozice určuje, co bude po ruce: sídla (obchod, dílny), surovinové uzly a které dílny na základně budou dosažitelné (do 3 polí).</div>`;
      html += `<button class="btn" data-action="pick-base-spot">📍 Vybrat místo na mapě</button>`;
      if (s) {
        html += `<button class="btn ghost" data-action="auto-place-base" title="Položí základnu na nejvýhodnější volné pole">✨ Postavit na doporučeném místě (${s.x}, ${s.y})</button>`;
        html += `<div class="hint" style="text-align:left">Doporučené místo leží ${G.esc(G.baseLocationText(s.x, s.y))} — blízko sídla i surovin.</div>`;
      }
      html += `<div class="hint">Vodítko: 🏕️ tlačítko na mapě kdykoli otevře tento panel.</div>`;
      return html;
    }
    const bp = G.basePos ? G.basePos() : G.BASE_POS;
    let html = `<div class="loc-head">
      <div class="loc-icon">🏕️</div>
      <div class="loc-main">
        <div class="loc-name">Tvá základna</div>
        <div class="loc-sub">📍 ${G.esc(G.baseLocationText())} (${bp.x}, ${bp.y})</div>
        <div class="loc-sub">Pasivní produkce běží i když spíš. Dílny na základně mají dosah 3 pole.</div>
      </div>
    </div>`;
    html += `<div class="unit-actions">
      <button class="btn-sm ghost" data-action="center-base" title="Posune mapu na základnu">🎯 Zobrazit na mapě</button>
      ${G.canMoveBase && G.canMoveBase()
        ? `<button class="btn-sm ghost" data-action="move-base" title="Dokud na základně nic nestojí, můžeš ji přesunout.">🚚 Přesunout základnu</button>`
        : `<button class="btn-sm ghost" disabled title="Základnu s postavenými budovami přesunout nelze.">🚚 Přesunout (nelze)</button>`}
    </div>`;

    const baseWs = G.workshopsOnBase();
    if (baseWs.length) {
      html += `<div class="panel-title">Dílny</div><div class="base-summary">`;
      for (const wid of baseWs) {
        const w = G.WORKSHOPS[wid];
        html += `<span class="base-mat">${w.icon} ${G.esc(w.name)}</span>`;
      }
      html += `</div>`;
    }

    const summary = G.baseProductionSummary();
    const keys = Object.keys(summary);
    if (keys.length) {
      html += `<div class="panel-title">Produkce</div><div class="base-summary">`;
      for (const mat of keys) {
        if (mat === 'gem') {
          html += `<span class="base-mat">💎 Gemy<b>+${summary[mat].toFixed(1)}/h</b></span>`;
          continue;
        }
        html += `<span class="base-mat">${G.MATERIALS[mat].icon} ${G.esc(G.MATERIALS[mat].name)}<b>+${summary[mat].toFixed(1)}/h</b></span>`;
      }
      html += `</div>`;
    }
    html += `<div class="panel-title">Budovy</div>`;
    const st = G.constructionStatus ? G.constructionStatus('base') : null;
    if (st) {
      html += `<div class="warn-box">🏗️ Staví se <b>${G.esc(G.buildingLabel(st.job))}</b>`;
      if (st.task) html += ` — ${Math.round(st.progress * 100)} %${st.eta != null ? `, zbývá ≈ ${G.formatSec(st.eta)}` : ''} • ${st.builders} stavitelů`;
      else html += ` — čeká na stavitele u základny`;
      html += `</div>
        <div class="hint" style="text-align:left">Stavitelé musí být do 4 polí od základny (až 3). Než stavba skončí, nelze začít další.</div>`;
    }
    for (const bid in G.BASE_BUILDINGS) {
      const def = G.BASE_BUILDINGS[bid];
      const lvl = G.baseBuildingLevel(bid);
      const maxed = lvl >= def.maxLevel;
      const check = G.canBuildBase(bid);
      const cost = maxed ? null : def.cost(lvl + 1);
      let costText = '';
      if (cost) {
        const mats = cost.materials.map(m => `${G.MATERIALS[m.material].icon} ${m.qty}× ${G.MATERIALS[m.material].name}`).join(' + ');
        costText = `${cost.gold} 🪙${mats ? ' + ' + mats : ''}`;
      }
      let rateInfo = '';
      if (lvl > 0) {
        if (def.special === 'gem') rateInfo = `<div class="act-sub" style="color:#8fbf7a">Produkce: ${12*lvl} gemů/h</div>`;
        else if (def.special === 'legendary') rateInfo = `<div class="act-sub" style="color:#8fbf7a">Bonus: +${lvl*5} % šance na legendárku</div>`;
        else if (def.rate) rateInfo = `<div class="act-sub" style="color:#8fbf7a">Produkce: +${(def.rate(lvl)*3600).toFixed(1)}/h</div>`;
      }
      let nextInfo = '';
      if (!maxed) {
        if (def.special === 'gem') nextInfo = `Na úr. ${lvl+1}: ${12*(lvl+1)} gemů/h`;
        else if (def.special === 'legendary') nextInfo = `Na úr. ${lvl+1}: +${(lvl+1)*5} % šance na legendárku`;
        else if (def.rate) nextInfo = `Na úr. ${lvl+1}: +${(def.rate(lvl+1)*3600).toFixed(1)}/h`;
        if (nextInfo) nextInfo = `<div class="act-sub" style="color:#9c937c">${nextInfo}</div>`;
      }
      const specialTag = def.special ? ' <span class="loc-tag" style="background:#4a3a6b;color:#d8d0f5">speciální</span>' : '';
      html += `<div class="recipe-row ${maxed || !check.ok ? 'locked' : ''}">
        <div class="recipe-icon">${def.icon}</div>
        <div class="recipe-main">
          <div class="recipe-name">${G.esc(def.name)}${specialTag} <span style="color:#8d8570;font-weight:400">— úr. ${lvl}/${def.maxLevel}</span></div>
          <div class="recipe-sub">${G.esc(def.desc)}</div>
          ${costText ? `<div class="recipe-io">Další: ${costText}</div>` : ''}
          ${!check.ok && !maxed ? `<div class="act-sub" style="color:#c05a45">🔒 ${G.esc(check.reason)}</div>` : ''}
          ${rateInfo}
          ${nextInfo}
        </div>
        <button class="btn-sm" ${check.ok ? '' : 'disabled'} data-action="build-base" data-building="${bid}">${maxed ? 'MAX' : 'Postavit'}</button>
      </div>`;
    }
    return html;
  };
})();
