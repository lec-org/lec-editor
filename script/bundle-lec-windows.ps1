[CmdletBinding()]
param(
    [ValidateSet('x86_64', 'aarch64')][string]$Architecture = 'x86_64',
    [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true
$root = Split-Path $PSScriptRoot -Parent
Push-Location $root
try {
    $target = "$Architecture-pc-windows-msvc"
    $env:ZED_RELEASE_CHANNEL = 'stable'
    $env:RELEASE_CHANNEL = 'stable'
    $stage = Join-Path $root "target/lec-windows-$Architecture"
    New-Item -ItemType Directory -Force $stage | Out-Null
    if (-not $SkipBuild) {
        rustup target add $target
        cargo build --locked --release --package zed --bin leceditor --target $target
        if ($LASTEXITCODE -ne 0) { throw 'LEC Editor build failed' }
    }

    # ConPTY is downloaded by crates/zed/build.rs. Fail packaging if it is missing.
    $output = Join-Path $root "target/$target/release"
    foreach ($file in @('leceditor.exe', 'conpty.dll', 'OpenConsole.exe')) {
        Copy-Item (Join-Path $output $file) $stage -Force
    }
    Copy-Item LICENSE-GPL $stage -Force
    Copy-Item docs/lec/THIRD_PARTY.md $stage -Force
    # Generate the complete dependency notices, including upstream licenses.
    & "$PSScriptRoot/generate-licenses.ps1" "$stage/licenses.md"

    $version = (Select-String '^version = "([^"]+)"' crates/zed/Cargo.toml).Matches[0].Groups[1].Value
    $archive = Join-Path $root "target/LECEditor-$version-$Architecture.zip"
    Compress-Archive -Path "$stage/*" -DestinationPath $archive -Force
    $iscc = Join-Path ${env:ProgramFiles(x86)} 'Inno Setup 6/ISCC.exe'
    if (-not (Test-Path $iscc)) { throw 'Install Inno Setup 6 to build the installer' }
    & $iscc "/DSourceDir=$stage" "/DOutputDir=$root/target" "/DAppVersion=$version" "/DArchitecture=$Architecture" crates/zed/resources/windows/lec-editor.iss
    if ($LASTEXITCODE -ne 0) { throw 'LEC Editor installer build failed' }
} finally {
    Pop-Location
}
