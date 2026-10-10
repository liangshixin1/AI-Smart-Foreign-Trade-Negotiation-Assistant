param([switch]$Private, [switch]$Public)
if ($Private -and $Public) { throw "Choose one edition." }
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$ProgressPreference = 'SilentlyContinue'
$SourceRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$Shared = Join-Path $SourceRoot 'release/windows-x64'
$CacheRoot = $Shared
if ($Public) { $Shared = Join-Path $SourceRoot 'public-release/windows-x64' }
$RunId = Get-Date -Format 'yyyyMMdd-HHmmss'
$Work = Join-Path $env:LOCALAPPDATA "$(if ($Public) {'ForeignTradePublic-Build'} else {'ForeignTradeExpert-Build'})/$RunId"
New-Item -ItemType Directory -Path $Work -Force | Out-Null
$Log = Join-Path $Work 'windows-build.log'
$Status = @{status='RUNNING'; runId=$RunId; workspace=$Work; stage='prepare'}
Start-Transcript -Path $Log | Out-Null
try {
    $SourceZip = Join-Path $Shared 'windows-build-source.zip'
    $Hash = ((Get-Content ($SourceZip + '.sha256') -Raw -Encoding UTF8).Trim() -split '\s+')[0]
    if ((Get-FileHash $SourceZip -Algorithm SHA256).Hash.ToLower() -ne $Hash) { throw 'Source checksum mismatch' }
    $Project = Join-Path $Work 'source'
    Expand-Archive -LiteralPath $SourceZip -DestinationPath $Project
    $Tools = @(
        @{name='python-3.12.10-x64.zip'; url='https://api.nuget.org/v3-flatcontainer/python/3.12.10/python.3.12.10.nupkg'; hash='0eb85c2dfccccf1b17352de4c397f69194035b7d37149eacc16f1147d93de3b8'; destination='python'},
        @{name='node-v22.23.2-win-x64.zip'; url='https://nodejs.org/dist/v22.23.2/node-v22.23.2-win-x64.zip'; hash='1177b4137ba5adaa56354ae40f1080c7450e8ae09cecb47da459d1c52ac99f97'; destination='node'}
    )
    foreach ($Tool in $Tools) {
        $Archive = Join-Path $Work $Tool.name
        $Cache = Join-Path $CacheRoot $Tool.name
        if (Test-Path $Cache) { Copy-Item $Cache $Archive } else {
            Invoke-WebRequest -UseBasicParsing -Uri $Tool.url -OutFile $Archive
        }
        if ((Get-FileHash $Archive -Algorithm SHA256).Hash.ToLower() -ne $Tool.hash) { throw 'Tool checksum mismatch' }
        Expand-Archive -LiteralPath $Archive -DestinationPath (Join-Path $Work $Tool.destination)
    }
    $env:PATH = "$(Join-Path $Work 'python/tools');$(Join-Path $Work 'node/node-v22.23.2-win-x64');$env:PATH"
    $Wheels = Join-Path $CacheRoot 'wheelhouse'
    if (Test-Path (Join-Path $Wheels 'manifest.json')) {
        $Manifest = Get-Content (Join-Path $Wheels 'manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
        $LocalWheels = Join-Path $Work 'wheelhouse'
        New-Item -ItemType Directory -Path $LocalWheels | Out-Null
        foreach ($Item in $Manifest.files) {
            $File = Join-Path $Wheels $Item.name
            if ((Get-FileHash $File -Algorithm SHA256).Hash.ToLower() -ne $Item.sha256) { throw 'Wheel checksum mismatch' }
            Copy-Item $File $LocalWheels
        }
        $env:EXPERT_WHEELHOUSE = $LocalWheels
    }
    $Credential = ''
    if ($Private) {
        Add-Type -AssemblyName System.Windows.Forms
        $Picker = New-Object System.Windows.Forms.OpenFileDialog
        $Picker.Title = 'Select private demo-credential.json'
        $Picker.Filter = 'JSON (*.json)|*.json'
        if ($Picker.ShowDialog() -ne 'OK') { throw 'Private build cancelled.' }
        $Credential = $Picker.FileName
    }
    $Status.stage = 'build'
    & (Join-Path $Project 'scripts/desktop/build-windows.ps1') -CredentialFile $Credential -Public:$Public
    $Output = Join-Path $Project $(if ($Public) {'public-release/windows-x64'} elseif ($Private) {'private-release/windows-x64'} else {'release/windows-x64'})
    $Destination = if ($Private) { Join-Path $SourceRoot 'private-release/windows-x64' } else { $Shared }
    New-Item -ItemType Directory -Path $Destination -Force | Out-Null
    Get-ChildItem $Output -File | Where-Object {
        $_.Extension -in @('.exe','.sha256','.json','.png','.txt','.md')
    } | Copy-Item -Destination $Destination
    $Status.status = 'PASS'
    $Status.stage = 'complete'
    Write-Host "SUCCESS: $Destination"
    Start-Process explorer.exe -ArgumentList $Destination
} catch {
    $Status.status = 'FAIL'
    $Status.error = $_.Exception.Message
    Write-Host "FAILED: $($_.Exception.Message)"
} finally {
    $Status | ConvertTo-Json | Set-Content (Join-Path $Work 'build-status.json') -Encoding UTF8
    Stop-Transcript | Out-Null
    try {
        $Evidence = Join-Path $Shared "evidence/$RunId"
        New-Item -ItemType Directory -Path $Evidence -Force | Out-Null
        Copy-Item $Log $Evidence
        Copy-Item (Join-Path $Work 'build-status.json') $Evidence
        Copy-Item (Join-Path $Work 'build-status.json') (Join-Path $Shared 'latest-status.json') -Force
    } catch { Write-Host "Shared folder unavailable. Evidence remains at $Work" }
}
if ($Status.status -ne 'PASS') { exit 1 }
