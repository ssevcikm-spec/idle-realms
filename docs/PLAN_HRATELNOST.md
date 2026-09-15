# Plán: Hratelnost — řízení postav, fronta úkolů a osobní události

> Cíl: dát hráči **intuitivní kontrolu** (zadat úkol i když jsou postavy zaměstnané)
> a **srozumitelný kontext** (vědět, kdo/co/kde se děje) — v duchu „idle hra, kterou vedu".

---

## 0. Fáze 0 — okamžitě vypnout náhodné popup události

Současné události nemají význam (globální, náhodné, přerušující) → **vypnout**,
než je přepracujeme.

- `js/systems/events.js` → `G.tickEvents`: guard `if (!G.EVENTS_ENABLED) return;`
- `G.EVENTS_ENABLED = false` (snadno zpět zapnout).
- **Ponechat:** WORLD_EVENTS (sucho/svátek — modifikátory v liště, nepopupují)
  a STORY_QUESTS (příběh je záměrný). Vypínáme **jen náhodné popup události**.

---

## 1. Význam událostí — koncept (nový)

**Problém:** události jsou globální („jste potkali…"), spouští je časovač, každá pauzne hru, nic nerozvíjí.

**Návrh:** událost = **osobní moment konkrétní postavy**, vychází z toho, co dělá, a **rozvíjí ji**.

| # | Typ | Rozhoduje | Příklad | Dopad |
|---|---|---|---|---|
| 1 | **Nález** | postava (auto) | „Aldo při těžbě narazil na žílu krystalu." | materiál + deník |
| 2 | **Osobní rozvoj** | postava (auto) | „Bram se rozhodl stát kovářem." | trait / ambice |
| 3 | **Vztahový moment** | postava (auto) | „Cira pomohla Aldovi." | změna vztahu |
| 4 | **Krize** | auto → **boj s tou postavou na tom místě** | „Vlk přepadl Alda v Hlubokém lese." | boj / zranění |
| 5 | **Morální volba** | **hráč** (kontext) | „Zraněné zvíře. Co s ním?" | odměna / renomé |
| 6 | **Velká příležitost** | **hráč** (kontext, vzácné) | „Karavana nabízí artefakt." | strategický zisk |

**Principy:**
1. **Vzniká z činnosti, ne z časovače** — dokončený úkol, vstup do regionu, level up, změna nálady.
2. **Většina se odehraje sama** → zápis do deníku postavy. Hráč **sleduje příběh**.
3. **Hráč rozhoduje jen u velkých věcí** → prompt s plným kontextem (kdo/kde/proč).
4. **Rozvíjí postavu** → trait, ambice, vztah, dovednost, nálada.

**Propojení:** osobnost (jak se rozhodne) · ambice (posun cíle) · vztahy · deník (záznam).

---

## 2. Diagnóza současného stavu

### 2.1 Skupiny a role
- Postava patří do **max. jedné skupiny** (`u.groupId`), může být i bez.
- Skupina má `focus` → členové společně pracují. Role (`autoAssignRoles`):

| Role | Bonus |
|---|---|
| 👑 Vůdce | +10 % produktivita |
| 📦 Zásobovač | −30 % jídla |
| ⚕️ Ranhojič | +50 % hojení |
| 🧭 Průzkumník | −25 % nebezpečí |
| ⚔️ Bojovník | +30 % boj |
| ⚖️ Obchodník | karavany |

- **Chemie** = průměr vztahů → násobič.
- **Závěr:** skupiny nejsou povinné, ale výhodné. Drží pohromadě přes `focus` + role + chemii.

### 2.2 Boj
- Tahový (`combatRound`), pořadí podle rychlosti, dokud jedna strana nepadne.
- **Při práci** (`checkDanger`) ✅ správně — bojují postavy na tom uzlu.
- **Z události** 🐛 chyba — bere **všechny** postavy a **náhodný** uzel.

### 2.3 Události
- `EVENTS` = globální šablony bez subjektu/místa; `tickEvents` je spouští časovačem; každá pauzne hru.
- Deník (`G.addJournal`) už existuje → využijeme pro auto-rozhodnutí.

---

## 3. Návrh

### 3.1 Hierarchie řízení: hráč → fronta → skupina/postava
```
HRÁČ ── příkaz (aktivita + cíl: kdokoli / skupina / postava)
  └─ FRONTA PŘÍKAZŮ (G.state.orders[])
      └─ SCHEDULER (tickAutonomy, každé 2 s)
          ├─ skupina má volné členy? → přiřaď nejvhodnější příkaz
          └─ volná postava bez skupiny? → přiřaď
              └─ ÚKOL (současný model)
```
`focus` = trvalá směrnice; `order` = jednorázový příkaz. Koexistují.

### 3.2 Model příkazu
```js
{ id, activityId, targetType:'any'|'group'|'unit', targetId,
  nodeId|null, targetQty, priority:0, createdAt }
```

### 3.3 Start nikdy neselže tiše
`doStartTask` (`js/ui/ui.js`): volné postavy → přiřaď; žádné → **volba**:
- **Přiřadit hned** → kandidáti seřazení podle vzdálenosti + zbývající práce (přeruší se jim úkol)
- **Zařadit do fronty** → `G.state.orders[]`
- **Zrušit**

### 3.4 Kontextové události
Instance ponese `{ subjectUnitId, groupId, nodeId, settlementId, activityId }`;
texty s placeholdery (`{unit}`, `{place}`); `G.startEvent(templateId, context)`.

### 3.5 Kdo rozhoduje
`decision: 'player' | 'character'`:
- **player** → modal s kontextem, pauza (jen velké věci).
- **character** → postava se rozhodne (osobnost/ambice), zápis do **deníku** + logu.

### 3.6 Oprava boje z událostí
`applyEffects` (typ `combat`) použije **kontext**: bojují postavy z kontextu na uzlu z kontextu.

---

## 4. Co NEimplementovat
**Plán postavy (2 sloty)** — odloženo. Fronta příkazů dá 90 % přínosu bez složitosti.

---

## 5. Implementační fáze

| Fáze | Co | Soubory |
|---|---|---|
| **0** | Vypnout náhodné popup události | `js/systems/events.js` |
| **1** | Události → osobní momenty (kontext, auto/prompt, deník, oprava boje) | `events.js`, `journal.js`, `panels.js`, `state.js` |
| **2** | Fronta příkazů + scheduler + volba při Startu | `state.js`, `work.js`, `autonomy.js`, `ui.js`, `panels.js` |
| **3** | UI polish (filtr logu, panel fronty) | `panels.js`, `ui.js` |

---

## 6. Testování a akceptační kritéria

- `scripts/check-globals.ps1` = **0 problémů** po každé fázi.
- `node test/headless-smoke.js` rozšířit (příkaz → fronta → přiřazení; kontextová událost).
- **Kritéria:**
  1. Události se teď **nezobrazují** (Fáze 0).
  2. Start bez volných postav → **volba** (přiřadit/zařadit), ne ticho.
  3. Příkaz ve frontě → autonomie ho vezme, jak se postava uvolní (vidím v UI).
  4. Událost řekne **koho a kde** se týká; boj proběhne **s nimi tam**.
  5. Běžná událost **nepauzne** — zapíše se do deníku postavy.
- Migrace savu (`orders`), defenzivní guards, po každé fázi commit + test.
