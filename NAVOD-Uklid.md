# Návod — one-click úklid repozitáře (mobil / Termux)

## Co tento návod řeší

Při nahrávání ZIPů se ti omylem vytvořily **duplikáty** ve složkách `scripts/` a `js/`, a **stará verze** `autonomy.js` zůstala v `js/systems/`. Tento návod ti to spraví jedním skriptem.

## Krok za krokem (Termux)

### 1. Otevři Termux a jdi do repa

```bash
cd ~/idle-realms
```

(Pokud máš repo jinde, uprav cestu — např. `cd /sdcard/idle-realms`.)

Ověř, že jsi na správném místě:

```
ls
```

Měl bys vidět: `index.html`, `js`, `scripts`, `docs`, `css`, `test`.

### 2. Zkopíruj skript do repa

Pokud už máš `uklid-repa.sh` v kořeni repa (protože jsi rozbalil ZIP), přeskoč na krok 3.

Jinak:

```
cp /sdcard/Download/uklid-repa.sh .
```

### 3. Spusť skript

```
sh uklid-repa.sh
```

### 4. Potvrď

Skript se zeptá `Pokračovat? (a/n):`. Napiš `a` a zmáčkni Enter.

### 5. Hotovo

Skript:

- Smaže duplikáty
- Nahradí `autonomy.js`
- Vypíše, co udělal

### 6. Nahraj do gitu

Ve stejném Termuxu:

```
git add -A
git commit -m "chore: úklid duplikátů a oprava autonomy.js"
git push
```

(Pokud `git push` chce heslo, použij Personal Access Token z GitHubu.)

### 7. Ověř

Zkontroluj, že v `scripts/` máš jen dva soubory:

```
ls scripts/
```

Mělo by vypsat:

```
check-globals.ps1  verify-snapshot.ps1
```

---

## Co když něco nefunguje?

**„CHYBA: Tato složka nevypadá jako repo Idle Realms"**
→ Skript spouštíš ve špatné složce. Ujisti se, že jsi v `idle-realms/` (kde je `index.html`).

**`sh: uklid-repa.sh: No such file or directory`**
→ Skript není v aktuální složce. Zkontroluj `ls` — měl bys vidět `uklid-repa.sh`.

**„git: command not found"**
→ Nainstaluj git v Termuxu: `pkg install git`

**„Permission denied"**
→ Zkus `chmod +x uklid-repa.sh` a pak `./uklid-repa.sh`.

**Něco jiného?**
→ Pošli mi výpis z Termuxu, co vidíš, a pomůžu.

---

## Proč se to stalo?

Když rozbalíš ZIP, ve kterém jsou soubory ve struktuře `js/data/abilities.js`, `docs/SNAPSHOT.md`, atd., a rozbalíš ho **do podsložky** místo do kořene repa, vytvoří se ti duplikáty. Vždy rozbaluj ZIP **do kořene repa** (`idle-realms/`), ne do `scripts/` ani `js/`.

## Jak to nedělat příště

- ZIP vždy rozbal do **kořene** repa (tam, kde je `index.html`)
- Po rozbalení zkontroluj, že v `scripts/` máš **jen** `check-globals.ps1` a `verify-snapshot.ps1`
- Pokud ZIP obsahuje `docs/`, `js/`, `css/`, měly by se sloučit s existujícími, ne vytvořit `docs/docs/`

