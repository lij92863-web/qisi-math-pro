param(
    [Parameter(Mandatory = $true)]
    [string]$InputPath,

    [Parameter(Mandatory = $true)]
    [string]$OutputPath,

    [string]$Translator = 'LaTeX.tdl'
)

$ErrorActionPreference = 'Stop'

function Write-Result {
    param([object]$Value)

    $json = $Value | ConvertTo-Json -Depth 8 -Compress
    $encoding = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($OutputPath, $json, $encoding)
}

$mathTypeCandidates = if ([Environment]::Is64BitProcess) {
    @(
        'C:\Program Files (x86)\MathType\System\64\MT6.dll',
        'C:\Program Files\MathType\System\64\MT6.dll'
    )
} else {
    @(
        'C:\Program Files (x86)\MathType\System\32\MT6.dll',
        'C:\Program Files (x86)\MathType\System\MT6.dll'
    )
}

$mathTypeDll = $mathTypeCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $mathTypeDll) {
    Write-Result @{
        ok = $false
        code = 'MATHTYPE_DLL_NOT_FOUND'
        equations = @()
    }
    exit 2
}

$mathTypeDir = Split-Path -Parent $mathTypeDll
$env:PATH = "$mathTypeDir;$env:PATH"

$nativeCode = @'
using System;
using System.Text;
using System.Runtime.InteropServices;

public static class QisiMathTypeNative
{
    [StructLayout(LayoutKind.Sequential)]
    public struct Rect
    {
        public int left;
        public int top;
        public int right;
        public int bottom;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct Dims
    {
        public int baseline;
        public Rect bounds;
    }

    [DllImport("MT6.dll", ExactSpelling = true)]
    public static extern int MTAPIConnect(short start, short timeout);

    [DllImport("MT6.dll", ExactSpelling = true)]
    public static extern int MTAPIDisconnect();

    [DllImport("MT6.dll", ExactSpelling = true)]
    public static extern int MTXFormReset();

    [DllImport("MT6.dll", CharSet = CharSet.Ansi, ExactSpelling = true)]
    public static extern int MTXFormSetTranslator(
        ushort options,
        [MarshalAs(UnmanagedType.LPStr)] string name
    );

    [DllImport("MT6.dll", EntryPoint = "MTXFormEqn", CharSet = CharSet.Ansi, ExactSpelling = true)]
    public static extern int MTXFormEqn(
        short src,
        short srcFmt,
        [In] byte[] srcData,
        int srcLen,
        short dst,
        short dstFmt,
        StringBuilder dstData,
        int dstLen,
        [MarshalAs(UnmanagedType.LPStr)] string dstPath,
        ref Dims dims
    );

    [DllImport("MT6.dll", ExactSpelling = true)]
    public static extern int MTXFormGetStatus(short index);
}
'@

try {
    Add-Type -TypeDefinition $nativeCode -Language CSharp
    $payload = Get-Content -LiteralPath $InputPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $rows = @($payload.equations)

    if ($rows.Count -gt 512) {
        throw 'Equation batch exceeds the 512 item limit.'
    }

    $connectStatus = [QisiMathTypeNative]::MTAPIConnect(0, 30)
    if ($connectStatus -ne 0) {
        Write-Result @{
            ok = $false
            code = 'MATHTYPE_CONNECT_FAILED'
            connectStatus = $connectStatus
            equations = @()
        }
        exit 3
    }

    try {
        $results = foreach ($row in $rows) {
            $id = [string]$row.id
            try {
                $mtef = [Convert]::FromBase64String([string]$row.mtefBase64)
                if (-not $mtef.Length) {
                    throw 'MTEF payload is empty.'
                }

                $resetStatus = [QisiMathTypeNative]::MTXFormReset()
                $translatorStatus = [QisiMathTypeNative]::MTXFormSetTranslator(0, $Translator)
                if ($resetStatus -ne 0 -or $translatorStatus -ne 0) {
                    throw "Translator setup failed (reset=$resetStatus translator=$translatorStatus)."
                }

                $capacity = 32768
                $destination = New-Object System.Text.StringBuilder $capacity
                $dims = New-Object QisiMathTypeNative+Dims
                $convertStatus = [QisiMathTypeNative]::MTXFormEqn(
                    -3,
                    4,
                    $mtef,
                    $mtef.Length,
                    -3,
                    7,
                    $destination,
                    $capacity,
                    '',
                    [ref]$dims
                )

                if ($convertStatus -ne 0) {
                    throw "MathType conversion failed with status $convertStatus."
                }

                @{
                    id = $id
                    ok = $true
                    code = 'MATHTYPE_LATEX_OK'
                    latex = $destination.ToString()
                }
            } catch {
                @{
                    id = $id
                    ok = $false
                    code = 'MATHTYPE_TRANSLATION_FAILED'
                    latex = ''
                    message = $_.Exception.Message
                }
            }
        }

        Write-Result @{
            ok = -not ($results | Where-Object { -not $_.ok })
            code = 'MATHTYPE_BATCH_COMPLETE'
            translator = $Translator
            equations = @($results)
        }
    } finally {
        [void][QisiMathTypeNative]::MTAPIDisconnect()
    }
} catch {
    Write-Result @{
        ok = $false
        code = 'MATHTYPE_HELPER_FAILED'
        message = $_.Exception.Message
        equations = @()
    }
    exit 1
}
