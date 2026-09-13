#!/bin/sh
# uklid-repa.sh — One-click úklid Idle Realms repozitáře (bash/Termux verze)
#
# Co dělá:
#   1) Smaže duplikáty v scripts/ (css/, docs/, js/, index.html)
#   2) Smaže duplikáty v js/ (index.html, docs/)
#   3) Nahradí js/systems/autonomy.js správnou verzí (Fáze 10)
#   4) Vypíše souhrn
#
# Použití (v Termuxu):
#   cd ~/idle-realms      # nebo kam máš repo
#   sh uklid-repa.sh
#
# Skript je bezpečný — před smazáním vypíše, co bude dělat, a čeká na potvrzení.

set -e

echo ""
echo "=== Idle Realms — úklid repozitáře ==="
echo ""

# Zkontroluj, že jsme ve správné složce
if [ ! -f "index.html" ] || [ ! -d "js" ] || [ ! -d "scripts" ]; then
  echo "CHYBA: Tato složka nevypadá jako repo Idle Realms."
  echo "Ujisti se, že skript spouštíš v kořeni repa (kde je index.html, js/, scripts/)."
  exit 1
fi

echo "Pracovní složka: $(pwd)"
echo ""

# === Plán úklidu ===
TO_DELETE="scripts/css scripts/docs scripts/js scripts/index.html js/index.html js/docs"
TO_DELETE_EXISTING=""

for item in $TO_DELETE; do
  if [ -e "$item" ]; then
    TO_DELETE_EXISTING="$TO_DELETE_EXISTING $item"
  fi
done

COUNT=$(echo $TO_DELETE_EXISTING | wc -w | tr -d ' ')

echo "Bude smazáno ($COUNT položek):"
if [ "$COUNT" -eq 0 ]; then
  echo "  (nic — už je uklizeno)"
else
  for item in $TO_DELETE_EXISTING; do
    echo "  ✗ $item"
  done
fi

# === Nahradit autonomy.js ===
REPLACE_AUTONOMY=0
if [ -f "scripts/js/systems/autonomy.js" ]; then
  REPLACE_AUTONOMY=1
  echo ""
  echo "Bude nahrazeno:"
  echo "  ↻ js/systems/autonomy.js ← scripts/js/systems/autonomy.js"
fi

echo ""
printf "Pokračovat? (a/n): "
read CONFIRM

if [ "$CONFIRM" != "a" ] && [ "$CONFIRM" != "A" ]; then
  echo "Zrušeno."
  exit 0
fi

echo ""
echo "Provádím úklid..."
echo ""

# === Krok 1: Nahradit autonomy.js PŘED smazáním scripts/js ===
if [ "$REPLACE_AUTONOMY" -eq 1 ]; then
  cp -f "scripts/js/systems/autonomy.js" "js/systems/autonomy.js"
  echo "  ✓ Nahrazen js/systems/autonomy.js"
fi

# === Krok 2: Smazat duplikáty ===
for item in $TO_DELETE_EXISTING; do
  rm -rf "$item"
  echo "  ✓ Smazáno: $item"
done

# === Souhrn ===
echo ""
echo "=== Hotovo ==="
echo ""
echo "Další kroky:"
echo "  1) Ověř, že v scripts/ máš jen: check-globals.ps1, verify-snapshot.ps1"
echo "     ls scripts/"
echo "  2) Otevři test/smoke.html v prohlížeči (mělo by být zelené)"
echo "  3) Nahraj změny do gitu:"
echo "       git add -A"
echo "       git commit -m 'chore: úklid duplikátů a oprava autonomy.js'"
echo "       git push"
echo ""
