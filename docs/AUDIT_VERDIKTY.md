# Verdikty auditů — ověření 184 nálezů proti kódu

> **Datum ověření:** 2026-09-18
> **Ověřeno proti:** `HEAD = 26c691a` (2026-09-18 14:31), 59 JS souborů, 14 852 řádků
> **Vstup:** 10 auditů (`AUDIT_BOJ, VYROBA, SKUPINY, EXPEDICE, PRESTIZ, CAS, DATA, SAVE, PSYCHOLOGIE, UI`),
> vznik 2026-09-17 11:53–11:58, 3 001 řádků, 184 číslovaných nálezů
> **Metoda:** čtení kódu s citací `soubor:řádek` + spuštěné kontroly
> (`check-globals` = 0 problémů / 720 globálů, `check-actions` = 0 mrtvých handlerů,
> `headless-smoke` = 77/77 OK) + `git show 632f7e4^:<soubor>` pro dataci
>
> **Tento dokument je podklad pro rozhodnutí. Nic v něm není implementováno.**

---

## 0. Jak číst tento dokument

| Verdikt | Význam |
|---|---|
| **PLATÍ** | nález je proti `HEAD` pravdivý (i kdyby byly nepřesné dílčí citace) |
| **ČÁSTEČNĚ** | jádro platí, ale premisa / číslo / dopad je nepřesné — v poznámce je oprava |
| **NEPLATÍ** | proti `HEAD` neobstojí: buď už opraveno, nebo tvrzení nebylo pravdivé ani v době vzniku auditu |

**Past, kterou je nutné znát:** audity vznikly **2026-09-17 v 11:53–11:58**. Devět hodin po nich
přišel commit **`632f7e4` „družina, výbava a expedice" (2026-09-17 20:46)** — 19 souborů,
**+1315/−123** řádků, včetně `js/systems/combat.js`, `expeditions.js`, `groups.js`, `economy.js`,
`js/ui/panels.js`, `ui.js`, `combat_modal.js`. Část auditů tedy popisuje **stav před tímto commitem**
a tvrzení typu „HANDOFF tvrdí, že je to opravené, ale v kódu to není" je dnes obráceně: **kód je napřed**.
Nálezy `B4`, `B17`, `SL1`, `X7`, `S1` (bonusy skupin), `S14` (jídlo expedice) jsou tím vysvětlené.

**Počet nálezů: 184** (B 24, I 20, S 20, X 20, M 20, T 15, D 20, SL 15, PS 15, U 15).

| Souhrn | Počet |
|---|---|
| PLATÍ | **129** |
| ČÁSTEČNĚ | **46** |
| NEPLATÍ | **9** (`B4, B17, S2, S15, X7, SL1, SL10, SL13, U7`) |

K auditu se smí přistoupit jen přes tento verdikt — **žádný nález se neimplementuje bez ověření proti `HEAD`.**

---

## 1. BOJ — `AUDIT_BOJ.md` (B1–B24)

| ID | Nález | Verdikt | Důkaz / poznámka |
|---|---|---|---|
| B1 | Boj je volitelný a nízkosázký | PLATÍ | `data/world.js:74` (bezpečné uzly `danger:0`); `combat.js:460-525` — žádné `addRep`; boj plní jen `stats` + kill-zakázky |
| B2 | Přepadení bez varování, ruší úkol | PLATÍ | `combat.js:604-608` `cancelTask` → `startCombat`, žádný varovný log |
| B3 | Frekvence přepadení je vysoká | ČÁSTEČNĚ | `combat.js:578,603` sedí, ale je to **dvoufázový hod**: `computeAccidentChance` `:619-634` dává 0,004–0,35; „každých 6–7 s" platí jen pro velmi slabou družinu |
| B4 | `enemyCountFor` podle počtu hlav | **NEPLATÍ** | dnes `enemyCountFor(enemy, size, partyPower)` + `G.COMBAT_POWER_REF = 14` (`data/combat.js:152-179`, volání `combat.js:99`); v `632f7e4^` ještě 2 argumenty |
| B5 | Taktika je globální nastavení | ČÁSTEČNĚ | taktika je **per-souboj** (`combat.js:103,552`, `combat_modal.js:133-142`) — premisa neplatí; platí, že všech 5 volání startuje `balanced` a doporučení chybí |
| B6 | 33 schopností, 8 slotů, hráč nevidí | ČÁSTEČNĚ | počty sedí (`data/abilities.js:10-132,143-152`); hráč je **vidí a může frontovat** (`combat_modal.js:150-176`); chybí zdůvodnění AI (`autoChooseAbility` důvod nevrací) |
| B7 | Schopnosti vázané na produkční dovednosti | PLATÍ | `data/abilities.js:13-21` (`splitting_axe: woodcutting 3`), odemyká `:134-141` |
| B8 | Boss je jen silnější nepřítel | ČÁSTEČNĚ | fáze/interrupt nejsou, jen enrage (`combat.js:427-434`); **ale** bossové mají 3 schopnosti s CD (`data/combat.js:81-86`) a elity dostávají schopnost navíc (`combat.js:217-221`) |
| B9 | Boss bez mechaniky přerušení | PLATÍ | `combat.js:337-423` `summon` bez reakce hráče; `interrupt` = 0 výskytů |
| B10 | Dropy nezávisí na obtížnosti | PLATÍ | `combat.js:460-495` násobí jen elita ×2/×1,5 a boss ×3/×2; `currentDifficulty()` v odměnách není |
| B11 | Smrt na Normalu 12 % | PLATÍ | `data/difficulty.js:8,15,22,29-31`; použito `combat.js:533`; kryto testem |
| B12 | Vzkříšení maže smrt | PLATÍ | `misc.js:39` `_resurrected = true`, `combat.js:534` `!u._resurrected`; příznak se nikdy neresetuje |
| B13 | Smrt je jen řádek v logu | PLATÍ | `misc.js:4-20` (log `:16`, deník `:17`); `pohřeb|deathModal` = 0 |
| B14 | Truchlení je neviditelné | ČÁSTEČNĚ | systém běží (`psychology.js:239-253`) a **v kartě je** (`panels.js:573,582` 🕊️); v HUD chybí |
| B15 | Boj × ekonomika izolovaná | PLATÍ | `G.lootValue` (`drops.js:27`) se **nikde nevolá**; `bandit_seal`/`dragon_scale` nejsou v receptech (`world.js:173-209`), 6 položek není v `G.TRADED` (`world.js:46`) |
| B16 | Boj × čas je slabý | PLATÍ | `timeDangerMod` (`systems/time.js:73-78`) jen v `checkDanger` (`combat.js:599`); `startCombat` čas nečte |
| B17 | UI neumí schovat okno boje | **NEPLATÍ** | `hideCombatWindow`/`openCombatWindow`/`combatWindowHiddenNow` (`ui/combat_modal.js:35-55`), Esc `ui/ui.js:176`, chip na mapě `:334-347`; v `632f7e4^` existoval jen `hideCombatModal` |
| B18 | Auto-close po 5 s je agresivní | PLATÍ | `combat.js:186` `COMBAT_CLOSE_MS = 5000` (aktivita prodlouží, `:204`) |
| B19 | Log má jen 14 řádků | PLATÍ | `ui/combat_modal.js:180` `cb.log.slice(-14)` |
| B20 | Nelze z boje utéct | PLATÍ | v `combat_modal.js` žádná akce útěku; `tactical_retreat` je cleanse, ne útěk (`data/abilities.js:118-120`) |
| B21 | `reach` a `ignoreDef` jsou mrtvé | ČÁSTEČNĚ | `reach` mrtvý (`data/combat.js:122,131-132,143` → `combat.js:115`, nikde čten); **`ignoreDef` živý** (`abilities.js:210`, nastaven `data/abilities.js:46-48`) |
| B22 | `def × 0.5` je slabé | PLATÍ | `combat.js:442` `− def * 0.5` |
| B23 | Poškození je šum | PLATÍ | `combat.js:442` `0.8 + rand*0.5` (−20 %/+30 %); schopnosti mají `0.9 + rand*0.4` (`abilities.js:209`) |
| B24 | Krit je jen ×2 | PLATÍ | `data/combat.js:121` `0.05 + luk*0.005` (max ~10 %), `combat.js:445` `*= 2`; crit multipliery/efekty neexistují |

---

## 2. VÝROBA — `AUDIT_VYROBA.md` (I1–I20)

| ID | Nález | Verdikt | Důkaz / poznámka |
|---|---|---|---|
| I1 | Recepty jsou chudé | PLATÍ | 10 receptů (`world.js:173-209`) na **27** materiálů (`:16-45`), vstupem je jen **12**; 15 položek není vstupem ničeho (`dragon_scale` má jen `price`, `:38`) |
| I2 | `bestSkill` globální vs. konkrétní crafter | PLATÍ | `crafting.js:4-8,13-18` vs. `workshops.js:94-108`; UI tiskne obojí (`panels.js:900`) |
| I3 | Dílny nejsou vidět na mapě | ČÁSTEČNĚ | v panelu Řemeslo jsou (`panels.js:876-888`, `workshops.js:5-32`); v `js/render/` 0 výskytů → na mapě stále ne |
| I4 | Kvalita je černá skříňka | PLATÍ | `work.js:208-234` (6 vstupů) vs. UI bez rozpadu (`panels.js:894-902`) |
| I5 | Masterwork neodměňuje | ČÁSTEČNĚ | vzniká (`crafting.js:84-90`), nelze nasadit/prodat; **ale** je vypsán v Batohu (`panels.js:1011-1015`) — „nikde nefiguruje" už neplatí |
| I6 | XP z výroby jde všem | PLATÍ | `crafting.js:81` iteruje **všechny** postavy, bez vzdálenosti; navíc podmínka `reqLevel - 1` pustí i postavu pod požadavek |
| I7 | Automatizace neřekne proč | ČÁSTEČNĚ | `crafting.js:129-130` důvod zahazuje; stav dílen a „máš N" v UI je (`panels.js:881-883,917`) |
| I8 | Chybí „co jde vyrobit z X" | PLATÍ | `panels.js:982-999` vypisuje jen materiál + kvality |
| I9 | Chybí „kolik toho jde vyrobit" | ČÁSTEČNĚ | `G.maxCraftable` existuje (`panels.js:108-112`) a jde do `qtyControl` jako `max` (`:905`); jako text nikde |
| I10 | Krystaly nemají využití | PLATÍ | vstupem jen `potion` (`world.js:208`) a `longbow` (`:183`) + cena `alchemist_lab` (`character.js:70`) |
| I11 | Kovárna vs. Dílna | PLATÍ | `character.js:44-46,60-62`; sčítá se (`misc.js:177-187`) = `8l + 4l` bez vysvětlení |
| I12 | Chybí specializace craftera | PLATÍ | profese násobí jen rychlost (`misc.js:551-552`); kvalita bere `unitSkill` (`crafting.js:64,70-75`) |
| I13 | Kvalita vstupů vs. výstupů | PLATÍ | `G.matAvgQualityMult` (`state.js:239-244`) **nikde nevolané**; `crafting.js:69` bere `matRemove` |
| I14 | Chybí reverzní řetězce | PLATÍ | `world.js:173-209` — jen dopředné recepty |
| I15 | Chybí výrobní linka | ČÁSTEČNĚ | `tickProduction` je (`crafting.js:121-137`, max 5 ks/tick), ale váže postavu k dílně (`:129`) |
| I16 | Chybí podmíněná automatizace | PLATÍ | `setProductionOrder` ukládá jen `{material, qty}` (`crafting.js:111-118`) |
| I17 | `canCraft` je příliš striktní | PLATÍ | `crafting.js:10-21` vrací **první** důvod |
| I18 | Chybí produkční kapacita | ČÁSTEČNĚ | počet postav s přístupem je (`panels.js:881-883`); „~N/hod" a počet kováren chybí |
| I19 | Kvalita je nevyvážená | PLATÍ | `work.js:228` base `avgSkill * 1.1`, prahy `100/75/45/15` (`:229-233`) |
| I20 | Chybí mistrovská dílna | PLATÍ | `data/workshops.js:11-32` bez úrovní; úrovně mají jen budovy (`character.js:41-77`) |

---

## 3. SKUPINY A AUTONOMIE — `AUDIT_SKUPINY.md` (S1–S20)

| ID | Nález | Verdikt | Důkaz / poznámka |
|---|---|---|---|
| S1 | Skupiny jsou nevýhodné | ČÁSTEČNĚ | bonusy se **násobí**: `groups.js:158-168` → leader 1,10 × chemie 1,12 = **+23 %** (audit je sčítá); `groupCombatMult`/`groupFoodCostMult` byly v době auditu mrtvé, dnes živé (`units.js:210`, `data/combat.js:142`, `expeditions.js:23,92`) |
| S2 | Role jsou neviditelné | **NEPLATÍ** | `panels.js:772-777` vypisuje všech 6 rolí se jménem a tooltipem — **už před auditem** (`632f7e4^`); platí jen chybějící ruční override |
| S3 | Chemie je skrytá | PLATÍ | `panels.js:762,769` ukazuje jen label; `ch.value` se nerenderuje, heatmapa 0 |
| S4 | `pickActivity` je nevyzpytatelný | PLATÍ | `autonomy.js:93-108,112-116`; boost potřeby je ×1–×7 (ne ×6) |
| S5 | Skupina bez zaměření je zbytečná | PLATÍ | `autonomy.js:60-63`; `groupCohesionTarget` (`groups.js:101-115`) drží jen vizuálně (`world.js:326`) |
| S6 | Fronta příkazů je slabá | ČÁSTEČNĚ | ETA i priorita **existují** (`panels.js:239-248,254,258`) — už před auditem; platí, že se neřadí kandidáti |
| S7 | `orderCandidates` neřadí | PLATÍ | `work.js:302-317` bez `sort`, `:328` posílá všechny; řazení je jen v `taskAssignModal` (`panels.js:196-198`) |
| S8 | `avoidDanger` je tvrdý | PLATÍ | `autonomy.js:85-90`; **navíc** `danger === 3` zakázáno vždy (`:89`) a důl vyžaduje `power ≥ 36` |
| S9 | Jeden `focusMaterial` | PLATÍ | `state.js:30` skalár; `focusMaterials` 0 |
| S10 | `manual` režim není vysvětlený | PLATÍ | `panels.js:680` bez tooltipu; nečinná postava ukazuje „Volno" (`:677`) |
| S11 | `unitRefusesWork` je skrytý | ČÁSTEČNĚ | `psychology.js:26-29` vs. `panels.js:556,567` (důvod chybí); nálada je vidět (`:665`) |
| S12 | `_refuseUntil` je neviditelný | ČÁSTEČNĚ | „Odmítá pracovat" **existuje** (`panels.js:567`, i v `632f7e4^`); chybí „do kdy" a důvod |
| S13 | Autonomie neřeší jídlo | PLATÍ | `autonomy.js:6-72` bez priority přežití; chléb je jen recept (`world.js:202-204`), ryba dostane generický boost (`:104-107`) |
| S14 | `groupCohesionTarget` je slabý | PLATÍ | `groups.js:101-115` vrací bod u středu ostatních, nikdy uzel/sídlo |
| S15 | Autonomie ignoruje profesi | **NEPLATÍ** | `autonomy.js:96-97` váží `primary ×2.5`, `bonus ×1.5` — a to i v době auditu; nález si odporuje s vlastní sekcí S4 |
| S16 | Skupinové úkoly jen `focus` | ČÁSTEČNĚ | režim `mode` neexistuje (`groups.js:18`), ale expedice celé skupiny jde (`panels.js:767`, `ui.js:1156-1180`); boj přes `partyOf` (`groups.js:127-135`) |
| S17 | `tickOrders` nepřeruší | ČÁSTEČNĚ | scheduler nepřerušuje (`work.js:311,320-338`), ale ruční „Přerušit autonomní práci" existuje (`ui.js:804-817`, `panels.js:204`) |
| S18 | Chybí bojové směrnice | PLATÍ | `state.js:30` + `autonomy.js:131-137`; `huntBeasts`/`huntBandits` 0 |
| S19 | `pickActivity` ignoruje expedice | PLATÍ | `startExpedition` má jediného volajícího (`ui.js:1151`) |
| S20 | Chybí report od autonomie | PLATÍ | `autonomy.js:74-117` nevrací ani neloguje důvod |

---

## 4. EXPEDICE — `AUDIT_EXPEDICE.md` (X1–X20)

| ID | Nález | Verdikt | Důkaz / poznámka |
|---|---|---|---|
| X1 | Expedice jsou krátké | PLATÍ | `data/time.js:11` × `data/expeditions.js:7` = 10–20 min; `systems/expeditions.js:89-90` |
| X2 | Jídlo je jen gate | PLATÍ | jediné `consumeFood` je `expeditions.js:97`; `tickExpeditions` (`:128-143`) jídlo neřeší |
| X3 | Power/need je jednoduché | PLATÍ | `expeditions.js:31,36` (combatPower + scouting ×3 vs `difficulty × 30`) |
| X4 | Eventy jsou slabé | PLATÍ | 10 typů (`data/expeditions.js:60-74`), 35 % (`:77`), bez voleb (`systems/expeditions.js:145-185`); **navíc** se plánuje max 1 event (`:118-121`) a `heal` neléčí (`:180-182`) |
| X5 | Výsledek je binární | PLATÍ | `expeditions.js:192-195`; stupně úspěchu = 0 výskytů |
| X6 | Žádný trvalý efekt | PLATÍ | `:198-216` jen dropy/XP/nálada/renown; `onGroupSuccess` (`psychology.js:228-234`) mění jen vztahy |
| X7 | Postavy se odeberou ze skupiny | **NEPLATÍ** | `expeditions.js:111-113` komentář „Skupinu NEROZEBÍRÁME"; v `632f7e4^` tam `removeUnitFromGroup` byl; hlídá test |
| X8 | Návrat vždy do Svitav | PLATÍ | `expeditions.js:227-229` `settlementById['svitavy']`; původní sídlo se neukládá |
| X9 | Chybí příprava výbavy | PLATÍ | `startExpedition` (`:79-126`) výbavu neřeší; nepřímo jen přes `unitCombatPower` (`units.js:209`) |
| X10 | Chybí expediční specialista | PLATÍ | `groups.js:7-12` bez takové role; `leader` jde jen do práce (`:158-168`) |
| X11 | 15 expedic, 5 se vyplatí | ČÁSTEČNĚ | čísla odměn sedí (`data/expeditions.js:27-29,54-56`), ale šablon je **16** |
| X12 | `MAX_PARTY = 6` je vysoké | PLATÍ | `data/expeditions.js:76`; vynuceno `systems/expeditions.js:84` |
| X13 | `MIN_PARTY = 2` je nízké | PLATÍ | `data/expeditions.js:75`; neškáluje se s obtížností (`:83`) |
| X14 | `foodNeededFor` je lineární | ČÁSTEČNĚ | vzorec nezměněn (`:5-6`), **ale sleva Zásobovače se už aplikuje** (`:92-93`, `groups.js:146-156`) |
| X15 | Chybí drama | PLATÍ | `tickExpeditions` nic neloguje; UI jen progress (`panels.js:807-812`) |
| X16 | Selhání je málo bolestivé | PLATÍ | `expeditions.js:217-225` (−12 nálada, 15 % zranění); `G.die` se v souboru nevyskytuje |
| X17 | Prestiž nezachová expedice | PLATÍ | `prestige.js:78` + `state.js:21`; `prestigeStatus` (`:24-37`) expedice neřeší |
| X18 | Expedice nejdou zrušit | PLATÍ | `panels.js:790-818` jen vyslání; `recall|Odvolat` = 0 (jen debug `:364-365`) |
| X19 | Chybí expediční journal | PLATÍ | `expeditions.js:114,211,221` — tři věty; `journal.js:7-21` jen pushuje |
| X20 | Chybí dovednost `expedition` | PLATÍ | `data/character.js` bez ní; `expeditions.js:31` používá `combat`+`scouting` |

---

## 5. PRESTIŽ A ENDGAME — `AUDIT_PRESTIZ.md` (M1–M20)

| ID | Nález | Verdikt | Důkaz / poznámka |
|---|---|---|---|
| M1 | Podmínky prestiže jsou fixní | PLATÍ | `prestige.js:4-9,24-37` — konstanta |
| M2 | Achievementy se resetují | PLATÍ | `state.js:25` + `prestige.js:78`; achievementů 42 (`data/progress.js:91-135`) |
| M3 | Story flags se resetují | PLATÍ | `state.js:24`; flagy `progress.js:39-41,65-67` |
| M4 | Dynastie se resetuje | PLATÍ | `state.js:29`; jména plní `dynasty.js:47,64` |
| M5 | 7 unlocků, vítězství na 5 | PLATÍ | `data/unlocks.js:8-44`, `endgame.js:5`, start `state.js:22` |
| M6 | Nová mapa je jen jiný seed | PLATÍ | `prestige.js:133-137`; sídla z konstanty `world.js:222-233,312-322` |
| M7 | `nextWorldSeed` je deterministický | PLATÍ | `prestige.js:40-47`; seed startu `main.js:3` |
| M8 | Chapters jsou jen jména | PLATÍ | `endgame.js:64-70` zápis, **nikde čtení**; modal počítá jméno z levelu (`:76-78`, `ui.js:1319`) |
| M9 | Endgame je jen 2 modaly | PLATÍ | `endgame.js:16-35`, `ui.js:1311-1369,1381-1385` |
| M10 | `stats.prestiges` je 0 | PLATÍ | `state.js:52` — **nikdy se neinkrementuje**; stav drží `prestige.totalPrestige` (`prestige.js:83`) |
| M11 | Chybí „co si odnáším" | ČÁSTEČNĚ | panel/úroveň/unlocky vidět (`panels.js:1087-1112`), souhrn ztrát před potvrzením chybí (`ui.js:512-535`) |
| M12 | Relax nemá prohru | PLATÍ | `endgame.js:25`; `data/difficulty.js:5-18`; v UI to vysvětlené není |
| M13 | Hardcore defeat je divný | ČÁSTEČNĚ | `endgame.js:6,29`; **deadlock nehrozí** — `recruitCost` při 0 živých = 15 (`panels.js:442`), přesně na prahu |
| M14 | Prestiž 5+ nemá obsah | PLATÍ | `endgame.js:16`; `victoryReached` se drží `true` |
| M15 | `applyUnlocksToNewGame` je neúplný | ČÁSTEČNĚ | logika `unlocks.js:61-93,107-115`; **`kind: start|passive` v datech je** (`:12,17,22,27,32,37,42`), UI ho ale nečte (`ui.js:522-528`) |
| M16 | Chybí meta-progrese | PLATÍ | `prestige.js:81-86` přenáší jen 4 pole; `state.js:42-53` reset |
| M17 | `chapterHistory` se ztrácí | PLATÍ | `state.js:36`; `prestige` ho nemá — a `newChapter` ho zapíše a `doPrestige` hned smaže |
| M18 | Vítězství nezastaví hru | PLATÍ | `ui.js:1338` → `:1381-1385` `resumeGame` |
| M19 | Defeat nezastaví hru | PLATÍ | `ui.js:1364,1386-1389` → `resetSave` (`state.js:166-171`) smaže i prestiž |
| M20 | Chybí legacy mezi hrami | PLATÍ | legacy funguje **uvnitř běhu** (`dynasty.js:37-57,60-78,81-84`); mezi prestižemi nic |

---

## 6. ČAS A SEZÓNY — `AUDIT_CAS.md` (T1–T15)

| ID | Nález | Verdikt | Důkaz / poznámka |
|---|---|---|---|
| T1 | Roky jsou příliš dlouhé | PLATÍ | `data/time.js:11-12` → 8 400 s; **pozor na vazby** — viz N1/N2 a `expeditions.js:90,163,166,231` |
| T2 | Fáze dne nemá vliv na boj | PLATÍ | `combat.js:76-150` bez `timeDangerMod`; použito jen `:599-600` |
| T3 | Sezóny nemění bestiář | PLATÍ | `data/combat.js:89-100,102-114,154-163` bez sezóny |
| T4 | Sezóny nemění dropy | PLATÍ | `drops.js:4-19`, `combat.js:472-495`; nepřímo přes `timeWorkMod` (`units.js:163`) ano |
| T5 | Fáze dne nemá vliv na odpočinek | PLATÍ | `autonomy.js:154-168` jen `restMult`; drain čas řeší (`:151`) |
| T6 | Chybí kalendář | PLATÍ | `data/time.js:10-20` bez `holidays`; HUD **neukazuje rok** (`ui/ui.js:369-370`, rok jen `debug.js:399`, `journal.js:31-32`) |
| T7 | Sezóny nemění vzhled mapy | PLATÍ | `js/render/world.js` 0× `season`; barvy sezón jen v UI (`ui/ui.js:369`) |
| T8 | Fáze dne nemá vliv na UI | ČÁSTEČNĚ | tmavé UI neexistuje, **indikátor v HUD ano** (`ui/ui.js:361,370`) |
| T9 | Chybí časové zóny | PLATÍ | `state.js:13-15`; sídla bez času (`world.js:322`) |
| T10 | `dayLength` je konstantní | PLATÍ | `data/time.js:11`; zrychlení `debug.js:4-5`; **navíc** existuje skok dne/sezóny (`debug.js:39-47,286-297`) |
| T11 | Roky nemají vliv na hru | PLATÍ | `year` jen log/text (`systems/time.js:21-22`, `journal.js:12`); v HUD není |
| T12 | `season` nemá `year` bonus | ČÁSTEČNĚ | žádný roční bonus platí (`systems/time.js:87-89`), ale „`year` se nemění" je nepravda (`:18-22`) |
| T13 | Chybí časové okno | PLATÍ | `work.js:261-272,320-337`; termíny ale existují u questů/expedic (`events.js:362,404`, `expeditions.js:90`) |
| T14 | Chybí délka dne podle sezóny | PLATÍ | `data/time.js:22-51` bez `dayLength`; riziko: `dayLength` je jednotka i pro expedice |
| T15 | `TIME` nemá svátky | ČÁSTEČNĚ | `TIME` je nemá, **ale** světová událost „Svátky" existuje (`data/world.js:497-499`) — jen je náhodná, ne kalendářní |

---

## 7. DATA — `AUDIT_DATA.md` (D1–D20)

| ID | Nález | Verdikt | Důkaz / poznámka |
|---|---|---|---|
| D1 | Chybí schéma | PLATÍ | `world.js:16`, `character.js:40`; `validateData` 0 |
| D2 | Chybí validace dat | PLATÍ | `economy.js:61` `G.MATERIALS[matId].price` — sonda: neznámý `matId` → `TypeError` |
| D3 | `id` vs. klíč | PLATÍ | `MATERIALS` 0/27, `SKILLS` 0/11 vs. `ACTIVITIES` 13/13, `BUILDINGS` 12/12, `GEMS` 6/6 |
| D4 | Kvality jen pro materiály | ČÁSTEČNĚ | nekonzistence platí, ale **`output.quality` neexistuje** (`world.js:177`) — kvalita se počítá při výrobě (`crafting.js:75,80`) |
| D5 | `tier` má různý význam | PLATÍ | `world.js:17,27,176`; `character.js:41` `maxLevel` |
| D6 | Chybí `category` | PLATÍ | 0/27; náhrady `G.TRADED` (`world.js:46`), `currency:true` (`:33`) |
| D7 | Chybí `tags` | PLATÍ | 0/27 |
| D8 | Duplikace (crystal vs. gem) | PLATÍ | `world.js:32` vs. `gems.js:10`; gemy se navíc zapisují jako `gem_*` materiály (`economy.js:188`) |
| D9 | Chybí defaulty | PLATÍ | **tři** kopie: `state.js:10-55`, `:76-165`, `main.js:108-138,141-202` — a divergují |
| D10 | `unit.traits` je pole objektů | PLATÍ | `units.js:11-29,47`; `aging.js:131`; `ambitions.js:115`; `TRAIT_POOL` lookup se nepoužívá (`units.js:29`) |
| D11 | Stejně `ambitions`, `perks` | PLATÍ | `ambitions.js:81-85,106` vs. `misc.js:561-572` |
| D12 | Chybí `version` u dat | PLATÍ | `DATA_VERSION` undefined; jen `state.version` (`state.js:12`) |
| D13 | Chybí `deprecated` | PLATÍ | 0 výskytů; dopad zatím nulový (žádné id nezaniklo), cesta průchodná |
| D14 | Chybí `validate` | PLATÍ | `canCraft` validuje recept (`crafting.js:10-21`), data ne |
| D15 | Chybí `freeze` | PLATÍ | `Object.freeze` 0 |
| D16 | Chybí helpery | PLATÍ | `G.matName` neexistuje; **39** nechráněných `G.MATERIALS[...]` (`panels.js:97,990`; `economy.js:61,134,154`; `merchant.js:127`; `construction.js:41`; `work.js:197`; `psychology.js:300,307`…); správný vzor `panels.js:832`, `expeditions.js:204` |
| D17 | Chybí data loader (JSON) | PLATÍ | 59 `<script src>`; `fetch(` 0 |
| D18 | Chybí data export | PLATÍ | `G.exportData` undefined; debug umí jen save/reset (`debug.js:374-375`) |
| D19 | Chybí data diff | PLATÍ | `G.diffData`, `migrate_v*` = 0 |
| D20 | Chybí data testy | PLATÍ | 77 checků, žádný neiteruje `MATERIALS/SKILLS/RECIPES`; datové kontroly jsou jen nepřímé |

---

## 8. SAVE / LOAD / MIGRACE — `AUDIT_SAVE.md` (SL1–SL15)

| ID | Nález | Verdikt | Důkaz / poznámka |
|---|---|---|---|
| SL1 | „Všechno, nebo nic" migrace ekonomiky | **NEPLATÍ** | `G.ensureEconomy` (`economy.js:39-50`, idempotentní, per-sídlo) + `ensureQuests` (`events.js:331`), volané `main.js:65-68,74,240`; opraveno `632f7e4` |
| SL2 | Žádná validace save | PLATÍ | `load()` jen `JSON.parse` (`state.js:65-75`); `main.js:46` kontroluje jen `log`; sonda: `importSave({version:8,units:"nope"})` → `{ok:true}` a string v savu |
| SL3 | Migrace nemaže neznámá pole | PLATÍ | jediná delece `state.js:162` `delete u.gear`; whitelist neexistuje |
| SL4 | Migrace vs. klíč | PLATÍ | fallback hardcoded (`state.js:69`) duplikuje `SAVE_KEYS` (`:5-8`); in-place rename neexistuje |
| SL5 | Export/import bez kontroly | ČÁSTEČNĚ | try/catch je (`state.js:182-193`), ale chybí b64 regex, size cap, whitelist verze; sonda `migrateSave({version:99})` → tiše `version: 8` |
| SL6 | Auto-save každých 5 s | PLATÍ | `loop.js:18`, `main.js:104-105`; bez dirty flagu; naměřeno **24 327 B** → ~4,9 kB/s (audit uváděl ~20 kB/s) |
| SL7 | Save neobsahuje `G.WORLD` | PLATÍ | `state.js:57-64` ukládá jen seed; svět se generuje znovu (`main.js:22`) |
| SL8 | `worldSeed` chybí v `newState` | ČÁSTEČNĚ | `state.js:14` `null`, ale každá cesta ho hned nastaví (`main.js:43,88,205`) → dopad ~0 |
| SL9 | `SAVE_KEYS` bez `v1` | PLATÍ | `state.js:5-8` = v8…v2 |
| SL10 | Migrace nezachová `equipmentSeq` | **NEPLATÍ** | `state.js:81` hodnotu zachovává + dopočet `main.js:256,269`; obojí od `cc5a311` |
| SL11 | Migrace nedoplní `pos` | PLATÍ | `state.js:137-163` ani `main.js:108-138`; sonda: pád `world.js:441,443` `Cannot read properties of undefined (reading 'y')` |
| SL12 | Migrace nedoplní `facing` | ČÁSTEČNĚ | formálně platí, dopad nulový — guardy `art.js:378,386`, `world.js:587` |
| SL13 | Save nezahrnuje `G.FOUNDRY` | **NEPLATÍ** | `art.js:757-760` → `state.settings.foundry`, čtení `:766-774`, voláno v kreslení `:859`; zavedeno `3bfb406` (2026-09-16) |
| SL14 | `resetSave` maže jen `SAVE_KEYS` | ČÁSTEČNĚ | localStorage jinde než v save klíčích není → dopad nulový; **skutečný dluh je trojí duplikace cyklu** (`state.js:166-171`, `title_screen.js:18`, `main.js:7-14`) |
| SL15 | Save nemá schema version | PLATÍ | `state.js:4` skalár + monolit `:76-165`; per-verzi migrátory 0 |

---

## 9. PSYCHOLOGIE — `AUDIT_PSYCHOLOGIE.md` (PS1–PS15)

| ID | Nález | Verdikt | Důkaz / poznámka |
|---|---|---|---|
| PS1 | Osobnost je neviditelná | ČÁSTEČNĚ | čísla i bary **jsou** (`panels.js:518-522,646,670`, už v `632f7e4^`); chybí vysvětlení modů |
| PS2 | Nálada je jen číslo | ČÁSTEČNĚ | číslo + bar v kartě i na mapě (`panels.js:665`, `world.js:467,723-730`); chybí tempo a dopad |
| PS3 | Vztahy jsou skryté | ČÁSTEČNĚ | `panels.js:636-637` (top 4, `|v|>20`); agregát je chemie skupiny (`:762-770`, `groups.js:55-71`); matice chybí, záložka „Vztahy" vede na reputaci (`ui.js:20`) |
| PS4 | Traity se nedají získat | PLATÍ | jen narození (`units.js:47`), dědictví (`aging.js:90-99,131`), ambice (`ambitions.js:112-115`); nikdy se neodebírají |
| PS5 | Drift je neviditelný | ČÁSTEČNĚ | běží (`psychology.js:260-273`, `personality.js:45-77`); výsledek vidět, příčina ne (~3 body/h) |
| PS6 | Inspirace je slabá | PLATÍ | `psychology.js:36-45` + **600s throttle** (`:39`); klíčové: odpočinek capuje náladu na **90** (`autonomy.js:163`) a `tickMood` táhne k 65 (`psychology.js:107-108`) → chytá se hlavně u odpočívající postavy |
| PS7 | Truchlení je jen postih | PLATÍ | `psychology.js:239-253`; deník píše jen umírajícímu (`misc.js:17`); pohřeb/hrob 0 |
| PS8 | Dezertace je náhodná | ČÁSTEČNĚ | `psychology.js:122-144` + 60s throttle (`:130`); varování jen pro vůdce (`:137-140`); intervence neexistuje |
| PS9 | Ambice jsou skryté | PLATÍ | `panels.js:631-634` jen text + ✓, bez progresu |
| PS10 | Ambice jsou jen pro postavu | PLATÍ | `ambitions.js:9-72,75-89,96-126` |
| PS11 | `addMood` nemá zdroje | PLATÍ | `G.log` u změn nálady nikde; 21 volání bez zdroje; **navíc** `autonomy.js:163` píše `mood` napřímo mimo `addMood` |
| PS12 | Psychologie neovlivňuje vztahy | ČÁSTEČNĚ | jen `agreeableness` (`personality.js:39`); **vada**: mult z `a` se aplikuje i na `b` (`psychology.js:178-181`) → vztah je vždy symetrický; vztahy ale hru ovlivňují (`groups.js:158-177`) |
| PS13 | Chybí psychologický profil | PLATÍ | `psycholog|profile` 0; jen per-os label (`personality.js:22-28`) |
| PS14 | Osobnostní reakce jsou slabé | ČÁSTEČNĚ | frekvence sedí (`psychology.js:280-321`), **ale** pozitivní reakce existují (`:296-301`) → premisa „jen chyby" neplatí |
| PS15 | Chybí duševní zdraví | ČÁSTEČNĚ | žádná perzistentní metrika; proto-stav `_refuseUntil` (`:312-318`, `panels.js:567`) + truchlení existují |

---

## 10. UI A RENDER — `AUDIT_UI.md` (U1–U15)

| ID | Nález | Verdikt | Důkaz / poznámka |
|---|---|---|---|
| U1 | `render()` je drahý | ČÁSTEČNĚ | string-compare je (`ui.js:439-450`); **„při každém ticku" je nepravda** — tick nevolá UI (`loop.js:3,33-52`), render jde z `autoRefresh` 1000 ms (`ui.js:202`); reálný dluh: nepodmíněný `renderSubtabs` innerHTML (`:408`) + 2× `querySelectorAll('details')` (`:42-56`) |
| U2 | `autoRefresh` každou 1 s | PLATÍ | `ui.js:201-202,216-224` (guardy fokus/modal/hidden/collapsed) |
| U3 | Cache je jen pro panel | ČÁSTEČNĚ | HUD 400 ms (`ui.js:201`) a we-bar bez cache (`:364-386`) platí; **mats bar cachovaný je** (`:308-314`) |
| U4 | LOD je jen pro mapu | PLATÍ | `G.lodLevel` jen `world.js:29-33,357` + `debug.js:222` |
| U5 | `qtyControl` nemá zkratky | ČÁSTEČNĚ | `type=number` → nativní ↑/↓ **funguje** (`panels.js:75`, `ui.js:89-104`); chybí jen Shift+↑/↓ a Ctrl+Enter (`keydown` `ui.js:172-177` řeší jen Esc) |
| U6 | Modaly nemají `Esc` | PLATÍ | `ui.js:172-177` (Esc = menu / okno boje); ostatní jen `data-action="close-modal"` (`:501-510`); event/story modal zavírací tlačítko nemá |
| U7 | Toasty se hromadí | **NEPLATÍ** | cap na 3 + auto-remove (`ui.js:234-242`); chybí jen slučování |
| U8 | Log má jen 80 řádků | PLATÍ | `panels.js:1197,1208`; buffer 260 (`state.js:246,256`); filtry/search/časové okno existují (`panels.js:1071-1075,1195,1200`) |
| U9 | Chybí undo | PLATÍ | `undo` 0 výskytů; kompenzace `confirm()` u drahých akcí (`ui.js:895,928-943,998,1105-1109,1205,1222,1377,1387`) |
| U10 | Chybí notifikace | ČÁSTEČNĚ | `notif` 0; ale toast je zapojen 2× (`combat.js:457-458`, `events.js:626`), popupy vyskakují samy, badge fronty (`ui.js:348-353`) |
| U11 | Chybí rychlý přehled | ČÁSTEČNĚ | mini-HUD **existuje** jako „👥 Aktivity" (`panels.js:145-153`), ale jen uvnitř panelu Místo; HUD + chip souboje (`ui.js:319-347`) |
| U12 | Chybí kontextové menu | PLATÍ | `contextmenu|button===2` 0 |
| U13 | „Více" je odpadkový koš | ČÁSTEČNĚ | `more` = log/Cíle/Prestiž (`ui.js:23-27`); export/import je sekce uvnitř Prestiže (`panels.js:1110`) → mišmaš platí; **settings jsou v ☰** (`title_screen.js:143-156`), ne ve „Více" |
| U14 | Chybí onboarding | ČÁSTEČNĚ | 3 kroky + skip + odměny (`tutorial.js:4-38,70-78`, `panels.js:155-169`); po nich jen pasivní vedení (Cíle, progress příběhu, `emptyState`) |
| U15 | Chybí search | PLATÍ | search jen v logu (`panels.js:1074`, `ui.js:89-94`, `state.js:41,99`); globální Ctrl+F 0 |

---

## 11. Nové nálezy — mimo všech 10 auditů

Tyto nálezy v žádném auditu nejsou. Číslování `N*` je závazné pro `docs/PLAN_OPRAV.md`.

| ID | Nález | Závažnost | Důkaz |
|---|---|---|---|
| **N1** | **Dva různé „roky": `AGE_YEAR = 300` s = přesně jeden kalendářní den** → věk běží **28× rychleji** než kalendář; `AGE_MAX = 95` se nikde nepoužívá, `ageProtected` se nikde nenastavuje | kritická | `data/aging.js:5,11,32-36`; `data/time.js:11`; `systems/aging.js:9,46` |
| **N2** | **Offline simulace stárne, ale vztahy/reakce/události/příběh jsou vypnuté** → 4 h offline = **48 věkových let** (~480 hodů na smrt) → jedno delší offline sezení vyhladí generaci 65+ | kritická | `loop.js:54-67`, `systems/aging.js:39-56` vs. `psychology.js:196,281`, `events.js:50,237,584` |
| **N3** | Offline tiká `dt = 1 s`, online `0,1 s` → 10× méně tiků na stejný herní čas (systémy bez škálování `dt` mají jinou frekvenci) | vysoká | `loop.js:4,60-63` |
| **N4** | Chybí vrstva modifikátorů s trasováním — `unitWorkRate` násobí 12 členů, `addSkillXp` 10, nikde se neukládá který; příčina ~64 nálezů „hráč nevidí proč" | vysoká | `units.js:88-116,144-168` |
| **N5** | Tři různé vzorce poškození a **taktika se aplikuje jen na základní útok** (schopnosti `atkMult` ignorují, enemy ability ignoruje `defMult`) | vysoká | `combat.js:442` vs. `abilities.js:209-210`; `combat.js:301,325` vs. `:344,358` |
| **N6** | `gem_*` materiály jsou mimo `G.MATERIALS` (zapisují se, ale registr je nezná) → latentní pád v nechráněných dereferencích | vysoká | `economy.js:188`, `gems.js:60`, `autonomy.js:447` vs. `world.js:16-45,46`; `combat.js:480`, `events.js:96` |
| **N7** | `load()` má **jeden `try` blok** → poškozený aktuální klíč zablokuje fallback na starší klíče (sonda: corrupt v8 + validní v7 → `null`) | vysoká | `state.js:65-75` |
| **N8** | `migrateSave` má **early-return** pro aktuální verzi → pro v8 savy neproběhne žádný dopočet | vysoká | `state.js:78` |
| **N9** | `migrateSave` bezpodmínečně nuluje `u.maxStamina = 100` (zahodí nasčítané maximum) | střední | `state.js:139` |
| **N10** | Tři reparační vrstvy (`newState` / `migrateSave` / `ensureDefaults`+`repairUnits`) si už odporují (`directives.focusTarget`, `settings.tutorial`) | střední | `state.js:10-55,76-165`; `main.js:141-202,108-138` |
| **N11** | `SAVE_KEYS` (7 klíčů) vs. hardcoded seznam v `load()` (6) — riziko driftu při bumpu verze | střední | `state.js:5-8` vs. `:69` |
| **N12** | Mrtvé deklarace bez efektu: `AGE_MAX`, `difficulty.masteryMult`, `G.lootValue`, `combat.reach`, `matAvgQualityMult`, `ageProtected`, trait `sturdy` (`mod.end`), mod klíče `nature`/`stone`, `worldEvent.renownMult` (Svátky), `politicalXpMult`, `prestigeStartUnits`, `stats.prestiges` + **~37 `G.*` funkcí bez volání** | střední | `data/aging.js:11`; `data/difficulty.js:9,16,23,30`; `drops.js:27`; `data/combat.js:122-143`; `state.js:239,52`; `units.js:17-19`; `data/world.js:499` + `events.js:278`; `prestige.js:19` |
| **N13** | `naturalDeathChance` nemá strop a `ageProtected` je mrtvé → stáří je jediná smrt, kterou nic nezastaví | střední | `data/aging.js:32-36`, `systems/aging.js:44-49` |
| **N14** | `_resurrected` = **trvalá imunita vůči smrti v boji**, nikdy se neresetuje | střední | `misc.js:39`; `combat.js:534` |
| **N15** | `G.die` ani `G.resurrect` nečistí `onExpedition` → vzkříšená postava zůstane „na cestě" navždy (`unitWorkRate → 0`, není nabízena do expedic) | střední | `misc.js:4-20,23-44` vs. `expeditions.js:226-230`; `units.js:147` |
| **N16** | Expedice: plánuje se **max 1 event** z 10; `natural_spring` neléčí (jen +5 nálady); zobrazená cena jídla ≠ účtovaná; UI „2–9 dní" vs. realita 2–10 | střední | `expeditions.js:118-121,180-182,19,89-91`; `panels.js:833,793` vs. `ui.js:472` |
| **N17** | `order.targetType` je nedosažitelná větev → fronta neumí cílit na postavu/skupinu, ačkoli to UI tvrdí | střední | `work.js:266,304-307`; `ui.js:869`; `panels.js:254` |
| **N18** | Autonomie **nikdy** nejde na `danger 3` (jeskyně) bez ohledu na sílu i směrnice; důl potichu vyžaduje `power ≥ 36` | střední | `autonomy.js:85-90` |
| **N19** | `% 4` hardcoded místo `G.TIME.seasons.length`; `s.day` je den v sezóně; přechod dne/fáze se neloguje | nízká | `systems/time.js:15-19`; `ui/ui.js:369` |
| **N20** | Prestiž zahodí **uživatelská nastavení** (vzhled mapy/postav, foundry, režim okna boje, auto-zakázky); `newChapter()` volá `doPrestige(null)` → po vítězství žádný unlock, a kapitolu zapíše do historie, kterou `doPrestige` hned smaže | střední | `prestige.js:80,93,78`; `endgame.js:73` |
| **N21** | UI dluhy: `setInterval(updateStats, 500)` se nikdy neclearuje; `renderSubtabs` innerHTML bez cache; `showEventModal` nenastavuje `modal` → guard v `autoRefresh` je díra | nízká | `debug.js:114`; `ui.js:408`; `ui.js:1228` vs. `:1260` |
| **N22** | `matRemove` umí odebrat jen kvality z `G.QUALITY` (neznámá kvalita ze savu je nespotřebovatelná); XP z výroby dostane i postava **o úroveň pod** požadavkem receptu | nízká | `state.js:210,218-227`; `crafting.js:81` |
| **N23** | `maxCraftable` vrací minimum 1 i s prázdným batohem | nízká | `panels.js:108-112` |
| **N24** | `importSave` přijme strukturálně neplatný obsah a uloží ho; `migrateSave` tiše přepíše neznámou verzi (99 → 8) | vysoká | `state.js:182-193,78-79` (sondy) |
| **N25** | Ze 77 smoke kontrol je save-related **jediná** — pro SL2/3/5/9/10/11/12/15 neexistuje regresní ochrana | střední | `test/headless-smoke.js` (1 test), `test/smoke.js:71-72` |
| **N26** | **Audity nepokrývají 56 % systémového kódu** — bez auditu jsou dva největší soubory: `systems/events.js` (725 ř.) a `systems/misc.js` (656 ř.), dále ekonomika, obchod, politika, dynastie, stárnutí, stavby, tutoriál, deník, perky, výbava | vysoká | inventura `js/systems/*` (24 souborů, 5 574 řádků) |

---

## 12. Jak s dokumentem pracovat

1. **Verdikt je vázaný na commit.** Při změně kódu se řádek musí přehodnotit; nález se neopravuje jen proto, že je v auditu.
2. **NEPLATÍ ≠ neškodí.** `B4`/`B17`/`SL1`/`X7` dokazují, že oprava existuje — u nich se nic nedělá. `U7` a `S15` dokazují, že nález byl chybný už při psaní.
3. **ČÁSTEČNĚ znamená „nejdřív opravit premisu".** U `I5`, `I7`, `I18` je část práce už hotová; u `B3`, `B5`, `S6`, `S12`, `SL12`, `SL14` je dopad menší, než audit tvrdí.
4. **Nové nálezy `N*` mají přednost před kosmetikou auditů** — `N1`, `N2`, `N6`–`N8`, `N24` jsou horší než většina P0 z auditů.
5. Postup oprav: `docs/PLAN_OPRAV.md`.
