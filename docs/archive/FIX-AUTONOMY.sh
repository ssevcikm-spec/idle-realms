#!/bin/bash
# FIX-AUTONOMY.sh — nahradí js/systems/autonomy.js opravenou verzí
# (obsahuje legendaryDropBonus + gem smithy produkci už aplikované)

set -e
cd "$(dirname "$0")"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'; CYAN='\033[0;36m'; NC='\033[0m'

echo ""
echo -e "${CYAN}=== Fix: js/systems/autonomy.js ===${NC}"
echo ""

if [ ! -f "index.html" ] || [ ! -d "js" ]; then
  echo -e "${RED}CHYBA: Nejsi v kořeni repa.${NC}"
  exit 1
fi

TARGET="js/systems/autonomy.js"

if [ ! -f "$TARGET" ]; then
  echo -e "${RED}CHYBA: $TARGET neexistuje.${NC}"
  echo "Ujisti se, že jsi v kořeni repa a že repo má tuto strukturu."
  exit 1
fi

# 1. Záloha
BACKUP="${TARGET}.broken.bak"
cp "$TARGET" "$BACKUP"
echo -e "${YELLOW}Záloha rozbité verze:${NC} $BACKUP"
echo ""

# 2. Diagnostika — co je v současném souboru špatně
echo -e "${CYAN}Diagnostika staré verze:${NC}"
echo "  • velikost: $(wc -c < "$TARGET") bajtů"
echo "  • řádků:    $(wc -l < "$TARGET")"
if command -v grep >/dev/null; then
  if grep -q "G.tickAutonomy" "$TARGET"; then
    echo -e "  • G.tickAutonomy: ${GREEN}nalezeno${NC}"
  else
    echo -e "  • G.tickAutonomy: ${RED}CHYBÍ${NC}"
  fi
  if grep -q "G.legendaryDropBonus" "$TARGET"; then
    echo -e "  • G.legendaryDropBonus: ${GREEN}nalezeno${NC}"
  else
    echo -e "  • G.legendaryDropBonus: ${RED}CHYBÍ${NC}"
  fi
  LAST=$(grep -v '^[[:space:]]*$' "$TARGET" | tail -1)
  echo "  • poslední řádek: $LAST"
fi
echo ""

# 3. Přepsat novou verzí
cp autonomy.js.new "$TARGET"
echo -e "${GREEN}✓ Nahrazen $TARGET novou verzí${NC}"
echo ""

# 4. Rychlá syntaktická kontrola (pokud máme node)
if command -v node >/dev/null 2>&1; then
  if node --check "$TARGET" 2>/dev/null; then
    echo -e "${GREEN}✓ Syntax check OK (node --check)${NC}"
  else
    echo -e "${RED}✗ Syntax check SELHAL:${NC}"
    node --check "$TARGET"
    echo ""
    echo "Obnov zálohu: cp $BACKUP $TARGET"
    exit 1
  fi
else
  echo -e "${YELLOW}(node není, syntax check přeskočen)${NC}"
fi
echo ""

# 5. Úklid
rm -f autonomy.js.new

echo -e "${GREEN}=== Hotovo! ===${NC}"
echo ""
echo "Zkontroluj:"
echo "  - otevři test/smoke.html → musí být 31/31 zelené"
echo "  - otevři index.html → u nové hry výběr obtížnosti"
echo ""
echo "Pak commit:"
echo "  rm $BACKUP"
echo "  git add -A"
echo "  git commit -m 'fix: nahrazen rozbitý autonomy.js'"
echo "  git push"
echo ""
