@echo off
setlocal

echo ====================================
echo CONVENIO CANCEL TEST (48-72H BAND)
echo ====================================
echo.

REM IMPORTANT:
REM - Uses PowerShell to run the .ps1 test (same as your other tests)
REM - You run this from CMD.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0test_cancel_48_72.ps1"

echo.
echo Press any key to close...
pause >nul