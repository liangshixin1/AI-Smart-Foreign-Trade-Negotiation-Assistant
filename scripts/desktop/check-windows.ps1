$ErrorActionPreference = 'Stop'
$Root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$Output = Join-Path $Root 'release/windows-x64'
New-Item -ItemType Directory -Path $Output -Force | Out-Null
$Report = @{
    status='PASS'
    windows=[Environment]::OSVersion.VersionString
    osArchitecture=$env:PROCESSOR_ARCHITECTURE
    powershell=$PSVersionTable.PSVersion.ToString()
    sharedPath=$Root
    localBuildRoot=(Join-Path $env:LOCALAPPDATA 'ForeignTradeExpert-Build')
    sourcePackagePresent=(Test-Path (Join-Path $Output 'windows-build-source.zip'))
    notice='ARM Windows running an x64 app is emulation, not native x64 acceptance.'
}
if (!$Report.sourcePackagePresent) { $Report.status='FAIL' }
$Report | ConvertTo-Json | Set-Content (Join-Path $Output 'environment-check.json') -Encoding UTF8
$Report | Format-List
Write-Host "Report: $Output/environment-check.json"
if ($Report.status -ne 'PASS') { exit 1 }
