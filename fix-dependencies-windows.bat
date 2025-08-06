@echo off
setlocal enabledelayedexpansion

echo Marvel Rivals Mod Manager - Dependency Fixer
echo =============================================
echo This script will attempt to fix dependency issues on Windows
echo.

:: Check current directory
if not exist "package.json" (
    echo [ERROR] package.json not found! Make sure you're in the correct directory.
    pause
    exit /b 1
)

echo [INFO] Step 1: Clearing package manager caches...
echo.

:: Clear npm cache
echo Clearing npm cache...
npm cache clean --force
if %ERRORLEVEL% neq 0 (
    echo [WARNING] npm cache clean failed, but continuing...
)

:: Clear pnpm cache if pnpm is available
pnpm --version >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo Clearing pnpm cache...
    pnpm store prune
    if %ERRORLEVEL% neq 0 (
        echo [WARNING] pnpm cache clear failed, but continuing...
    )
)

echo.
echo [INFO] Step 2: Removing existing node_modules and lock files...

:: Remove node_modules
if exist "node_modules" (
    echo Removing node_modules directory...
    rmdir /s /q "node_modules"
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] Failed to remove node_modules. Try running as administrator.
        pause
        exit /b 1
    )
)

:: Remove lock files
if exist "package-lock.json" (
    echo Removing package-lock.json...
    del "package-lock.json"
)

if exist "pnpm-lock.yaml" (
    echo Removing pnpm-lock.yaml...
    del "pnpm-lock.yaml"
)

if exist "yarn.lock" (
    echo Removing yarn.lock...
    del "yarn.lock"
)

echo.
echo [INFO] Step 3: Reinstalling dependencies...
echo.

:: Try pnpm first, then npm
echo Attempting to install with pnpm...
pnpm install --force
if %ERRORLEVEL% neq 0 (
    echo [WARNING] pnpm install failed. Trying with npm...
    echo.
    
    npm install --force
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] Both pnpm and npm installation failed!
        echo.
        echo [TROUBLESHOOTING]:
        echo 1. Make sure you have Node.js 18+ installed
        echo 2. You might need Visual Studio Build Tools for native modules
        echo 3. Try running this script as administrator
        echo 4. Check your internet connection
        echo.
        pause
        exit /b 1
    ) else (
        echo [SUCCESS] npm install completed!
        set PACKAGE_MANAGER=npm
    )
) else (
    echo [SUCCESS] pnpm install completed!
    set PACKAGE_MANAGER=pnpm
)

echo.
echo [INFO] Step 4: Installing critical development dependencies...
echo.

:: Install critical dependencies that might be missing
echo Installing electron-vite...
%PACKAGE_MANAGER% add -D electron-vite
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Failed to install electron-vite
)

echo Installing cross-env...
%PACKAGE_MANAGER% add -D cross-env
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Failed to install cross-env
)

echo Installing npm-run-all...
%PACKAGE_MANAGER% add -D npm-run-all
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Failed to install npm-run-all
)

echo Installing rimraf...
%PACKAGE_MANAGER% add -D rimraf
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Failed to install rimraf
)

echo.
echo [INFO] Step 5: Verifying installation...
echo.

:: Verify key dependencies
echo Checking electron-vite...
npx electron-vite --version
if %ERRORLEVEL% neq 0 (
    echo [ERROR] electron-vite verification failed
) else (
    echo [OK] electron-vite is working
)

echo Checking cross-env...
npx cross-env --version
if %ERRORLEVEL% neq 0 (
    echo [ERROR] cross-env verification failed
) else (
    echo [OK] cross-env is working
)

echo.
echo [SUCCESS] Dependency fix attempt completed!
echo.
echo [NEXT STEPS]:
echo 1. Try running: debug-dev-windows.bat
echo 2. Or try: %PACKAGE_MANAGER% run dev
echo 3. Or try: npm run dev:win
echo.

pause