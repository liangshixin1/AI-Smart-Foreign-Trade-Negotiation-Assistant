param([switch]$SkipInstall, [switch]$Public)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$Root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$Release = Join-Path $Root 'release/windows-x64'
if ($Public) { $Release = Join-Path $Root 'public-release/windows-x64' }
$Installer = Join-Path $Release 'ForeignTradeExpert-0.1.0-win-x64-setup.exe'
if ($Public) { $Installer = Join-Path $Release 'ForeignTradePublic-0.2.0-win-x64-setup.exe' }
$Product = if ($Public) {'外贸谈判公开体验版'} else {'外贸谈判专家体验版'}
$RunId = Get-Date -Format 'yyyyMMdd-HHmmss'
$Local = Join-Path $env:LOCALAPPDATA "ForeignTradeExpert-Acceptance/$RunId"
New-Item -ItemType Directory -Path $Local -Force | Out-Null
$Status = @{status='RUNNING'; stage='installer-checksum'; runId=$RunId}
Start-Transcript -Path (Join-Path $Local 'installation-test.log') | Out-Null

function Read-Amd64([string]$File) {
    $Stream = [IO.File]::OpenRead($File)
    $Reader = New-Object IO.BinaryReader($Stream)
    try {
        if ($Reader.ReadUInt16() -ne 0x5a4d) { throw 'Not a Windows PE binary.' }
        $Stream.Position = 0x3c
        $Offset = $Reader.ReadUInt32()
        if ($Offset -gt ($Stream.Length - 6)) { throw 'Invalid PE header offset.' }
        $Stream.Position = $Offset
        if ($Reader.ReadUInt32() -ne 0x00004550) { throw 'Invalid PE signature.' }
        if ($Reader.ReadUInt16() -ne 0x8664) { throw 'Application or backend is not AMD64.' }
        return 'AMD64'
    } finally { $Reader.Dispose(); $Stream.Dispose() }
}

function Find-InstalledApp {
    $Keys = @(
        'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
        'HKCU:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*'
    )
    foreach ($Key in $Keys) {
        foreach ($Item in @(Get-ItemProperty $Key -ErrorAction SilentlyContinue)) {
            $Name = $Item.PSObject.Properties['DisplayName']
            $Icon = $Item.PSObject.Properties['DisplayIcon']
            if ($Name -and $Icon -and ([string]$Name.Value).StartsWith($Product)) {
                $Candidate = (([string]$Icon.Value) -replace ',\d+$','').Trim('"')
                if ((Test-Path -LiteralPath $Candidate) -and $Candidate.EndsWith('.exe')) {
                    return $Candidate
                }
            }
        }
    }
    # Reading a shortcut target does not launch or modify it.
    $Shortcut = Join-Path ([Environment]::GetFolderPath('Desktop')) ($Product + '.lnk')
    if (Test-Path -LiteralPath $Shortcut) {
        $Shell = New-Object -ComObject WScript.Shell
        $Candidate = $Shell.CreateShortcut($Shortcut).TargetPath
        if (Test-Path -LiteralPath $Candidate) { return $Candidate }
    }
    Add-Type -AssemblyName System.Windows.Forms
    $Picker = New-Object System.Windows.Forms.OpenFileDialog
    $Picker.Title = 'Select the installed expert application (not setup.exe)'
    $Picker.Filter = 'Application (*.exe)|*.exe'
    $Picker.InitialDirectory = Join-Path $env:LOCALAPPDATA 'Programs'
    if ($Picker.ShowDialog() -ne 'OK') { throw 'Installed application selection cancelled.' }
    return $Picker.FileName
}

try {
    $Expected = ((Get-Content ($Installer + '.sha256') -Raw -Encoding UTF8).Trim() -split '\s+')[0]
    $Actual = (Get-FileHash -LiteralPath $Installer -Algorithm SHA256).Hash.ToLower()
    if ($Actual -ne $Expected) { throw 'Installer checksum mismatch. Installation was not started.' }
    $Status.installerSha256 = $Actual
    $Status.osArchitecture = $env:PROCESSOR_ARCHITECTURE
    if (!$SkipInstall) {
        $Status.stage = 'installation'
        $LocalInstaller = Join-Path $Local (Split-Path $Installer -Leaf)
        Copy-Item -LiteralPath $Installer -Destination $LocalInstaller
        if ((Get-FileHash $LocalInstaller -Algorithm SHA256).Hash.ToLower() -ne $Expected) {
            throw 'Local installer copy checksum mismatch.'
        }
        Write-Host 'Installing for the current user. Complete the normal installer window.'
        # Start-Process -Wait waits for descendants too, including the auto-started app.
        # Wait for the installer itself so a successful installation cannot look hung.
        $Setup = Start-Process -FilePath $LocalInstaller -PassThru
        if (!$Setup.WaitForExit(600000)) {
            throw 'Installer is still open. Complete it, then rerun this script with -SkipInstall.'
        }
        if ($Setup.ExitCode -ne 0) { throw "Installer exited with code $($Setup.ExitCode)." }
    }
    $Status.stage = 'installed-binary-verification'
    $Exe = Find-InstalledApp
    if ($Exe -like '*setup.exe' -or $Exe -like '*win-unpacked*' -or $Exe -like '*ForeignTradeExpert-Build*') {
        throw 'Select the installed app, not the installer or build output.'
    }
    $Backend = Join-Path (Split-Path $Exe -Parent) 'resources/backend/negotiation-backend.exe'
    $Status.applicationMachine = Read-Amd64 $Exe
    $Status.backendMachine = Read-Amd64 $Backend
    $Status.applicationSha256 = (Get-FileHash $Exe -Algorithm SHA256).Hash.ToLower()
    $Status.backendSha256 = (Get-FileHash $Backend -Algorithm SHA256).Hash.ToLower()
    $Status.stage = 'installed-smoke'
    $Smoke = Join-Path $Local 'installed-smoke.json'
    Write-Host 'Testing the installed application using separate synthetic data.'
    $Process = Start-Process -FilePath $Exe -ArgumentList @('--desktop-smoke', "--smoke-output=`"$Smoke`"") -PassThru
    if (!$Process.WaitForExit(180000)) { $Process.Kill(); throw 'Installed smoke timed out.' }
    if (!(Test-Path $Smoke)) { throw 'Smoke result missing. Close any other smoke-test instance and retry with -SkipInstall.' }
    $Result = Get-Content $Smoke -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($Public -and ($Result.edition -ne 'public' -or $Result.mode -ne 'mock')) { throw 'Public smoke mismatch.' }
    if ($Result.status -ne 'PASS' -or $Result.arch -ne 'x64' -or $Result.platform -ne 'win32') {
        throw 'Installed desktop smoke did not pass.'
    }
    $Status.status = 'PASS'
    $Status.stage = 'complete'
    Write-Host 'PASS: installed app and backend are AMD64; installed UI smoke passed.'
    Write-Host 'Next: manually test Counter-offer, LC correction, teacher replay and restart persistence.'
} catch {
    $Status.status = 'FAIL'
    $Status.error = $_.Exception.Message
    Write-Host "FAILED: $($_.Exception.Message)"
} finally {
    $Status.time = (Get-Date).ToString('o')
    $Status | ConvertTo-Json | Set-Content (Join-Path $Local 'installed-acceptance.json') -Encoding UTF8
    Stop-Transcript | Out-Null
    try {
        $Shared = Join-Path $Release "evidence/install-$RunId"
        New-Item -ItemType Directory -Path $Shared -Force | Out-Null
        foreach ($Name in @('installation-test.log','installed-acceptance.json','installed-smoke.json','installed-smoke.json.png','installed-smoke.json.settings.png')) {
            $File = Join-Path $Local $Name
            if (Test-Path $File) { Copy-Item -LiteralPath $File -Destination $Shared }
        }
        Copy-Item (Join-Path $Local 'installed-acceptance.json') (Join-Path $Release 'latest-install-status.json') -Force
        Write-Host "Evidence saved to: $Shared"
    } catch { Write-Host "Evidence remains at: $Local" }
}
if ($Status.status -ne 'PASS') { exit 1 }
