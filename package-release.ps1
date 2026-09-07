# Called by build.bat after compilation. Copies files; never moves project sources.
[CmdletBinding()]
param([switch]$StageOnly)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$projectRoot = [IO.Path]::GetFullPath($PSScriptRoot)
$stagePath = Join-Path $projectRoot 'staging\app'
$releasePath = Join-Path $projectRoot 'releases\MML Music Studio-win32-x64'
$electronPath = Join-Path $projectRoot 'node_modules\electron\dist'

# Clean only these generated paths; reject junctions and symlinks first.
function Assert-OutputPath([string]$Target) {
    $absolute = [IO.Path]::GetFullPath($Target)
    if ($absolute -ne $stagePath -and $absolute -ne $releasePath) { throw "Unexpected output directory: $absolute" }
    $relative = $absolute.Substring($projectRoot.Length + 1)
    $cursor = $projectRoot
    foreach ($part in $relative.Split('\')) {
        $cursor = Join-Path $cursor $part
        if (Test-Path -LiteralPath $cursor) {
            $item = Get-Item -LiteralPath $cursor -Force
            if (-not $item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw "Unsafe output path: $cursor" }
        }
    }
    if (Test-Path -LiteralPath $absolute) {
        foreach ($item in Get-ChildItem -LiteralPath $absolute -Recurse -Force) {
            if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Linked output item: $($item.FullName)" }
        }
    }
}
function Reset-Output([string]$Target) {
    Assert-OutputPath $Target
    if (Test-Path -LiteralPath $Target) { Remove-Item -LiteralPath $Target -Recurse -Force }
    New-Item -ItemType Directory -Path $Target -Force | Out-Null
}
try {
    $manifest = Get-Content -LiteralPath (Join-Path $projectRoot 'package.json') -Raw | ConvertFrom-Json
    $runtimeFiles = @('main.cjs', 'preload.cjs', 'index.html', 'mml.html', 'studio.css', 'themes.css', 'style.css')
    $assetFiles = @('logo.ico', 'logo.png', 'logo.svg', 'TimGM6mb.sf2', 'TimGM6mb-LICENSE.txt', 'GPL-2.txt')
    $vendorFiles = @('synth.js', 'spessasynth_processor.min.js', 'SpessaSynth-LICENSE.txt', 'SpessaSynth-Core-LICENSE.txt')
    # Derive module paths from current source to exclude stale compiled files.
    $compiledFiles = @(Get-ChildItem -LiteralPath (Join-Path $projectRoot 'src') -Filter '*.ts' -Recurse -File | ForEach-Object {
        'dist\' + [IO.Path]::ChangeExtension($_.FullName.Substring((Join-Path $projectRoot 'src').Length + 1), '.js')
    })
    $files = @($runtimeFiles) + @($assetFiles | ForEach-Object { 'assets\' + $_ }) + @($vendorFiles | ForEach-Object { 'vendor\' + $_ }) + $compiledFiles
    foreach ($file in $files) {
        if (-not (Test-Path -LiteralPath (Join-Path $projectRoot $file) -PathType Leaf)) { throw "Missing runtime file: $file. Run build.bat after npm ci." }
    }
    if (-not $StageOnly) {
        if (-not (Test-Path -LiteralPath (Join-Path $electronPath 'electron.exe') -PathType Leaf)) { throw 'Electron runtime missing. Run npm ci.' }
        $electronVersion = (Get-Content -LiteralPath (Join-Path $electronPath 'version') -Raw).Trim()
        if ($electronVersion -ne $manifest.devDependencies.electron) { throw "Installed Electron $electronVersion differs from package.json. Run npm ci." }
        $executable = [IO.File]::ReadAllBytes((Join-Path $electronPath 'electron.exe'))
        $peOffset = [BitConverter]::ToInt32($executable, 60)
        if ([BitConverter]::ToUInt16($executable, $peOffset + 4) -ne 0x8664) { throw 'This release script requires the Windows x64 Electron runtime.' }
        Assert-OutputPath $releasePath
    }
    Reset-Output $stagePath
    foreach ($file in $files) {
        $target = Join-Path $stagePath $file
        New-Item -ItemType Directory -Path (Split-Path -Parent $target) -Force | Out-Null
        Copy-Item -LiteralPath (Join-Path $projectRoot $file) -Destination $target
    }
    # Runtime uses bundled vendor JS; omit build scripts and npm dependencies.
    $runtimeManifest = [ordered]@{ name=$manifest.name; version=$manifest.version; private=$true; main=$manifest.main; type=$manifest.type }
    $utf8 = New-Object System.Text.UTF8Encoding($false)
    [IO.File]::WriteAllText((Join-Path $stagePath 'package.json'), ($runtimeManifest | ConvertTo-Json), $utf8)
    Write-Host "Staged $($files.Count + 1) runtime files in $stagePath"
    if ($StageOnly) { exit 0 }
    Reset-Output $releasePath
    # Keep Electron's complete distribution: DLLs, locales and license notices.
    Get-ChildItem -LiteralPath $electronPath -Force | ForEach-Object {
        Copy-Item -LiteralPath $_.FullName -Destination $releasePath -Recurse
    }
    Rename-Item -LiteralPath (Join-Path $releasePath 'electron.exe') -NewName 'MML Music Studio.exe'
    # Embed the existing blue note-M icon in the copied executable before ZIPping.
    if (-not ('StudioExecutableIcon' -as [type])) { Add-Type -Path (Join-Path $projectRoot 'build-icon.cs') }
    [StudioExecutableIcon]::Apply((Join-Path $releasePath 'MML Music Studio.exe'), (Join-Path $projectRoot 'assets\logo.ico'), $manifest.version)
    Write-Host 'Embedded MML Studio executable icon and application metadata.'
    $defaultApp = Join-Path $releasePath 'resources\default_app.asar'
    if (Test-Path -LiteralPath $defaultApp) { Remove-Item -LiteralPath $defaultApp }
    Copy-Item -LiteralPath $stagePath -Destination (Join-Path $releasePath 'resources\app') -Recurse
    Write-Host "Packaged Electron $electronVersion at $releasePath"
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zipPath = $releasePath + '.zip'
    if (Test-Path -LiteralPath $zipPath) {
        $item = Get-Item -LiteralPath $zipPath -Force
        if ($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw "Unsafe archive path: $zipPath" }
    }
    $temporaryZip = Join-Path (Split-Path -Parent $releasePath) ([Guid]::NewGuid().ToString() + '.tmp.zip')
    try {
        Write-Host 'Creating release ZIP...'
        # Include the enclosing app folder. Keep the previous ZIP until the new
        # archive finishes, so compression failure cannot leave a partial ZIP.
        [IO.Compression.ZipFile]::CreateFromDirectory($releasePath, $temporaryZip, [IO.Compression.CompressionLevel]::Optimal, $true)
        Move-Item -LiteralPath $temporaryZip -Destination $zipPath -Force
    } finally {
        if (Test-Path -LiteralPath $temporaryZip) { Remove-Item -LiteralPath $temporaryZip }
    }
    Write-Host "Release ZIP: $zipPath"
    Write-Host 'Distribute the ZIP; extract the entire folder before running the EXE.'
} catch {
    Write-Error $_
    exit 1
}
