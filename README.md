# Idle Realm

Idle RPG se správou skupin, ekonomikou, bojem a živým světem.

## Spuštění
Otevři `index.html` v prohlížeči. Nebo `python3 -m http.server 8000`.

## Funkce

- **Postavy** — atributy, dovednosti, výstroj, zranění, výdrž, **nálada**, **osobnost** (5 os), **ambice**, vztahy, povolání, perky, učednictví
- **Skupiny** — role (Vůdce, Zásobovač, Ranhojič, Průzkumník, Bojovník), chemie
- **Boj** — statistiky, kola, taktika, nepřátelé podle regionů
- **Obchodník** — postava cestující mezi sídly, prodává přebytky, buduje vztahy
- **Výroba** — dílny ve městech, produkční řetězce, kvalita
- **Ekonomika** — dynamické ceny, specializace, budovy, zakázky, frakce
- **Svět** — karavany, světové události, příběhové kvesty, dropy
- **Meta** — prestiž, 22 achievementů, základna

## Ovládání
- Tažení — pohyb mapou
- Ťuknutí — výběr uzlu / sídla / základny
- **Klávesa D** — debug

## Vývoj (git)

- Repozitář: `https://github.com/ssevcikm-spec/idle-realms.git` (privátní)
- Větev: `main`
- Konvence commitů: Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`)

```bash
git clone https://github.com/ssevcikm-spec/idle-realms.git
cd idle-realms
# po změnách
git add -A
git commit -m "feat: popis změny"
git push
```

Architektura: vanilla JS, globální `window.Game`, IIFE moduly načítané v `index.html`
v pevném pořadí. Více v `docs/TECHNICKY_DOKUMENT.md`.

## Testy a kontroly

Statická kontrola konzistence (chybějící globály, odkazy v `index.html`, tick funkce, TODO):

```bash
powershell.exe -ExecutionPolicy Bypass -File scripts/check-globals.ps1
# nebo (PowerShell 7)
pwsh -File scripts/check-globals.ps1
```

Smoke test — otevři v prohlížeči (ověří boot, práci, tick a save/load):

```
test/smoke.html
```

## Licence
MIT.
