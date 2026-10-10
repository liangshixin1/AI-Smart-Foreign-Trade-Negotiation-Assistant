$ErrorActionPreference = 'Stop'
$BuildRoot = Join-Path $env:LOCALAPPDATA 'ForeignTradeExpert-Build'
$Recent = Get-ChildItem $BuildRoot -Directory | Sort-Object Name -Descending |
    Where-Object { Test-Path (Join-Path $_.FullName 'source/desktop/node_modules/electron/dist/electron.exe') } |
    Select-Object -First 1
if (!$Recent) { throw 'Build the mock version first.' }
$Electron = Join-Path $Recent.FullName 'source/desktop/node_modules/electron/dist/electron.exe'
$Desktop = Join-Path $Recent.FullName 'source/desktop'
& $Electron $Desktop '--inject-credentials'
