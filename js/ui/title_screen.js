/**
 * title_screen.js — Úvodní obrazovka s Pokračovat / Nová hra / Smazat
 *
 * Volá se z main.js boot(). Nahrazuje původní showDifficultyModal()
 * (ten zůstává v ui.js jako fallback, ale už se nevolá).
 *
 * Poskytuje:
 *   G.showTitleScreen({ saveInfo, onContinue, onNewGame })
 *   G.getSaveInfo(saved) — extrahuje metadata pro intro
 *   G.wipeSave()         — smaže všechny savy (bez reloadu)
 *   G.SAVE_KEYS          — definováno v state.js
 */
(function () {
  const G = window.Game;

  G.wipeSave = function () {
    try {
      for (const k of G.SAVE_KEYS) localStorage.removeItem(k);
    } catch (e) {}
  };

  G.getSaveInfo = function (saved) {
    if (!saved) return null;
    const diff = (G.DIFFICULTIES && G.DIFFICULTIES[(saved.settings && saved.settings.difficulty) || 'normal'])
      || { icon: '⚖️', name: 'Normální' };
    const units = (saved.units || []).filter(u => !u.dead && !u.isChild).length;
    const t = saved.time || 0;
    const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60);
    const timeStr = h > 0 ? `${h} h ${m} min` : `${m} min`;
    const elapsed = saved.lastSave ? Math.floor((Date.now() - saved.lastSave) / 1000) : 0;
    let savedStr = 'právě teď';
    if (elapsed > 86400) savedStr = `${Math.floor(elapsed / 86400)} dny zpět`;
    else if (elapsed > 3600) savedStr = `${Math.floor(elapsed / 3600)} h zpět`;
    else if (elapsed > 60) savedStr = `${Math.floor(elapsed / 60)} min zpět`;
    return {
      difficulty: diff.icon + ' ' + diff.name,
      units: units,
      time: timeStr,
      saved: savedStr
    };
  };

  let menuPaused = false;
  let menuOpen = false;

  /** Je otevřené menu (titulní obrazovka vyvolaná ze hry)? */
  G.isGameMenuOpen = function () { return menuOpen; };

  /** Otevře menu ze hry (☰ v liště) — hra se pozastaví. */
  G.openGameMenu = function () {
    if (menuOpen) return;
    if (G.isPaused && !G.isPaused()) { G.pauseGame(); menuPaused = true; }
    menuOpen = true;
    G.showTitleScreen({
      saveInfo: G.getSaveInfo(G.state),
      fromGame: true,
      onContinue: () => G.closeGameMenu(),
      onClose: () => G.closeGameMenu(),
      onNewGame: (diffId) => {
        G.closeGameMenu();
        if (G.startNewGame) G.startNewGame(diffId);
      }
    });
  };

  /** Zavře menu a vrátí se do hry. */
  G.closeGameMenu = function () {
    if (!menuOpen) return;
    menuOpen = false;
    const root = document.getElementById('modal-root');
    if (root) { root.innerHTML = ''; root.classList.remove('show'); }
    if (menuPaused) { menuPaused = false; if (G.resumeGame) G.resumeGame(); }
    // Menu překrylo případný jiný modal — vrať ho zpět, ať se hra nezasekne.
    if (G.state && G.state.combat && G.state.combat.active && G.showCombatModal) {
      G.showCombatModal(G.state.combat.active);
    } else if (G.state && G.state.pendingStory && G.showStoryModal) {
      G.showStoryModal(G.state.pendingStory);
    } else if (G.state && G.state.pendingEvents && G.state.pendingEvents.length && G.showEventModal) {
      G.showEventModal(G.state.pendingEvents[0]);
    }
    if (G.refreshPanel) G.refreshPanel();
  };

  G.showTitleScreen = function (opts) {
    opts = opts || {};
    const root = document.getElementById('modal-root');
    if (!root) {
      if (opts.onContinue && opts.saveInfo) opts.onContinue();
      else if (opts.onNewGame) opts.onNewGame('normal');
      return;
    }

    function renderMain() {
      const si = opts.saveInfo;
      let html = `<div class="title-screen">
        ${opts.fromGame ? '<button class="title-close" data-ts="close" title="Zpět do hry (Esc)">✕</button>' : ''}
        <div class="title-logo">🏰</div>
        <div class="title-name">Idle Realms</div>
        <div class="title-sub">Idle RPG o vedení, přežití a dědictví</div>`;

      if (si) {
        html += `<div class="title-save-info">
          <div class="tsi-row"><span>Obtížnost</span><b>${G.esc(si.difficulty)}</b></div>
          <div class="tsi-row"><span>Živé postavy</span><b>${si.units}</b></div>
          <div class="tsi-row"><span>Odehráno</span><b>${G.esc(si.time)}</b></div>
          <div class="tsi-row"><span>Uloženo</span><b>${G.esc(si.saved)}</b></div>
        </div>`;
      }

      html += `<div class="title-actions">`;

      if (si) {
        html += `<button class="title-btn primary" data-ts="continue">
          <span class="tbtn-icon">▶️</span>
          <div class="tbtn-main">
            <div class="tbtn-title">${opts.fromGame ? 'Zpět do hry' : 'Pokračovat'}</div>
            <div class="tbtn-desc">${opts.fromGame ? 'Zavřít menu a hrát dál' : 'Načíst rozpracovanou hru'}</div>
          </div>
        </button>`;
      }

      html += `<button class="title-btn ${si ? '' : 'primary'}" data-ts="new">
        <span class="tbtn-icon">✨</span>
        <div class="tbtn-main">
          <div class="tbtn-title">Nová hra</div>
          <div class="tbtn-desc">Vybrat obtížnost a začít od nuly</div>
        </div>
      </button>`;

      if (si) {
        html += `<button class="title-btn danger" data-ts="wipe">
          <span class="tbtn-icon">🗑️</span>
          <div class="tbtn-main">
            <div class="tbtn-title">Smazat uloženou hru</div>
            <div class="tbtn-desc">Nevratné — smaže všechny savy</div>
          </div>
        </button>`;
      }

      html += `</div>
        ${opts.fromGame ? `<label class="title-toggle"><input type="checkbox" id="story-toggle" ${(G.storyPopupsEnabled && G.storyPopupsEnabled()) ? 'checked' : ''}> Příběhové popupy (volby s trvalými efekty)</label>` : ''}
        ${opts.fromGame ? `<label class="title-toggle">🤖 Zakázky sama: <select id="quest-toggle">
          <option value="off" ${G.autoQuestMode() === 'off' ? 'selected' : ''}>vypnuto</option>
          <option value="deliver" ${G.autoQuestMode() === 'deliver' ? 'selected' : ''}>jen doručovací</option>
          <option value="all" ${G.autoQuestMode() === 'all' ? 'selected' : ''}>všechny</option>
        </select></label>` : ''}
        ${opts.fromGame ? `<label class="title-toggle">🎨 Vzhled (mapa a postavy): <select id="tile-toggle">
          <option value="code" ${(G.tileStyle && G.tileStyle() === 'code') ? 'selected' : ''}>kreslený (kód)</option>
          <option value="ai" ${(G.tileStyle && G.tileStyle() === 'ai') ? 'selected' : ''}>malovaný (AI dlaždice)</option>
        </select></label>` : ''}
        <div class="title-footer">
          Verze savu ${G.SAVE_VERSION} • klávesa <span class="title-key">D</span> = debug
        </div>
      </div>`;

      root.innerHTML = `<div class="modal-backdrop title-backdrop">${html}</div>`;
      root.classList.add('show');

      const storyToggle = root.querySelector('#story-toggle');
      if (storyToggle) storyToggle.addEventListener('change', () => {
        if (!G.state.settings) G.state.settings = {};
        G.state.settings.storyPopups = !!storyToggle.checked;
        G.log(storyToggle.checked
          ? '📖 Příběhové popupy zapnuty.'
          : '📖 Příběhové popupy vypnuty — příběh se přeskočí (můžeš je vrátit v menu ☰).', 'info');
      });

      const questToggle = root.querySelector('#quest-toggle');
      if (questToggle) questToggle.addEventListener('change', () => {
        if (G.setAutoQuestMode) G.setAutoQuestMode(questToggle.value);
        G.log(`🤖 Automatické zakázky: ${questToggle.value === 'off' ? 'vypnuty' : questToggle.value === 'deliver' ? 'jen doručovací' : 'všechny'}.`, 'info');
      });

      const tileToggle = root.querySelector('#tile-toggle');
      if (tileToggle) tileToggle.addEventListener('change', () => {
        const v = G.setTileStyle ? G.setTileStyle(tileToggle.value) : 'code';
        G.log(v === 'ai'
          ? '🎨 Zapnutý malovaný vzhled mapy (AI dlaždice se načítají).'
          : '🎨 Zapnutý kreslený vzhled mapy.', 'info');
      });

      root.querySelectorAll('[data-ts]').forEach(btn => {
        btn.addEventListener('click', () => {
          const act = btn.dataset.ts;
          if (act === 'continue') {
            root.innerHTML = ''; root.classList.remove('show');
            if (opts.onContinue) opts.onContinue();
          } else if (act === 'close') {
            if (opts.onClose) opts.onClose();
            else { root.innerHTML = ''; root.classList.remove('show'); }
          } else if (act === 'new') {
            renderDifficulty();
          } else if (act === 'wipe') {
            if (!confirm('Opravdu smazat uloženou hru? Tato akce je nevratná.')) return;
            G.wipeSave();
            location.reload();
          }
        });
      });
    }

    function renderDifficulty() {
      let selected = null;

      function draw() {
        let html = `<div class="title-screen">
          <div class="title-name" style="font-size:22px">Vyber si obtížnost</div>
          <div class="title-sub">Každá hra má svůj charakter. Volba ovlivní délku běhu, smrt v boji a offline progres.</div>
          <div class="diff-grid">`;

        for (const id in G.DIFFICULTIES) {
          const d = G.DIFFICULTIES[id];
          html += `<button class="diff-pick ${selected === id ? 'selected' : ''}" data-diff="${id}">
            <span class="diff-icon">${d.icon}</span>
            <div class="diff-main">
              <div class="diff-name">${G.esc(d.name)}</div>
              <div class="diff-desc">${G.esc(d.desc)}</div>
              <div class="diff-stats">
                <span>🪙 Start: <b>${d.startGold}</b></span>
                <span>🧙 Postavy: <b>${d.startUnits}</b></span>
                <span>💀 Smrt: <b>${Math.round(d.combatDeathChance * 100)} %</b></span>
                <span>💤 Offline: <b>${Math.round(d.offlineCap / 3600)} h</b></span>
              </div>
            </div>
          </button>`;
        }

        html += `</div>
          <div class="title-actions">
            <button class="title-btn primary" data-ts2="start" ${selected ? '' : 'disabled'}>
              <span class="tbtn-icon">▶️</span>
              <div class="tbtn-main">
                <div class="tbtn-title">Začít hru</div>
                <div class="tbtn-desc">${selected ? G.esc(G.DIFFICULTIES[selected].name) : 'Vyber obtížnost nahoře'}</div>
              </div>
            </button>
            <button class="title-btn" data-ts2="back">
              <span class="tbtn-icon">↩️</span>
              <div class="tbtn-main">
                <div class="tbtn-title">Zpět</div>
              </div>
            </button>
          </div>
        </div>`;

        root.innerHTML = `<div class="modal-backdrop title-backdrop">${html}</div>`;
        root.classList.add('show');

        root.querySelectorAll('[data-diff]').forEach(b => {
          b.addEventListener('click', () => { selected = b.dataset.diff; draw(); });
        });
        root.querySelector('[data-ts2="start"]').addEventListener('click', () => {
          if (!selected) return;
          root.innerHTML = ''; root.classList.remove('show');
          if (opts.onNewGame) opts.onNewGame(selected);
        });
        root.querySelector('[data-ts2="back"]').addEventListener('click', renderMain);
      }

      draw();
    }

    renderMain();
  };
})();
