# Audit menu a UI — co funguje, co ne a co zlepšit

> **Datum:** 2026-09-15
> **Rozsah:** celé hráčské menu — horní lišta, záložky a podzáložky, všechny panely
> (`js/ui/*.js`), modaly, ovládání mapy a úvodní obrazovka.
> **Metoda:** čtení kódu (každé tvrzení má `soubor:řádek`), statická inventura
> `data-action` / `data-change` proti obsluze v `js/ui/ui.js`, spuštěné kontroly
> (`scripts/check-globals.ps1` = 0 problémů, `node test/headless-smoke.js` = OK).
>
> **Poznámka:** Fáze 0–2 z `docs/PLAN_HRATELNOST.md` jsou v kódu hotové
> (popup události vypnuté, osobní momenty postav, fronta příkazů).
> Tento audit hodnotí **menu jako celek**, ne jen frontu.

---

## 1. Souhrn (TL;DR)

| # | Nález | Oblast | Severita |
|---|---|---|---|
| **M-01** | Tlačítko **„Koupit" u gemů** v trhu je mrtvé — `data-action="buy-gem"` nemá obsluhu | bug | 🔴 vysoká |
| **M-02** | **Fronta ztrácí zadané množství** — `doQueueTask` uloží jen aktivitu, `targetQty` se zahodí → vyrobí se default | bug | 🔴 vysoká |
| **M-03** | „Přiřadit hned" v modalu **také ignoruje zadané množství** | bug | 🔴 vysoká |
| **M-04** | **Přepis panelu každou 1 s** maže rozepsané hodnoty v `input` (množství u práce i obchodu) | UX | 🔴 vysoká |
| **M-05** | **Start ruší VŠECHNY autonomní úkoly v říši** (i skupinová zaměření) | design | 🟠 střední |
| **M-06** | Start/přiřazení na odpočívající nebo zraněnou postavu **tiše selže s nepravdivou hláškou** | bug | 🟠 střední |
| **M-07** | Politika: u kandidáta je jen ikona + název programu, **efekty se nezobrazují** | kontext | 🟠 střední |
| **M-08** | Expedice: modal **neukazuje počet vybraných, limit, cenu jídla ani šanci** | kontext | 🟠 střední |
| **M-09** | Fronta příkazů je vidět **jen** na „Svět → Místo", ne v „Práci", kde vzniká | kontext | 🟠 střední |
| **M-10** | U běžících úkolů chybí **místo, ETA a kdo tam jde** | kontext | 🟡 nízká |
| **M-11** | Kontrola množství je jen `input[number]` — bez ±, ×10, Max a bez perzistence | UX | 🟠 střední |
| **M-12** | Výroba (recepty) **neumí množství** — jen jeden kus na klik | UX | 🟡 nízká |
| **M-13** | `toggle-auto-abilities` je obsluhováno **dvakrát** (click + change) | bug (latentní) | 🟡 nízká |
| **M-14** | Rozpis chybových hlášek je jednotný, ale často **nepravdivý** („Není dostupný uzel") | kontext | 🟡 nízká |

Detaily, důkazy a návrhy oprav: §3–§6. Plán realizace: §7.

---

## 2. Co funguje (ověřeno)

**Struktura a navigace**
- 5 záložek (`Svět / Lidé / Řemeslo / Obchod / Více`) a 13 podzáložek — definováno
  v `js/ui/ui.js:4-28`, obsluha kliků `js/ui/ui.js:58-91`.
- Každá podzáložka má vykreslovací funkci (`js/ui/ui.js:235-250`), žádná nespadne
  do `default: Neznámý panel`.
- Stav záložky se drží (`activeParent` / `activeSub`), `G.selectTab()` umí skočit
  na podzáložku z kódu (`js/ui/ui.js:146-153`).
- Zachování rozbalených `<details>` a scrollu při překreslení (`js/ui/ui.js:41-55, 255-266`).
- HUD (čas, zlato, renomé, počet postav, prestiž, místo+roční období+den) —
  `renderHud` `js/ui/ui.js:162-204`, obnova 400 ms.

**Herní panely**
- **Místo**: uzly (druh, poloha, bohatost, nebezpečí, odhad síly, práce s req. na
  dovednost a sezónní modifikátor času), sídla (obchod), základna —
  `js/ui/panels.js:145-197`, `js/ui/trade.js:6-61`, `js/ui/base_panel.js`.
- **Práce**: seznam všech aktivit s nejbližším uzlem a stavem zamčenosti —
  `js/ui/panels.js:238-261`.
- **Postavy**: karty s atributy, traitami, zraněními, výdrží, náladou, osobností,
  ambicemi, deníkem, vztahy, rodinou, perky, učednictvím, obchodníkem, výbavou —
  `js/ui/panels.js:366-492` (nejbohatší panel, ~130 řádků).
- **Skupiny**: role s tooltipem, chemie, síla, zaměření, přidávání/vyhazování členů —
  `js/ui/panels.js:515-540`.
- **Expedice**: seznam běžících, postup, jídlo, drops; modal pro vyslání —
  `js/ui/panels.js:542-592`.
- **Řemeslo / Batoh**: dílny se stavem přístupu, recepty s „máš X", gemy, mistrovská
  díla — `js/ui/panels.js:594-653`.
- **Obchod**: trh (sklad, ceny, specializace), budovy, vybavení, zakázky (typy,
  deadliny, progres, odměny) — `js/ui/trade.js:125-298`.
- **Vztahy / Politika / Log / Cíle / Prestiž**: vše vykreslené; log má filtry podle
  kategorií (`js/ui/panels.js:697-705, 816-823`), prestiž má 4 podmínky s progresem
  a export/import savu (`js/ui/panels.js:714-739`).
- **Modaly**: perky, učednictví, obchodník (přednastavené i vlastní trasy), expedice,
  socket, prestige, export/import, souboj (taktiky, schopnosti, kolo, auto, kořist),
  obtížnost, vítězství/prohra — `js/ui/ui.js:268-345, 756-854`, `js/ui/combat_modal.js`.
- **Úvodní obrazovka**: Pokračovat (s metadaty savu) / Nová hra (obtížnosti s čísly) /
  Smazat — `js/ui/title_screen.js:43-186`.
- **Mapa**: sbalit panel, fullscreen, centrování, zoom — `js/render/world.js:19-74`.

**Chytré nabídky, které už existují**
- Když při Startu **není volná postava**, otevře se modal s volbou
  **„Zařadit do fronty"** vs. **„Přiřadit hned"** a seznamem kandidátů seřazeným
  podle zaneprázdněnosti a vzdálenosti — `js/ui/ui.js:472-477`, `js/ui/panels.js:74-100`.
- Fronta příkazů je funkční: `addOrder` / `cancelOrder` / `tickOrders` (priorita, cíl
  `any|unit|group`), scheduler ji vyřídí před automatickou prací —
  `js/systems/work.js:192-251`, `js/systems/autonomy.js:11-12`.
- Riziko u uzlu se počítá z reálné síly družiny (`G.riskLabel`, `js/systems/combat.js:421-430`).

**Statická inventura ovládacích prvků**
- `data-action`: 66 různých hodnot, 65 obsluhovaných, **1 mrtvá (M-01)**.
- `data-change`: 4 hodnoty, všechny obsluhované.

---

## 3. Chyby a mrtvé ovládací prvky

### 🔴 M-01 — „Koupit" u gemů nic nedělá
`js/ui/trade.js:112` generuje `data-action="buy-gem"`, ale `handleAction`
(`js/ui/ui.js:347-412`) tento případ nemá a `G.buyGem` v kódu neexistuje.
Tlačítko je v trhu metropole a města → hráč klikne a **nic se nestane, ani hláška**.
*Oprava:* doplnit `G.buyGem(settlementId, gemId)` (odečte zlato, `matAdd('gem_'+id,1)`,
log) a `case 'buy-gem'` v `handleAction`; tlačítko navíc vypnout, když na gem není zlato.

### 🔴 M-02 — Fronta ztrácí zadané množství
`doQueueTask` (`js/ui/ui.js:505-513`) volá `G.addOrder({ activityId, nodeId })` —
`targetQty` se neposílá. `tickOrders` (`js/systems/work.js:243`) pak použije
`act.defaultQty`. Hráč zadá „100 kamene", do fronty jde 20 (default `gather_stone`).
*Oprava:* `pendingAssign` rozšířit o `targetQty` a předat ho do `addOrder` i do
`G.startTask` při vyřízení příkazu.

### 🔴 M-03 — „Přiřadit hned" také ignoruje množství
`doAssignTaskUnit` (`js/ui/ui.js:490-504`) předává
`act.mode === 'quantity' ? (act.defaultQty || 10) : 1` místo hodnoty z inputu.
Stejná chyba jako M-02, jen jiná cesta.

### 🟠 M-05 — Start ruší všechny autonomní úkoly
`doStartTask` (`js/ui/ui.js:466`) zruší **každý** úkol s `auto: true`, tedy i ta
zaměření skupin a práci postav na druhém konci mapy (`autonomy.js:39-43, 60-64`).
Do logu jde „↩️ Přerušeny automatické úkoly (N)". Pro hráče je to neviditelný zásah
do celého světa a zároveň to obchází hierarchii z plánu (příkaz > zaměření).
*Návrh:* rušit jen tolik autonomních úkolů, kolik je potřeba, a přednostně ty
**nejblíž k cílovému uzlu**; zbytek nechat běžet. Ideálně dát volbu v modalu
(„Přerušit práci N postavám" vs. „Zařadit do fronty").

### 🟠 M-06 — Přiřazení postavě, která nemůže pracovat, tiše selže
`startTask` filtruje `resting`, těžká zranění, odmítání práce a obchodníky
(`js/systems/work.js:10-19`). Když tím seznam zůstane prázdný, vrátí `null` a UI
ohlásí **„⚠️ Není dostupný vhodný uzel."** (`js/ui/ui.js:500`, `:459`) — což je
nepravda a hráč nemá jak zjistit, co se stalo.
Nesourodé je i to, že modal (`panels.js:93-97`) odpočívající postavu nabízí
(„😴 odpočívá") a `doAssignTaskUnit` ji **vzbudí** (`ui.js:494`), ale
`doUnitTask` ze selectu na kartě postavy (`panels.js:470`) ji nevzbudí a selže.
*Návrh:* v kandidátech rozlišit stavy a u nemožných je nevypsat (nebo s důvodem),
sjednotit probouzení, a `startTask` vrátit `{ok, reason}` místo `null`.

### 🟡 M-13 — `toggle-auto-abilities` obsluhováno dvakrát
Jednou přes `case 'toggle-auto-abilities'` v `handleAction` (`js/ui/ui.js:393`, voláno
z click listeneru modalu `:127-128`) a podruhé přes change listener pro stejný
`data-action` (`js/ui/ui.js:130-134`). Přepínač se překresluje přes
`G.updateCombatModal` (`js/systems/combat.js:297`), takže druhá obsluha je minimálně
nadbytečná a v závislosti na pořadí událostí může přepnutí **vrátit zpět**.
*Oprava:* ponechat jen jednu cestu (doporučuji `change`, ať to není vázané na klik).

### 🟡 Drobné
- **M-14a** `pendingAssign` se po „Zrušit" nevyčistí (`js/ui/ui.js:284-291`) — dnes
  neškodí, ale je to stav, který může v budoucnu prosáknout.
- **M-14b** Hodnoty mimo `min/max` v inputu se jen tiše přiříznou
  (`ui.js:481` na 500, `ui.js:546` na 999), ale v poli zůstane, co hráč napsal.
- **M-14c** `G.startTask` kontroluje `u.role === 'trader'`, ale `autoAssignRoles`
  tuto roli nikdy nepřidělí (`js/systems/groups.js:75`) — mrtvá podmínka.
- **M-14d** „Vyléčit" (`js/ui/ui.js:578-598`) je aktivní vždy; mimo dosah sídla jen
  zapíše hlášku a neřekne, u kterého sídla by to šlo.

---

## 4. Kontrola množství (hlavní UX slabina)

**Současný stav**

| Místo | Prvek | Problém |
|---|---|---|
| Uzel / Práce | `input[type=number] data-qty-for` (`panels.js:184`, `:254`) | jen číslo; žádné ±, ×10, Max; hodnota se ztratí při překreslení (M-04) |
| Fronta / Přiřadit | modal (`ui.js:496, 509`) | zadané množství se zahodí (M-02, M-03) |
| Obchod | `input[data-trade-qty]` (`trade.js:89`) | default 1, resetuje se každou sekundu, žádné Max/Vše |
| Výroba | tlačítko „Vyrobit" (`panels.js:622`) | žádné množství, jen 1 kus (`js/systems/crafting.js:25`) |
| Expedice | modal | neřeší množství, ale počet osob a jídlo (M-08) |

**M-04 — proč se hodnoty ztrácejí.** `setInterval(autoRefresh, 1000)`
(`js/ui/ui.js:143`) volá `render()`, který dělá `el.innerHTML = html`
(`js/ui/ui.js:251`). Přeskočí se jen když je fokus v `INPUT|SELECT|TEXTAREA`
(`js/ui/ui.js:155-160`). Jakmile pole ztratí fokus (klik na Start, ťuknutí do mapy),
je hodnota při dalším tiknutí zpět na defaultu.

**Návrh: jedna znovupoužitelná komponenta `qtyControl()`**
1. Vykreslí `[−] [input] [+]` + čipy `1 · 10 · 50 · Max` (Max = co dovolí materiál
   / cíl / 500).
2. Hodnotu drží v modulové paměti `qtyMemory = { 'act:mine_iron': 100, 'mat:wood': 25 }`
   a při každém renderu ji obnoví → překreslení už hodnotu nemaže.
3. `input` event hned clampuje na `min/max` a aktualizuje čipy.
4. `doStartTask`, `doQueueTask`, `doAssignTaskUnit`, `doTrade`, `doCraft` čtou
   hodnotu z jednoho místa (`getQty(key)`), ne z DOM query.
5. U aktivity navíc dopočítat **odhad**: `ks × workPerUnit / (workRate × richness)`
   → „≈ 2 min 30 s pro 3 postavy". Vstup pro to je (`js/systems/units.js:142-166`,
   `js/data/world.js:86-134`, `richness` v `js/systems/work.js:76`).
6. U výroby doplnit `G.craft(recipeId, qty)` (smýčka s kontrolou materiálu na každý
   kus) a tlačítka „×1 / ×5 / Vyrobit max".

---

## 5. Kontext a vysvětlivky (kde hráč nevidí „kdo/co/kde/proč")

| Nález | Kde | Co chybí |
|---|---|---|
| **M-07** kandidát politiky | `panels.js:683, 688` | `POLITICAL_PROGRAMS` má `desc` i `effects` (`js/data/politics.js:31-57`), ale zobrazí se jen ikona + název → hráč neví, co podpora udělá |
| **M-08** modal expedice | `panels.js:572-592` | počet vybraných / limit `EXPEDITION_MAX_PARTY`, cena jídla (`G.expeditionFoodCost`), odhad šance (`power/need`, `expeditions.js:33-34, 126`), výčet odměn z `rewardPool` |
| **M-09** fronta | `panels.js:102-117, 121` | fronta je jen v `panelPlace`; v „Práci" chybí, na záložce není odznak s počtem |
| **M-10** řádek úkolu | `panels.js:199-214` | místo (název uzlu), ETA, kdo je na cestě; v „Práci" se míchají úkoly z celé mapy bez místa |
| **K-01** směrnice | `panels.js:22-37` | co dělá „zaměření na materiál" (váha ×8 pod 30 ks, `autonomy.js:92-95`) a že působí **jen na autonomní volbu** |
| **K-02** skupiny | `panels.js:524-536` | co dělá „Zaměření" (autonomie sama posílá volné členy, `autonomy.js:26-44`) a že chemie vzniká ze vztahů (`groups.js:45-61`) |
| **K-03** uzly | `panels.js:166` | „Odhad síly 42 / potřeba 66" bez vysvětlení, co ta čísla jsou (`partySafety` vs `danger*22`, `combat.js:407-430`) |
| **K-04** karta postavy | `panels.js:469` | u „pracuje" chybí **kde**; u expedice/obchodu chybí kam |
| **K-05** dílny | `panels.js:594-606` | „3 postavy mají přístup" bez vysvětlení, že jde o dosah dílny |
| **K-06** obchod | `trade.js:78-93` | nevysvětlený rozdíl nákup/prodej a význam „Sklad zlata" sídla |
| **K-07** log | `panels.js:816-823` | bez času a bez místa; filtr je dobrý, hledání chybí |
| **K-08** výčet aktivit | `panels.js:176-187` | u aktivity chybí **co dá** (výnos/ks) a jak dlouho to potrvá |
| **K-09** „Vyléčit" | `ui.js:578-598` | neřekne, u kterého sídla a za kolik to půjde |

**Doporučený jednotný způsob vysvětlivek** (aby to nebylo 20 ručních tooltipů):
- Krátký `hint` řádek pod nadpisem panelu (už se používá, `panels.js:189`).
- `title="…"` u chipů/tlačítek (už se používá u rolí a schopností) — doplnit tam,
  kde chybí (směrnice, chemie, programy).
- `<details>` pro delší vysvětlení („Jak funguje autonomie") — vzor už je u osobnosti
  a dovedností (`panels.js:466, 481`).

---

## 6. Chytré nabídky (fronta, výběr osoby, doporučení)

**Co už je hotové** (§2): modal při nedostatku postav, fronta, řazení kandidátů.

**Co zlepšit v modalu „Přiřadit úkol" (`panels.js:74-100`)**
1. **Přenést `targetQty`** do obou cest (M-02, M-03).
2. **Přesnější stav a důvod** u každé postavy: `🟢 volný` / `⚒️ pracuje: Kácet dřevo
   (~2 min)` / `😴 odpočívá (výdrž 12 %)` / `🐎 obchoduje` / `🤕 těžce zraněný` /
   `🚫 odmítá pracovat`. Dnes se rozlišují jen 3 stavy (`panels.js:95`).
3. **Vzdálenost k reálnému uzlu.** Teď se počítá k uzlu podle centroidu všech
   (`panels.js:82`), ale `startTask` pak uzel hledá pro konkrétní postavu
   (`work.js:36-46`) → zobrazená vzdálenost může být jiná než skutečná.
4. **Cena přerušení** před kliknutím: „přeruší Kácet dřevo — zbývá 12/20".
5. **Doporučení**: odznak „nejbližší vhodná" u prvního kandidáta + volba
   „poslat celou skupinu" (`groupId`), kterou fronta už umí (`targetType:'group'`,
   `work.js:216-221`), ale UI ji nikde nenabízí.
6. Když **neexistuje vhodný uzel** (např. `mine_crystal` bez jeskyně), dnes to
   pozná jen řádek v „Práci" (`panels.js:244, 255`) — doplnit i do modalu.

**Další chytrá místa**
- **Start na uzlu** místo „zaútočit všemi" (`ui.js:662-669`) nabídnout družinu podle
  `riskLabel` a varovat u „Smrtelné riziko".
- **Odpočívající postavy**: hromadné „Vzbudit všechny" a vysvětlení, že 20 % výdrže
  znamená odchod od práce (`autonomy.js:131, 160-166`).
- **Fronta**: zobrazit odhad, kdy se příkaz vyřídí („až se uvolní ~2 min"), a přesun
  priority (pole `priority` už existuje, `work.js:235`).
- **Prázdné stavy**: v „Práci"/„Postavách" doplnit odkaz na to, kde se to dělá
  (vzor: `panelMerchant`, `js/ui/merchant_panel.js:71-73`).

---

## 7. Návrh realizace po fázích

> Konvence: po každé fázi `check-globals.ps1` + `headless-smoke.js`, pak
> `feat:`/`fix:` commit a push na `main`.

| Fáze | Obsah | Soubory | Riziko |
|---|---|---|---|
| **M-A** opravy | M-01 (buy-gem), M-02/M-03 (množství do fronty a přiřazení), M-13 (dvojí obsluha), M-14a | `ui.js`, `trade.js`, `economy.js`, `work.js` | nízké |
| **M-B** kontrola množství | komponenta `qtyControl` + paměť hodnot + ±/×10/Max, `getQty()`, `craft(qty)`, odhad ETA u aktivit (M-04, M-11, M-12) | `ui.js`, `panels.js`, `trade.js`, `crafting.js`, `css/style.css` | střední |
| **M-C** kontext | fronta i v „Práci" + odznak na záložce, místo/ETA u úkolů, vysvětlivky (politika, expedice, směrnice, skupiny, riziko, log s časem) — M-07…M-10, K-01…K-09 | `panels.js`, `trade.js`, `ui.js` | nízké |
| **M-D** chytré nabídky | lepší kandidáti v modalu, cena přerušení, „poslat skupinu", doporučená družina u souboje, ETA fronty — §6 | `panels.js`, `ui.js`, `work.js` | střední |
| **M-E** výkon | `autoRefresh` jen při změně (signature/dirty flag) místo plného `innerHTML` každou sekundu | `ui.js` | střední |

**Doporučené pořadí:** M-A → M-C → M-B → M-D → M-E.
(M-A jsou rychlé opravy chyb, M-C je vidět okamžitě a nezasahuje logiku,
M-B a M-D mění chování ovládání, M-E je optimalizace, která M-B zčásti řeší.)

---

## 8. Testy a akceptační kritéria

Do `test/headless-smoke.js` (nebo nového `test/menu-smoke.js`) doplnit:
1. **Fronta drží množství:** `addOrder({activityId:'gather_stone', targetQty:50})`
   → `tickOrders()` → `state.tasks[0].targetQty === 50`.
2. **buy-gem:** `G.buyGem(sid, 'ruby')` odečte zlato a přidá `gem_ruby`; tlačítko
   bez handleru už v UI není (statická kontrola `data-action`).
3. **Mrtvé akce:** skript porovnávající `data-action` v `js/` proti obsluze v `ui.js`
   (přesně to odhalilo M-01) — vhodné přidat jako `scripts/check-actions.ps1`
   vedle `check-globals.ps1`.
4. **Politika:** panel obsahuje `desc` programu vybraného kandidáta.
5. **Expedice:** modal při 2 vybraných z 5 zobrazí „2/3–5" a cenu jídla.

**Akceptační kritéria fáze:**
- `scripts/check-globals.ps1` = 0 problémů (po každé fázi).
- `node test/headless-smoke.js` = OK, plus nové kontroly.
- Žádné tlačítko v menu bez obsluhy (statická kontrola).
- Zadané množství se nikdy „neztratí" — ani při překreslení, ani ve frontě.

---

## 9. Co nedělat

- Nezavádět build krok ani framework kvůli menu — stačí DOM a delegace, jak jsou.
- Nedělat z „Přiřadit hned" výchozí volbu (ruší práci); výchozí má být **fronta**.
- Nepřidávat nové záložky; problém není struktura (13 podzáložek stačí), ale obsah
  a vysvětlivky uvnitř nich.
