@echo off

echo ====================================
echo CONVENIO CANCEL TEST (<48H BAND)
echo ====================================
echo.

powershell -ExecutionPolicy Bypass -File "%~dp0test_cancel_lt_48.ps1"

echo.
pause