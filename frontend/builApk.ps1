```powershell
Write-Host "========================================="
Write-Host "Starting Android APK Build..."
Write-Host "========================================="

Set-Location "C:\Users\Azeem\Desktop\Aegis - Eval\frontend"

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
Write-Host "========================================="
Write-Host "BUILD SUCCESSFUL"
Write-Host "APK Location:"
Write-Host ".\app\build\outputs\apk\release\app-release.apk"
Write-Host "========================================="
```
