param(
    [Parameter(Mandatory=$true, ParameterSetName='Convert')]
    [string]$InputPath,

    [Parameter(Mandatory=$true, ParameterSetName='Convert')]
    [string]$OutputDir,

    [Parameter(Mandatory=$true, ParameterSetName='Cleanup')]
    [int]$OwnedWordPid,

    [Parameter(Mandatory=$true, ParameterSetName='Cleanup')]
    [long]$OwnedWordStart
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

if ($PSCmdlet.ParameterSetName -eq 'Cleanup') {
    $process = Get-Process -Id $OwnedWordPid -ErrorAction SilentlyContinue
    if ($null -ne $process) {
        try {
            [void]$process.Handle
            if ($process.ProcessName -eq 'WINWORD' -and $process.MainWindowHandle -eq [IntPtr]::Zero -and
                $process.StartTime.ToUniversalTime().Ticks -eq $OwnedWordStart) {
                $process.Kill()
                [void]$process.WaitForExit(4000)
            }
        } finally { $process.Dispose() }
    }
    exit 0
}

function Write-JsonAndExit($obj, $code) {
    $json = $obj | ConvertTo-Json -Compress -Depth 10
    Write-Output $json
    exit $code
}

try {
    if (-not (Test-Path -LiteralPath $InputPath)) {
        throw "Input file does not exist: $InputPath"
    }

    if (-not (Test-Path -LiteralPath $OutputDir)) {
        New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
    }

    $resolvedInput = (Resolve-Path -LiteralPath $InputPath).Path
    $resolvedOutputDir = (Resolve-Path -LiteralPath $OutputDir).Path

    $baseName = [System.IO.Path]::GetFileNameWithoutExtension($resolvedInput)
    $safeBaseName = $baseName -replace '[\\/:*?"<>|]', '_'
    $pdfPath = Join-Path $resolvedOutputDir ($safeBaseName + ".pdf")

    $word = $null
    $doc = $null

    try {
        $existingWordPids = @(Get-Process -Name WINWORD -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
        $word = New-Object -ComObject Word.Application
        $word.Visible = $false
        $word.DisplayAlerts = 0
        try {
            # 3 = msoAutomationSecurityForceDisable
            $word.AutomationSecurity = 3
        } catch {}

        try {
            $doc = $word.Documents.Open($resolvedInput, $false, $true, $false)
        } catch {
            $doc = $word.Documents.OpenNoRepairDialog($resolvedInput, $false, $true, $false)
        }

        if ($doc -eq $null) {
            throw "Word failed to open DOCX: document object is null"
        }

        try {
            Add-Type -Namespace Qisi -Name WordWindow -MemberDefinition @'
[DllImport("user32.dll")]
public static extern uint GetWindowThreadProcessId(System.IntPtr window, out uint processId);
'@
            [uint32]$wordPid = 0
            [void][Qisi.WordWindow]::GetWindowThreadProcessId([IntPtr][long]$doc.ActiveWindow.Hwnd, [ref]$wordPid)
            if ($wordPid -and $wordPid -notin $existingWordPids) {
                $owned = Get-Process -Id $wordPid
                if ($owned.ProcessName -eq 'WINWORD') {
                    [Console]::WriteLine("QISI_WORD_OWNER {0} {1}", $wordPid, $owned.StartTime.ToUniversalTime().Ticks)
                }
            }
        } catch { }

        try {
            $doc.ExportAsFixedFormat($pdfPath, 17)
        } catch {
            $format = 17
            $doc.SaveAs2([ref]$pdfPath, [ref]$format)
        }

        $doc.Close($false)
        $doc = $null

        $word.Quit()
        $word = $null

        if (-not (Test-Path -LiteralPath $pdfPath)) {
            throw "PDF was not created: $pdfPath"
        }

        $pdfInfo = Get-Item -LiteralPath $pdfPath

        if ($pdfInfo.Length -le 0) {
            throw "PDF file is empty: $pdfPath"
        }

        Write-JsonAndExit @{
            ok = $true
            inputPath = $resolvedInput
            pdfPath = $pdfPath
            pdfBytes = $pdfInfo.Length
        } 0
    }
    finally {
        if ($doc -ne $null) {
            try { $doc.Close($false) } catch {}
            try { [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($doc) } catch {}
        }

        if ($word -ne $null) {
            try { $word.Quit() } catch {}
            try { [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) } catch {}
        }

        [GC]::Collect()
        [GC]::WaitForPendingFinalizers()
    }
}
catch {
    Write-JsonAndExit @{
        ok = $false
        error = $_.Exception.Message
        inputPath = $InputPath
        outputDir = $OutputDir
    } 2
}
