$ErrorActionPreference = 'Stop'
$Root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$Output = Join-Path $Root 'release/windows-x64'
$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$Temp = Join-Path $env:TEMP "expert-diagnostics-$Stamp"
New-Item -ItemType Directory -Path $Temp -Force | Out-Null
# Only machine-readable summaries: never sweep logs, databases or credential files.
foreach ($Name in @('latest-status.json','environment-check.json','installed-smoke.json','latest-install-status.json')) {
    $Source = Join-Path $Output $Name
    if (Test-Path $Source) { Copy-Item $Source $Temp }
}
$Status = Join-Path $env:APPDATA 'ForeignTradeExpert/desktop-status.json'
if (Test-Path $Status) { Copy-Item $Status $Temp }
# The smoke runner uses a separate profile; collect only its allowlisted status.
$SmokeStatus = Join-Path $env:TEMP 'ForeignTradeExpert-Smoke/desktop-status.json'
if (Test-Path $SmokeStatus) { Copy-Item $SmokeStatus (Join-Path $Temp 'smoke-desktop-status.json') }
# Recover result written locally before a runner timeout, if any. Do not copy page text.
$Acceptance = Join-Path $env:LOCALAPPDATA 'ForeignTradeExpert-Acceptance'
$Latest = Get-ChildItem -LiteralPath $Acceptance -Directory -ErrorAction SilentlyContinue |
    Sort-Object Name -Descending | Select-Object -First 1
if ($Latest) {
    $ResultFile = Join-Path $Latest.FullName 'installed-smoke.json'
    if (Test-Path $ResultFile) {
        $Result = Get-Content $ResultFile -Raw -Encoding UTF8 | ConvertFrom-Json
        $Safe = @{}
        foreach ($Field in @('status','stage','category','arch','platform','mode','stages','checks')) {
            $Property = $Result.PSObject.Properties[$Field]
            if ($Property) { $Safe[$Field] = $Property.Value }
        }
        $Safe | ConvertTo-Json -Depth 4 | Set-Content (Join-Path $Temp 'recovered-smoke-result.json') -Encoding UTF8
    }
}
$Zip = Join-Path $Output "expert-diagnostics-$Stamp.zip"
Compress-Archive -Path (Join-Path $Temp '*') -DestinationPath $Zip
Write-Host "Diagnostic file: $Zip"
Start-Process explorer.exe -ArgumentList $Output
