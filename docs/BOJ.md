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
| **⚔️ Bojovat** na uzlu | na každém uzlu, kde se vyskytují nepřátelé (`ENCOUNTER_TABLE`) — nově nejen v dolech/jeskyních |
| **Práce na nebezpečném uzlu** | každé 3 s je šance na **přepadení** (nebezpečí 2+) nebo zranění; v divočině (nebezpečí 1) je nově taky malá šance na souboj |
| Příběh / událost | občas spustí souboj |

Nepřátelé se vybírají podle **typu uzlu** (`ENCOUNTER_TABLE`) a síla se přizpůsobí
tvým postavám.

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
- **Schopnosti se používají samy** ve výchozím stavu.
- **Bojovat jde na každém uzlu s nepřáteli** (předtím jen na nebezpečí 2+, tedy
  dolech a jeskyních — zvěř v lese nešla lovit vůbec).
- **Divočina (nebezpečí 1) umí vyvolat přepadení** při práci, ne jen zranit.
- **Postup u kill a explore zakázek** je vidět v panelu („2/3").
- **Explore text i logika sedí** — počítá sídla, ne uzly.
- Jednotné místo „jde odevzdat?" (`G.canTurnInQuest`) teď hlídá i materiály
  u explore zakázek (např. relikvie potřebuje krystaly).

## 6. Testy

`test/headless-smoke.js` (celkem 47 kontrol) nově ověřuje:
- `G.questKillProgress` počítá zabití od přijetí a `G.canTurnInQuest` uvolní
  odevzdání až po 3/3,
- `G.killTypeLabel` překládá typy,
- uzel hlubokého lesa nabízí tlačítko „Bojovat".
