#!/bin/bash
# FIX-v2.sh — opraví 6 problémů nalezených v revizi repa Idle Realms
#
# Opravuje:
#   1) CSS useknutý v .dbg-danger (kritické — chybí uzavření pravidla)
#   2) Legendárky nejsou v G.EQUIPMENT (kvůli pořadí scriptů v index.html)
#   3) combatDeathChance z obtížnosti se v boji nepoužívá (hardcoded 0.12)
#   4) offlineCap + xpMult z obtížnosti se nepoužívají
#   5) bossesKilled chybí v ensureDefaults() v main.js
#   6) .patch-backup-* složky v gitu (neignorované)
#
# Použití (z kořene repa, v Termuxu):
#   bash FIX-v2.sh
#
# Skript je defenzivní — každá oprava zkontroluje, jestli už není aplikovaná.
# Pokud selže, záloha je v .fixv2-backup-TIMESTAMP/

set -e
cd "$(dirname "$0")"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'; CYAN='\033[0;36m'; NC='\033[0m'

echo ""
echo -e "${CYAN}=== Idle Realms — FIX v2 ===${NC}"
echo ""

if [ ! -f "index.html" ] || [ ! -d "js" ]; then
  echo -e "${RED}CHYBA: Nejsi v kořeni repa (chybí index.html nebo js/).${NC}"
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo -e "${RED}Potřebuji python3. Nainstaluj: pkg install python${NC}"
  exit 1
fi

BACKUP_DIR=".fixv2-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
echo -e "${YELLOW}Záloha: $BACKUP_DIR${NC}"

FILES="css/style.css index.html test/smoke.html js/systems/combat.js js/core/loop.js js/systems/units.js js/main.js .gitignore"
for f in $FILES; do
  if [ -f "$f" ]; then
    mkdir -p "$BACKUP_DIR/$(dirname "$f")"
    cp "$f" "$BACKUP_DIR/$f" 2>/dev/null || true
  fi
done
echo -e "${GREEN}  ✓ Záloha hotova${NC}"
echo ""

echo -e "${CYAN}--- Aplikuji opravy ---${NC}"

python3 << 'PYEOF'
import os, re

def read(p):
    try:
        with open(p, encoding='utf-8') as f:
            return f.read()
    except FileNotFoundError:
        return None

def write(p, s):
    with open(p, 'w', encoding='utf-8', newline='\n') as f:
        f.write(s)

# ============ 1. CSS: dokončit .dbg-danger ============
def fix_css():
    s = read('css/style.css')
    if s is None:
        print('  \u2717 MISSING css/style.css')
        return False
    lines = s.split('\n')
    fixed = False
    for i, line in enumerate(lines):
        # Hledáme řádek, který začíná .dbg-danger, obsahuje { a background,
        # ale NEMÁ uzavírací }
        stripped = line.strip()
        if stripped.startswith('.dbg-danger') and '{' in stripped and '}' not in stripped:
            lines[i] = '.dbg-danger { background: linear-gradient(180deg, #8c3b2f, #6d2c23); color: #f5eeda; border-color: #8b6c2e; }'
            fixed = True
            break
    if fixed:
        write('css/style.css', '\n'.join(lines))
        print('  \u2713 css/style.css: dopln\u011bno .dbg-danger')
        return True
    # Zkontroluj, jestli už je hotovo
    if '.dbg-danger { background: linear-gradient' in s:
        print('  - css/style.css: ji\u017e opraveno')
        return False
    print('  \u2717 css/style.css: pattern .dbg-danger nenalezen (zkontroluj ru\u010dn\u011b)')
    return False

fix_css()

# ============ 2. Pořadí scriptů: legendaries.js před character.js ============
def reorder_scripts(path):
    s = read(path)
    if s is None:
        print(f'  \u2717 MISSING {path}')
        return False

    old_block = (
        '<script src="js/data/character.js"></script>\n'
        '<script src="js/data/sets.js"></script>\n'
        '<script src="js/data/gems.js"></script>\n'
        '<script src="js/data/legendaries.js"></script>'
    )
    new_block = (
        '<script src="js/data/legendaries.js"></script>\n'
        '<script src="js/data/character.js"></script>\n'
        '<script src="js/data/sets.js"></script>\n'
        '<script src="js/data/gems.js"></script>'
    )

    # Varianta 1: relativní cesty "js/data/..." (index.html)
    if old_block in s:
        s2 = s.replace(old_block, new_block, 1)
        write(path, s2)
        print(f'  \u2713 {path}: legendaries.js p\u0159ed character.js')
        return True

    # Varianta 2: relativní cesty "../js/data/..." (test/smoke.html)
    old_block2 = old_block.replace('src="js/', 'src="../js/')
    new_block2 = new_block.replace('src="js/', 'src="../js/')
    if old_block2 in s:
        s2 = s.replace(old_block2, new_block2, 1)
        write(path, s2)
        print(f'  \u2713 {path}: legendaries.js p\u0159ed character.js')
        return True

    # Už opraveno?
    if re.search(r'legendaries\.js[^\n]*\n[^\n]*character\.js', s):
        print(f'  - {path}: ji\u017e opraveno')
        return False

    print(f'  \u2717 {path}: blok k p\u0159esunu nenalezen')
    return False

reorder_scripts('index.html')
reorder_scripts('test/smoke.html')

# ============ 3. combat.js: combatDeathChance z obtížnosti ============
def fix_combat_death():
    s = read('js/systems/combat.js')
    if s is None:
        print('  \u2717 MISSING js/systems/combat.js')
        return False
    old = "          if (G.chance(0.12) && !u._resurrected) G.die(u, 'padl v boji');"
    new = ("          const deathChance = (G.currentDifficulty ? G.currentDifficulty().combatDeathChance : 0.12);\n"
           "          if (G.chance(deathChance) && !u._resurrected) G.die(u, 'padl v boji');")
    if old in s:
        s = s.replace(old, new, 1)
        write('js/systems/combat.js', s)
        print('  \u2713 js/systems/combat.js: combatDeathChance z obt\u00ed\u017enosti')
        return True
    if 'const deathChance = (G.currentDifficulty' in s:
        print('  - js/systems/combat.js: ji\u017e opraveno')
        return False
    print('  \u2717 js/systems/combat.js: pattern nenalezen')
    return False

fix_combat_death()

# ============ 4a. loop.js: offlineCap z obtížnosti ============
def fix_loop():
    s = read('js/core/loop.js')
    if s is None:
        print('  \u2717 MISSING js/core/loop.js')
        return False
    old = "  G.simulateOffline = function (elapsedSeconds) {\n    const total = Math.min(elapsedSeconds, OFFLINE_CAP_S);"
    new = ("  G.simulateOffline = function (elapsedSeconds) {\n"
           "    const cap = (G.currentDifficulty ? G.currentDifficulty().offlineCap : OFFLINE_CAP_S);\n"
           "    const total = Math.min(elapsedSeconds, cap);")
    if old in s:
        s = s.replace(old, new, 1)
        write('js/core/loop.js', s)
        print('  \u2713 js/core/loop.js: offlineCap z obt\u00ed\u017enosti')
        return True
    if 'G.currentDifficulty().offlineCap' in s:
        print('  - js/core/loop.js: ji\u017e opraveno')
        return False
    print('  \u2717 js/core/loop.js: pattern nenalezen')
    return False

fix_loop()

# ============ 4b. units.js: xpMult z obtížnosti ============
def fix_units_xp():
    s = read('js/systems/units.js')
    if s is None:
        print('  \u2717 MISSING js/systems/units.js')
        return False
    old = ("    if (G.timeXpMod) mult *= G.timeXpMod();\n"
           "    if (G.unlockXpMult) mult *= G.unlockXpMult();\n"
           "    amount *= mult;")
    new = ("    if (G.timeXpMod) mult *= G.timeXpMod();\n"
           "    if (G.unlockXpMult) mult *= G.unlockXpMult();\n"
           "    if (G.currentDifficulty) mult *= G.currentDifficulty().xpMult;\n"
           "    amount *= mult;")
    if old in s:
        s = s.replace(old, new, 1)
        write('js/systems/units.js', s)
        print('  \u2713 js/systems/units.js: xpMult z obt\u00ed\u017enosti')
        return True
    if 'G.currentDifficulty().xpMult' in s:
        print('  - js/systems/units.js: ji\u017e opraveno')
        return False
    print('  \u2717 js/systems/units.js: pattern nenalezen')
    return False

fix_units_xp()

# ============ 5. main.js: bossesKilled v ensureDefaults ============
def fix_main():
    s = read('js/main.js')
    if s is None:
        print('  \u2717 MISSING js/main.js')
        return False
    old = "'electionsWon','expeditions','expeditionSuccesses','namedMasterworks','prestiges']"
    new = "'electionsWon','bossesKilled','expeditions','expeditionSuccesses','namedMasterworks','prestiges']"
    if old in s:
        s = s.replace(old, new, 1)
        write('js/main.js', s)
        print('  \u2713 js/main.js: bossesKilled v ensureDefaults')
        return True
    if "'electionsWon','bossesKilled'" in s:
        print('  - js/main.js: ji\u017e opraveno')
        return False
    print('  \u2717 js/main.js: pattern nenalezen')
    return False

fix_main()

# ============ 6. .gitignore: přidat .patch-backup-*/ atd. ============
def fix_gitignore():
    path = '.gitignore'
    required = ['.patch-backup-*/', '.fixv2-backup-*/', '.cleanup-backup-*/']
    if not os.path.exists(path):
        write(path, '# === Z\u00e1lohy z patch skript\u016f ===\n' + '\n'.join(required) + '\n')
        print(f'  \u2713 {path}: vytvo\u0159en')
        return True
    s = read(path)
    missing = [p for p in required if p not in s]
    if not missing:
        print(f'  - {path}: ji\u017e obsahuje v\u0161e')
        return False
    s = s.rstrip() + '\n\n# === Z\u00e1lohy z patch skript\u016f ===\n' + '\n'.join(missing) + '\n'
    write(path, s)
    print(f'  \u2713 {path}: p\u0159id\u00e1no {len(missing)} vzor\u016f')
    return True

fix_gitignore()

print('')
print('\u2713 Python \u010d\u00e1st hotova.')
PYEOF

echo ""
echo -e "${CYAN}--- Odstraňuji staré .patch-backup složky ---${NC}"

REMOVED=0
for d in .patch-backup-*; do
  if [ -d "$d" ]; then
    rm -rf "$d"
    echo -e "${GREEN}  ✓ Odstran\u011bno: $d${NC}"
    REMOVED=$((REMOVED+1))
  fi
done
if [ "$REMOVED" -eq 0 ]; then
  echo -e "${YELLOW}  - \u017d\u00e1dn\u00e9 .patch-backup-* slo\u017eky nenalezeny${NC}"
fi

echo ""
echo -e "${CYAN}--- Syntax check (node) ---${NC}"

if command -v node >/dev/null 2>&1; then
  OK=0; FAIL=0
  for f in js/systems/combat.js js/core/loop.js js/systems/units.js js/main.js; do
    if [ ! -f "$f" ]; then continue; fi
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
    echo -e "${RED}Pozor: n\u011bkter\u00fd soubor m\u00e1 syntax error!${NC}"
    echo "Obnov ze z\u00e1lohy: cp -r $BACKUP_DIR/* ."
    exit 1
  fi
else
  echo -e "${YELLOW}(node nen\u00ed k dispozici, syntax check p\u0159esko\u010den)${NC}"
fi

echo ""
echo -e "${CYAN}--- Kontrola CSS ---${NC}"
if grep -q 'linear-gradient(180deg, #8c3b2f, #6d2c23)' css/style.css; then
  echo -e "${GREEN}  ✓ .dbg-danger m\u00e1 kompletn\u00ed pravidlo${NC}"
else
  echo -e "${YELLOW}  ⚠ .dbg-danger mo\u017en\u00e1 st\u00e1le ne\u00fap\u0161n\u011b opraveno${NC}"
fi

echo ""
echo -e "${GREEN}=== Hotovo! ===${NC}"
echo ""
echo "Ov\u011b\u0159 v prohl\u00ed\u017ee\u010di:"
echo "  1) test/smoke.html \u2192 v\u0161e zelen\u00e9"
echo "  2) index.html \u2192 nov\u00e1 hra, vyber obt\u00ed\u017enost"
echo "  3) Hardcore \u2192 smrt v boji by m\u011bla b\u00fdt ~35 %"
echo "  4) Debug panel (kl\u00e1vesa D) \u2192 tla\u010d\u00edtko Reset m\u00e1 \u010derven\u00fd gradient"
echo ""
echo -e "${YELLOW}Z\u00e1loha:${NC} $BACKUP_DIR"
echo "Obnoven\u00ed: cp -r $BACKUP_DIR/* ."
echo ""
echo -e "${CYAN}Commit:${NC}"
echo "  git add -A"
echo "  git commit -m 'fix: 6 oprav z revize (CSS, legend\u00e1rky, obt\u00ed\u017enost, gitignore)'"
echo "  git push"
echo ""
