@echo off
:: Navigate to the directory where your scripts are located
cd /d "%~dp0"

echo ====================================================
echo   CONVENIO AUTOMATED TEST RUNNER (FIREFOX)
echo ====================================================
echo.

:: Run the Master PowerShell script
powershell -ExecutionPolicy Bypass -File "run_all_tests.ps1"

echo.
echo ====================================================
echo   TEST RUN COMPLETE
echo ====================================================
pause