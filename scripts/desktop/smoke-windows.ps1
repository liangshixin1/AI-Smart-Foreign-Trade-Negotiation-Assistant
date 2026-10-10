$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
$Dialog = New-Object System.Windows.Forms.OpenFileDialog
$Dialog.Title = 'Select the INSTALLED expert application exe (not setup.exe)'
$Dialog.Filter = 'Application (*.exe)|*.exe'
$Dialog.InitialDirectory = Join-Path $env:LOCALAPPDATA 'Programs'
if ($Dialog.ShowDialog() -ne 'OK') { exit 1 }
if ($Dialog.FileName -like '*setup.exe') { throw 'Select the installed app, not the installer.' }
$Root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$Output = Join-Path $Root 'release/windows-x64/installed-smoke.json'
$LocalOutput = Join-Path $env:TEMP ("expert-smoke-" + [guid]::NewGuid() + '.json')
Write-Host 'Close other expert app windows before this test. Your review history is not modified.'
$Process = Start-Process -FilePath $Dialog.FileName -ArgumentList @('--desktop-smoke', "--smoke-output=`"$LocalOutput`"") -PassThru
if (!$Process.WaitForExit(180000)) { $Process.Kill(); throw 'Installed smoke timed out.' }
if (!(Test-Path $LocalOutput)) { throw 'No smoke evidence. Close other running instances and retry.' }
Copy-Item $LocalOutput $Output -Force
Get-Content $Output -Encoding UTF8
$Result = Get-Content $Output -Raw -Encoding UTF8 | ConvertFrom-Json
if ($Result.status -ne 'PASS') { exit 1 }
