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
- **Svět** — karavany, světové události, příběhové kvesty, dropy, expedice, politika
- **Obsah** — 33 schopností, 34 nepřátel + 6 bossů, sety, gemy, legendárky, synergie
- **Obtížnosti** — Relax / Normální / Hardcore (ovlivňují smrt, offline, XP)
- **Meta** — prestiž, 34 achievementů, základna, endgame, tutoriál

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

Statická kontrola ovládacích prvků UI (každé `data-action` / `data-change` musí mít
obsluhu v `js/ui/ui.js` — odhalí mrtvá tlačítka):

```bash
powershell.exe -ExecutionPolicy Bypass -File scripts/check-actions.ps1
```

Headless smoke test (spustí hru bez prohlížeče přes Node — 30 kontrol, deterministicky):

```bash
node test/headless-smoke.js
```

Smoke test v prohlížeči (rozšířený, 31 kontrol):

```
test/smoke.html
```

## Licence
MIT.
