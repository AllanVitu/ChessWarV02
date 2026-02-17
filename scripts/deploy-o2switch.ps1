param(
  [string]$BaseUrl = "",
  [switch]$SkipSmoke
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir

Write-Host "==> Build O2Switch (dist/)"
Push-Location $repoRoot
try {
  npm run build:o2switch

  if (-not $SkipSmoke) {
    if ([string]::IsNullOrWhiteSpace($BaseUrl)) {
      Write-Host "==> Smoke dist package (fichiers + rewrite)"
      node scripts/o2switch-smoke.mjs --dist dist
    }
    else {
      Write-Host "==> Smoke remote base: $BaseUrl"
      node scripts/o2switch-smoke.mjs --base $BaseUrl
    }
  }

  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $zipName = "dist-o2switch-$stamp.zip"
  $zipPath = Join-Path $repoRoot $zipName

  if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
  }

  Write-Host "==> Packaging $zipName"
  Compress-Archive -Path (Join-Path $repoRoot "dist\*") -DestinationPath $zipPath -Force
  Write-Host "Archive genere: $zipPath"
}
finally {
  Pop-Location
}
