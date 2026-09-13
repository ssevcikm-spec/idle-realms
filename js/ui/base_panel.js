(function () {
  const G = window.Game;

  G.panelBase = function () {
    if (!G.state.base || !G.state.base.unlocked) {
      const need = G.BASE_UNLOCK.renown;
      const have = Math.floor(G.state.resources.renown);
      return `<div class="loc-head">
        <div class="loc-icon">🏕️</div>
        <div class="loc-main"><div class="loc-name">Základna</div><div class="loc-sub">Ještě není odemčena</div></div>
      </div>
      <div class="warn-box">🔒 Základna se odemkne při renomé ${need}. Máš ${have}.</div>`;
    }
    let html = `<div class="loc-head">
      <div class="loc-icon">🏕️</div>
      <div class="loc-main">
        <div class="loc-name">Tvá základna</div>
        <div class="loc-sub">Poloha ${G.BASE_POS.x}, ${G.BASE_POS.y}</div>
        <div class="loc-sub">Pasivní produkce běží i když spíš.</div>
      </div>
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
    for (const bid in G.BASE_BUILDINGS) {
      const def = G.BASE_BUILDINGS[bid];
      const lvl = G.baseBuildingLevel(bid);
      const maxed = lvl >= def.maxLevel;
      const check = G.canBuildBase(bid);
      const cost = maxed ? null : def.cost(lvl + 1);
      let costText = '';
      if (cost) {
        const mats = cost.materials.map(m => `${G.MATERIALS[m.material].icon} ${m.qty}×`).join(' + ');
        costText = `${cost.gold} 🪙${mats ? ' + ' + mats : ''}`;
      }
      let rateInfo = '';
      if (lvl > 0) {
        if (def.special === 'gem') rateInfo = `<div class="act-sub" style="color:#8fbf7a">Produkce: ${12*lvl} gemů/h</div>`;
        else if (def.special === 'legendary') rateInfo = `<div class="act-sub" style="color:#8fbf7a">Bonus: +${lvl*5} % šance na legendárku</div>`;
        else if (def.rate) rateInfo = `<div class="act-sub" style="color:#8fbf7a">Produkce: +${(def.rate(lvl)*3600).toFixed(1)}/h</div>`;
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
        </div>
        <button class="btn-sm" ${check.ok ? '' : 'disabled'} data-action="build-base" data-building="${bid}">${maxed ? 'MAX' : 'Postavit'}</button>
      </div>`;
    }
    return html;
  };
})();
