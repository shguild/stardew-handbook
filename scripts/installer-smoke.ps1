$ErrorActionPreference = 'Stop'
$taskRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$packageInfo = Get-Content -LiteralPath (Join-Path $taskRoot 'package.json') -Encoding UTF8 -Raw | ConvertFrom-Json
$productName = $packageInfo.build.productName
$installerPath = Join-Path $taskRoot ('dist\Stardew-Handbook-{0}-Setup-Windows-x64.exe' -f $packageInfo.version)
$testRoot = Join-Path $taskRoot ('test-output\installer-cycle-' + [DateTime]::Now.ToString('yyyyMMdd-HHmmss-fff'))
$installDir = [IO.Path]::GetFullPath((Join-Path $testRoot ('Install Path ' + $productName)))
$profileDir = Join-Path $testRoot 'profile'
$applicationPath = Join-Path $installDir ($productName + '.exe')
$uninstallerPath = Join-Path $installDir ('Uninstall ' + $productName + '.exe')
$appGuid = & node -e 'const {UUID}=require("builder-util-runtime");console.log(UUID.v5(require("./package.json").build.appId,UUID.parse("50e065bc-3134-11e6-9bab-38c9862bdaf3")))'
if ($LASTEXITCODE -ne 0) { throw 'Cannot compute installer identity.' }
$appGuid = $appGuid.Trim()
$uninstallKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\' + $appGuid
$installKey = 'HKCU:\Software\' + $appGuid
$machineUninstallKey = 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\' + $appGuid
$desktopLink = Join-Path ([Environment]::GetFolderPath('DesktopDirectory')) ($productName + '.lnk')
$startMenuLink = Join-Path ([Environment]::GetFolderPath('Programs')) ($productName + '.lnk')
$realLibrary = Join-Path $env:APPDATA ($packageInfo.name + '\library.json')
$realLibraryHash = if (Test-Path -LiteralPath $realLibrary) { (Get-FileHash -LiteralPath $realLibrary -Algorithm SHA256).Hash } else { $null }

# Never replace an existing installation, shortcut or running user application.
foreach ($existingPath in @($uninstallKey, $installKey, $machineUninstallKey, $desktopLink, $startMenuLink)) {
  if (Test-Path -LiteralPath $existingPath) { throw ('Test refused to overwrite existing item: ' + $existingPath) }
}
if (Get-Process -Name $productName -ErrorAction SilentlyContinue) { throw 'Close the running application before installer verification.' }
if (-not $installDir.StartsWith($testRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe test installation path.' }
New-Item -ItemType Directory -Path $testRoot -Force | Out-Null

function Install-TestApp {
  # /D is the final NSIS parameter and deliberately has no quotes. Test spaces
  # and the Chinese product name in the destination directory.
  $setupProcess = Start-Process -FilePath $installerPath -ArgumentList ('/S /currentuser /D=' + $installDir) -WindowStyle Hidden -Wait -PassThru
  if ($setupProcess.ExitCode -ne 0) { throw ('Installer failed: ' + $setupProcess.ExitCode) }
  if (-not (Test-Path -LiteralPath $applicationPath)) { throw 'Installed executable is missing.' }
  if (-not (Test-Path -LiteralPath $uninstallerPath)) { throw 'Uninstaller is missing.' }
  $registration = Get-ItemProperty -LiteralPath $uninstallKey
  if ($registration.DisplayName -ne $productName -or $registration.DisplayVersion -ne $packageInfo.version) { throw 'Incorrect uninstall registration.' }
  $registeredDir = (Get-ItemProperty -LiteralPath $installKey).InstallLocation
  if ([IO.Path]::GetFullPath($registeredDir).TrimEnd('\') -ne $installDir.TrimEnd('\')) { throw 'Incorrect registered installation path.' }
  foreach ($shortcutPath in @($desktopLink, $startMenuLink)) {
    if (-not (Test-Path -LiteralPath $shortcutPath)) { throw ('Shortcut missing: ' + $shortcutPath) }
  }
  $versionInfo = (Get-Item -LiteralPath $applicationPath).VersionInfo
  if ($versionInfo.ProductName -ne $productName -or $versionInfo.FileVersion -notlike ($packageInfo.version + '*')) { throw 'Installed program metadata is incorrect.' }
  Write-Output 'PASS: installation, Chinese/spaced path, metadata, desktop/start menu shortcuts and uninstall registration'
}

function Uninstall-TestApp {
  if (-not (Test-Path -LiteralPath $uninstallKey)) { return }
  $registeredDir = (Get-ItemProperty -LiteralPath $installKey).InstallLocation
  # The shipped uninstaller recursively removes its registered installation.
  # Verify the exact absolute directory remains inside this test's workspace.
  if ([IO.Path]::GetFullPath($registeredDir).TrimEnd('\') -ne $installDir.TrimEnd('\')) { throw 'Refusing to uninstall a different directory.' }
  $removeProcess = Start-Process -FilePath $uninstallerPath -ArgumentList '/S /currentuser' -WindowStyle Hidden -Wait -PassThru
  if ($removeProcess.ExitCode -ne 0) { throw ('Uninstall failed: ' + $removeProcess.ExitCode) }
  $deadline = [DateTime]::Now.AddSeconds(30)
  while ((Test-Path -LiteralPath $applicationPath) -or (Test-Path -LiteralPath $uninstallKey)) {
    if ([DateTime]::Now -gt $deadline) { throw 'Uninstall did not complete.' }
    Start-Sleep -Milliseconds 200
  }
  foreach ($removedPath in @($desktopLink, $startMenuLink, $installKey)) {
    if (Test-Path -LiteralPath $removedPath) { throw ('Uninstall left an item: ' + $removedPath) }
  }
  if ($realLibraryHash -and (Get-FileHash -LiteralPath $realLibrary -Algorithm SHA256).Hash -ne $realLibraryHash) { throw 'Existing user library changed.' }
  Write-Output 'PASS: uninstallation removes program, shortcuts and registration; existing library is unchanged'
}

try {
  Install-TestApp
  & node (Join-Path $PSScriptRoot 'installed-smoke.cjs') --exe $applicationPath --profile $profileDir --stage first --desktop-link $desktopLink --start-menu-link $startMenuLink
  if ($LASTEXITCODE -ne 0) { throw 'First installed launch verification failed.' }
  $testLibrary = Join-Path $profileDir 'library.json'
  $savedLibraryHash = (Get-FileHash -LiteralPath $testLibrary -Algorithm SHA256).Hash
  Uninstall-TestApp
  if ((Get-FileHash -LiteralPath $testLibrary -Algorithm SHA256).Hash -ne $savedLibraryHash) { throw 'Test library was not retained.' }
  Install-TestApp
  & node (Join-Path $PSScriptRoot 'installed-smoke.cjs') --exe $applicationPath --profile $profileDir --stage reinstall --desktop-link $desktopLink --start-menu-link $startMenuLink
  if ($LASTEXITCODE -ne 0) { throw 'Reinstalled launch verification failed.' }
  Uninstall-TestApp
  [ordered]@{ passed = $true; version = $packageInfo.version; at = [DateTime]::UtcNow.ToString('o'); installCycles = 2; unicodeAndSpacedPath = $true; shortcuts = $true; uninstallRegistration = $true; retainedTestFavorite = $true; existingLibraryChecked = [bool]$realLibraryHash } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $taskRoot 'test-output\installer-smoke.json') -Encoding UTF8
} finally {
  # On failure, remove only the test installation if it was registered here.
  if (Test-Path -LiteralPath $uninstallKey) { Uninstall-TestApp }
}
