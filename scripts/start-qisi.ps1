[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectRoot,

    [ValidateRange(1, 65535)]
    [int]$Port = 3000,

    [ValidateRange(1, 120)]
    [int]$ReadyTimeoutSeconds = 30
)

$ErrorActionPreference = 'Stop'
$healthUrl = "http://127.0.0.1:$Port/api/health"

function Test-QisiHealth {
    try {
        $response = Invoke-WebRequest `
            -UseBasicParsing `
            -Uri $healthUrl `
            -TimeoutSec 1
        return $response.StatusCode -eq 200
    } catch {
        return $false
    }
}

if (Test-QisiHealth) {
    exit 0
}

$serverPath = Join-Path $ProjectRoot 'qisi-local-server.js'
if (-not (Test-Path -LiteralPath $serverPath -PathType Leaf)) {
    throw "TEX Question Bank server entry is missing: $serverPath"
}

$node = Get-Command 'node.exe' -ErrorAction SilentlyContinue
if (-not $node) {
    throw 'TEX Question Bank cannot start because Node.js was not found.'
}

Start-Process `
    -FilePath $node.Source `
    -ArgumentList 'qisi-local-server.js' `
    -WorkingDirectory $ProjectRoot `
    -WindowStyle Hidden

$deadline = (Get-Date).AddSeconds($ReadyTimeoutSeconds)
while ((Get-Date) -lt $deadline) {
    if (Test-QisiHealth) {
        exit 0
    }
    Start-Sleep -Milliseconds 250
}

throw "TEX Question Bank local service was not ready within $ReadyTimeoutSeconds seconds."
