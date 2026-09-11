# check-globals.ps1 - static consistency check for Idle Realm
# Validates a vanilla-JS project built on the global window.Game object.
#
# Checks:
#   1) every <script src> in index.html points to an existing file
#   2) every used global G.* is defined somewhere (and reports unused ones)
#   3) every called tick function G.tickX is defined (and reports dead ticks)
#   4) no TODO/FIXME/XXX/HACK markers
#
# Usage:  pwsh -File scripts/check-globals.ps1
#         powershell.exe -ExecutionPolicy Bypass -File scripts/check-globals.ps1
# Exit code: 0 = OK, 1 = problems found

param([string]$Root = (Get-Location).Path)

$ErrorActionPreference = 'Stop'
$Root = (Resolve-Path $Root).Path
$problems = @()
$notes = @()

# ---------- 1) script refs in index.html ----------
$htmlPath = Join-Path $Root 'index.html'
if (Test-Path $htmlPath) {
  $html = Get-Content -Raw $htmlPath
  $refs = [regex]::Matches($html, 'src="([^"]+)"') | ForEach-Object { $_.Groups[1].Value }
  foreach ($s in $refs) {
    if (-not (Test-Path (Join-Path $Root $s))) { $problems += "MISSING script: $s" }
  }
} else {
  $problems += "index.html not found"
  $refs = @()
}

# ---------- 2) G.* defined vs used ----------
$jsDir = Join-Path $Root 'js'
$files = @()
if (Test-Path $jsDir) { $files = Get-ChildItem -Recurse -File -Path $jsDir -Filter *.js }
$defined = @{}
$used = @{}
foreach ($f in $files) {
  $text = Get-Content -Raw -LiteralPath $f.FullName
  foreach ($m in [regex]::Matches($text, 'G\.([A-Za-z_$][\w$]*)\s*=')) { $defined[$m.Groups[1].Value] = $true }
  foreach ($m in [regex]::Matches($text, 'G\.([A-Za-z_$][\w$]*)\b')) {
    if (-not $used.ContainsKey($m.Groups[1].Value)) { $used[$m.Groups[1].Value] = @() }
    $used[$m.Groups[1].Value] += $f.Name
  }
}
foreach ($k in ($used.Keys | Sort-Object)) {
  if (-not $defined.ContainsKey($k)) {
    $where = ($used[$k] | Select-Object -Unique) -join ', '
    $problems += "UNDEFINED global: G.$k  (used in: $where)"
  }
}
foreach ($k in ($defined.Keys | Sort-Object)) {
  if (-not $used.ContainsKey($k)) { $notes += "unused global: G.$k" }
}

# ---------- 3) tick functions ----------
$tickDef = @{}; $tickCall = @{}
foreach ($f in $files) {
  $text = Get-Content -Raw -LiteralPath $f.FullName
  foreach ($m in [regex]::Matches($text, 'G\.(tick[A-Za-z_$][\w$]*)\s*=\s*function')) { $tickDef[$m.Groups[1].Value] = $true }
  foreach ($m in [regex]::Matches($text, 'G\.(tick[A-Za-z_$][\w$]*)\s*\(')) { $tickCall[$m.Groups[1].Value] = $true }
}
foreach ($k in ($tickCall.Keys | Sort-Object)) {
  if (-not $tickDef.ContainsKey($k)) { $problems += "UNDEFINED tick: G.$k" }
}
foreach ($k in ($tickDef.Keys | Sort-Object)) {
  if (-not $tickCall.ContainsKey($k)) { $notes += "dead tick (never called): G.$k" }
}

# ---------- 4) TODO markers ----------
foreach ($f in $files) {
  $lines = Get-Content -LiteralPath $f.FullName
  for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -cmatch 'TODO|FIXME|XXX|HACK') { $problems += "TODO marker: $($f.Name):$($i+1)" }
  }
}

# ---------- summary ----------
Write-Host ""
Write-Host "=== Idle Realm - static check ==="
Write-Host ("script refs in index.html : " + $refs.Count)
Write-Host ("JS files                  : " + $files.Count)
Write-Host ("defined globals G.*       : " + $defined.Count)
Write-Host ("used globals G.*          : " + $used.Count)

if ($notes.Count -gt 0) {
  Write-Host ""
  Write-Host "Notes:" -ForegroundColor Yellow
  $notes | ForEach-Object { Write-Host ("  ~ " + $_) -ForegroundColor Yellow }
}

Write-Host ""
if ($problems.Count -eq 0) {
  Write-Host "RESULT: OK - 0 problems" -ForegroundColor Green
  exit 0
} else {
  Write-Host ("RESULT: " + $problems.Count + " problem(s)") -ForegroundColor Red
  $problems | ForEach-Object { Write-Host ("  x " + $_) -ForegroundColor Red }
  exit 1
}
