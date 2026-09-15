# Analýza: stavba budov a hráčská základna

> **Datum:** 2026-09-15
> **Rozsah:** budovy v sídlech, budovy základny, dílny a vazba na polohu základny.
> **Metoda:** čtení kódu s důkazy `soubor:řádek`, dohledání všech čtenářů každého
> efektu budovy (`grep` na klíč efektu napříč `js/`).
> **Návaznost:** doplňuje `docs/AUDIT_MENU.md` (audit menu).

---

## 1. Jak to dnes funguje (tok hráče)

1. **Sídla** — hráč ťukne na sídlo → panel Obchod → záložka **Budovy** → „Postavit".
   Stavba je **okamžitá**: jen zlato + materiály, žádný čas ani stavitel
   (`js/systems/misc.js:147-172`).
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

## 2. Budovy v sídlech — které efekty skutečně fungují

`G.BUILDINGS` (`js/data/character.js:40-77`) definuje 12 budov (max. úr. 5).
Efekty se sčítají v `G.settlementBonuses(sid)` (`js/systems/misc.js:135-146`),
ale **ne všechny klíče někdo čte**:

| Budova | Efekt (klíč) | Kdo ho čte | Stav |
|---|---|---|---|
| Tržnice | `sellMult`, `buyMult` | `economy.js:39` (ceny), `misc.js:203` (vybavení), `economy.js:131` (gemy) | ✅ funguje |
| Sklad | `stockMult` | `economy.js:183` (cíl zásob), `trade.js:71` (zobrazení) | ✅ funguje |
| Hospoda | `restMult` | `autonomy.js:150-153` (regenerace výdrže) | ✅ funguje |
| Hospoda | `moodMult` | — nikde | ❌ **mrtvý efekt** (nálada roste jen přes `restMult`) |
| Lazebna | `healMult` | `misc.js:93` (hojení zranění) | ✅ funguje |
| Strážnice | `safetyMult` | `combat.js:447` (nebezpečí u sídla) | ✅ funguje |
| Dílna | `craftQualityBonus`, `repairDiscount` | — nikde | ❌ **mrtvé efekty** |
| Kovárna | `smithingSpeed`, `smithingQuality` | — nikde | ❌ **mrtvé efekty** |
| Bylinná zahrada | `herbalismSpeed`, `herbalismYield` | — nikde | ❌ **mrtvé efekty** |
| Lovecká chata | `huntingSpeed`, `huntingQuality` | — nikde | ❌ **mrtvé efekty** |
| Alchymistická laboratoř | `alchemySpeed`, `alchemyQuality` | — nikde | ❌ **mrtvé efekty** |
| Cvičiště | `combatTraining` | — nikde | ❌ **mrtvý efekt** |
| Knihovna | `xpBonus` | — nikde (`units.js:125` čte `xpBonus` z **výbavy**, ne z budov) | ❌ **mrtvý efekt** |

**Důsledek pro hráče:** 6 z 12 budov (všechny „specializované" — kovárna, bylinková
zahrada, lovecká chata, laboratoř, cvičiště, knihovna) **nemá žádný herní efekt**,
přestože stojí zlato a materiály. U Dílny a Hospody funguje jen část slibovaného.
Vysvětlení je v tom, že efekty míří na systémy, které ve hře neexistují (výroba je
okamžitá → „rychlost kování" nemá co zrychlit; opravy a XP podle sídla také nejsou).

**UI tyto budovy ukazuje** (`js/ui/trade.js:125-176`), ale efekt vypisuje syrově
(`smithingSpeed: 1.10`), takže hráč nemá šanci poznat, že nejde o nic.

---

## 3. Budovy základny

`G.BASE_BUILDINGS` (`js/data/character.js:80-108`) — 12 budov, max. úr. 5
(legendární výheň 3). Všechny **fungují**:

- 9× pasivní produkce surovin (`rate(l)/s`, v UI přepočteno na `/h`) přes `tickBase`
  (`js/systems/autonomy.js`), kvalita `common`/`fine` (`BASE_FINE_CHANCE = 0,10`).
- `gem_smithy` — 1 gem za `300/l` sekund (UI: `12·l`/h).
- `legendary_forge` — `+5 %` šance na legendárku, čte `combat.js:338`.

Omezení: **žádné požadavky na stavbu** (žádné „potřebuješ X úr. jiné budovy"),
**žádný čas stavby** a **žádný strop** na počet budov (jen úrovně).

---

## 4. Základna: poloha

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

## 5. Co je implementováno (výběr místa)

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

## 6. Návrhy na další krok (nyní neimplementováno)

1. **Oživit mrtvé efekty budov** (§2) — bez toho je 6 budov jen past na zlato.
   Konkrétně navrhuji překlopit je na systémy, které existují:
   - Dílna: `craftQualityBonus` → přičíst do `G.rollQualityWithBonus`,
     `repairDiscount` → sleva na materiál při stavbě/opravě výbavy.
   - Knihovna: `xpBonus` → násobit `G.addSkillXp`/`G.addUnitXp` postavám v dosahu sídla.
   - Cvičiště: `combatTraining` → násobit `G.unitCombatPower` v dosahu sídla.
   - Kovárna / laboratoř: „rychlost" nahradit **výtěžností nebo kvalitou** (výroba je
     okamžitá), případně přidat `craftBatch`.
   - Lovecká chata / bylinková zahrada: `herbalismYield` → `+1` surovina za dokončený
     sběr v dosahu sídla.
   - Hospoda: `moodMult` → použít v `tickStaminaRegen` místo `restMult` i pro náladu.
2. **Stavba jako činnost** — doba stavby + stavitel (postava se na čas uvolní z práce),
   nebo aspoň potvrzení u drahých staveb.
3. **Požadavky a strop základny** — odemykání budov podle úrovně jiných budov
   (např. `gem_smithy` až po `iron_mine` 3) a limit počtu budov na základně.
4. **Základna v ekonomice** — karavany/obchodníci na základně, vlastní sklad,
   obrana základny při nebezpečných událostech.
5. **Zviditelnění polohy** — v panelu ukázat dosah dílen (3 pole) jako kruh na mapě
   při výběru místa.

---

## 7. Testy

`test/headless-smoke.js` (celkem 28 kontrol) nově ověřuje:
- `G.canPlaceBaseAt` odmítne vodu, skálu, pole s uzlem, pole se sídlem a okraj mapy;
- `G.suggestBaseSpot()` vrátí platné pole;
- `G.tryUnlockBase()` **nepostaví** základnu samo, jen nabídne výběr;
- panel v tomto stavu nabízí `pick-base-spot` i `auto-place-base`;
- `G.startBasePlacement` / `G.placeBaseAt` / `G.basePos()` uloží zvolenou polohu
  a režim výběru vypnou; `G.baseLocationText()` není prázdný;
- po postavení panel nabízí `center-base`.
