# Idle Realms — KOMPLETNÍ oprava (druhý pokus)

Předchozí patch se neaplikoval správně. Tento balíček obsahuje **vše** a má robustní kontrolu.

## Postup

### 1. Jdi do repa
```bash
cd ~/idle-realms
```

### 2. Ověř aktuální stav

```
ls js/data/difficulty.js js/systems/tutorial.js js/systems/endgame.js 2>/dev/null
```

Mělo by hlásit "No such file or directory" (nebo prázdný výstup).

### 3. Rozbal ZIP do kořene repa

```
unzip -o /sdcard/Download/idle-realms-full-patch.zip
```

(nebo použij Termux:API `termux-unzip`, případně ruční kopírování přes `cp`)

### 4. Ověř, že soubory dorazily

```
ls -la js/data/difficulty.js js/systems/tutorial.js js/systems/endgame.js
ls -la index.html js/data/sets.js js/data/legendaries.js test/smoke.js
```

Všechny musí existovat.

### 5. Spusť PATCH.sh

```
bash PATCH.sh
```

Uvidíš barevný výpis. Každá položka `✓` = OK, `✗` = problém. Pokud něco selže, záloha je v `.patch-backup-*`.

### 6. Otestuj v prohlížeči

- `test/smoke.html` → musí být **15/15 zelených**
- `index.html` → u nové hry se objeví **modal s výběrem obtížnosti**

### 7. Commit

```
echo ".patch-backup-*/" >> .gitignore
git add -A
git status
git commit -m "feat: boss spawn, legendárky, questy, obtížnost, tutoriál, ending"
git push
```

## Co tento balíček obsahuje

### Přímo přepsané soubory (7)

- `js/data/difficulty.js` (nový) — 4 obtížnosti
- `js/systems/tutorial.js` (nový) — 3-krokový tutoriál
- `js/systems/endgame.js` (nový) — vítězství/prohra/kapitoly
- `js/data/sets.js` (přepsán) — bonusy 2/3 místo 2/3/5
- `js/data/legendaries.js` (přepsán) — `rollLegendaryDrop(id, bonus)`
- `test/smoke.js` (přepsán) — 15 sekcí
- `index.html` (přepsán) — script tagy

### Chirurgické opravy (13 souborů) — přes `PATCH.sh`

- `js/core/state.js` — settings, tutorial, victoryReached, bossesKilled
- `js/core/loop.js` — debug speed, tutorial tick, endgame tick
- `js/data/combat.js` — mountain v ENCOUNTER_TABLE, bosse v BOSS_TABLE
- `js/data/progress.js` — set_5 → set_3
- `js/systems/combat.js` — boss spawn na danger≥2, legendary bonus, kill countery, summon cap
- `js/systems/autonomy.js` — legendaryDropBonus, gem smithy produkce
- `js/systems/expeditions.js` — filtr pro busy/rest/merchant
- `js/systems/psychology.js` — desertUnit nastaví deathAge
- `js/systems/prestige.js` — smazán mrtvý kód
- `js/systems/units.js` — recordKill, legendary XP bonus
- `js/ui/trade.js` — quest turn-in pro kill/escort/explore
- `js/ui/panels.js` — tutorial banner
- `js/ui/ui.js` — modaly + akce
- `js/main.js` — difficulty modal při nové hře
- `css/style.css` — styly pro tutoriál/difficulty/victory

## Pokud něco selže

**`python3: command not found`** → `pkg install python`
**`unzip: command not found`** → `pkg install unzip`
**PATCH.sh hlásí FAIL na nějakém souboru** → soubor se liší od očekávaného.
**Hra po patchi nefunguje** → obnov zálohu: `cp -r .patch-backup-*/* .`

## Ověření po patchi

```
node -e "['js/data/difficulty.js','js/systems/tutorial.js','js/systems/endgame.js'].forEach(f=>console.log(f, require('fs').existsSync(f)))" 2>/dev/null || echo "node není, zkontroluj ručně"
```

Nebo prostě: `ls js/data/difficulty.js && echo OK`

