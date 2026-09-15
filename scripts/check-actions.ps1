# check-actions.ps1 - static check of UI wiring for Idle Realm
#
# The UI is driven by data-action / data-change attributes delegated to
# js/ui/ui.js. A data-action without a handler is a dead button: it renders,
# it is clickable, and nothing happens (and nothing is logged). This script
# finds those.
#
# Checks:
#   1) every data-action="X" in js/ has a handler in js/ui/ui.js
#      (a `case 'X':` in handleAction, or a [data-action="X"] selector)
#   2) every data-change="X" has a `change === 'X'` branch
#
# Usage:  powershell.exe -ExecutionPolicy Bypass -File scripts/check-actions.ps1
# Exit code: 0 = OK, 1 = dead handlers found

param([string]$Root = (Get-Location).Path)

$ErrorActionPreference = 'Stop'
$Root = (Resolve-Path $Root).Path
$problems = @()

$jsDir = Join-Path $Root 'js'
if (-not (Test-Path $jsDir)) { Write-Host "js/ not found"; exit 1 }
$files = Get-ChildItem -Recurse -File -Path $jsDir -Filter *.js

$uiPath = Join-Path $Root 'js/ui/ui.js'
if (-not (Test-Path $uiPath)) { Write-Host "js/ui/ui.js not found"; exit 1 }
$ui = Get-Content -Raw -LiteralPath $uiPath

$handledAction = @{}
foreach ($m in [regex]::Matches($ui, "case '([A-Za-z0-9_-]+)'\s*:")) { $handledAction[$m.Groups[1].Value] = $true }
foreach ($m in [regex]::Matches($ui, '\[data-action="([A-Za-z0-9_-]+)"\]')) { $handledAction[$m.Groups[1].Value] = $true }

$handledChange = @{}
foreach ($m in [regex]::Matches($ui, "change === '([A-Za-z0-9_-]+)'")) { $handledChange[$m.Groups[1].Value] = $true }

$actions = @{}
$changes = @{}
foreach ($f in $files) {
  $text = Get-Content -Raw -LiteralPath $f.FullName
  foreach ($m in [regex]::Matches($text, 'data-action="([A-Za-z0-9_-]+)"')) {
    $a = $m.Groups[1].Value
    if (-not $actions.ContainsKey($a)) { $actions[$a] = @() }
    if ($actions[$a] -notcontains $f.Name) { $actions[$a] += $f.Name }
  }
  foreach ($m in [regex]::Matches($text, 'data-change="([A-Za-z0-9_-]+)"')) {
    $c = $m.Groups[1].Value
    if (-not $changes.ContainsKey($c)) { $changes[$c] = @() }
    if ($changes[$c] -notcontains $f.Name) { $changes[$c] += $f.Name }
  }
}

foreach ($a in ($actions.Keys | Sort-Object)) {
  if (-not $handledAction.ContainsKey($a)) {
    $problems += "DEAD data-action: $a  (in: $($actions[$a] -join ', '))"
  }
}
foreach ($c in ($changes.Keys | Sort-Object)) {
  if (-not $handledChange.ContainsKey($c)) {
    $problems += "DEAD data-change: $c  (in: $($changes[$c] -join ', '))"
  }
}

Write-Host ""
Write-Host "=== Idle Realm - UI action check ==="
Write-Host ("data-action values        : " + $actions.Count)
Write-Host ("data-change values        : " + $changes.Count)

Write-Host ""
if ($problems.Count -eq 0) {
  Write-Host "RESULT: OK - 0 dead handlers" -ForegroundColor Green
  exit 0
} else {
  Write-Host ("RESULT: " + $problems.Count + " dead handler(s)") -ForegroundColor Red
  $problems | ForEach-Object { Write-Host ("  x " + $_) -ForegroundColor Red }
  exit 1
}
