#!/bin/bash
# CLEANUP.sh — vyčistí duplikáty z dvojího spuštění PATCH.sh
#
# Opravuje:
#   1) js/systems/combat.js  — duplikátní `const tplQ` (FATÁLNÍ SyntaxError)
#   2) js/systems/units.js   — duplikátní xpBonus loop a recordKill
#   3) js/core/state.js      — duplikátní bossesKilled klíč a migrateSave blok
#   4) js/main.js            — nested if-else (mrtvý kód)
#   5) js/ui/ui.js           — duplikátní modaly a do* funkce
#   6) js/data/combat.js     — duplikátní klíče v BOSS_TABLE
#   7) css/style.css         — duplikátní TUTORIÁL/DIFFICULTY/VICTORY blok
#
# Použití (z kořene repa):
#   bash CLEANUP.sh

set -e
cd "$(dirname "$0")"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'; CYAN='\033[0;36m'; NC='\033[0m'

echo ""
echo -e "${CYAN}=== Idle Realms — CLEANUP po dvojím PATCH.sh ===${NC}"
echo ""

if [ ! -f "index.html" ] || [ ! -d "js" ]; then
  echo -e "${RED}CHYBA: Nejsi v kořeni repa.${NC}"
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo -e "${RED}Potřebuji python3. Nainstaluj: pkg install python${NC}"
  exit 1
fi

BACKUP_DIR=".cleanup-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
echo -e "${YELLOW}Záloha: $BACKUP_DIR${NC}"

FILES="js/systems/combat.js js/systems/units.js js/core/state.js js/main.js js/ui/ui.js js/data/combat.js css/style.css"
for f in $FILES; do
  if [ -f "$f" ]; then
    mkdir -p "$BACKUP_DIR/$(dirname "$f")"
    cp "$f" "$BACKUP_DIR/$f"
  fi
done
echo -e "${GREEN}  ✓ Záloha hotova${NC}"
echo ""

echo -e "${CYAN}--- 1/2 Aplikuji fixy ---${NC}"
echo ""

python3 << 'PYEOF'

def read(p):
    return open(p, encoding='utf-8').read()

def write(p, s):
    open(p, 'w', encoding='utf-8', newline='\n').write(s)

def fix(path, fn, desc):
    try:
        s = read(path)
    except FileNotFoundError:
        print(f'  \u2717 MISSING {path}: {desc}')
        return False
    s2 = fn(s)
    if s2 is None or s2 == s:
        print(f'  - {path}: {desc} (nic ke zm\u011bn\u011b)')
        return False
    write(path, s2)
    print(f'  \u2713 {path}: {desc}')
    return True

# ============ 1. js/systems/combat.js ============
def fix_combat_sys(s):
    dup = """      const tplQ = G.ENEMIES[cb.enemyTemplate];
      if (tplQ && G.recordKill) {
        const beastIds = ['rat','slime','boar','wolf','spider','bat','bear','werewolf','scorpion','harpy','serpent'];
        const humanIds = ['bandit','orc','goblin','bandit_leader','warlord','minotaur'];
        let killType = 'monster';
        if (beastIds.includes(tplQ.id)) killType = 'beast';
        else if (humanIds.includes(tplQ.id)) killType = 'humanoid';
        G.recordKill(killType, 1);
      }"""
    idx = s.find(dup)
    if idx < 0:
        return None
    idx2 = s.find(dup, idx + len(dup))
    if idx2 < 0:
        return None
    end = idx2 + len(dup)
    # Od\u0159\u00edznout i n\u00e1sleduj\u00edc\u00ed newline
    if end < len(s) and s[end] == '\n':
        end += 1
    # Od\u0159\u00edznout i p\u0159edchoz\u00ed pr\u00e1zdn\u00fd \u0159\u00e1dek, pokud existuje
    return s[:idx2] + s[end:]

fix('js/systems/combat.js', fix_combat_sys,
    'odstran\u011bn druh\u00fd const tplQ (SyntaxError fix)')

# ============ 2. js/systems/units.js ============
def fix_units(s):
    changed = False

    dup_xp = """    if (unit.equipment) {
      for (const slot in unit.equipment) {
        const it = unit.equipment[slot];
        if (!it) continue;
        const def = G.EQUIPMENT[it.itemId];
        if (def && def.effect && def.effect.xpBonus) amount *= (1 + def.effect.xpBonus / 100);
      }
    }
"""
    idx = s.find(dup_xp)
    if idx >= 0:
        idx2 = s.find(dup_xp, idx + len(dup_xp))
        if idx2 >= 0:
            s = s[:idx2] + s[idx2 + len(dup_xp):]
            changed = True

    dup_rk = """  G.recordKill = function (killType, count) {
    if (!G.state.killCounts) G.state.killCounts = { beast: 0, humanoid: 0, monster: 0 };
    if (!G.state.killCounts[killType]) G.state.killCounts[killType] = 0;
    G.state.killCounts[killType] += (count || 1);
  };

"""
    idx = s.find(dup_rk)
    if idx >= 0:
        idx2 = s.find(dup_rk, idx + len(dup_rk))
        if idx2 >= 0:
            s = s[:idx2] + s[idx2 + len(dup_rk):]
            changed = True

    return s if changed else None

fix('js/systems/units.js', fix_units,
    'odstran\u011bny duplik\u00e1ty (xpBonus loop, recordKill)')

# ============ 3. js/core/state.js ============
def fix_state(s):
    changed = False

    if 'bossesKilled: 0, bossesKilled: 0,' in s:
        s = s.replace('bossesKilled: 0, bossesKilled: 0,', 'bossesKilled: 0,')
        changed = True

    dup_ms = """    save.units = save.units || [];
    save.settings = save.settings || { difficulty: 'normal', tutorial: false };
    save.tutorial = save.tutorial || { active: false, stepIdx: 99, completed: [] };
    save.killCounts = save.killCounts || { beast: 0, humanoid: 0, monster: 0 };
    if (save.victoryReached == null) save.victoryReached = false;
    if (save.defeatReached == null) save.defeatReached = false;
    save.chapterHistory = save.chapterHistory || [];
    save.stats.bossesKilled = save.stats.bossesKilled || 0;
"""
    idx = s.find(dup_ms)
    if idx >= 0:
        idx2 = s.find(dup_ms, idx + len(dup_ms))
        if idx2 >= 0:
            s = s[:idx2] + s[idx2 + len(dup_ms):]
            changed = True

    return s if changed else None

fix('js/core/state.js', fix_state,
    'odstran\u011bny duplik\u00e1ty (bossesKilled, migrateSave)')

# ============ 4. js/main.js ============
def fix_main(s):
    old = """      G.log('\U0001f4be Na\u010dteno. V\u00edtej zp\u011bt!', 'info');
    } else {
      if (!saved) {
        G.state = G.newState();
        G.state.worldSeed = seed;
        if (G.showDifficultyModal) {
          G.showDifficultyModal(function (diffId) {
            newGame(diffId);
            G.initWorld(document.getElementById('world'));
            G.initUI();
            G.initDebug();
            G.startLoop();
            window.addEventListener('beforeunload', () => G.save());
            document.addEventListener('visibilitychange', () => { if (document.hidden) G.save(); });
          });
          return;
        }
        newGame('normal');
      } else {
      if (!saved) {
        G.state = G.newState();
        G.state.worldSeed = seed;
        if (G.showDifficultyModal) {
          G.showDifficultyModal(function (diffId) {
            newGame(diffId);
            G.initWorld(document.getElementById('world'));
            G.initUI();
            G.initDebug();
            G.startLoop();
            window.addEventListener('beforeunload', () => G.save());
            document.addEventListener('visibilitychange', () => { if (document.hidden) G.save(); });
          });
          return;
        }
        newGame('normal');
      } else newGame();
    }
    }"""
    new = """      G.log('\U0001f4be Na\u010dteno. V\u00edtej zp\u011bt!', 'info');
    } else {
      G.state = G.newState();
      G.state.worldSeed = seed;
      if (G.showDifficultyModal) {
        G.showDifficultyModal(function (diffId) {
          newGame(diffId);
          G.initWorld(document.getElementById('world'));
          G.initUI();
          G.initDebug();
          G.startLoop();
          window.addEventListener('beforeunload', () => G.save());
          document.addEventListener('visibilitychange', () => { if (document.hidden) G.save(); });
        });
        return;
      }
      newGame('normal');
    }"""
    if old in s:
        return s.replace(old, new, 1)
    return None

fix('js/main.js', fix_main, 'opraven nested if-else v boot()')

# ============ 5. js/ui/ui.js ============
def fix_ui(s):
    marker = '/* === DIFFICULTY MODAL === */'
    first = s.find(marker)
    if first < 0:
        return None
    second = s.find(marker, first + len(marker))
    if second < 0:
        return None
    tail = s.rfind('})();')
    if tail < 0 or tail < second:
        return None
    return s[:second].rstrip() + '\n\n' + s[tail:]

fix('js/ui/ui.js', fix_ui,
    'odstran\u011bny duplicitn\u00ed modaly a do* funkce')

# ============ 6. js/data/combat.js ============
def fix_combat_data(s):
    old = """  G.BOSS_TABLE = {
    forest:      ['ancient_treant'],
    grove:       ['ancient_treant'],
    meadow:      ['ancient_treant'],
    grove:       ['ancient_treant'],
    meadow:      ['ancient_treant'],
    deep_forest: ['alpha_werewolf'],"""
    new = """  G.BOSS_TABLE = {
    forest:      ['ancient_treant'],
    grove:       ['ancient_treant'],
    meadow:      ['ancient_treant'],
    deep_forest: ['alpha_werewolf'],"""
    if old in s:
        return s.replace(old, new, 1)
    return None

fix('js/data/combat.js', fix_combat_data,
    'odstran\u011bny duplicitn\u00ed kl\u00ed\u010de v BOSS_TABLE')

# ============ 7. css/style.css ============
def fix_css(s):
    marker = '/* === TUTORI\u00c1L === */'
    parts = s.split(marker)
    if len(parts) < 3:
        return None
    return (parts[0] + marker + parts[1]).rstrip() + '\n'

fix('css/style.css', fix_css,
    'odstran\u011bn duplicitn\u00ed TUTORI\u00c1L/DIFFICULTY/VICTORY blok')

PYEOF

echo ""
echo -e "${CYAN}--- 2/2 Syntax check (node) ---${NC}"

if command -v node >/dev/null 2>&1; then
  OK=0; FAIL=0
  for f in js/systems/combat.js js/systems/units.js js/core/state.js js/main.js js/ui/ui.js js/data/combat.js; do
    if node --check "$f" 2>/dev/null; then
      echo -e "  ${GREEN}✓${NC} $f"
      OK=$((OK+1))
    else
      echo -e "  ${RED}✗${NC} $f"
      node --check "$f" 2>&1 | head -3
      FAIL=$((FAIL+1))
    fi
  done
  echo ""
  if [ "$FAIL" -eq 0 ]; then
    echo -e "Syntax: ${GREEN}$OK OK${NC}, ${GREEN}0 FAIL${NC}"
  else
    echo -e "Syntax: ${GREEN}$OK OK${NC}, ${RED}$FAIL FAIL${NC}"
    echo ""
    echo -e "${RED}Pozor: n\u011bkter\u00fd soubor m\u00e1 st\u00e1le syntax error!${NC}"
    echo "Zkontroluj v\u00fdstup v\u00fd\u0161e. Obnov ze z\u00e1lohy:"
    echo "  cp -r $BACKUP_DIR/* ."
    exit 1
  fi
else
  echo -e "${YELLOW}(node nen\u00ed, syntax check p\u0159esko\u010den \u2014 otestuj v prohl\u00ed\u017ee\u010di)${NC}"
fi

echo ""
echo -e "${GREEN}=== Hotovo! ===${NC}"
echo ""
echo "Zkontroluj:"
echo "  - otev\u0159i test/smoke.html \u2192 mus\u00ed b\u00fdt v\u0161e zelen\u00e9"
echo "  - otev\u0159i index.html \u2192 vyzkou\u0161ej souboj (klikni na \u010derven\u00fd uzel \u2192 \u2694\ufe0f Za\u00fato\u010dit)"
echo ""
echo -e "${YELLOW}Z\u00e1loha:${NC} $BACKUP_DIR"
echo "Obnoven\u00ed: cp -r $BACKUP_DIR/* ."
echo ""
echo -e "${CYAN}Commit:${NC}"
echo "  echo '.cleanup-backup-*/' >> .gitignore"
echo "  git add -A"
echo "  git commit -m 'fix: odstran\u011bn\u00ed duplik\u00e1t\u016f z dvoj\u00edho PATCH.sh + syntax fix combat.js'"
echo "  git push"
echo ""
