@echo off
setlocal

echo ====================================
echo CONVENIO COMPLETION TEST
echo ====================================
echo.

REM Run the PowerShell test from this folder
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0test_complete_flow.ps1"

echo.
pause
endlocal