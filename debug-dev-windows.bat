@echo off
setlocal enabledelayedexpansion

echo Marvel Rivals Mod Manager - DEBUG Development Server
echo ===================================================
echo This script will help identify why the development server isn't starting
echo.

:: Check current directory
echo [DEBUG] Current directory: %CD%
echo.

:: Check if package.json exists
if not exist "package.json" (
    echo [ERROR] package.json not found! Make sure you're in the correct directory.
    echo Expected location: Marvel Rivals Mod Manager project root
    pause
    exit /b 1
)
echo [OK] package.json found

:: Check if node_modules exists
if not exist "node_modules" (
    echo [ERROR] node_modules directory not found!
    echo [FIX] Run: pnpm install
    pause
    exit /b 1
)
echo [OK] node_modules directory exists

:: Test Node.js
echo.
echo [DEBUG] Testing Node.js...
node --version
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js not found or not working!
    echo [FIX] Install Node.js from https://nodejs.org/
    pause
    exit /b 1
)
echo [OK] Node.js is working

:: Test npm/npx
echo.
echo [DEBUG] Testing npx...
npx --version
if %ERRORLEVEL% neq 0 (
    echo [ERROR] npx not found or not working!
    echo [FIX] Reinstall Node.js or update npm
    pause
    exit /b 1
)
echo [OK] npx is working

:: Test pnpm
echo.
echo [DEBUG] Testing pnpm...
pnpm --version
if %ERRORLEVEL% neq 0 (
    echo [WARNING] pnpm not found! This might be the issue.
    echo [FIX] Install pnpm: npm install -g pnpm
    echo [INFO] Continuing with npm/npx...
)

:: Clean development files
echo.
echo [DEBUG] Cleaning development files...
if exist "node_modules\.dev" (
    echo Removing node_modules\.dev...
    rmdir /s /q "node_modules\.dev"
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] Failed to remove node_modules\.dev
        echo [FIX] Try running as administrator or delete manually
        pause
        exit /b 1
    )
    echo [OK] Cleaned successfully
) else (
    echo [INFO] No cleanup needed - directory doesn't exist
)

:: Test cross-env
echo.
echo [DEBUG] Testing cross-env availability...
npx cross-env --version
if %ERRORLEVEL% neq 0 (
    echo [ERROR] cross-env not available!
    echo [FIX] Installing cross-env...
    npm install cross-env
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] Failed to install cross-env
        pause
        exit /b 1
    )
    echo [OK] cross-env installed
) else (
    echo [OK] cross-env is available
)

:: Test electron-vite
echo.
echo [DEBUG] Testing electron-vite availability...
npx electron-vite --version
if %ERRORLEVEL% neq 0 (
    echo [ERROR] electron-vite not available!
    echo [FIX] This might be the main issue. Let's check package.json...
    
    :: Check if electron-vite is in package.json
    findstr "electron-vite" package.json >nul
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] electron-vite not found in package.json!
        echo [FIX] Run: pnpm install or npm install
        pause
        exit /b 1
    ) else (
        echo [INFO] electron-vite is listed in package.json but not available
        echo [FIX] Try: pnpm install --force or npm install --force
        pause
        exit /b 1
    )
) else (
    echo [OK] electron-vite is available
)

:: Test the actual command that's failing
echo.
echo [DEBUG] Testing the full development command...
echo [INFO] Running: npx cross-env NODE_ENV=development electron-vite --version
npx cross-env NODE_ENV=development electron-vite --version
if %ERRORLEVEL% neq 0 (
    echo [ERROR] The development command setup is failing!
    echo [DEBUG] Error level: %ERRORLEVEL%
    echo.
    echo [TROUBLESHOOTING OPTIONS]:
    echo 1. Run: pnpm install --force
    echo 2. Run: npm install --force
    echo 3. Delete node_modules and reinstall: rmdir /s /q node_modules ^&^& pnpm install
    echo 4. Check if you need Visual Studio Build Tools for native modules
    echo.
    pause
    exit /b 1
)

:: If we get here, try starting the actual development server
echo.
echo [SUCCESS] All checks passed! Starting development server...
echo [INFO] If this fails, check the error message below:
echo ========================================
echo.

:: Set environment and start
set NODE_ENV=development
npm run dev:win

:: Check if the command failed
if %ERRORLEVEL% neq 0 (
    echo.
    echo ========================================
    echo [ERROR] Development server failed to start!
    echo [DEBUG] Error level: %ERRORLEVEL%
    echo.
    echo [NEXT STEPS]:
    echo 1. Check the error messages above
    echo 2. Try: pnpm install --force
    echo 3. Try: npm run dev instead of this script
    echo 4. Check if you have all required build tools
    echo.
) else (
    echo.
    echo [INFO] Development server stopped normally
)

echo.
echo Press any key to exit...
pause > nul