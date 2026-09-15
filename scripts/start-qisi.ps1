[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectRoot,

    [ValidateRange(1, 65535)]
    [int]$Port = 3000,

    [ValidateRange(1, 120)]
    [int]$ReadyTimeoutSeconds = 8,

    [switch]$OpenBrowser
)

$ErrorActionPreference = 'Stop'
$hostAddress = '127.0.0.1'
$maxPort = [Math]::Min(65535, $Port + 10)

function Test-QisiHealth([int]$CandidatePort) {
    try {
        $response = Invoke-WebRequest `
            -UseBasicParsing `
            -Uri "http://${hostAddress}:$CandidatePort/api/health" `
            -TimeoutSec 1
        $payload = $response.Content | ConvertFrom-Json
        return $response.StatusCode -eq 200 `
            -and $payload.ok -eq $true `
            -and $payload.service -eq 'qisi-local-server' `
            -and $payload.buildId -eq $expectedBuildId
    } catch {
        return $false
    }
}

function Test-TcpPort([int]$CandidatePort) {
    $client = [System.Net.Sockets.TcpClient]::new()
    try {
        $pending = $client.ConnectAsync($hostAddress, $CandidatePort)
        return $pending.Wait(200) -and $client.Connected
    } catch {
        return $false
    } finally {
        $client.Dispose()
    }
}

$node = Get-Command 'node.exe' -ErrorAction SilentlyContinue
if (-not $node) {
    throw 'TEX Question Bank cannot start because Node.js was not found.'
}

$serverPath = Join-Path $ProjectRoot 'qisi-local-server.js'
if (-not (Test-Path -LiteralPath $serverPath -PathType Leaf)) {
    throw "TEX Question Bank server entry is missing: $serverPath"
}
$sha256 = [System.Security.Cryptography.SHA256]::Create()
$serverStream = [System.IO.File]::OpenRead($serverPath)
try {
    $serverHash = $sha256.ComputeHash($serverStream)
} finally {
    $serverStream.Dispose()
    $sha256.Dispose()
}
$expectedBuildId = -join $serverHash[0..7].ForEach({ $_.ToString('x2') })

$selectedPort = $null
$serverProcess = $null
$startedAt = Get-Date
$skippedPorts = [System.Collections.Generic.List[string]]::new()

for ($candidate = $Port; $candidate -le $maxPort; $candidate++) {
    if (Test-QisiHealth $candidate) {
        $selectedPort = $candidate
        break
    }

    if (Test-TcpPort $candidate) {
        $skippedPorts.Add("port $candidate is already used by another service")
        continue
    }

    $previousPort = $env:PORT
    $candidateProcess = $null
    try {
        $env:PORT = [string]$candidate
        $candidateProcess = Start-Process `
            -FilePath $node.Source `
            -ArgumentList 'qisi-local-server.js' `
            -WorkingDirectory $ProjectRoot `
            -WindowStyle Hidden `
            -PassThru
    } finally {
        $env:PORT = $previousPort
    }

    $deadline = (Get-Date).AddSeconds($ReadyTimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        if (Test-QisiHealth $candidate) {
            $selectedPort = $candidate
            break
        }
        if ($candidateProcess.HasExited) {
            break
        }
        Start-Sleep -Milliseconds 100
    }
    if ($selectedPort) {
        $serverProcess = $candidateProcess
        break
    }

    if ($candidateProcess.HasExited) {
        # The port was free when probed but the service could not keep it, for example when
        # another program claimed it in between. That is a reason to try the next port, not to
        # abort the whole startup.
        $skippedPorts.Add("port $candidate could not start the service (exit code $($candidateProcess.ExitCode))")
        continue
    }

    if (-not $selectedPort) {
        throw "TEX Question Bank local service was not ready within $ReadyTimeoutSeconds seconds."
    }
}

if (-not $selectedPort) {
    $detail = if ($skippedPorts.Count) { $skippedPorts -join '; ' } else { 'no free loopback port was found' }
    throw "TEX Question Bank could not start on ports $Port-$maxPort ($detail)."
}

$browserUrl = "http://${hostAddress}:$selectedPort/main.html"
$elapsed = [Math]::Round(((Get-Date) - $startedAt).TotalMilliseconds)
Write-Output "TEX Question Bank ready in $elapsed ms"
Write-Output "QISI_URL=$browserUrl"
Write-Output "QISI_PID=$($serverProcess.Id)"

if ($OpenBrowser) {
    Start-Process -FilePath $browserUrl
}
