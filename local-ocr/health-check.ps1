$ErrorActionPreference = 'Stop'

$port = if ($env:QISI_LOCAL_OCR_PORT) { [int]$env:QISI_LOCAL_OCR_PORT } else { 8765 }
$uri = "http://127.0.0.1:$port/health"

try {
    $result = Invoke-RestMethod -Method Get -Uri $uri -TimeoutSec 5
    $result | ConvertTo-Json -Depth 6
    if (-not $result.ok) { exit 2 }
} catch {
    [pscustomobject]@{
        ok = $false
        code = 'local-ocr-health-unavailable'
        endpoint = $uri
    } | ConvertTo-Json
    exit 1
}
