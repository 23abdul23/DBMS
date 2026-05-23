Write-Host "========================================="
Write-Host "Starting Android APK Build..."
Write-Host "========================================="

Set-Location "C:\Users\Azeem\Desktop\Aegis\frontend"

Write-Host ""
Write-Host "Step 1: Installing dependencies..."
npm install

Write-Host ""
Write-Host "Step 2: Running Expo prebuild (clean)..."
npx expo prebuild --clean

Write-Host ""
Write-Host "Step 3: Moving to android folder..."
Set-Location .\android

Write-Host ""
Write-Host "Step 4: Stopping old Gradle daemons..."
.\gradlew.bat --stop

Write-Host ""
Write-Host "Step 5: Cleaning Gradle build..."
.\gradlew.bat clean

Write-Host ""
Write-Host "Step 6: Building Release APK..."
.\gradlew.bat assembleRelease

Write-Host ""
Write-Host "Step 7: Renaming APK..."

# Move back to frontend root
Set-Location ..

# Extract version from app.config.js
$versionLine = Get-Content .\app.config.js | Select-String "version:"
$version = ($versionLine -replace '.*version:\s*''([^'']+)''.*', '$1')

# APK paths
$apkFolder = ".\android\app\build\outputs\apk\release"
$sourceApk = "$apkFolder\app-release.apk"

# Final APK name
$newApkName = "AegisID_V_$version.apk"
$destinationApk = "$apkFolder\$newApkName"

# Remove old APK with same name if exists
if (Test-Path $destinationApk) {
    Remove-Item $destinationApk -Force
}

# Rename APK
Rename-Item -Path $sourceApk -NewName $newApkName -Force

Write-Host ""
Write-Host "========================================="
Write-Host "BUILD SUCCESSFUL"
Write-Host "APK Location:"
Write-Host $destinationApk
Write-Host "========================================="