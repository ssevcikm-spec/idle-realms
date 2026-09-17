# Boj a zakázky „poraz N …"

> **Datum:** 2026-09-15
> **Otázky:** „Jak funguje boj? Jak splním „prozkoumej místo, poraz 3 beast"?"

---

## 1. Jak boj funguje

Boj je **tahový** (`G.combatRound`): postavy i nepřátelé se řadí podle **rychlosti**
a střídají tahy, dokud jedna strana nepadne.

- **Běží sám** — souboj se odehrává automaticky (~0,7 s na kolo), takže se díváš
  na živý log a stavy, ale nemusíš nic mačkat. Tlačítko **⏸ Pozastavit boj** ho
  přepne do ručního režimu (pak „▶︎ Další kolo" odehraje kolo po kole).
- **Taktika** (Agresivní / Vyvážená / Defenzivní) mění útok vs. obranu.
- **Schopnosti** — ve výchozím stavu je postavy **používají samy**
  („Automaticky používat schopnosti" je zapnuté); jde to vypnout a používat je ručně.
  Nepřátelé mají vlastní (jed, omráčení, přivolání posil, léčení…).
- **Vítězství** = kořist (dropy), XP, nálada; poražený nepřítel se započítá do
  `killCounts` (zvěř / humanoidi / monstra). **Prohra** = zranění (nebo smrt podle
  obtížnosti) a ztracená výdrž.
- Na uzlu s nebezpečím vidíš odhad: „síla družiny vs. potřeba", takže poznáš,
  jestli na to máš.

## 2. Jak boj vyvolat

| Jak | Kdy |
|---|---|
| **⚔️ Bojovat s družinou** na uzlu | výchozí volba — vezme **družinu (= skupinu) postavy, která je uzlu nejblíž** (`G.partyNearNode`); postava bez skupiny je družina o jednom |
| **🛡️ Doporučená družina** | nejmenší družina s rozumnou šancí (`G.recommendParty`), zbytek může pracovat |
| **⚔️ Všichni** | všechny volné postavy z celé mapy — přeruší jim práci |
| **Práce na nebezpečném uzlu** | každé 3 s je šance na **přepadení** (nebezpečí 2+) nebo zranění; v divočině (nebezpečí 1) je nově taky malá šance na souboj. Členové stejné družiny do 4 polí **přispěchají na pomoc** (`G.helpersNear`, `opts.helpers`) |
| Příběh / událost | občas spustí souboj |

Nepřátelé se vybírají podle **typu uzlu** (`ENCOUNTER_TABLE`) a **počet se řídí
sílou družiny, ne počtem hlav** (`G.enemyCountFor(enemy, size, power)`): šest
slabých postav nepřitáhne víc nepřátel než dvě silné, takže přibrat slabšího
člena je vždycky výhoda. Referenční síla průměrné postavy je `G.COMBAT_POWER_REF`.

### Skupina jako družina

Skupina (`u.groupId`) je **družina** — platí pro práci i boj:

| Role | Efekt | Kde se uplatní |
|---|---|---|
| 👑 Vůdce | +10 % práce | `G.groupWorkMult` (práce, `work.js`) |
| ⚔️ Bojovník | +30 % boje | `G.groupCombatMultFor` → `unitCombatPower` i `unitCombatStats` |
| ⚕️ Ranhojič | +50 % hojení | `G.groupHealMult` (`misc.js`) |
| 🧭 Průzkumník | −25 % nebezpečí | `G.groupSafetyMult` (`checkDanger`, `partySafety`) |
| 📦 Zásobovač | −30 % jídla | `G.groupFoodMultFor` (expedice) |

Plus **chemie** (průměr vztahů) násobí práci i boj (±10–15 %).

Členové bez úkolu se **drží pohromadě** (`G.groupCohesionTarget`) — postava se
postaví kousek od středu ostatních členů, takže skupina není rozesetá po mapě.
Boj se odehrává jen mezi těmi, kdo jsou v družině; bojující se automaticky
odpojí od svého pracovního úkolu (`G.detachUnit`), aby bojovali a nepracovali zároveň.

## 3. „Poraz 3 beast" — jak na to

- **beast** = zvěř: krysa, sliz, divoké prase, vlk, pavouk, netopýr, medvěd,
  vlkodlak, škorpión, harpyje, zmije.
- Počítá se **každý vyhraný souboj** proti zvěři jako +1 (ne počet zabitých kusů
  v jednom souboji).
- **Kde zvěř je:** hluboký les (vlk, medvěd, vlkodlak), močál (zmije, škorpión),
  jeskyně (netopýr). Nově na nich můžeš rovnou **⚔️ Bojovat**, nebo tam poslat
  postavy pracovat a počkat na přepadení.
- Postup je vidět přímo v zakázce: **„⚔️ Poraz 2/3 zvěř"**.
- „Lovit zvěř" (aktivita) zvěř **nepočítá** — to je sběr kůží, ne souboj.

## 4. „Prozkoumej místo"

Zakázka **explore** se dřív tvářila jako „prozkoumej uzly", ale ve skutečnosti
počítala **návštěvy sídel**. Opraveno: text teď říká **„Navštiv X sídel"**
a v panelu je postup „🗺️ Navštiv 2/4 sídel". Prostě ťukni na sídla, která jsi
ještě neviděl.

---

## 5. Co se změnilo

- **Automatický boj** — souboj běží sám (vidíš log i stavy), tlačítkem se dá
  pozastavit do ručního režimu. Dřív se na každé kolo muselo klikat.
- **Svět běží dál i během souboje** — boj nepauzuje hru, jen překryje mapu;
  bojující postavy jsou označené (`G.unitInCombat`), takže jim autonomie/fronta
  příkazů/stavba během boje nepřidělí jinou práci.
- **Okno se samo zavře** 5 s po konci souboje; jakákoli aktivita v okně (klik,
  rolování, klávesa) zavření odloží o dalších 5 s (`G.resetCombatCloseTimer`).
  Když modal překryje menu ☰, samozavření počká, až se menu zavře.
- **Okno boje jde kdykoli zavřít** — tlačítkem **✕ Zavřít okno** v hlavičce,
  klávesou `Esc`, nebo kliknutím mimo okno. Souboj tím **nekončí**, běží dál na
  pozadí (postavy dál bojují, `G.unitInCombat` platí) a na mapě se objeví
  tlačítko **⚔️ Souboj — kolo N**, kterým okno kdykoli otevřeš zpět
  (`G.hideCombatWindow` / `G.openCombatWindow`). Ručně zavřené okno se samo
  nevrátí — ani po zavření menu ☰. Po dohraném souboji se místo okna objeví
  plovoucí hláška s výsledkem (`G.toast`).
- **Okno nemusí vyskakovat vůbec** — v menu ☰ je volba **⚔️ Okno boje**:
  `vždy` (výchozí), `jen boss a elita`, nebo `nikdy (tiše)`. V tichém režimu se
  okno neotevře, souboj proběhne na pozadí a výsledek jde do logu; tlačítko
  ⚔️ na mapě ho i tak kdykoli otevře. Drží se v savu (`settings.combatWindow`,
  `G.combatWindowMode` / `G.setCombatWindowMode`, rozhoduje `G.combatWindowWanted`).
- **Schopnosti se používají samy** ve výchozím stavu.
- **Bojovat jde na každém uzlu s nepřáteli** (předtím jen na nebezpečí 2+, tedy
  dolech a jeskyních — zvěř v lese nešla lovit vůbec).
- **Divočina (nebezpečí 1) umí vyvolat přepadení** při práci, ne jen zranit.
- **Postup u kill a explore zakázek** je vidět v panelu („2/3").
- **Explore text i logika sedí** — počítá sídla, ne uzly.
- Jednotné místo „jde odevzdat?" (`G.canTurnInQuest`) teď hlídá i materiály
  u explore zakázek (např. relikvie potřebuje krystaly).

## 6. Testy

`test/headless-smoke.js` (celkem 71 kontrol) nově ověřuje:
- `G.questKillProgress` počítá zabití od přijetí a `G.canTurnInQuest` uvolní
  odevzdání až po 3/3,
- `G.killTypeLabel` překládá typy,
- uzel hlubokého lesa nabízí tlačítko „Bojovat",
- **boj nepauzuje svět** (`G.isPaused()` false), `G.unitInCombat` blokuje práci
  i frontu příkazů, po konci se ozbrojí samozavření a `G.closeCombat` ho zruší,
- **okno jde zavřít během souboje** a znovu otevřít (souboj přitom běží dál),
- **režim okna** `vždy` / `jen boss a elita` / `nikdy` a že se ručně zavřené
  okno nevrátí ani po zavření menu ☰,
- když obrazovku převezme **jiné okno** (příběh, událost, perky — `G.combatModalYield`),
  okno boje se jen schová a zůstane dostupné přes ⚔️ tlačítko na mapě.
