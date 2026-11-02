$ErrorActionPreference = 'Stop'
try {
    $root = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
    Set-Location -LiteralPath $root
    $existing = Get-Command node.exe -ErrorAction SilentlyContinue
    if ($existing -and (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
        & $existing.Source -e 'process.exit(Number(process.versions.node.split(String.fromCharCode(46))[0])>=24?0:1)'
        if ($LASTEXITCODE -eq 0) {
            & $existing.Source (Join-Path $PSScriptRoot 'launch.mjs')
            exit $LASTEXITCODE
        }
    }
    $architecture = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64' -or $env:PROCESSOR_ARCHITEW6432 -eq 'ARM64') { 'arm64' } else { 'x64' }
    $manifest = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'node-runtime.json') -Raw | ConvertFrom-Json
    $entry = $manifest."win-$architecture"
    $runtime = Join-Path $root ('.runtime/' + [IO.Path]::GetFileNameWithoutExtension($entry.filename))
    $node = Join-Path $runtime 'node.exe'
    if (-not (Test-Path -LiteralPath $node)) {
        Write-Host 'Preparing Node.js. First launch needs Internet access. Please wait...'
        $tempdir = Join-Path $root ('.runtime/download-' + [guid]::NewGuid().ToString('N'))
        New-Item -ItemType Directory -Path $tempdir -Force | Out-Null
        try {
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
            $archive = Join-Path $tempdir $entry.filename
            Invoke-WebRequest -UseBasicParsing -Uri ("https://nodejs.org/dist/" + $entry.version + '/' + $entry.filename) -OutFile $archive
            $actual = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
            if ($actual -ne $entry.sha256) { throw 'Node.js checksum mismatch. Installation stopped.' }
            Expand-Archive -LiteralPath $archive -DestinationPath (Join-Path $root '.runtime') -Force
        } finally {
            if (Test-Path -LiteralPath $tempdir) { Remove-Item -LiteralPath $tempdir -Recurse -Force }
        }
    }
    $env:Path = $runtime + [IO.Path]::PathSeparator + $env:Path
    & $node (Join-Path $PSScriptRoot 'launch.mjs')
    exit $LASTEXITCODE
} catch {
    Write-Host ("Startup failed: " + $_.Exception.Message) -ForegroundColor Red
    exit 1
}
