param([string]$CredentialFile = "", [switch]$Public)
if ($Public -and $CredentialFile) { throw "Public build cannot accept credentials." }
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$Root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
Set-Location $Root
function Run([string]$Program, [string[]]$Arguments) {
    & $Program @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Command failed: $Program (exit $LASTEXITCODE)" }
}
$Platform = & python -c "import sysconfig; print(sysconfig.get_platform())"
if ($Platform.Trim() -ne 'win-amd64') { throw 'An x64 Windows Python is required.' }
if ((& node -p "process.arch").Trim() -ne 'x64') { throw 'An x64 Node is required.' }
if (!(Test-Path 'apps/web/dist/index.html')) { throw 'Desktop frontend missing; regenerate the source kit on the development machine.' }
Run 'python' @('-m', 'venv', '.venv')
$Python = Join-Path $Root '.venv/Scripts/python.exe'
$PipArgs = @('-m','pip','install','--disable-pip-version-check','-r','scripts/desktop/requirements-windows.txt')
if ($env:EXPERT_WHEELHOUSE) { $PipArgs += @('--no-index','--find-links',$env:EXPERT_WHEELHOUSE) }
Run $Python $PipArgs
Run 'npm.cmd' @('ci','--prefix','desktop','--no-audit','--no-fund')
Run 'node' @('desktop/node_modules/electron/install.js')
Run 'node' @('--test','desktop/security.test.cjs','desktop/deadline.test.cjs','desktop/public-config.test.cjs')
$env:NEGOTIATION_PUBLIC_BUILD = if ($Public) {'1'} else {'0'}
Run $Python @('-m','PyInstaller','--noconfirm','--distpath','build/desktop-backend',
    '--workpath','build/pyinstaller','scripts/desktop/backend.spec')
New-Item -ItemType Directory -Path 'build/desktop-credential' -Force | Out-Null
Set-Content 'build/desktop-credential/README.txt' 'Mock build: no model credentials included.' -Encoding UTF8
$Output = Join-Path $Root $(if ($Public) {'public-release/windows-x64'} else {'release/windows-x64'})
if ($CredentialFile) {
    # Read privately: never echo the object or put its values on the command line.
    $env:PYTHONPATH = Join-Path $Root 'apps/api'
    Run $Python @('scripts/desktop/validate-credential.py', $CredentialFile)
    Copy-Item -LiteralPath $CredentialFile -Destination 'build/desktop-credential/demo-credential.json'
    $Output = Join-Path $Root 'private-release/windows-x64'
} elseif (Test-Path 'build/desktop-credential/demo-credential.json') {
    throw 'Private credential exists in staging. Use a fresh mock workspace.'
}
if ($Public) { Run $Python @('scripts/desktop/collect-notices.py') }
try {
    Push-Location (Join-Path $Root 'desktop')
    $BuilderArgs = @('--no-install','electron-builder','--win','nsis','--x64','--publish','never',
        "--config.directories.output=$Output")
    if ($Public) { $BuilderArgs += @('--config','public-builder.cjs') }
    Run 'npx.cmd' $BuilderArgs
} finally { Pop-Location }
if ($Public) {
    Copy-Item 'build/public-notices/THIRD-PARTY-NOTICES.txt' $Output
    Copy-Item 'docs/handoff/windows-public/USER-GUIDE.md' $Output
}
$Installers = @(Get-ChildItem -LiteralPath $Output -Filter '*-setup.exe')
if ($Installers.Count -ne 1) { throw 'Expected exactly one installer.' }
$Exe = Join-Path $Output 'win-unpacked/ForeignTradeExpert.exe'
if (!(Test-Path $Exe)) {
    $Exe = (Get-ChildItem (Join-Path $Output 'win-unpacked') -Filter '*.exe' |
        Where-Object { $_.Name -notlike '*Uninstall*' } | Select-Object -First 1).FullName
}
Run $Python @('scripts/desktop/check-pe.py', $Exe,
    (Join-Path $Output 'win-unpacked/resources/backend/negotiation-backend.exe'))
if ($Public) {
    Run 'node' @('scripts/desktop/audit-public.cjs', (Join-Path $Output 'win-unpacked'))
}
$Smoke = Join-Path $Output 'desktop-smoke.json'
$Process = Start-Process -FilePath $Exe -ArgumentList @('--desktop-smoke', "--smoke-output=`"$Smoke`"") -PassThru
if (!$Process.WaitForExit(180000)) { $Process.Kill(); throw 'Desktop smoke test timed out.' }
if (!(Test-Path $Smoke)) { throw 'Desktop smoke evidence missing.' }
$Result = Get-Content $Smoke -Raw -Encoding UTF8 | ConvertFrom-Json
if ($Public -and ($Result.edition -ne 'public' -or $Result.mode -ne 'mock')) { throw 'Public edition evidence mismatch.' }
if ($Result.status -ne 'PASS' -or $Result.arch -ne 'x64') { throw 'Desktop smoke failed.' }
foreach ($File in $Installers) {
    $Hash = (Get-FileHash -LiteralPath $File.FullName -Algorithm SHA256).Hash.ToLower()
    "$Hash  $($File.Name)" | Set-Content ($File.FullName + '.sha256') -Encoding UTF8
}
@{
    status='PASS'; target='win-x64'; node=(& node --version); python=(& $Python --version)
    electron='44.4.5'; mode=$(if ($Public) {'public-user-key'} elseif ($CredentialFile) {'private-deepseek'} else {'mock'})
    osArchitecture=$env:PROCESSOR_ARCHITECTURE; time=(Get-Date).ToString('o')
    evidence='desktop-smoke.json'; installer=$Installers[0].Name
} | ConvertTo-Json | Set-Content (Join-Path $Output 'build-manifest.json') -Encoding UTF8
Write-Host "Build and smoke passed: $Output"
