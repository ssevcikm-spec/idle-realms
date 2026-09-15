# CLEANUP.sh — návod

## Co tento skript řeší

Když jsi spustil `PATCH.sh` **dvakrát** (jednou v každém balíčku), vytvořily se duplikáty v 7 souborech. Jeden z nich je **fatální syntax error** v `js/systems/combat.js` — celý soubor se v prohlížeči odmítne načíst, což znamená, že **boj ve hře úplně přestal fungovat**.

Tento skript to vyčistí. Používá přesné string matching, takže pokud už něco bylo opravené ručně, nic nerozbije.

## Postup (Termux)

```bash
cd ~/idle-realms
unzip -o /sdcard/Download/idle-realms-cleanup.zip
bash CLEANUP.sh
```

Skript:

1. Zálohuje 7 dotčených souborů do `.cleanup-backup-TIMESTAMP/`
2. Vyčistí duplikáty (Python skript s přesnými stringy)
3. Provede `node --check` na každém opraveném JS souboru
4. Vypíše commit příkaz

## Co se opraví

| Soubor | Problém | Dopad |
|---|---|---|
| `js/systems/combat.js` | `const tplQ` dvakrát ve stejném scope | **SyntaxError → boj úplně rozbitý** |
| `js/systems/units.js` | xpBonus loop ×2 (1.25² = +56 % místo +25 %), `recordKill` ×2 | Rozbitý balance |
| `js/core/state.js` | `bossesKilled: 0, bossesKilled: 0`, migrateSave blok ×2 | Redundance |
| `js/main.js` | nested if-else s mrtvým kódem | Redundance, matoucí |
| `js/ui/ui.js` | 3× G.show* modal, 4× do* funkce | Redundance |
| `js/data/combat.js` | `grove`/`meadow` v BOSS_TABLE ×2 | Redundance |
| `css/style.css` | Celý TUTORIÁL + DIFFICULTY + VICTORY blok ×2 | Redundance |

## Ověření

Po spuštění:

1. **`test/smoke.html`** → musí být **zelené** (všech 31 testů)
2. **`index.html`** → vyzkoušej:

- Klepni na červený uzel (nebezpečný) → tlačítko „⚔️ Zaútočit"
- Měl by se otevřít bojový modal a jít odehrát kolo

Pokud boj funguje, je oprava úspěšná.

## Pokud něco selže

**`node --check` hlásí FAIL** → syntax error zůstal. Skript ti to řekne a nabídne obnovu ze zálohy:

```
cp -r .cleanup-backup-*/* .
```

**Cokoli jiného** → pošli mi výstup z `bash CLEANUP.sh` a mrkneme na to.

## Pak commit

```
echo ".cleanup-backup-*/" >> .gitignore
git add -A
git commit -m "fix: odstranění duplikátů z dvojího PATCH.sh + syntax fix combat.js"
git push
```

## Proč se to stalo

`PATCH.sh` z prvního balíčku byl určen k jednorázovému spuštění. Když byl aplikován dvakrát (jednou v každém balíčku), `str.replace(old, new, 1)` nahradil jen **první výskyt**, ale protože `new` obsahoval i `old`, druhý běh přidal **druhou kopii**. Tento cleanup je defenzivní: používá `find` + `find` na druhý výskyt a bezpečně ho odstraní.

Do budoucna: PATCH skripty by měly být **idempotentní** — pokud už byly aplikovány, podruhé nic nezmění. To je práce na později.

