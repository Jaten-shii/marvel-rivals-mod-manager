@echo off
echo Marvel Rivals Mod Manager - Simple Development Start
echo ==================================================
echo.

:: Navigate to project directory (in case script is run from elsewhere)
cd /d "%~dp0"

:: Check if package.json exists
if not exist "package.json" (
    echo ERROR: Not in the correct directory! 
    echo Make sure this script is in the Marvel Rivals Mod Manager folder.
    pause
    exit /b 1
)

echo Starting development server...
echo If you see errors, run 'fix-dependencies-windows.bat' first
echo.
echo ========================================

:: Try the most direct approach - use the Windows-specific script
npm run dev:win

echo ========================================
echo.
if %ERRORLEVEL% neq 0 (
    echo Development server failed to start!
    echo.
    echo Try these solutions:
    echo 1. Run: fix-dependencies-windows.bat
    echo 2. Run: debug-dev-windows.bat
    echo 3. Install dependencies: pnpm install --force
) else (
    echo Development server stopped normally.
)

echo.
pause