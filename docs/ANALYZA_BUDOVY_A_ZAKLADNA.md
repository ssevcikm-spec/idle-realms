# Analýza: stavba budov a hráčská základna

> **Datum:** 2026-09-15
> **Rozsah:** budovy v sídlech, budovy základny, dílny a vazba na polohu základny.
> **Metoda:** čtení kódu s důkazy `soubor:řádek`, dohledání všech čtenářů každého
> efektu budovy (`grep` na klíč efektu napříč `js/`).
> **Návaznost:** doplňuje `docs/AUDIT_MENU.md` (audit menu).

---

## 1. Jak to dnes funguje (tok hráče)

1. **Sídla** — hráč ťukne na sídlo → panel Obchod → záložka **Budovy** → „Postavit".
   Stavba **zabere herní čas a potřebuje stavitele** (viz §5): nejdřív se odečte cena,
   pak se k sídlu pošle až 3 schopné postavy (do 4 polí), stavba běží jako úkol
   s postupem a odhadem času. Do dokončení nelze v tom sídle začít další stavbu.
2. **Základna** — při renomé **25** se sama odemkne a postaví na **pevné pole (14, 18)**
   (`G.BASE_UNLOCK`, `G.BASE_POS` v `js/data/character.js:110-111`,
   `G.tryUnlockBase` v `js/systems/autonomy.js`). Hráč se to dozví jedním řádkem
   v logu: „🏕️ Odemknuta tvá základna! (14, 18)."
3. **Budovy základny** — 12 typů, pasivní produkce (`tickBase`) nebo speciální efekt
   (gemy, legendárky). Cena `gold·l²` + materiály.
4. **Dílny** — fyzická místa výroby: v sídlech podle velikosti, nebo na základně
   (`baseRequirement`). Přístup postavy = do **3 polí** od základny, resp.
   `radius + 1,5` od sídla (`js/data/workshops.js:63-82`).

---

## 2. Budovy v sídlech — efekty

`G.BUILDINGS` (`js/data/character.js:40-77`) definuje 12 budov (max. úr. 5).
Efekty se sčítají v `G.settlementBonuses(sid)` (`js/systems/misc.js`).

> **Původní stav:** 9 klíčů efektů nikdo nečetl — 6 specializovaných budov
> (kovárna, bylinková zahrada, lovecká chata, laboratoř, cvičiště, knihovna) byly
> jen past na zlato a u Dílny/Hospody fungovala jen část slibu.
> **Nyní jsou všechny efekty napojené na existující systémy** (sloupec „Kdo ho čte").

| Budova | Efekt (klíč) | Kdo ho čte | Stav |
|---|---|---|---|
| Tržnice | `sellMult`, `buyMult` | `economy.js` (ceny), `misc.js` (vybavení) | ✅ |
| Sklad | `stockMult` | `economy.js` (cíl zásob), `trade.js` | ✅ |
| Hospoda | `restMult` | `autonomy.js` (regenerace výdrže) | ✅ |
| Hospoda | `moodMult` | `autonomy.js` (růst nálady při odpočinku) | ✅ *(dřív mrtvé)* |
| Lazebna | `healMult` | `misc.js` (hojení zranění) | ✅ |
| Strážnice | `safetyMult` | `combat.js` (nebezpečí u sídla) | ✅ |
| Dílna | `craftQualityBonus` | `crafting.js` + `work.js` (skóre kvality) | ✅ *(dřív mrtvé)* |
| Dílna | `buildDiscount` | `misc.js:buildingCost` (zlevní stavby v sídle) | ✅ *(dřív mrtvé jako `repairDiscount`)* |
| Kovárna | `smithingQuality`, `smithingBatch` | kvalita a +kusy při kování | ✅ *(dřív mrtvé)* |
| Bylinná zahrada | `herbalismQuality`, `herbalismYield` | kvalita a +suroviny ze sběru | ✅ *(dřív mrtvé)* |
| Lovecká chata | `huntingQuality`, `huntingYield` | kvalita a +suroviny z lovu | ✅ *(dřív mrtvé)* |
| Alchymistická laboratoř | `alchemyQuality`, `alchemyBatch` | kvalita a +kusy při alchymii | ✅ *(dřív mrtvé)* |
| Cvičiště | `combatTraining` | `units.js:unitCombatPower` (bojová síla postav u sídla) | ✅ *(dřív mrtvé)* |
| Knihovna | `xpBonus` | `units.js` (`addUnitXp`, `addSkillXp`) | ✅ *(dřív mrtvé)* |

**Pravidlo působení:** bonusy platí postavám, které stojí **u toho sídla**
(`G.settlementNearUnit`, dosah `radius + 1,5`). U základny se sídlení budovy
neuplatňují — základna má vlastní budovy.

**Konvence efektů:** rychlostní efekty nahradily **kvalita** a **výtěžnost** —
výroba je okamžitá, takže „+10 % rychlost kování" nemělo co zrychlit
(`G.skillQualityBonus`, `G.skillYieldBonus`).

V UI se už nevypisují syrové klíče (`smithingSpeed: 1.10`), ale věty
(`G.buildingEffectText`), a to jak pro **aktivní** úroveň, tak pro **další úroveň**
(„Na úr. 3: kvalita kování +12 • +1 kus navíc při kování").

---

## 3. Budovy základny

`G.BASE_BUILDINGS` (`js/data/character.js:80-108`) — 12 budov, max. úr. 5
(legendární výheň 3). Všechny **fungují**:

- 9× pasivní produkce surovin (`rate(l)/s`, v UI přepočteno na `/h`) přes `tickBase`
  (`js/systems/autonomy.js`), kvalita `common`/`fine` (`BASE_FINE_CHANCE = 0,10`).
- `gem_smithy` — 1 gem za `300/l` sekund (UI: `12·l`/h).
- `legendary_forge` — `+5 %` šance na legendárku, čte `combat.js:338`.

Omezení: **žádné požadavky na stavbu** (žádné „potřebuješ X úr. jiné budovy")
a **žádný strop** na počet budov (jen úrovně). Stavba ale nově zabere čas
a stavitele jako v sídlech (§4).

---

## 4. Stavba: čas a stavitelé

`js/systems/construction.js` (nový) — stavba se nepočítá zvlášť, ale **jako běžný
úkol** s vnitřní aktivitou `construct` (skrytá v UI, `hidden: true`). Díky tomu
stavitelé:

- jsou zaměstnaní — autonomie je nepřevezme na jinou práci,
- přeruší svou předchozí práci (jako „přiřadit skupině"),
- mají viditelný postup a odhad času v panelu (úkol „🏗️ Stavět — Svitavy"),
- podléhají běžným pravidlům (výdrž, zranění, nebezpečí) a na mapě **dojdou ke staveništi**.

| Parametr | Hodnota |
|---|---|
| Pracnost | `32 · úr.²` (sídlo), `45 · úr.²` (základna) |
| Stavitelé | až **3** schopné postavy do **4 polí** od stavby, řazené podle řemesla |
| Trvání | pracnost ÷ součet rychlosti stavitelů (řádově sekundy až minuty dle úrovně) |
| Souběh | **jedna stavba na sídlo/základnu**; další je blokovaná s vysvětlením |
| Bez stavitelů | stavba čeká („čeká na stavitele") a `tickConstruction` ji zkusí rozjet, jakmile někdo přijde |
| Zrušení | zrušením úkolu se stavba přeruší a **suroviny propadají** (hláška to řekne) |
| Uložení | stavby jsou ve `state.construction`, po načtení se znovu napojí na úkoly |

Cena se odečte **při zadání** stavby (`G.canBuild` / `G.build`, resp. `G.canBuildBase`
/ `G.buildBase`), úroveň budovy se zapíše až po dokončení (`G.finishConstruction`).

---

## 5. Základna: poloha (nálezy před opravou)

Nálezy před opravou:

| # | Nález | Dopad |
|---|---|---|
| **B-01** | Základna se **postavila sama** na pevné pole (14, 18); hráč neměl žádnou volbu | hráč nemohl ovlivnit, co bude po ruce |
| **B-02** | Hráč se dozvěděl jen „(14, 18)" — souřadnice, které nikde jinde v UI nejsou | číslo bez významu, základnu prakticky nenašel |
| **B-03** | Poloha se **nevalidovala**: podle seedu mohla vyjít na vodu, skálu, uzel nebo doprostřed sídla | rozbitý vzhled/dojem, dílny na „vodě" |
| **B-04** | **Dva zdroje pravdy**: `state.base.x/y` se ukládal, ale vykreslení, ťuknutí i výběr používaly konstantu `G.BASE_POS` (`render/world.js`), zatímco dílny čtou `state.base.x/y` (`workshops.js:69`) | při jakékoli změně polohy by se tábor kreslil jinde, než kde fungují dílny |
| **B-05** | Panel základny existoval jen po odemčení a otevřel se **jen ťuknutím na ikonu** na mapě | slabá objevitelnost; „kde ji postavím" se hráč neměl jak zeptat |
| **B-06** | Pozice měla reálný dopad (dílny do 3 polí), ale hráč ho nikde neviděl | nešlo se rozhodnout vědomě |

---

## 6. Co je implementováno (výběr místa)

**Tok:** renomé 25 → hra **nenabídne rovnou stavbu**, ale založení:
log „Vyber místo tlačítkem 🏕️ na mapě" + odznak v panelu místa.

- **Tlačítko 🏕️ na mapě** (`index.html`, `js/render/world.js`):
  - základna stojí → vycentruje mapu na ni a otevře její panel,
  - místo se vybírá → zapne režim výběru a vycentruje mapu na doporučené pole,
  - renomé nestačí → otevře panel se stavem odemčení.
- **Režim výběru** — lišta „🏕️ Ťukni na mapu, kde založit základnu" se tlačítkem
  *Zrušit*; ťuknutí na pole základnu postaví, neplatné pole odmítne **s důvodem**
  (voda / skála / uzel / sídlo / moc blízko sídla / mimo mapu).
- **Doporučené místo** (`G.suggestBaseSpot`) — skóruje volná pole podle vzdálenosti
  od sídla (~4 pole = ideál) a počtu různých surovinových uzlů do 4 polí; na mapě se
  při výběru kreslí jako duch s popiskem „doporučeno". Tlačítko
  „✨ Postavit na doporučeném místě" založí základnu jedním klikem.
- **Popis polohy místo souřadnic** (`G.baseLocationText`):
  „4 pole od Královské Město • u dolu" — v panelu i v logu.
- **Přesun základny** (`🚚`) — dokud na ní nic nestojí; pak už ne (tlačítko je
  vysvětleně zakázané).
- **Jeden zdroj pravdy** — `G.basePos()`; vykreslení, ťuknutí, výběr i dílny ho
  čtou odtud (B-04 vyřešeno).
- **Panel základny** umí nově stav „máš renomé, ale ještě nestojí" s volbami
  *Vybrat místo na mapě* / *Postavit na doporučeném místě* + vysvětlení, co poloha
  ovlivní. Před odemčením panel rovnou říká, že místo bude volba hráče.
- **Migrace savu**: `base.x/y` se doplňuje, `placementOffered` u starých savů
  s postavenou základnou = `true`; `placing` se načtením nuluje.
- Bonus: ceny budov se v obou panelech vypisují **s názvy materiálů** místo
  samotných ikon.

---

## 7. Návrhy na další krok

1. ~~Oživit mrtvé efekty budov~~ — **hotovo** (§2).
2. ~~Stavba jako činnost (doba stavby + stavitel)~~ — **hotovo** (§5).
3. ~~Potvrzení u drahých staveb~~ — **hotovo**: stavba nad `G.EXPENSIVE_BUILD_GOLD`
   (1000 zlata) se ptá a ukáže cenu + materiály + odhad práce (`G.buildConfirmText`).
4. ~~Požadavky a strop základny~~ — **hotovo**: budovy mají `requires` (např.
   `iron_mine` po `stone_quarry` 2, `gem_smithy`/`crystal_cave` po `iron_mine` 3,
   `legendary_forge` po `gem_smithy` 3) a základna má strop počtu druhů budov
   (`G.baseBuildingSlots` = 6 + renomé/20, max 12; `G.baseBuildingTypes`).
5. ~~Základna v ekonomice~~ — **částečně hotovo**: karavany jezdí i na základnu
   (`G.caravanSitePos`, náklad přistane hráči `matAdd`); vlastní sklad a obrana
   základny zůstávají jako budoucí rozšíření.
6. **Zviditelnění polohy** — v panelu ukázat dosah dílen (3 pole) jako kruh na mapě
   při výběru místa.

---

## 8. Testy

`test/headless-smoke.js` (celkem 30 kontrol) nově ověřuje:
- `G.canPlaceBaseAt` odmítne vodu, skálu, pole s uzlem, pole se sídlem a okraj mapy;
- `G.suggestBaseSpot()` vrátí platné pole;
- `G.tryUnlockBase()` **nepostaví** základnu samo, jen nabídne výběr;
- panel v tomto stavu nabízí `pick-base-spot` i `auto-place-base`;
- `G.startBasePlacement` / `G.placeBaseAt` / `G.basePos()` uloží zvolenou polohu
  a režim výběru vypnou; `G.baseLocationText()` není prázdný;
- po postavení panel nabízí `center-base`;
- **efekty budov se skutečně projeví**: knihovna zvedne XP bonus, cvičiště bojovou
  sílu, dílna kvalitu výroby a slevu na stavbu, kovárna kvalitu kování;
  `G.buildingEffectText` vrací věty místo klíčů;
- **stavba**: `G.build` odečte cenu a založí stavbu, budova se **nepostaví hned**,
  stavba získá stavitele a vazbu na úkol, druhá stavba v témže sídle je blokovaná,
  po dokončení úkolu má budova úroveň 1.

Testovací běh je od nynějška **deterministický** (`G.setSeed(20260910)` v úvodu
testu) — dřív se globální RNG seedoval z `Date.now()`, takže občas selhaly testy
závislé na náladě postav (`_refuseUntil`).
