# Úkoly, zakázky a výroba — jak to funguje

> **Datum:** 2026-09-15
> **Otázky:** „Jak se plní úkoly? Jak funguje escort? Jak přiřadit postavy?
> Mohly by questy brát samy? Kdy se začnou vyrábět pokročilejší produkty?
> Jak získám prkna, když nejsou u mého města?"

---

## 1. Zakázky (questy) — druhy a jak se plní

Zakázky visí v sídle na záložce **Obchod → Zakázky**. Jsou 4 druhy
(`G.QUEST_TEMPLATES`, `js/data/progress.js`):

| Druh | Co se plní | Jak se odevzdá |
|---|---|---|
| **deliver** (doručit) | máš dost surovin (`need`) | odevzdáš v tom sídle, suroviny se odečtou |
| **kill** (zabít) | zabiješ N nepřátel daného typu | zabití se počítají automaticky (`killCounts`) |
| **explore** (prozkoumat) | navštívíš N sídel | návštěvy se počítají automaticky |
| **escort** (doprovod) | postavy stráví N dní na cestě | odevzdáš, až doba uplyne |

**Dřív byl escort jen „počkej N dní a odevzdej"** — žádná postava nikam nešla,
proto to vypadalo, že se nedá přiřadit. To je opravené (viz §3).

---

## 2. Přiřazení postav — kam se přiřazují

Postavy se dnes přiřazují k **práci**, ne k zakázkám (až na escort):

1. **Uzel na mapě** → tlačítko **Start** — přiřadí všechny volné postavy té práci
   na tom uzlu.
2. **Karta postavy** → rozbalovací seznam „⚒️ Přiřadit práci…" — přiřadí jen ji.
3. **Skupina** → „Zaměření" — skupina se na tu práci vrhne, jakmile má volné členy.
4. **Fronta příkazů** — když nikdo není volný, Start nabídne zařadit do fronty
   (vyřídí se, až se někdo uvolní); řadí se tlačítky ▲▼.

Escort je od teď výjimka: **přiřazuje se sám** (viz §3).

---

## 3. Co je nové: escort obsadí postavy

Při přijetí escort zakázky hra najde **až 2 volné schopné postavy**, ony přeruší
svou práci, vyrazí k sídlu a **stráví `escortDays` dní na cestě** (v panelu je
vidět jako úkol „🚶 Doprovod" s postupem, a v zakázce kdo doprovází). Po uplynutí
se uvolní a zakázku jde odevzdat. Když volná postava není, escort přijmout nejde.

---

## 4. Co je nové: automatické zakázky (politika)

V menu (☰) je nastavení **„🤖 Zakázky sama"** (`settings.autoQuests`):

| Režim | Chování |
|---|---|
| **vypnuto** | hra questy nebere ani neodevzdává (výchozí) |
| **jen doručovací** | sama vezme doručovací zakázku, **jen když už máš suroviny**, a hned ji odevzdá |
| **všechny** | bere i kill/explore/escort (escort jen když je volná postava) a odevzdává, co je hotové |

- Kontrola běží každých 30 s herního času (`tickQuests`).
- Log jasně píše „🤖 Automaticky přijata / odevzdána zakázka".
- Jediné místo s logikou „jde odevzdat?" je teď `G.canTurnInQuest` (používá ho
  panel i automatika).

---

## 5. Výroba a pokročilejší produkty

### Jak se dnes vyrábí
- **Recepty** (`G.RECIPES`) se dělají ručně v panelu **Řemeslo → Výroba**
  (tlačítko „Vyrobit", nebo „udržovat zásobu").
- **Dílny** (`G.WORKSHOPS`) jsou fyzicky v sídlech podle velikosti, nebo **na
  základně**, když postavíš odpovídající budovu. Postava musí stát v dosahu
  dílny (`radius + 1,5` od sídla, nebo 3 pole od základny).
- **Základna umí víc než dřív** — nově na ní jdou i tesařská dílna, alchymie
  a kuchyně, ne jen kovárna a tkalcovna:

| Dílna | Budova základny, která ji zpřístupní | Co vyrábí |
|---|---|---|
| 🪚 Tesařská | `woodcutter_camp` (dřevařský tábor) | **prkna**, luk, dlouhý luk |
| 🔨 Kovárna | `iron_mine` | ingoty, meč, zbroj |
| 🧶 Tkalcovská | `weaving_hut` | látka |
| ⚗️ Alchymie | `herb_garden` | lektvary |
| 🍳 Kuchyně | `grain_field` | mouka, chléb |

### Odpověď na „jak získám prkna, když nejsou u mého města"
1. **Kup je** na trhu (prkna jsou běžné zboží, `G.TRADED`).
2. **Pošli postavu do města/města s tesařskou dílnou** (Březová, Stříbrný Brod,
   Královské Město) a vyrob ručně.
3. **Postav na základně dřevařský tábor** → tím se na základně objeví tesařská
   dílna a postava u základny umí prkna vyrobit.

### Co je nové: „Udržovat zásobu"
V **Řemeslo → Výroba** je sekce **Udržovat zásobu** — nastavíš, kolik kusů
(prken, chleba, ingotů, látek, lektvarů, …) má hra držet. Autonomie (každé 2 s)
je sama dovyrobí, **když**:
- je jich pod cílem,
- je k dispozici dílna (v sídle nebo na základně),
- je u ní schopná postava,
- jsou suroviny.

Tím se řetězec „dřevo → prkna → luk" může běžet sám.

---

## 6. Testy

`test/headless-smoke.js` (celkem 45 kontrol) nově ověřuje:
- escort obsadí postavy, po čase jde odevzdat a odevzdání postavy uvolní;
- `G.canTurnInQuest` pro deliver (materiál ano/ne);
- automatické zakázky: režim `off|deliver|all`, doručovací zakázka se sama
  vezme i odevzdá, neznámý režim spadne na `off`;
- automatická výroba: `G.setProductionOrder` / `G.productionOrder` a `tickProduction`
  dovyrobí prkna, když je postava u dílny.
