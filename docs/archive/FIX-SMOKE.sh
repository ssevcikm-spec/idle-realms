#!/bin/bash
# FIX-SMOKE.sh — doplní chybějící <script src> do test/smoke.html
#
# Problém: originální test/smoke.html zapomněl načíst
#   js/data/sets.js, gems.js, legendaries.js, synergies.js
# Proto smoke test hlásí "rollLegendaryDrop existuje" jako FAIL,
# i když je soubor v repu správně.
#
# Použití (z kořene repa):
#   bash FIX-SMOKE.sh

set -e
cd "$(dirname "$0")"

if [ ! -f "test/smoke.html" ]; then
  echo "CHYBA: test/smoke.html nenalezen. Jsi v kořeni repa?"
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "Potřebuji python3."
  exit 1
fi

cp test/smoke.html test/smoke.html.bak

python3 << 'PYEOF'
p = 'test/smoke.html'
s = open(p, encoding='utf-8').read()
changes = []

# 1) Doplň sets/gems/legendaries za character.js
if 'js/data/sets.js' not in s:
    old = '<script src="../js/data/character.js"></script>'
    new = ('<script src="../js/data/character.js"></script>\n'
           '<script src="../js/data/sets.js"></script>\n'
           '<script src="../js/data/gems.js"></script>\n'
           '<script src="../js/data/legendaries.js"></script>')
    if old in s:
        s = s.replace(old, new, 1)
        changes.append('sets.js + gems.js + legendaries.js')

# 2) Doplň synergies za abilities.js
if 'js/data/synergies.js' not in s:
    old = '<script src="../js/data/abilities.js"></script>'
    new = ('<script src="../js/data/abilities.js"></script>\n'
           '<script src="../js/data/synergies.js"></script>')
    if old in s:
        s = s.replace(old, new, 1)
        changes.append('synergies.js')

if not changes:
    print('Nic k doplnění — už je tam vše.')
else:
    open(p, 'w', encoding='utf-8').write(s)
    for c in changes:
        print(f'  ✓ {c}')
    print('test/smoke.html aktualizován.')
PYEOF

echo ""
echo "Hotovo. Otevři test/smoke.html v prohlížeči — mělo by být zelené."
echo "Záloha: test/smoke.html.bak"
echo ""
echo "Pak commitni:"
echo "  rm test/smoke.html.bak"
echo "  git add test/smoke.html"
echo "  git commit -m 'fix: smoke.html načítá sets/gems/legendaries/synergies'"
echo "  git push"
