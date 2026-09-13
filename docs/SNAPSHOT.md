# Snapshot — aktuální stav repozitáře

> **Datum:** 13. 9. 2026
> **Verze:** po Fázi 7 (schopnosti + synergie)
> **Účel:** Tento snapshot obsahuje **všechny soubory, které se změnily** od původního stavu.
> Stačí rozbalit ZIP do kořene repa a přepsat stávající soubory.

---

## Jak použít tento snapshot

1. Rozbal ZIP do kořene svého lokálního repa (`idle-realms/`).
2. Všechny soubory přepiš (jsou v aktuální verzi).
3. Zkontroluj: `pwsh -File scripts/verify-snapshot.ps1` (nebo `scripts/check-globals.ps1`).
4. Smoke test: otevři `test/smoke.html` v prohlížeči.
5. `git add -A && git commit -m "feat: snapshot po Fázi 7" && git push`.

**Co tento snapshot NEobsahuje:** soubory, které jsem nezměnil (`js/core/`, `js/render/`,
většina `js/systems/`, část `js/ui/`, `css/style.css`, atd.). Ty zůstávají ve tvém repu
beze změny.

---

## Seznam souborů v tomto snapshotu (20)

### Dokumentace (3)
| Soubor | Stav | Fáze |
|---|---|---|
| `docs/DESIGN_DOKUMENT.md` | nový (v1.0 → v3.0) | Fáze 6, 7 |
| `docs/ROADMAP_OBSAHU.md` | nový | Fáze 6 |
| `docs/SNAPSHOT.md` | nový (tento manifest) | — |

### HTML / CSS (2)
| Soubor | Co se změnilo | Fáze |
|---|---|---|
| `index.html` | 5 primárních tabů, sub-taby, `<script src="js/data/synergies.js">` | 4, 7 |
| `css/subtabs.css` | sub-taby + scrollable combat abilities | 4, 7 |

### Data — `js/data/` (4)
| Soubor | Co se změnilo | Fáze |
|---|---|---|
| `js/data/abilities.js` | 33 schopností (3 per dovednost: L3/L8/L15) | 7 |
| `js/data/combat.js` | 34 nepřátel + 6 bossů + ~35 abilities + elita | 6 |
| `js/data/progress.js` | 34 achievementů (bylo 22) | 5 |
| `js/data/synergies.js` | **nový** — 7 synergií | 7 |

### Systémy — `js/systems/` (8)
| Soubor | Co se změnilo | Fáze |
|---|---|---|
| `js/systems/abilities.js` | nové efekty: mark, cleanse, AoE poison, stun | 7 |
| `js/systems/autonomy.js` | materialNeed ×7, focusMaterial respektuje "dost", bez duplicit prestige | 1–2 |
| `js/systems/combat.js` | enemy ability AI, elita, boss enrage, smrt 12 % | 1–2, 6 |
| `js/systems/crafting.js` | synergy bonusy, sjednocená kvalita | 1–2, 7 |
| `js/systems/economy.js` | diminishing returns pro reputaci (`sqrt(qty)×2`) | 5 |
| `js/systems/expeditions.js` | jídlo jako náklad, výdrž ×0,7 při odchodu | 5 |
| `js/systems/politics.js` | fix: `electionsWon` se inkrementuje | 5 |
| `js/systems/work.js` | groupWorkMult per postava, `rollQualityWithBonus` | 1–2, 7 |

### UI — `js/ui/` (3)
| Soubor | Co se změnilo | Fáze |
|---|---|---|
| `js/ui/combat_modal.js` | tier ikony (✨ L8, 🌟 L15), status tagy, label 20 kol | 1–2, 7 |
| `js/ui/panels.js` | 5-tab navigace, synergie badge, ability tiers v kartě postavy | 4, 7 |
| `js/ui/ui.js` | sub-tab routing, `<details>` state, confirm dialogy, heal-all fix | 1–2, 4 |

### Skripty (1)
| Soubor | Co se změnilo | Fáze |
|---|---|---|
| `scripts/verify-snapshot.ps1` | **nový** — ověří, že repo má očekávané soubory | — |

---

## Klíčové herní změny (souhrn všech fází)

**Fáze 1–2 (bugy + balance):**
- Opraven `groupWorkMult` (multiplikace)
- Sjednocená kvalita výroby
- Masterwork dosažitelný (skill ×1,1, práh 100)
- Šance na smrt v boji 25 % → 12 %
- `<details>` elementy se nezavírají každou sekundu

**Fáze 3–4 (UX + navigace):**
- 5 primárních tabů (Svět, Lidé, Řemeslo, Obchod, Více) + sub-taby
- Confirm dialogy u destruktivních akcí
- `doHealAll` hledá nejbližší sídlo

**Fáze 5 (expedice, rep, cíle):**
- Expedice vyžadují jídlo (0,5× / postava / den)
- Diminishing returns pro reputaci z obchodu
- 34 achievementů (bylo 22)

**Fáze 6 (nepřátelé):**
- 34 nepřátel (bylo 15), ~35 abilities, 6 bossů
- Elitní varianta (⭐), boss enrage

**Fáze 7 (schopnosti + synergie):**
- 33 schopností hráče (bylo 11)
- 7 synergií (kombinace dvou dovedností na L10+)
- Nové efekty: mark, cleanse, AoE poison, stun

---

## Workflow do budoucna

Od Fáze 8 budu vždy posílat **kompletní snapshot** (všechny změněné soubory), nikoli
přírůstkové patche. To znamená, že po každé iteraci dostaneš jeden ZIP a stačí
rozbalit + přepsat.

Pro ověření můžeš kdykoli spustit:
```powershell
pwsh -File scripts/verify-snapshot.ps1
# nebo
powershell.exe -ExecutionPolicy Bypass -File scripts/verify-snapshot.ps1
```

