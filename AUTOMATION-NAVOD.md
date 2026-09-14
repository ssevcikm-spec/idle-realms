# Automatizace workflow — Idle Realms

Zkrácení pracovního postupu z 8 kroků na 1.

## Předpoklad

```bash
pkg install -y nodejs unzip termux-api git
termux-setup-storage
```

## Instalace (jednorázová)

```
cd ~/idle-realms
bash scripts/ir-setup.sh
source ~/.bashrc
```

## Denní workflow

### Varianta A — Termux (1 příkaz)

1. V prohlížeči stáhni ZIP z Better DeepSeek
2. V Termuxu:

```
ir-apply "fix: stručný popis, co je v
```

### Varianta B — Home screen widget (1 tap)

1. Nainstaluj **Termux:Widget** z F-Droidu / Play Store
2. Nainstaluj **Termux:API** (Termux: `pkg install termux-api`)
3. Dlouhý tap na plochu → **Widgets** → **Termux:Widget** → přidej
4. Ťukni na widget → vyber **ir-apply**

## Co `ir-apply` dělá

| Krok ↕▾ | Akce ↕▾ |
|---|---|
| −1 | Najde nejnovější `better-deepseek-*.zip` v `~/storage/downloads/` nebo `/sdcard/Download/` |
| −2 | Rozbalí ho do `~/idle-realms/` (přepíše existující) |
| −3 | Projde nové/změněné `.js` soubory a zkontroluje syntax (`node --check`) |
| −4 | Pokud je syntax OK, provede `git add -A` a `git commit -m "<zpráva>"` |
| −5 | Provede `git push` |
| −6 | Cloudflare automaticky nasadí změny (~1 min) |
⚙

Pokud syntax selže, **commit se neprovede** — dostaneš výpis chyb.

## Pre-commit hook (bezpečnostní síť)

Po instalaci se aktivuje hook, který **při každém `git commit`** zkontroluje syntax
všech změněných `.js` souborů. Když najde chybu, commit zablokuje.

Přeskočení: `git commit --no-verify` (nedoporučuji).

## Aliasy (volitelné)

Přidej do `~/.bashrc`:

```
alias ir='cd ~/idle-realms'
alias irstat='cd ~/idle-realms && git log -3 --oneline'
alias irls='ls -lt ~/storage/downloads/better-deepseek-*.zip 2>/dev/null | head -5'
alias irlocal='cd ~/idle-realms && python3 -m http.server 8000'
```

Pak:

- `ir` — jdi do repa
- `irstat` — poslední 3 commity
- `irls` — nejnovější ZIPy
- `irlocal` — spustí lokální server na `http://localhost:8000`

## Řešení problémů

| Problém ↕▾ | Řešení ↕▾ |
|---|---|
| −`ir-apply: command not found` | `source ~/.bashrc` (nebo restartuj Termux) |
| −`Žádný better-deepseek-*.zip nenalezen` | Zkontroluj, že ZIP je v `~/storage/downloads/`; spusť `termux-setup-storage` |
| −`unzip: command not found` | `pkg install unzip` |
| −`node: command not found` | `pkg install nodejs` |
| −`git push` chce heslo | Použij **Personal Access Token** (nastav v `~/.git-credentials` nebo `git config credential.helper store`) |
| −Widget nic nedělá | Zkontroluj, že Termux:Widget má povolení a že skript je v `~/.shortcuts/` |
⚙

## Budoucí vylepšení (Level 2)

- **Auto-detect** — watch script, který po stažení ZIPu sám spustí `ir-apply`
- **GitHub Actions** — automatický smoke test po push
- **Telegram bot** — push notifikace o výsledku

