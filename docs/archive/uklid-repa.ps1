# uklid-repa.ps1 — One-click úklid Idle Realms repozitáře
#
# Co dělá:
#   1) Smaže duplikáty v scripts/ (css/, docs/, js/, index.html)
#   2) Smaže duplikáty v js/ (index.html, docs/)
#   3) Nahradí js/systems/autonomy.js správnou verzí (Fáze 10)
#   4) Vypíše souhrn
#
# Použití:
#   1) Zkopíruj tento soubor do kořene repa (idle-realms/)
#   2) Otevři PowerShell v této složce
#   3) Spusť: .\uklid-repa.ps1
#
# Skript je bezpečný — před smazáním vypíše, co bude dělat, a čeká na potvrzení.

$ErrorActionPreference = 'Stop'

Write-Host ""
Write-Host "=== Idle Realms — úklid repozitáře ===" -ForegroundColor Cyan
Write-Host ""

# Zkontroluj, že jsme ve správné složce
if (-not (Test-Path 'index.html') -or -not (Test-Path 'js') -or -not (Test-Path 'scripts')) {
  Write-Host "CHYBA: Tato složka nevypadá jako repo Idle Realms." -ForegroundColor Red
  Write-Host "Ujisti se, že skript spouštíš v kořeni repa (kde je index.html, js/, scripts/)." -ForegroundColor Red
  Read-Host "Stiskni Enter pro ukončení"
  exit 1
}

$Root = (Get-Location).Path
Write-Host "Pracovní složka: $Root" -ForegroundColor Gray
Write-Host ""

# === Plán úklidu ===
$toDelete = @(
  'scripts/css',
  'scripts/docs',
  'scripts/js',
  'scripts/index.html',
  'js/index.html',
  'js/docs'
)

$toDeleteExisting = @()
foreach ($item in $toDelete) {
  $path = Join-Path $Root $item
  if (Test-Path $path) { $toDeleteExisting += $item }
}

Write-Host "Bude smazáno ($($toDeleteExisting.Count) položek):" -ForegroundColor Yellow
foreach ($item in $toDeleteExisting) {
  Write-Host "  ✗ $item" -ForegroundColor Yellow
}
if ($toDeleteExisting.Count -eq 0) {
  Write-Host "  (nic — už je uklizeno)" -ForegroundColor Green
}

# === Nahradit autonomy.js ===
$autonomyTarget = Join-Path $Root 'js/systems/autonomy.js'
$autonomySource = Join-Path $Root 'scripts/js/systems/autonomy.js'

$replaceAutonomy = $false
if (Test-Path $autonomySource) {
  $replaceAutonomy = $true
  Write-Host ""
  Write-Host "Bude nahrazeno:" -ForegroundColor Yellow
  Write-Host "  ↻ js/systems/autonomy.js ← scripts/js/systems/autonomy.js" -ForegroundColor Yellow
}

Write-Host ""
$confirm = Read-Host "Pokračovat? (a/n)"
if ($confirm -ne 'a' -and $confirm -ne 'A') {
  Write-Host "Zrušeno." -ForegroundColor Red
  Read-Host "Stiskni Enter pro ukončení"
  exit 0
}

Write-Host ""
Write-Host "Provádím úklid..." -ForegroundColor Cyan

# === Krok 1: Nahradit autonomy.js PŘED smazáním scripts/js ===
if ($replaceAutonomy) {
  try {
    Copy-Item -Path $autonomySource -Destination $autonomyTarget -Force
    Write-Host "  ✓ Nahrazen js/systems/autonomy.js" -ForegroundColor Green
  } catch {
    Write-Host "  ✗ Chyba při kopírování autonomy.js: $_" -ForegroundColor Red
    Read-Host "Stiskni Enter pro ukončení"
    exit 1
  }
}

# === Krok 2: Smazat duplikáty ===
foreach ($item in $toDeleteExisting) {
  $path = Join-Path $Root $item
  try {
    if (Test-Path $path -PathType Container) {
      Remove-Item -Path $path -Recurse -Force
    } else {
      Remove-Item -Path $path -Force
    }
    Write-Host "  ✓ Smazáno: $item" -ForegroundColor Green
  } catch {
    Write-Host "  ✗ Chyba při mazání ${item}: $_" -ForegroundColor Red
  }
}

# === Souhrn ===
Write-Host ""
Write-Host "=== Hotovo ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Další kroky:" -ForegroundColor Yellow
Write-Host "  1) Spusť kontrolu:  pwsh -File scripts/check-globals.ps1" -ForegroundColor White
Write-Host "  2) Otevři test/smoke.html v prohlížeči" -ForegroundColor White
Write-Host "  3) Nahraj změny do gitu:" -ForegroundColor White
Write-Host "       git add -A" -ForegroundColor Gray
Write-Host "       git commit -m `"chore: úklid duplikátů a oprava autonomy.js`"" -ForegroundColor Gray
Write-Host "       git push" -ForegroundColor Gray
Write-Host ""
Read-Host "Stiskni Enter pro ukončení"
