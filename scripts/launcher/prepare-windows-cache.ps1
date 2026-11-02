param([Parameter(Mandatory=$true)][string]$NodeExecutable,[Parameter(Mandatory=$true)][string]$NpmCli,[Parameter(Mandatory=$true)][string]$Fingerprint)
$ErrorActionPreference = 'Stop'
try {
    . (Join-Path $PSScriptRoot 'windows-network.ps1')
    $root = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
    $cache = Join-Path $root '.runtime/npm-cache'
    $marker = Join-Path $cache ('.ready-' + $Fingerprint)
    if (Test-Path -LiteralPath $marker) { exit 0 }
    if ($null -eq (Get-AcademySystemProxy -Uri ([uri]'https://registry.npmjs.org/'))) { exit 0 }
    Write-Host 'Company proxy detected. Preparing packages with your Windows sign-in. No password is stored.'
    $raw = & $NodeExecutable (Join-Path $PSScriptRoot 'npm-cache.mjs') 'plan' $root
    if ($LASTEXITCODE -ne 0) { throw 'Unable to read verified package download plan.' }
    $plan = $raw | ConvertFrom-Json
    $downloads = Join-Path $root '.runtime/npm-downloads'
    New-Item -ItemType Directory -Path $downloads -Force | Out-Null
    $count = 0
    foreach ($entry in $plan) {
        $count++
        Write-Host ("Preparing package " + $count + ' / ' + $plan.Count)
        $target = Join-Path $downloads $entry.filename
        $valid = $false
        if (Test-Path -LiteralPath $target) {
            $actualBytes = [Convert]::FromBase64String($entry.integrity.Substring(7))
            $expected = ([BitConverter]::ToString($actualBytes)).Replace('-','')
            $valid = (Get-FileHash -LiteralPath $target -Algorithm SHA512).Hash -eq $expected
        }
        if (-not $valid) {
            $partial = $target + '.partial'
            Save-AcademyDownload -Uri ([uri]$entry.url) -OutFile $partial
            Move-Item -LiteralPath $partial -Destination $target -Force
        }
    }
    & $NodeExecutable (Join-Path $PSScriptRoot 'npm-cache.mjs') 'fill' $root $NpmCli
    if ($LASTEXITCODE -ne 0) { throw 'Package integrity/cache preparation failed. Installation stopped.' }
    Set-Content -LiteralPath $marker -Value 'verified' -Encoding ASCII
    exit 0
} catch {
    Write-Host ("Package preparation failed: " + $_.Exception.Message) -ForegroundColor Red
    exit 1
}
