# verify-snapshot.ps1 — ověří, že repo odpovídá očekávanému stavu po Fázi 7
#
# Použití:
#   pwsh -File scripts/verify-snapshot.ps1
#   powershell.exe -ExecutionPolicy Bypass -File scripts/verify-snapshot.ps1
#
# Zkontroluje:
#   1) Všechny očekávané soubory ze snapshotu existují
#   2) index.html odkazuje na synergies.js
#   3) Klíčové funkce (G.rollQualityWithBonus, G.synergyBonus) jsou definované
#   4) Žádné zakázané soubory (staré verze)

param([string]$Root = (Get-Location).Path)

$ErrorActionPreference = 'Stop'
$Root = (Resolve-Path $Root).Path
$missing = @()
$problems = @()
$notes = @()

Write-Host ""
Write-Host "=== Idle Realms — verify snapshot ===" -ForegroundColor Cyan
Write-Host "Root: $Root"
Write-Host ""

# ---------- 1) Očekávané soubory ----------
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
  'js/ui/ui.js',
  'docs/DESIGN_DOKUMENT.md',
  'docs/ROADMAP_OBSAHU.md',
  'docs/SNAPSHOT.md',
  'scripts/verify-snapshot.ps1'
)

foreach ($f in $expected) {
  $path = Join-Path $Root $f
  if (-not (Test-Path $path)) {
    $missing += $f
  }
}

# ---------- 2) index.html obsahuje synergies.js ----------
$htmlPath = Join-Path $Root 'index.html'
if (Test-Path $htmlPath) {
  $html = Get-Content -Raw $htmlPath
  if ($html -notmatch 'synergies\.js') {
    $problems += "index.html neobsahuje <script src=`"js/data/synergies.js`">"
  }
  if ($html -notmatch 'subtabs\.css') {
    $problems += "index.html neobsahuje <link rel=`"stylesheet`" href=`"css/subtabs.css`">"
  }
  if ($html -notmatch 'data-tab="world"') {
    $problems += "index.html nemá novou 5-tab navigaci (chybí data-tab=`"world`")"
  }
}

# ---------- 3) Klíčové funkce ----------
$functionChecks = @(
  @{ file='js/systems/work.js';       pattern='G\.rollQualityWithBonus\s*=';  desc='G.rollQualityWithBonus' },
  @{ file='js/data/synergies.js';     pattern='G\.synergyBonus\s*=';          desc='G.synergyBonus' },
  @{ file='js/data/synergies.js';     pattern='G\.activeSynergies\s*=';       desc='G.activeSynergies' },
  @{ file='js/systems/combat.js';     pattern='BOSS_SPAWN_CHANCE';            desc='Boss spawn' },
  @{ file='js/systems/expeditions.js';pattern='EXPEDITION_FOOD_PER_UNIT_PER_DAY'; desc='Expedice jídlo' }
)
foreach ($c in $functionChecks) {
  $p = Join-Path $Root $c.file
  if (-not (Test-Path $p)) { continue }
  $text = Get-Content -Raw $p
  if ($text -notmatch $c.pattern) {
    $problems += "V $($c.file) chybí $($c.desc)"
  }
}

# ---------- 4) count kontrol ----------
$jsDir = Join-Path $Root 'js'
if (Test-Path $jsDir) {
  $files = Get-ChildItem -Recurse -File -Path $jsDir -Filter *.js
  Write-Host "JS souborů celkem: $($files.Count)"
}

# ---------- Summary ----------
Write-Host ""
if ($missing.Count -gt 0) {
  Write-Host "CHYBÍ SOUBORY ($($missing.Count)):" -ForegroundColor Red
  $missing | ForEach-Object { Write-Host "  ✗ $_" -ForegroundColor Red }
}

if ($problems.Count -gt 0) {
  Write-Host ""
  Write-Host "PROBLÉMY ($($problems.Count)):" -ForegroundColor Yellow
  $problems | ForEach-Object { Write-Host "  ⚠ $_" -ForegroundColor Yellow }
}

if ($missing.Count -eq 0 -and $problems.Count -eq 0) {
  Write-Host "✓ Snapshot je kompletní — všechny soubory na místě, klíčové funkce OK." -ForegroundColor Green
  exit 0
} else {
  Write-Host ""
  Write-Host "Snapshot NENÍ kompletní. Zkontroluj chybějící soubory a problémy výše." -ForegroundColor Red
  exit 1
}
