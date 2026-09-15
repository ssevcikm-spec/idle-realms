# verify-snapshot.ps1 - overi, ze repo obsahuje klicove soubory a funkce (Faze 7)
#
# Pouziti:
#   pwsh -File scripts/verify-snapshot.ps1
#   powershell.exe -ExecutionPolicy Bypass -File scripts/verify-snapshot.ps1
#
# Zkontroluje:
#   1) ocekavane soubory existuji
#   2) index.html odkazuje na synergies.js / subtabs.css / 5-tab navigaci
#   3) klicove funkce jsou definovane
#   4) pocet JS souboru

param([string]$Root = (Get-Location).Path)

$ErrorActionPreference = 'Stop'
$Root = (Resolve-Path $Root).Path
$missing = @()
$problems = @()

Write-Host ""
Write-Host "=== Idle Realm - verify snapshot ===" -ForegroundColor Cyan
Write-Host "Root: $Root"
Write-Host ""

# ---------- 1) ocekavane soubory ----------
$expected = @(
  'index.html',
  'css/subtabs.css',
  'js/data/abilities.js',
  'js/data/combat.js',
  'js/data/progress.js',
  'js/data/synergies.js',
  'js/systems/abilities.js',
  'js/systems/autonomy.js',
  'js/systems/combat.js',
  'js/systems/crafting.js',
  'js/systems/economy.js',
  'js/systems/expeditions.js',
  'js/systems/politics.js',
  'js/systems/work.js',
  'js/ui/combat_modal.js',
  'js/ui/panels.js',
  'js/ui/ui.js'
)
foreach ($f in $expected) {
  if (-not (Test-Path (Join-Path $Root $f))) { $missing += $f }
}

# ---------- 2) index.html odkazy ----------
$htmlPath = Join-Path $Root 'index.html'
if (Test-Path $htmlPath) {
  $html = Get-Content -Raw $htmlPath
  if ($html -notmatch 'synergies.js') { $problems += 'index.html neodkazuje na js/data/synergies.js' }
  if ($html -notmatch 'subtabs.css') { $problems += 'index.html neodkazuje na css/subtabs.css' }
  if ($html -notmatch 'data-tab="world"') { $problems += 'index.html nema 5-tab navigaci (chybi data-tab="world")' }
}

# ---------- 3) klicove funkce ----------
$functionChecks = @(
  @{ file='js/systems/work.js';        pattern='G\.rollQualityWithBonus\s*=';  desc='G.rollQualityWithBonus' },
  @{ file='js/data/synergies.js';      pattern='G\.synergyBonus\s*=';          desc='G.synergyBonus' },
  @{ file='js/data/synergies.js';      pattern='G\.activeSynergies\s*=';       desc='G.activeSynergies' },
  @{ file='js/systems/combat.js';      pattern='BOSS_SPAWN_CHANCE';            desc='Boss spawn' },
  @{ file='js/systems/expeditions.js'; pattern='EXPEDITION_FOOD_PER_UNIT_PER_DAY'; desc='Expedice jidlo' }
)
foreach ($c in $functionChecks) {
  $p = Join-Path $Root $c.file
  if (-not (Test-Path $p)) { continue }
  if ((Get-Content -Raw $p) -notmatch $c.pattern) { $problems += ("V " + $c.file + " chybi " + $c.desc) }
}

# ---------- 4) pocet JS souboru ----------
$jsDir = Join-Path $Root 'js'
if (Test-Path $jsDir) {
  $files = Get-ChildItem -Recurse -File -Path $jsDir -Filter *.js
  Write-Host ("JS souboru celkem: " + $files.Count)
}

# ---------- Summary ----------
Write-Host ""
if ($missing.Count -gt 0) {
  Write-Host ("CHYBI SOUBORY (" + $missing.Count + "):") -ForegroundColor Red
  $missing | ForEach-Object { Write-Host ("  x " + $_) -ForegroundColor Red }
}
if ($problems.Count -gt 0) {
  Write-Host ""
  Write-Host ("PROBLEMY (" + $problems.Count + "):") -ForegroundColor Yellow
  $problems | ForEach-Object { Write-Host ("  ! " + $_) -ForegroundColor Yellow }
}
if ($missing.Count -eq 0 -and $problems.Count -eq 0) {
  Write-Host "OK - snapshot je kompletni" -ForegroundColor Green
  exit 0
} else {
  Write-Host "Snapshot NENI kompletni. Zkontroluj chybejici soubory a problemy vyse." -ForegroundColor Red
  exit 1
}
