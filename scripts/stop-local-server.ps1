param([ValidateRange(1, 65535)][int]$Port = 3000)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$serverPath = Join-Path $root 'qisi-local-server.js'
$scriptArgument = '^\s*(?:"[^"]+"|\S+)\s+(?:"(?<file>[^"]+)"|(?<file>\S+))\s*$'

function Resolve-LongPath([string]$FilePath) {
    $buffer = New-Object System.Text.StringBuilder 32768
    $length = [Qisi.LocalPath]::GetLongPathName($FilePath, $buffer, $buffer.Capacity)
    if ($length -eq 0 -or $length -ge $buffer.Capacity) { return $null }
    return $buffer.ToString()
}

try {
    $listeners = @(Get-NetTCPConnection -State Listen | Where-Object LocalPort -eq $Port)
    if ($listeners.Count -eq 0) {
        Write-Host 'The local service is already stopped.'
        exit 0
    }
    $owners = @($listeners.OwningProcess | Sort-Object -Unique)
    if ($owners.Count -ne 1 -or '127.0.0.1' -notin $listeners.LocalAddress) {
        throw "Port $Port is held by a different program."
    }
    $server = Get-Process -Id $owners[0]
    [void]$server.Handle
    $command = Get-CimInstance -ClassName Win32_Process -Filter "ProcessId = $($server.Id)"
    if ($server.ProcessName -ne 'node' -or $command.CommandLine -notmatch $scriptArgument -or
        -not [IO.Path]::IsPathRooted($Matches.file)) {
        throw "Port $Port belongs to another installation or program. Open the stop tool from that Qisi folder."
    }
    $entry = $Matches.file
    if ($entry -ne $serverPath) {
        Add-Type -Namespace Qisi -Name LocalPath -MemberDefinition @'
[DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
public static extern uint GetLongPathName(string path, System.Text.StringBuilder result, int capacity);
'@
        $expected = Resolve-LongPath $serverPath
        if (!$expected -or (Resolve-LongPath $entry) -ne $expected) {
            throw "Port $Port belongs to another installation or program. Open the stop tool from that Qisi folder."
        }
    }
    $server.Kill()
    if (-not $server.WaitForExit(5000)) { throw 'The local service has not exited yet.' }
    Write-Host 'Qisi Math Pro local service stopped.'
} catch {
    [Console]::Error.WriteLine($_.Exception.Message)
    exit 1
}
