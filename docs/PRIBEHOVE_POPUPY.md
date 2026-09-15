# Příběhové popupy — co jsou, k čemu jsou a co se s nimi stalo

> **Datum:** 2026-09-15
> **Otázka:** „Vyskakují mi příběhové popupy, co jsou zač a k čemu jsou?
> Přijde mi, že nic nedělají. Jsou nezbytné?"

---

## 1. Co to je

Jsou to **příběhové kvesty** (`G.STORY_QUESTS`, `js/data/progress.js:36-73`).
Sedm jednorázových momentů, které se ptají hráče na strategické rozhodnutí:

| # | Kvest | Kdy se objeví | Na co se ptá |
|---|---|---|---|
| 1 | Neznámý poutník | po 2 min hry | jaký má být plán (osada / obchod / válka) |
| 2 | Zpráva z hor | 10 min + hornictví 3 | jít hledat ztracené horníky, nebo ne |
| 3 | Volání lesa | reputace Bratrstva 10 | přísahat lesu, nebo zůstat neutrální |
| 4 | Kupecká výzva | 4 postavy + 200 🪙 | vyslat obchodníka |
| 5 | Stíny v jeskyni | boj 5 | vyčistit jeskyni, nebo ji zapečetit |
| 6 | Rada starších | 2 frakce nad 30 rep | komu přísahat věrnost |
| 7 | Nový začátek | prestiž 1 / renomé 100 | uzavření první kapitoly |

**Nejsou to staré náhodné popup události.** Ty byly ve Fázi 0 plánu hratelnosti
(`docs/PLAN_HRATELNOST.md`) vypnuté (`G.EVENTS_ENABLED = false`) proto, že byly
globální, náhodné a bez subjektu. Příběh byl ponechán záměrně — je to jediné
místo, kde hra chce po hráči rozhodnutí, ne jen taktiku.

Spouští je `G.tickStory` (`js/systems/events.js`) — kontrola každých 10 s herního
času, vždy nejvýš jeden otevřený popup, hra se u něj pozastaví.

---

## 2. Proč to vypadalo, že nic nedělá

Byly to **tři reálné problémy**:

1. **Zpětná vazba šla do logu, ne před oči.** Efekty se zapisovaly přes `G.log`,
   jenže log je schovaný v záložce *Více → Log*. Hráč tedy kliknul, popup zmizel
   a nic se „nestalo" — přitom se přičetlo renomé, materiál nebo reputace.
2. **Část voleb nedělala vůbec nic.** `set_flag` zapsal rozhodnutí do
   `state.story.flags`, ale **tenhle objekt nikdo nikdy nečetl** (ověřeno `grep`em
   na `flags` — jen zápisy, žádné čtení). Volby „Postavit osadu", „Přísahat lesu",
   „Zapečetit jeskyni" tedy měly nulový herní dopad.
3. **Nebyl vidět obsah volby předem.** Tlačítka ukazovala jen text odpovědi, ne
   co z ní plyne.

---

## 3. Co je opravené

**a) Viditelná zpětná vazba (toast).** Po každé volbě se objeví plovoucí hláška
s tím, co se právě stalo, například:

> 📖 Zpráva z hor: Vyslat skupinu hledat. — −2× 🍞 Chléb • +8× ⛏️ Železná ruda • +4 ⭐ • +8 reputace (Hornický cech)

Do logu se zapisuje stejná věta (kategorie `story`).

**b) Náhled efektů u každé volby.** Tlačítka v popupu teď nesou druhý řádek
s tím, co volba dá nebo vezme — včetně trvalého efektu
(např. `trvale: 🏕️ základna už při renomé 20 (místo 25)`).

**c) Volby mají skutečné trvalé následky.** `story.flags` se konečně čte
(`G.storyFlag`), a to na těchto místech:

| Volba | Trvalý efekt | Kde se projeví |
|---|---|---|
| `plan: base` | 🏕️ základna už při renomé **20** (místo 25) | `G.baseUnlockRenown` (`autonomy.js`, `base_panel.js`) |
| `plan: trade` | ⚖️ prodejní ceny **+8 %** | `G.priceAt` (`economy.js`) |
| `plan: war` | ⚔️ bojová síla postav **+10 %** | `G.unitCombatPower` (`units.js`) |
| `allegiance: crown` | 👑 zisky reputace u Koruny **+25 %** | `G.addRep` (`economy.js`) |
| `allegiance: free` | 🌲 zisky reputace u Bratrstva a cechu **+25 %** | `G.addRep` |
| `allegiance: independent` | ⚖️ ztráty reputace **poloviční** | `G.addRep` |
| `oath: forest` | 🌿 **+1 bylina** z každého sběru | `grantOutput` (`work.js`) |
| `cave_cleared` | 💎 **+1 krystal** z těžby krystalu | `grantOutput` |
| `cave_sealed` | 🪨 nebezpečí v jeskyních **−40 %** | `checkDanger` (`combat.js`) |
| `merchant_unlocked`, `chapter1_done` | jen záznam v deníku příběhu | — |

**d) Přehled příběhu.** V *Více → Cíle* je sekce **Příběh**, která u hotových
kvestů ukazuje, **jak jsi se rozhodl** (`zpět do hry` / `„Přísahat lesu."`) a jaký
z toho plyne trvalý efekt.

**e) Dá se to vypnout.** V menu (☰) je přepínač **„Příběhové popupy"**
(`settings.storyPopups`). Když je vypneš, `tickStory` nic nespustí a příběh se
přeskočí; hotové kvesty zůstávají v přehledu.

**f) Menu už neshodí rozevřený popup.** Když otevřeš ☰ během příběhu (nebo
souboje), po zavření menu se původní modal **vrátí** — dřív zůstal příběh
ztracený a hra zůstala pozastavená.

---

## 4. Jsou nezbytné?

**Nejsou povinné — ale mají smysl, když je vidět, co dělají.** Doporučení:

- **Nechat zapnuté** — jsou jediné hráčské rozhodnutí ve hře a po opravě už
  mění čísla i dlouhodobé směřování (základna dřív, lepší ceny, silnější boj,
  vztahy s frakcemi).
- Když tě přerušování ruší (např. při dlouhém idle běhu), **vypni je v menu ☰**;
  hra tím o nic jiného nepřijde.
- Co v příběhu **záměrně nemá** mechanický dopad: `merchant_unlocked`
  a `chapter1_done` — jsou to záznamy do přehledu, ne odměny.

---

## 5. Testy

`test/headless-smoke.js` (celkem 37 kontrol) nově ověřuje:
- `G.storyEffectText` umí popsat odměnu i trvalý efekt volby;
- `G.tickStory` otevře popup s náhledem efektů, `G.resolveStory` zapíše volbu
  (`story.choices`), dokončení, vlajku i odměnu a popup zavře;
- `settings.storyPopups = false` popupy opravdu potlačí a zapnutí je vrátí;
- trvalé efekty skutečně mění hru (prodejní ceny, bojová síla, ztráty reputace).
