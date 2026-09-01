param(
    [switch]$BootstrapOnly,
    [switch]$SkipSeed
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

function Write-Bootstrap {
    param([string]$Message)
    Write-Host "[bootstrap] $Message" -ForegroundColor Cyan
}

function Refresh-Path {
    $machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = "$machinePath;$userPath"
}

function Install-WingetPackage {
    param(
        [string]$Id,
        [string]$DisplayName
    )
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
        throw "缺少 winget，无法自动安装 $DisplayName。请先安装 Microsoft App Installer。"
    }
    Write-Bootstrap "安装系统工具：$DisplayName"
    winget install --id $Id --exact --accept-package-agreements --accept-source-agreements
    if ($LASTEXITCODE -ne 0) {
        throw "$DisplayName 安装失败，winget退出码：$LASTEXITCODE"
    }
    Refresh-Path
}

function Test-Python {
    if (Get-Command python -ErrorAction SilentlyContinue) {
        python -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 12) else 1)"
        if ($LASTEXITCODE -eq 0) {
            return "python"
        }
    }
    if (Get-Command py -ErrorAction SilentlyContinue) {
        py -3.12 -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 12) else 1)"
        if ($LASTEXITCODE -eq 0) {
            return "py"
        }
    }
    return $null
}

$pythonCommand = Test-Python
if (-not $pythonCommand) {
    Install-WingetPackage -Id "Python.Python.3.12" -DisplayName "Python 3.12"
    $pythonCommand = Test-Python
}
if (-not $pythonCommand) {
    throw "Python已安装但当前终端尚未识别，请重新打开PowerShell后再运行。"
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Install-WingetPackage -Id "OpenJS.NodeJS.LTS" -DisplayName "Node.js LTS"
}

if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Write-Bootstrap "安装 pnpm 11"
    npm install --global pnpm@11.7.0
    if ($LASTEXITCODE -ne 0) {
        throw "pnpm安装失败，npm退出码：$LASTEXITCODE"
    }
    Refresh-Path
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Install-WingetPackage -Id "Docker.DockerDesktop" -DisplayName "Docker Desktop"
}

docker info *> $null
if ($LASTEXITCODE -ne 0) {
    $dockerDesktop = Join-Path $env:ProgramFiles "Docker\Docker\Docker Desktop.exe"
    if (-not (Test-Path $dockerDesktop)) {
        throw "未找到 Docker Desktop。安装后可能需要重启 Windows。"
    }
    Write-Bootstrap "启动 Docker Desktop"
    Start-Process $dockerDesktop
    $deadline = (Get-Date).AddMinutes(3)
    do {
        Start-Sleep -Seconds 2
        docker info *> $null
        $ready = $LASTEXITCODE -eq 0
    } while (-not $ready -and (Get-Date) -lt $deadline)
    if (-not $ready) {
        throw "Docker Desktop未在3分钟内就绪，请检查 WSL 2/虚拟化状态。"
    }
}

$devArguments = @("scripts/dev.py")
if ($BootstrapOnly) {
    $devArguments += "--bootstrap-only"
}
if ($SkipSeed) {
    $devArguments += "--skip-seed"
}

if ($pythonCommand -eq "py") {
    & py -3.12 @devArguments
} else {
    & python @devArguments
}
exit $LASTEXITCODE
