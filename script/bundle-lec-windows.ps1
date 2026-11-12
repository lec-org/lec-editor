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
    if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
    New-Item -ItemType Directory -Force $stage | Out-Null
    # Generate notices before compilation so the embedded license viewer is populated.
    & "$PSScriptRoot/generate-licenses.ps1"
    if (-not $SkipBuild) {
        rustup target add $target
        cargo build --locked --release --package zed --package cli --target $target
        if ($LASTEXITCODE -ne 0) { throw 'LEC Editor build failed' }
    }

    # ConPTY is downloaded by crates/zed/build.rs. Fail packaging if it is missing.
    $output = Join-Path $root "target/$target/release"
    foreach ($file in @('leceditor.exe', 'conpty.dll', 'OpenConsole.exe')) {
        Copy-Item (Join-Path $output $file) $stage -Force
    }
    New-Item -ItemType Directory -Force "$stage/bin" | Out-Null
    Copy-Item (Join-Path $output 'cli.exe') "$stage/bin/leceditor.exe" -Force
    Copy-Item LICENSE-GPL $stage -Force
    Copy-Item docs/lec/THIRD_PARTY.md $stage -Force
    Copy-Item assets/licenses.md $stage -Force
    if ($Architecture -eq 'x86_64') {
        $agsArchive = Join-Path $root 'target/lec-ags-6.3.0.zip'
        $agsDirectory = Join-Path $root 'target/lec-ags-6.3.0'
        Invoke-WebRequest 'https://codeload.github.com/GPUOpen-LibrariesAndSDKs/AGS_SDK/zip/refs/tags/v6.3.0' -OutFile $agsArchive
        Expand-Archive $agsArchive $agsDirectory -Force
        Copy-Item "$agsDirectory/AGS_SDK-6.3.0/ags_lib/lib/amd_ags_x64.dll" $stage -Force
        Copy-Item "$agsDirectory/AGS_SDK-6.3.0/LICENSE.txt" "$stage/AMD-AGS-LICENSE.txt" -Force
    }

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
