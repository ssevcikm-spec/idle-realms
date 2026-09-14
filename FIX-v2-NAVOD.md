# FIX-v2.sh — návod

Opravný skript pro 6 problémů nalezených v revizi repozitáře Idle Realms.

## Co opravuje

| # | Problém | Soubor |
|---|---|---|
| 1 | CSS useknutý v `.dbg-danger` | `css/style.css` |
| 2 | Legendárky nejsou v `G.EQUIPMENT` (pořadí scriptů) | `index.html`, `test/smoke.html` |
| 3 | `combatDeathChance` hardcoded 0.12 | `js/systems/combat.js` |
| 4a | `offlineCap` z obtížnosti se nepoužívá | `js/core/loop.js` |
| 4b | `xpMult` z obtížnosti se nepoužívá | `js/systems/units.js` |
| 5 | `bossesKilled` chybí v `ensureDefaults()` | `js/main.js` |
| 6 | `.patch-backup-*` složky v gitu | `.gitignore` + smazání |

## Postup (Termux)

### 1. Jdi do repa

```bash
cd ~/idle-realms
```

### 2. Zkopíruj `FIX-v2.sh` do kořene repa

Pokud máš soubor ve stažených:

```
cp /sdcard/Download/FIX-v2.sh .
```

### 3. Spusť skript

```
bash FIX-v2.sh
```

Uvidíš barevný výpis — každá položka `✓` znamená úspěch. Skript je **idempotentní**: když ho spustíš dvakrát, druhé spuštění jen napíše „již opraveno".

### 4. Ověř v prohlížeči

- `test/smoke.html` → musí být **zelené**
- `index.html` → nová hra, vyber **Hardcore**, jdi do boje, sleduj smrt (měla by být ~35 %)

### 5. Nahraj do gitu

```
git add -A
git status
git commit -m "fix: 6 oprav z revize (CSS, legendárky, obtížnost, gitignore)"
git push
```

## Pokud něco selže

**`python3: command not found`**
→ `pkg install python`

**Skript hlásí `✗ pattern nenalezen`**
→ Tvůj soubor se liší od očekávaného. Zkontroluj, jestli máš nejnovější commit:

```
git log -1 --oneline
```

Mělo by být `6c5f5d2` nebo novější.

**Hra po patchi nefunguje**
→ Obnov ze zálohy:

```
cp -r .fixv2-backup-*/* .
```

## Detailní popis oprav

### 1. CSS `.dbg-danger`

**Před:**

```
.dbg-danger { background: #6
```

**Po:**

```
.dbg-danger { background: linear-gradient(180deg, #8c3b2f, #6d2c23); color: #f5eeda; border-color: #8b6c2e; }
```

### 2. Pořadí scriptů

**Před:**

```
<script src="js/data/character.js"></script>
<script src="js/data/sets.js"></script>
<script src="js/data/gems.js"></script>
<script src="js/data/legendaries.js"></script>
```

**Po:**

```
<script src="js/data/legendaries.js"></script>
<script src="js/data/character.js"></script>
<script src="js/data/sets.js"></script>
<script src="js/data/gems.js"></script>
```

Důvod: `character.js` na konci obsahuje:

```
for (const lid in G.LEGENDARIES) {
  G.EQUIPMENT[lid] = Object.assign({...}, l);
}
```

`G.LEGENDARIES` musí být definováno **před** tímto cyklem, jinak se nic nestane a legendárky se nikdy nedostanou do `G.EQUIPMENT`.

### 3. Smrt v boji

**Před:**

```
if (G.chance(0.12) && !u._resurrected) G.die(u, 'padl v boji');
```

**Po:**

```
const deathChance = (G.currentDifficulty ? G.currentDifficulty().combatDeathChance : 0.12);
if (G.chance(deathChance) && !u._resurrected) G.die(u, 'padl v boji');
```

### 4. Offline cap + XP

**Před (`loop.js`):**

```
const total = Math.min(elapsedSeconds, OFFLINE_CAP_S);
```

**Po:**

```
const cap = (G.currentDifficulty ? G.currentDifficulty().offlineCap : OFFLINE_CAP_S);
const total = Math.min(elapsedSeconds, cap);
```

**Před (`units.js`):**

```
if (G.unlockXpMult) mult *= G.unlockXpMult();
amount *= mult;
```

**Po:**

```
if (G.unlockXpMult) mult *= G.unlockXpMult();
if (G.currentDifficulty) mult *= G.currentDifficulty().xpMult;
amount *= mult;
```

### 5. `bossesKilled` v ensureDefaults

Přidáno `'bossesKilled'` do pole, které se iteruje v `ensureDefaults()`.

### 6. `.gitignore`

Přidány vzory:

```
.patch-backup-*/
.fixv2-backup-*/
.cleanup-backup-*/
```

A smazány existující `.patch-backup-*` složky.

