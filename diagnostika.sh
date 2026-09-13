#!/bin/sh
# diagnostika.sh — Zkontroluj, které JS soubory jsou v repu poškozené (zkrácené)
#
# Použití:
#   cd ~/idle-realms
#   sh diagnostika.sh

echo ""
echo "=== Diagnostika Idle Realms ==="
echo ""

if [ ! -d "js" ]; then
  echo "CHYBA: Nejsi v kořeni repa (chybí js/)."
  exit 1
fi

BROKEN=""
OK=0
TOTAL=0

for f in $(find js -name "*.js" -type f | sort); do
  TOTAL=$((TOTAL + 1))

  # Poslední neprázdný řádek
  LAST=$(grep -v '^[[:space:]]*$' "$f" | tail -1 | tr -d '\r')

  # Standardní IIFE končí na })();
  case "$LAST" in
    "})();")
      OK=$((OK + 1))
      ;;
    *)
      BROKEN="$BROKEN $f"
      SIZE=$(wc -l < "$f" | tr -d ' ')
      echo "  ✗ $f ($SIZE řádků) — konec: $LAST"
      ;;
  esac
done

echo ""
echo "Celkem: $TOTAL souborů | OK: $OK | Podezřelých: $(echo $BROKEN | wc -w | tr -d ' ')"
echo ""

if [ -z "$BROKEN" ]; then
  echo "✓ Všechny JS soubory vypadají v pořádku."
else
  echo "Poškozené soubory (potřebují nahradit):"
  for f in $BROKEN; do
    echo "  $f"
  done
  echo ""
  echo "Pošli mi seznam, pošlu ti správné verze."
fi
