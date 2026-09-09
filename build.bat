@echo off
setlocal
pushd "%~dp0"
if errorlevel 1 exit /b 1
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install Node.js and run npm ci first.
  goto failed
)
if not exist "node_modules\electron\dist\electron.exe" (
  echo Installed dependencies are missing. Run npm ci first.
  goto failed
)
echo Compiling MML Studio...
node build.cjs
if errorlevel 1 goto failed
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0package-release.ps1"
if errorlevel 1 goto failed
echo.
echo Build complete: releases\MML Music Studio-win32-x64\MML Music Studio.exe
echo ZIP ready: releases\MML Music Studio-win32-x64.zip
popd
exit /b 0
:failed
echo.
echo Build failed. See the error above; no further steps were run.
popd
if /I not "%~1"=="--no-pause" pause
exit /b 1
