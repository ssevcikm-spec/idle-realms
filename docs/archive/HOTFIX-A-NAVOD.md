# Hotfix A — birthTime + Intro obrazovka + Reset

## Co opravuje

1. **Kritický bug `birthTime`** — nové postavy měly fixní `birthTime = -20*AGE_YEAR`
   (= -6000 s), místo relativně k `state.time`. Po ~5 h hraní (nebo pár minutách
   v debug ×100) měly nové postavy 300+ let a **okamžitě umíraly stářím**.
2. **`repairAges()`** — najde existující stoleté postavy a opraví je.
3. **Intro obrazovka** — Pokračovat / Nová hra / Smazat uloženou hru.
4. **`?reset=1` URL handler** — nejjednodušší reset kdykoli odkudkoli.

## Soubory (8)

| Soubor | Typ |
|---|---|
| `js/ui/title_screen.js` | NOVÝ |
| `css/title_screen.css` | NOVÝ |
| `js/main.js` | přepsán (refactor bootu) |
| `js/systems/units.js` | upraven (`birthTime` fix) |
| `js/core/state.js` | upraven (`migrateSave` fix + `G.SAVE_KEYS`) |
| `js/systems/aging.js` | upraven (`repairAges`) |
| `index.html` | upraven (2 nové `<link>` / `<script>`) |
| `HOTFIX-A-NAVOD.md` | tento soubor |

## Instalace (Termux)

```bash
cd ~/idle-realms

# rozbal / nakopíruj soubory z tohoto balíčku do kořene repa
# (přepiš existující)

git add -A
git status                # zkontroluj, že vidíš 8 změn
git commit -m "fix: birthTime bug (postavy 300+ let) + intro obrazovka + ?reset=1"
git push
```

## Ověření

1. Otevři `test/smoke.html` → zelené
2. Otevři `index.html` → **uvidíš intro obrazovku**
3. Klikni **✨ Nová hra** → vyber obtížnost → hra začne
4. **Nech hru chvíli běžet** (klidně debug ×100) → najmout postavu:

- měla by mít **~20 let**, ne 300+
- měla by **žít**, ne okamžitě zemřít
5. Vrať se na intro (obnovit stránku) → uvidíš **Pokračovat** + info o savu

## Reset hry — tři způsoby

1. **Intro obrazovka** → tlačítko **🗑️ Smazat uloženou hru**
2. **URL** → `https://tvůj-web.pages.dev/?reset=1`
3. **Debug** → klávesa `D` → tlačítko Reset

Všechny tři smažou klíče `idleRealmSave_v2..v8` z `localStorage`.

## Co dělat, když něco selže

- Zkontroluj, že `index.html` má `<script src="js/ui/title_screen.js">` **před** `js/main.js`
- Zkontroluj, že `title_screen.css` je v `<head>` jako **poslední** `<link>`
- Pokud intro obrazovka nefunguje (bílá obrazovka), otevři DevTools Console →
uvidíš chybu → pošli mi ji

## Co následuje

**FIX-v4** (další krok, až budeš chtít) obsahuje:

- 5 odložených nálezů z FIX-v3 (`masteryMult`, `difficultyList`, `rollCraftQuality`, `reach`)
- 11 nálezů z revize ekonomiky (E3–E11)
- Případné další z oblastí 3–15 (postupně)

