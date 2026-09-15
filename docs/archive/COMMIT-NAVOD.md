# Commit návod — Idle Realms patch balíček

## Co je v balíčku

Rozbalením tohoto ZIPu do kořene tvého klonu `idle-realms/` přibudou/ přepíšou se tyto soubory:

| Soubor | Typ | Popis |
|---|---|---|
| `js/data/difficulty.js` | **nový** | 4 obtížnosti (Relax / Normální / Hardcore / Ironman) |
| `js/systems/tutorial.js` | **nový** | 3-krokový tutoriál pro novou hru |
| `js/systems/endgame.js` | **nový** | Vítězství (Prestige 5), prohra (hardcore), kapitoly |
| `js/data/sets.js` | přepsán | Bonusy 2/3 (dřív 2/3/5 — nesplnitelné) |
| `js/data/legendaries.js` | přepsán | `rollLegendaryDrop(bossId, bonus)` s bonusem |
| `test/smoke.js` | přepsán | 15 sekcí testů (boss spawn, kill countery, endgame, tutoriál) |
| `PATCH.sh` | **nový** | Skript, který doopraví zbytek (chirurgické opravy) |
| `COMMIT-NAVOD.md` | **nový** | Tento soubor |

---

## Krok za krokem (Termux)

### 1. Otevři Termux a jdi do repa

```bash
cd ~/idle-realms
```

### 2. Zkontroluj, že jsi ve správné složce

```
ls
```

Měl bys vidět `index.html`, `js`, `scripts`, `docs`, `css`, `test`.

### 3. Rozbal ZIP do kořene repa

Záleží, kde máš ZIP (typicky `/sdcard/Download/`):

```
# pokud máš unzip
unzip -o /sdcard/Download/idle-realms-patch.zip

# pokud máš Termux:API (balíček termux-api)
termux-unzip /sdcard/Download/idle-realms-patch.zip

# fallback: ručně přes cp (pokud máš soubory jinde)
```

Pokud `unzip` chybí:

```
pkg install unzip
```

### 4. Spusť PATCH.sh

```
bash PATCH.sh
```

Uvidíš barevný výpis — každá položka `✓` znamená úspěch, `✗` znamená problém.
Pokud něco selže, **nezoufej** — skript vytvořil zálohu ve složce `.patch-backup-*`.
Obnovení: `cp -r .patch-backup-*/* .`

### 5. Ověř, že hra funguje

V prohlížeči otevři:

- `test/smoke.html` — mělo by být **zelené** (15 sekcí)
- `index.html` — u nové hry se objeví **modal s výběrem obtížnosti**

### 6. Nahraj do gitu

```
git add -A
git status
```

Zkontroluj, že ve změnách **není** `.patch-backup-*` složka. Pokud ano, přidej ji do `.gitignore`:

```
echo ".patch-backup-*/" >> .gitignore
git add .gitignore
```

Pak commitni a pushni:

```
git commit -m "feat: boss spawn, legendárky, questy, obtížnost, tutoriál, ending"
git push
```

(Pokud `git push` chce heslo, použij **Personal Access Token** z GitHubu.)

---

## Co bylo opraveno (souhrn)

### Kritické bugy (P0)

- **B1** Boss spawn — `BOSS_TABLE` nyní pokrývá i regiony s danger ≥ 2 (grove, meadow, mountain)
- **B2** Legendární drop — `rollLegendaryDrop(bossId, bonus)` skutečně používá `bonus` z legendary forge (+5 % / level)
- **B3** Kill / Escort / Explore questy — `recordKill()` + `canTurnIn` pro všechny typy
- **B4** Achievement `set_5` → `set_3` (5 kusů nebylo dosažitelných, jen 3 sloty)
- **B5** Expedice — `availableForExpedition` filtruje resting / merchant / onExpedition
- **B6** Gem smithy — nyní reálně produkuje gemy (12 × level / h)
- **B7** Debug speed — `×5 / ×20 / ×100` skutečně zrychluje (loop násobí `real`)

### Střední bugy (P1)

- **B8** `desertUnit` — nastaví `deathAge`, `deathReason`, inkrementuje `stats.deaths`
- **B9** `migrateSave` — guard na `save.units || []` + doplnění nových polí
- **B10** `stats.bossesKilled` — v `newState()`, migraci i UI
- **B12** `ENCOUNTER_TABLE.mountain` — přidán (dřív fallback na bandity)
- **B14** Summon cap — bossové nemohou summonovat donekonečna (max 8 nepřátel)

### Nové featury (P2)

- **Obtížnosti** — Relax / Normální / Hardcore / Ironman, volba při nové hře
- **Tutoriál** — 3 kroky (dřevo → budova → druhé sídlo), s odměnami
- **Endgame** — vítězství při Prestige 5, prohra u hardcore, kapitoly s historií
- **Run summary** — přehled statistik při vítězství/prohře

---

## Co záměrně **není** v balíčku

- **Migrace na ESM** — příliš velký risk pro jeden commit; odloženo na samostatnou větev
- **TypeScript / Vite** — stejný důvod
- **Rozšíření o nové achievementy pro tutoriál** — drobnost, můžeš dodělat sám

---

## Pokud něco selže

1. **`python3: command not found`** → `pkg install python`
2. **`unzip: command not found`** → `pkg install unzip`
3. **PATCH.sh hlásí `FAIL`** → tvůj soubor se liší od očekávaného.
Zkontroluj, jestli máš nejnovější commit: `git log -1 --oneline` (mělo by být `a0f09a7`)
4. **Hra po patchi nefunguje** → obnov zálohu: `cp -r .patch-backup-*/* .`
5. **Něco jiného** → pošli výstup z Termuxu.

---

## Rychlý checklist

- □  
`cd ~/idle-realms`
- □  
`unzip -o /sdcard/Download/idle-realms-patch.zip`
- □  
`bash PATCH.sh`
- □  
otevřít `test/smoke.html` → zelené
- □  
otevřít `index.html` → funguje výběr obtížnosti
- □  
`echo ".patch-backup-*/" >> .gitignore`
- □  
`git add -A && git commit -m "..." && git push`

