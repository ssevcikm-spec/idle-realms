# FIX-v3.sh — návod

Opravný skript pro **30 problémů** nalezených ve třech vlnách revizí (revize 1: 12, revize 2: 15, oblast Combat: 8, s odstraněnými duplikáty).

## Co opravuje

### Kritické (7)
| # | Problém | Soubor |
|---|---|---|
| K1 | Ironman `noExport` se nekontroluje | `state.js`, `ui.js` |
| K2 | Ironman `permaDeath` nebrání vzkříšení | `misc.js`, `panels.js` |
| K3 | Hardcore nikdy nespustí prohru | `endgame.js` |
| C1 | Mrtví jednají ve stejném kole | `combat.js` |
| A1 | Kill/Explore questy kumulativní | `events.js`, `trade.js` |
| A2 | Prestige ztratí obtížnost | `prestige.js` |
| A3 | Orphan state po loadu | `main.js` |

### Středně důležité (13)
| # | Problém | Soubor |
|---|---|---|
| A4 | `findCraftsman` nezohledňuje resting/expedition | `workshops.js` |
| A5 | craft XP dává mrtvým | `crafting.js` |
| A6 | resurrect NaN birthTime | `misc.js` |
| A7 | camera.zoom bez validace | `main.js` |
| A9 | promoteChild nepřidá do skupiny | `aging.js` |
| A10 | startEvent nededuplikuje | `events.js`, `debug.js` |
| A12 | groupMembers(null) shodí | `groups.js` |
| A13 | addJournal divný early return | `journal.js` |
| A15 | checkDanger bez isChild filtru | `combat.js` |
| S1 | `lucky_craft` unlock se nepoužívá | `crafting.js` |
| S2 | `world_knowledge` unlock se nepoužívá | `events.js` |
| S3 | `new_region` unlock nic nedělá | `unlocks.js` |
| S4 | addUnitXp neaplikuje xpMult | `units.js` |
| S5 | start_units nepřidá do skupiny | `unlocks.js` |

### Kosmetika/data (10)
| # | Problém | Soubor |
|---|---|---|
| A8 | guard pro neznámý item | `panels.js`, `misc.js` |
| A11 | masterworks se nezobrazuje | `ui.js` |
| M1 | honorTitle se nezobrazuje | `ui.js` |
| C2 | solo part vždy 2+ T1 nepřátel | `data/combat.js` |
| C3 | `damageVsBeast`, `potionStrength` mrtvé efekty | `data/legendaries.js` |
| C4 | bossTemplateId nepoužit | `data/legendaries.js` |
| C5 | nekonzistentní clamping nálady | `combat.js` |
| C6 | driftPersonalityCombat na mrtvých | `combat.js` |
| C8 | chybí tie-breaker v sortu | `combat.js` |

## Postup (Termux)

### 1. Jdi do repa

```bash
cd ~/idle-realms
```

### 2. Zkopíruj FIX-v3.sh do kořene repa

```
cp /sdcard/Download/FIX-v3.sh .
```

### 3. Spusť skript

```
bash FIX-v3.sh
```

Uvidíš:

- Barevný výpis každé opravy (`✓` aplikováno, `-` již hotovo, `⚠` pattern nenalezen)
- Verifikaci klíčových patternů
- Syntax check (pokud máš `node`)
- Souhrn a commit příkaz

Skript je **idempotentní** — druhé spuštění nic nezmění, jen vypíše „již hotovo".

### 4. Ověř v prohlížeči

Otevři:

- **`test/smoke.html`** → musí být zelené (všech 15 sekcí)
- **`index.html`** → nová hra, vyber obtížnost

Manuální testy (doporučuji):

| Test ↕▾ | Očekávané chování ↕▾ |
|---|---|
| −Hardcore: nechaj dynastii vyhynout a zlato < 15 | Modal **💀 KONEC** |
| Ironman: klikni Export save | Modal **🚫 Export zakázán** |
| Ironman: klikni Vzkřísit na mrtvé postavě | Chyba „Na této obtížnosti je smrt trvalá" |
| Boj: hlídej, kdy postava uprostřed kola umře | Mrtvá **nejedná** |
| Zakázka „poraz 10 banditů": přijmi ji | Počítadlo začíná od 0 (ne od aktuálního stavu) |
⚙

### 5. Nahraj do gitu

```
git add -A
git status
git commit -m "fix: 30 oprav z revizí 1, 2 a oblasti Combat"
git push
```

## Pokud něco selže

**`⚠ pattern NENALEZEN`**
→ Tvůj soubor se liší od očekávaného. Zkontroluj `git log -1 --oneline`:

- **`1f45967`** nebo novější → OK, pokračuj, jen nějaká oprava už byla aplikována ručně.
- Starší → nejdřív spusť `bash FIX-v2.sh`.

**Syntax error po aplikaci**
→ Obnov ze zálohy:

```
cp -r .fixv3-backup-*/* .
```

**Hra po patchi nefunguje**
→ Stejně: obnov ze zálohy a pošli mi výpis z Termuxu.

## Co skript záměrně nedělá

- **Nemaže mrtvý kód** (`G.difficultyList`, `G.rollCraftQuality`) — riziko, že je někde používaný externě.
- **Neimplementuje `masteryMult`** — designové rozhodnutí, potřebuje diskusi.
- **Nezpracovává `reach`** — plánovaný koncept „dostřelu", rozpracováno.

Tyto tři body jsou kandidáti na samostatný FIX-v4, až budeš chtít.

## Souhrn oprav podle souborů

- `js/core/state.js` — 1 oprava (K1a)
- `js/main.js` — 2 opravy (A3, A7)
- `js/systems/combat.js` — 5 oprav (C1, C5, C6, C8, A15)
- `js/systems/misc.js` — 3 opravy (K2a, A6, A8b)
- `js/systems/crafting.js` — 3 opravy (A5a, A5b, S1)
- `js/systems/events.js` — 3 opravy (A1a, A10a, S2)
- `js/systems/units.js` — 1 oprava (S4)
- `js/systems/endgame.js` — 1 oprava (K3)
- `js/systems/prestige.js` — 1 oprava (A2)
- `js/systems/groups.js` — 1 oprava (A12)
- `js/systems/aging.js` — 1 oprava (A9)
- `js/systems/journal.js` — 1 oprava (A13)
- `js/data/workshops.js` — 1 oprava (A4)
- `js/data/unlocks.js` — 2 opravy (S3, S5)
- `js/data/legendaries.js` — 3 opravy (C3a, C3b, C4)
- `js/data/combat.js` — 1 oprava (C2)
- `js/ui/ui.js` — 3 opravy (K1b, A11, M1)
- `js/ui/panels.js` — 2 opravy (K2b, A8a)
- `js/ui/trade.js` — 1 oprava (A1b)
- `js/ui/debug.js` — 1 oprava (A10b)

**Celkem 30 oprav napříč 20 soubory.**

