@echo off

echo ====================================
echo CONVENIO CANCEL TEST (>72H BAND)
echo ====================================
echo.

powershell -ExecutionPolicy Bypass -File "%~dp0test_cancel_gt_72.ps1"

echo.
pause