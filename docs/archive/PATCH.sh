#!/bin/bash
# PATCH.sh — aplikuje chirurgické opravy na existující soubory
# Předpokládá, že už jsou v repu soubory: difficulty.js, tutorial.js, endgame.js,
# sets.js, legendaries.js, smoke.js, index.html (z tohoto balíčku).

set -e
cd "$(dirname "$0")"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'; CYAN='\033[0;36m'; NC='\033[0m'

echo ""
echo -e "${CYAN}=== Idle Realms — patch ===${NC}"
echo ""

if [ ! -f "index.html" ] || [ ! -d "js" ]; then
  echo -e "${RED}CHYBA: Nejsi v kořeni repa.${NC}"
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo -e "${RED}Potřebuji python3. Nainstaluj: pkg install python${NC}"
  exit 1
fi

BACKUP_DIR=".patch-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
echo -e "${YELLOW}Záloha: $BACKUP_DIR${NC}"

FILES="js/core/state.js js/core/loop.js js/data/combat.js js/data/progress.js js/systems/combat.js js/systems/autonomy.js js/systems/expeditions.js js/systems/psychology.js js/systems/prestige.js js/systems/units.js js/ui/trade.js js/ui/ui.js js/main.js css/style.css"
for f in $FILES; do
  if [ -f "$f" ]; then
    mkdir -p "$BACKUP_DIR/$(dirname "$f")"
    cp "$f" "$BACKUP_DIR/$f"
  fi
done
echo -e "${GREEN}  ✓ Záloha hotova${NC}"
echo ""

echo -e "${CYAN}--- 1/3 Data + core ---${NC}"

python3 << 'PYEOF_DATA'
def read(p): return open(p, encoding='utf-8').read()
def write(p, s): open(p, 'w', encoding='utf-8').write(s)

def patch(path, old, new, desc):
    try:
        s = read(path)
    except FileNotFoundError:
        print(f'  ✗ MISSING {path}: {desc}')
        return False
    if old not in s:
        print(f'  ✗ FAIL {path}: {desc}')
        return False
    s = s.replace(old, new, 1)
    write(path, s)
    print(f'  ✓ {path}: {desc}')
    return True

patch('js/data/combat.js',
  "    marsh:       ['serpent','wisp','bandit','mud_golem','scorpion','hydra'],\n    lake:        ['serpent','wisp']",
  "    marsh:       ['serpent','wisp','bandit','mud_golem','scorpion','hydra'],\n    mountain:    ['troll','minotaur','orc','harpy','golem'],\n    lake:        ['serpent','wisp']",
  'ENCOUNTER_TABLE + mountain')

patch('js/data/combat.js',
  "  G.BOSS_TABLE = {\n    forest:      ['ancient_treant'],",
  "  G.BOSS_TABLE = {\n    forest:      ['ancient_treant'],\n    grove:       ['ancient_treant'],\n    meadow:      ['ancient_treant'],",
  'BOSS_TABLE + grove/meadow')

patch('js/data/progress.js',
  "{ id:'set_5', name:'Kompletní set', icon:'👑', desc:'Aktivuj 5-kusový set bonus.', reward:{gold:1500,renown:30}, check:(s)=>activeSetCount(s, 5) },",
  "{ id:'set_3', name:'Kompletní set', icon:'👑', desc:'Aktivuj 3-kusový set bonus.', reward:{gold:1500,renown:30}, check:(s)=>activeSetCount(s, 3) },",
  'achievement set_5 -> set_3')

patch('js/core/state.js',
  "        abilitiesUsed: 0, electionsWon: 0,",
  "        abilitiesUsed: 0, electionsWon: 0, bossesKilled: 0,",
  'stats.bossesKilled')

patch('js/core/state.js',
  "      directives: { focusMaterial: null, avoidDanger: false },\n      pendingStory: null,",
  "      directives: { focusMaterial: null, avoidDanger: false },\n      settings: { difficulty: null, tutorial: true },\n      tutorial: null,\n      killCounts: { beast: 0, humanoid: 0, monster: 0 },\n      victoryReached: false,\n      defeatReached: false,\n      chapterHistory: [],\n      pendingStory: null,",
  'settings/tutorial/victory fields')

patch('js/core/state.js',
  "    for (const u of save.units) {",
  "    save.units = save.units || [];\n    save.settings = save.settings || { difficulty: 'normal', tutorial: false };\n    save.tutorial = save.tutorial || { active: false, stepIdx: 99, completed: [] };\n    save.killCounts = save.killCounts || { beast: 0, humanoid: 0, monster: 0 };\n    if (save.victoryReached == null) save.victoryReached = false;\n    if (save.defeatReached == null) save.defeatReached = false;\n    save.chapterHistory = save.chapterHistory || [];\n    save.stats.bossesKilled = save.stats.bossesKilled || 0;\n    for (const u of save.units) {",
  'migrateSave guards')

patch('js/core/loop.js',
  "  function frame(ts) {\n    const real = Math.min(0.25, (ts - lastTs) / 1000 || 0);",
  "  function frame(ts) {\n    const speedMult = G.debugSpeed ? G.debugSpeed() : 1;\n    const real = Math.min(0.25, (ts - lastTs) / 1000 || 0) * speedMult;",
  'debug speed multiplier')

patch('js/core/loop.js',
  "    G.tickAutonomy(dt);\n    if (G.tickStory) G.tickStory(dt);",
  "    G.tickAutonomy(dt);\n    if (G.tickTutorial) G.tickTutorial(dt);\n    if (G.tickEndgame) G.tickEndgame(dt);\n    if (G.tickStory) G.tickStory(dt);",
  'tutorial+endgame tick')
PYEOF_DATA

echo ""
echo -e "${CYAN}--- 2/3 Systémy ---${NC}"

python3 << 'PYEOF_SYS'
def read(p): return open(p, encoding='utf-8').read()
def write(p, s): open(p, 'w', encoding='utf-8').write(s)

def patch(path, old, new, desc):
    try: s = read(path)
    except FileNotFoundError:
        print(f'  ✗ MISSING {path}: {desc}'); return False
    if old not in s:
        print(f'  ✗ FAIL {path}: {desc}'); return False
    s = s.replace(old, new, 1); write(path, s)
    print(f'  ✓ {path}: {desc}'); return True

patch('js/systems/combat.js',
  "    const danger = G.nodeDanger(node.kind);\n    if (!opts.noBoss && danger >= 3 && G.chance(G.BOSS_SPAWN_CHANCE)) {",
  "    const danger = G.nodeDanger(node.kind);\n    const bossChance = danger >= 3 ? G.BOSS_SPAWN_CHANCE : (danger >= 2 ? G.BOSS_SPAWN_CHANCE * 0.5 : 0);\n    if (!opts.noBoss && bossChance > 0 && G.chance(bossChance)) {",
  'boss spawn on danger>=2')

patch('js/systems/combat.js',
  "      if (cb.isBoss && G.rollLegendaryDrop) {\n        let chanceBoost = 1;\n        if (G.legendaryDropBonus) chanceBoost += G.legendaryDropBonus();\n        const legend = G.rollLegendaryDrop(cb.enemyTemplate);\n        if (legend && (chanceBoost > 1 ? true : G.chance(1))) {",
  "      if (cb.isBoss && G.rollLegendaryDrop) {\n        const bonus = G.legendaryDropBonus ? G.legendaryDropBonus() : 0;\n        const legend = G.rollLegendaryDrop(cb.enemyTemplate, bonus);\n        if (legend) {",
  'legendary drop uses bonus')

patch('js/systems/combat.js',
  "      if (cb.enemyTemplate === 'drake') G.state.stats.dragonsKilled = (G.state.stats.dragonsKilled || 0) + 1;",
  "      if (cb.enemyTemplate === 'drake') G.state.stats.dragonsKilled = (G.state.stats.dragonsKilled || 0) + 1;\n      const tplQ = G.ENEMIES[cb.enemyTemplate];\n      if (tplQ && G.recordKill) {\n        const beastIds = ['rat','slime','boar','wolf','spider','bat','bear','werewolf','scorpion','harpy','serpent'];\n        const humanIds = ['bandit','orc','goblin','bandit_leader','warlord','minotaur'];\n        let killType = 'monster';\n        if (beastIds.includes(tplQ.id)) killType = 'beast';\n        else if (humanIds.includes(tplQ.id)) killType = 'humanoid';\n        G.recordKill(killType, 1);\n      }",
  'record kill for quests')

patch('js/systems/combat.js',
  "      case 'summon': {\n        const minionTpl = G.ENEMIES[eff.enemyId]; if (!minionTpl) break;\n        let summoned = 0;\n        for (let i = 0; i < (eff.count || 1); i++) { const minion = G.createEnemyInstance(minionTpl, cb.enemy.length + i, 1, false); cb.enemy.push(minion); summoned++; }",
  "      case 'summon': {\n        const minionTpl = G.ENEMIES[eff.enemyId]; if (!minionTpl) break;\n        const aliveCount = cb.enemy.filter(e => e.alive).length;\n        const room = Math.max(0, 8 - aliveCount);\n        const want = Math.min(eff.count || 1, room);\n        let summoned = 0;\n        for (let i = 0; i < want; i++) { const minion = G.createEnemyInstance(minionTpl, cb.enemy.length + i, 1, false); cb.enemy.push(minion); summoned++; }",
  'summon cap')

patch('js/systems/autonomy.js',
  "  let baseTimer = 0;\n  const BASE_INTERVAL = 2;\n  G.tickBase = function (dt) {",
  "  G.legendaryDropBonus = function () {\n    const lvl = G.baseBuildingLevel ? G.baseBuildingLevel('legendary_forge') : 0;\n    return lvl * 0.05;\n  };\n\n  let gemTimer = 0;\n  const GEM_INTERVAL = 300;\n\n  let baseTimer = 0;\n  const BASE_INTERVAL = 2;\n  G.tickBase = function (dt) {",
  'legendaryDropBonus + gem timer')

patch('js/systems/autonomy.js',
  "      if (whole > 0) {\n        const q = G.chance(G.BASE_FINE_CHANCE) ? 'fine' : 'common';\n        G.matAdd(def.produces, whole, q);\n        G.state.base.accum[bid] = accum - whole;\n      } else G.state.base.accum[bid] = accum;\n    }\n  };",
  "      if (whole > 0) {\n        const q = G.chance(G.BASE_FINE_CHANCE) ? 'fine' : 'common';\n        G.matAdd(def.produces, whole, q);\n        G.state.base.accum[bid] = accum - whole;\n      } else G.state.base.accum[bid] = accum;\n    }\n    const gemLvl = G.baseBuildingLevel ? G.baseBuildingLevel('gem_smithy') : 0;\n    if (gemLvl > 0) {\n      gemTimer += step;\n      if (gemTimer >= GEM_INTERVAL / gemLvl) {\n        gemTimer = 0;\n        const gemIds = Object.keys(G.GEMS);\n        const gid = gemIds[G.randInt(0, gemIds.length - 1)];\n        G.matAdd('gem_' + gid, 1, 'common');\n        G.log(`💎 Gemmová dílna vyrobila ${G.GEMS[gid].icon} ${G.GEMS[gid].name}.`, 'work');\n      }\n    }\n  };",
  'gem smithy production')

patch('js/systems/expeditions.js',
  "    return G.state.units.filter(u => u && !u.dead && !u.isChild && !busy.has(id => busy.has(u.id)) && !busy.has(u.id));",
  "    return G.state.units.filter(u => u && !u.dead && !u.isChild\n      && !busy.has(u.id)\n      && !u.resting\n      && !u.onExpedition\n      && !(u.merchantState && u.merchantState.active));",
  'expedition filter')

patch('js/systems/psychology.js',
  "    u.deserted = true;\n    u.dead = true;               // používáme stejnou logiku odstranění\n    u.desertedAt = G.state.time;\n    u.deathTime = G.state.time;",
  "    u.deserted = true;\n    u.dead = true;\n    u.desertedAt = G.state.time;\n    u.deathTime = G.state.time;\n    u.deathAge = G.unitAge ? G.unitAge(u) : 0;\n    u.deathReason = 'dezertoval';\n    if (G.state.stats) G.state.stats.deaths = (G.state.stats.deaths || 0) + 1;",
  'desertUnit dynasty tracking')

patch('js/systems/prestige.js',
  "    G.state.resources.gold = 40 + G.prestigeStartGold() - 40;\n    G.state.resources.gold = G.prestigeStartGold();",
  "    G.state.resources.gold = G.prestigeStartGold();",
  'prestige dead code')

patch('js/systems/units.js',
  "  G.unitCombatPower = function (unit) {",
  "  G.recordKill = function (killType, count) {\n    if (!G.state.killCounts) G.state.killCounts = { beast: 0, humanoid: 0, monster: 0 };\n    if (!G.state.killCounts[killType]) G.state.killCounts[killType] = 0;\n    G.state.killCounts[killType] += (count || 1);\n  };\n\n  G.unitCombatPower = function (unit) {",
  'recordKill')

patch('js/systems/units.js',
  "  G.addUnitXp = function (unit, amount) {\n    if (amount <= 0) return;",
  "  G.addUnitXp = function (unit, amount) {\n    if (amount <= 0) return;\n    if (unit.equipment) {\n      for (const slot in unit.equipment) {\n        const it = unit.equipment[slot];\n        if (!it) continue;\n        const def = G.EQUIPMENT[it.itemId];\n        if (def && def.effect && def.effect.xpBonus) amount *= (1 + def.effect.xpBonus / 100);\n      }\n    }",
  'legendary xp bonus')
PYEOF_SYS

echo ""
echo -e "${CYAN}--- 3/3 UI + main ---${NC}"

python3 << 'PYEOF_UI'
def read(p): return open(p, encoding='utf-8').read()
def write(p, s): open(p, 'w', encoding='utf-8').write(s)

def patch(path, old, new, desc):
    try: s = read(path)
    except FileNotFoundError:
        print(f'  ✗ MISSING {path}: {desc}'); return False
    if old not in s:
        print(f'  ✗ FAIL {path}: {desc}'); return False
    s = s.replace(old, new, 1); write(path, s)
    print(f'  ✓ {path}: {desc}'); return True

patch('js/ui/trade.js',
  "    const canTurnIn = mode === 'active' && (q.need || []).every(n => !n.material || G.matCount(n.material) >= n.qty) && (q.kind === 'deliver');",
  "    let canTurnIn = false;\n    if (mode === 'active') {\n      if (q.kind === 'deliver') {\n        canTurnIn = (q.need || []).every(n => !n.material || G.matCount(n.material) >= n.qty);\n      } else if (q.kind === 'kill') {\n        const have = (G.state.killCounts && G.state.killCounts[q.killType]) || 0;\n        canTurnIn = have >= (q.killCount || 0);\n      } else if (q.kind === 'explore') {\n        const have = (G.state.stats.settlementsVisited || []).length;\n        canTurnIn = have >= (q.exploreCount || 0);\n      } else if (q.kind === 'escort') {\n        canTurnIn = G.state.time >= (q.acceptedAt || 0) + (q.escortDays || 0) * G.TIME.dayLength;\n      }\n    }",
  'quest turn-in pro všechny kind')

p = 'js/ui/panels.js'
s = read(p)
helpers = '''
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
'''
old = "  G.panelPlace = function () {\n    const sel = G.state.selected;\n    let html = renderDirectives() + renderActivityDashboard();"
new = helpers + "\n  G.panelPlace = function () {\n    const sel = G.state.selected;\n    let html = tutorialBanner() + renderDirectives() + renderActivityDashboard();"
if old in s:
    s = s.replace(old, new, 1); write(p, s)
    print('  ✓ js/ui/panels.js: tutorial banner')
else:
    print('  ✗ FAIL panels.js: tutorial banner')

p = 'js/ui/ui.js'
s = read(p)
helpers = '''
  /* === DIFFICULTY MODAL === */
  G.showDifficultyModal = function (onPick) {
    const root = document.getElementById('modal-root');
    let selected = null;
    function renderD() {
      let html = `<div class="modal-backdrop"><div class="modal wide">
        <div class="story-label">Vítej ve Idle Realm</div>
        <div class="modal-title">Vyber si obtížnost</div>
        <div class="modal-text">Každá hra má svůj charakter. Volba ovlivní délku běhu, smrt v boji a offline progres.</div>
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
              <span>💀 Smrt: <b>${Math.round(d.combatDeathChance*100)} %</b></span>
              <span>💤 Offline: <b>${Math.round(d.offlineCap/3600)} h</b></span>
            </div>
          </div>
        </button>`;
      }
      html += `</div><div class="perk-actions"><button class="btn" id="diff-confirm" ${selected ? '' : 'disabled'}>▶️ Začít hru</button></div></div></div>`;
      root.innerHTML = html;
      root.classList.add('show');
      root.querySelectorAll('[data-diff]').forEach(b => {
        b.addEventListener('click', () => { selected = b.dataset.diff; renderD(); });
      });
      const btn = document.getElementById('diff-confirm');
      if (btn) btn.addEventListener('click', () => {
        if (!selected) return;
        root.innerHTML = ''; root.classList.remove('show');
        onPick(selected);
      });
    }
    renderD();
  };

  /* === VICTORY MODAL === */
  G.showVictoryModal = function () {
    const root = document.getElementById('modal-root');
    const sm = G.runSummary();
    const chapter = G.chapterName ? G.chapterName(sm.prestige) : 'Neznámá';
    root.innerHTML = `<div class="modal-backdrop"><div class="modal wide victory-modal">
      <div class="victory-title">🏆 VÍTĚZSTVÍ!</div>
      <div class="victory-sub">Přivedl jsi svou dynastii z popela až do hvězd.<br>Příběh je dokonán — ale svět volá dál.</div>
      <div class="chapter-tag">📖 Kapitola ${sm.prestige}: ${G.esc(chapter)}</div>
      <div class="summary-grid">
        <div class="summary-item"><span>Obtížnost</span><span>${sm.difficulty.icon} ${G.esc(sm.difficulty.name)}</span></div>
        <div class="summary-item"><span>Odehráno</span><span>${formatTime(sm.timePlayed)}</span></div>
        <div class="summary-item"><span>Živé postavy</span><span>${sm.unitsAlive}</span></div>
        <div class="summary-item"><span>Zesnulí</span><span>${sm.unitsDead}</span></div>
        <div class="summary-item"><span>Generace</span><span>${sm.generations}</span></div>
        <div class="summary-item"><span>Vyděláno</span><span>${sm.goldEarned} 🪙</span></div>
        <div class="summary-item"><span>Úkolů</span><span>${sm.tasksDone}</span></div>
        <div class="summary-item"><span>Vítězství</span><span>${sm.combatsWon}</span></div>
        <div class="summary-item"><span>Bossů</span><span>${sm.bossesKilled}</span></div>
        <div class="summary-item"><span>Zakázek</span><span>${sm.questsCompleted}</span></div>
        <div class="summary-item"><span>Expedic</span><span>${sm.expeditions}</span></div>
        <div class="summary-item"><span>Cílů</span><span>${sm.achievements}</span></div>
      </div>
      <div class="perk-actions">
        <button class="btn prestige-btn" data-action="new-chapter">📖 Zahájit novou kapitolu</button>
        <button class="btn ghost" data-action="victory-continue">Pokračovat ve hře</button>
      </div>
    </div></div>`;
    root.classList.add('show');
    G.pauseGame();
  };

  /* === DEFEAT MODAL === */
  G.showDefeatModal = function () {
    const root = document.getElementById('modal-root');
    const sm = G.runSummary();
    root.innerHTML = `<div class="modal-backdrop"><div class="modal wide victory-modal">
      <div class="victory-title" style="color:#c05a45">💀 KONEC</div>
      <div class="victory-sub">Dynastie vyhasla. Pokladnice je prázdná.<br>Tvůj příběh zde končí — ale svět si tě pamatuje.</div>
      <div class="summary-grid">
        <div class="summary-item"><span>Obtížnost</span><span>${sm.difficulty.icon} ${G.esc(sm.difficulty.name)}</span></div>
        <div class="summary-item"><span>Odehráno</span><span>${formatTime(sm.timePlayed)}</span></div>
        <div class="summary-item"><span>Generace</span><span>${sm.generations}</span></div>
        <div class="summary-item"><span>Vyděláno</span><span>${sm.goldEarned} 🪙</span></div>
        <div class="summary-item"><span>Úkolů</span><span>${sm.tasksDone}</span></div>
        <div class="summary-item"><span>Vítězství</span><span>${sm.combatsWon}</span></div>
        <div class="summary-item"><span>Bossů</span><span>${sm.bossesKilled}</span></div>
        <div class="summary-item"><span>Cílů</span><span>${sm.achievements}</span></div>
      </div>
      <div class="perk-actions">
        <button class="btn danger" data-action="hardcore-reset">🔄 Začít znovu</button>
      </div>
    </div></div>`;
    root.classList.add('show');
    G.pauseGame();
  };

  function doSkipTutorial() {
    if (G.skipTutorial) G.skipTutorial();
    render();
  }
  function doNewChapter() {
    if (!confirm('Opravdu zahájit novou kapitolu? Vše se resetuje (kromě trvalých unlocků).')) return;
    const res = G.newChapter();
    if (res && res.ok) { G.log('📖 Nová kapitola…', 'story'); setTimeout(() => location.reload(), 600); }
  }
  function doVictoryContinue() {
    const root = document.getElementById('modal-root');
    root.innerHTML = ''; root.classList.remove('show');
    G.resumeGame();
  }
  function doHardcoreReset() {
    if (!confirm('Opravdu smazat tento běh a začít znovu?')) return;
    G.resetSave();
  }
'''
idx = s.rfind('})();')
if idx < 0:
    print('  ✗ FAIL ui.js: konec IIFE')
else:
    s = s[:idx] + helpers + "\n" + s[idx:]
    write(p, s)
    print('  ✓ js/ui/ui.js: modaly + akce')

s = read(p)
old_switch = "      case 'toggle-directive-danger': return doToggleDirectiveDanger();\n    }"
new_switch = "      case 'toggle-directive-danger': return doToggleDirectiveDanger();\n      case 'skip-tutorial':   return doSkipTutorial();\n      case 'new-chapter':     return doNewChapter();\n      case 'victory-continue':return doVictoryContinue();\n      case 'hardcore-reset':  return doHardcoreReset();\n    }"
if old_switch in s:
    s = s.replace(old_switch, new_switch, 1); write(p, s)
    print('  ✓ js/ui/ui.js: switch akce')
else:
    print('  ✗ FAIL ui.js: switch pattern')

patch('js/main.js',
  "    } else newGame();",
  "    } else {\n      if (!saved) {\n        G.state = G.newState();\n        G.state.worldSeed = seed;\n        if (G.showDifficultyModal) {\n          G.showDifficultyModal(function (diffId) {\n            newGame(diffId);\n            G.initWorld(document.getElementById('world'));\n            G.initUI();\n            G.initDebug();\n            G.startLoop();\n            window.addEventListener('beforeunload', () => G.save());\n            document.addEventListener('visibilitychange', () => { if (document.hidden) G.save(); });\n          });\n          return;\n        }\n        newGame('normal');\n      } else newGame();\n    }",
  'difficulty modal on new game')

patch('js/main.js',
  "  function newGame() {\n    G.state = G.newState();\n    G.state.worldSeed = G.WORLD_SEED;",
  "  function newGame(diffId) {\n    G.state = G.newState();\n    G.state.worldSeed = G.WORLD_SEED;\n    if (diffId) G.setDifficulty(diffId);\n    else if (!G.state.settings.difficulty) G.setDifficulty('normal');\n    const diff = G.currentDifficulty();\n    G.state.settings.tutorial = true;\n    G.state.tutorial = { active: true, stepIdx: 0, completed: [] };",
  'newGame signature')

patch('js/main.js',
  "    G.state.resources.gold = 40;",
  "    G.state.resources.gold = diff.startGold;\n    const extraUnits = Math.max(0, (diff.startUnits || 3) - 3);\n    for (let i = 0; i < extraUnits; i++) {\n      const ue = G.createUnit();\n      const stx = G.WORLD.settlementById['svitavy'];\n      if (stx) ue.pos = { x: stx.x + 0.5 + (G.rand() - 0.5) * 2, y: stx.y + 0.5 + (G.rand() - 0.5) * 2 };\n      G.state.units.push(ue);\n    }",
  'start units from difficulty')

patch('js/main.js',
  "    G.log('🌟 Vítej ve Idle Realm!', 'story');",
  "    G.log(`🌟 Vítej ve Idle Realm! Obtížnost: ${diff.icon} ${diff.name}.`, 'story');\n    G.log('📘 Sleduj úkol v panelu Místo — tutoriál tě provede začátkem.', 'story');",
  'welcome logs')
PYEOF_UI

echo ""
echo -e "${CYAN}--- CSS ---${NC}"
cat >> css/style.css << 'CSS_EOF'

/* === TUTORIÁL === */
.tutorial-banner {
  display: flex; gap: 10px; align-items: flex-start;
  background: linear-gradient(160deg, #2a271f, #241f17);
  border: 1px solid #a8813a; border-radius: 12px;
  padding: 12px; margin-bottom: 12px;
  box-shadow: 0 0 20px rgba(168,129,58,.15);
}
.tut-icon { font-size: 26px; flex-shrink: 0; }
.tut-main { flex: 1; min-width: 0; }
.tut-title { font-weight: 700; color: #e0bb5e; font-size: 13.5px; margin-bottom: 4px; }
.tut-text { font-size: 12.5px; color: #cfc7b4; line-height: 1.4; }
.tut-hint { font-size: 11.5px; color: #8d8570; margin-top: 4px; font-weight: 600; }
.tut-skip { border: 0; background: transparent; color: #8d8570; font-size: 16px; cursor: pointer; padding: 2px 6px; }
.tut-skip:hover { color: #cfc7b4; }

/* === DIFFICULTY MODAL === */
.diff-grid { display: flex; flex-direction: column; gap: 8px; }
.diff-pick {
  display: flex; gap: 12px; align-items: flex-start; text-align: left;
  background: #191813; border: 1px solid #423d32;
  border-radius: 10px; padding: 12px 14px;
  color: #e8e2d4; font: inherit; cursor: pointer;
}
.diff-pick:hover { border-color: #a8813a; background: #241f17; }
.diff-pick.selected { border-color: #e0bb5e; background: #332912; }
.diff-icon { font-size: 24px; flex-shrink: 0; }
.diff-main { flex: 1; }
.diff-name { font-weight: 700; color: #e0bb5e; font-size: 14px; }
.diff-desc { font-size: 12px; color: #9c937c; margin: 4px 0; }
.diff-stats { font-size: 11px; color: #8d8570; display: flex; flex-wrap: wrap; gap: 8px; }
.diff-stats b { color: #cfc7b4; }

/* === VICTORY / DEFEAT === */
.victory-modal { max-width: 520px; }
.victory-title { font-size: 22px; text-align: center; color: #e0bb5e; font-weight: 800; margin-bottom: 8px; letter-spacing: .05em; }
.victory-sub { text-align: center; color: #cfc7b4; font-size: 14px; margin-bottom: 16px; }
.summary-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
  background: #14130f; border-radius: 10px; padding: 12px; margin: 12px 0;
}
.summary-item { display: flex; justify-content: space-between; font-size: 12.5px; }
.summary-item span:first-child { color: #8d8570; }
.summary-item span:last-child { color: #d8b45a; font-weight: 700; }
.chapter-tag { text-align: center; color: #b3a4e8; font-style: italic; margin: 8px 0; }
CSS_EOF
echo "  ✓ css/style.css: tutorial + difficulty + victory"

echo ""
echo -e "${GREEN}=== Hotovo! ===${NC}"
echo ""
echo "Zkontroluj:"
echo "  - otevři test/smoke.html (mělo by být zelené, 15 sekcí)"
echo "  - otevři index.html — u nové hry se objeví výběr obtížnosti"
echo ""
echo -e "${YELLOW}Záloha:${NC} $BACKUP_DIR"
echo "Obnovení: cp -r $BACKUP_DIR/* ."
echo ""
