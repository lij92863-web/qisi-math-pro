$ErrorActionPreference = 'Stop'

$root = [System.IO.Path]::GetFullPath($PSScriptRoot)
$server = Join-Path $root 'server.js'

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw 'Node.js is required. Install the project runtime before local OCR setup.'
}

& node --check $server
if ($LASTEXITCODE -ne 0) {
    throw 'Local OCR server syntax check failed.'
}

foreach ($name in @('models', 'runtime', 'tmp')) {
    $target = [System.IO.Path]::GetFullPath((Join-Path $root $name))
    if (-not $target.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to create unmanaged path: $name"
    }
    New-Item -ItemType Directory -Force -Path $target | Out-Null
}

[pscustomobject]@{
    ok = $true
    serviceInstalled = $true
    engine = 'unavailable'
    modelDownloadAttempted = $false
    next = 'Run .\start.ps1, then .\health-check.ps1.'
} | ConvertTo-Json
