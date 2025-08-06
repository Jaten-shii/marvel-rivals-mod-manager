# Marvel Rivals Mod Manager - PowerShell Debug Script
param(
    [switch]$SkipChecks = $false
)

Write-Host "Marvel Rivals Mod Manager - DEBUG Development Server (PowerShell)" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

# Function to check command availability
function Test-Command {
    param([string]$Command)
    try {
        Get-Command $Command -ErrorAction Stop | Out-Null
        return $true
    } catch {
        return $false
    }
}

# Function to run command and capture output
function Invoke-CommandWithLogging {
    param(
        [string]$Command,
        [string]$Arguments = "",
        [string]$Description = ""
    )
    
    if ($Description) {
        Write-Host "[DEBUG] $Description" -ForegroundColor Yellow
    }
    
    Write-Host "Running: $Command $Arguments" -ForegroundColor Gray
    
    try {
        if ($Arguments) {
            $result = & $Command $Arguments.Split(' ') 2>&1
        } else {
            $result = & $Command 2>&1
        }
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[OK] Command succeeded" -ForegroundColor Green
            if ($result) {
                Write-Host $result -ForegroundColor White
            }
            return $true
        } else {
            Write-Host "[ERROR] Command failed with exit code: $LASTEXITCODE" -ForegroundColor Red
            if ($result) {
                Write-Host $result -ForegroundColor Red
            }
            return $false
        }
    } catch {
        Write-Host "[ERROR] Exception: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

if (-not $SkipChecks) {
    # Check current directory
    Write-Host "[DEBUG] Current directory: $(Get-Location)" -ForegroundColor Cyan
    
    # Check if package.json exists
    if (-not (Test-Path "package.json")) {
        Write-Host "[ERROR] package.json not found!" -ForegroundColor Red
        Write-Host "Make sure you're in the Marvel Rivals Mod Manager project root" -ForegroundColor Yellow
        Read-Host "Press Enter to exit"
        exit 1
    }
    Write-Host "[OK] package.json found" -ForegroundColor Green
    
    # Check if node_modules exists
    if (-not (Test-Path "node_modules")) {
        Write-Host "[ERROR] node_modules directory not found!" -ForegroundColor Red
        Write-Host "[FIX] Run: pnpm install" -ForegroundColor Yellow
        Read-Host "Press Enter to exit"
        exit 1
    }
    Write-Host "[OK] node_modules directory exists" -ForegroundColor Green
    
    Write-Host ""
    
    # Test Node.js
    if (-not (Invoke-CommandWithLogging "node" "--version" "Testing Node.js")) {
        Write-Host "[FIX] Install Node.js from https://nodejs.org/" -ForegroundColor Yellow
        Read-Host "Press Enter to exit"
        exit 1
    }
    
    Write-Host ""
    
    # Test npx
    if (-not (Invoke-CommandWithLogging "npx" "--version" "Testing npx")) {
        Write-Host "[FIX] Reinstall Node.js or update npm" -ForegroundColor Yellow
        Read-Host "Press Enter to exit"
        exit 1
    }
    
    Write-Host ""
    
    # Test pnpm (optional)
    if (Test-Command "pnpm") {
        Write-Host "[DEBUG] Testing pnpm..." -ForegroundColor Yellow
        Invoke-CommandWithLogging "pnpm" "--version"
    } else {
        Write-Host "[WARNING] npx not found! Reinstall Node.js or update npm" -ForegroundColor Yellow
    }
    
    Write-Host ""
    
    # Clean development files
    Write-Host "[DEBUG] Cleaning development files..." -ForegroundColor Yellow
    if (Test-Path "node_modules/.dev") {
        Write-Host "Removing node_modules/.dev..." -ForegroundColor Gray
        try {
            Remove-Item -Recurse -Force "node_modules/.dev" -ErrorAction Stop
            Write-Host "[OK] Cleaned successfully" -ForegroundColor Green
        } catch {
            Write-Host "[ERROR] Failed to remove node_modules/.dev: $($_.Exception.Message)" -ForegroundColor Red
            Write-Host "[FIX] Try running as administrator" -ForegroundColor Yellow
            Read-Host "Press Enter to exit"
            exit 1
        }
    } else {
        Write-Host "[INFO] No cleanup needed - directory doesn't exist" -ForegroundColor Gray
    }
    
    Write-Host ""
    
    # Test cross-env
    if (-not (Invoke-CommandWithLogging "npx" "cross-env --version" "Testing cross-env availability")) {
        Write-Host "[ERROR] cross-env not available!" -ForegroundColor Red
        Write-Host "[FIX] Try running: fix-dependencies-windows.bat" -ForegroundColor Yellow
        Read-Host "Press Enter to exit"
        exit 1
    }
    
    Write-Host ""
    
    # Test electron-vite
    if (-not (Invoke-CommandWithLogging "npx" "electron-vite --version" "Testing electron-vite availability")) {
        Write-Host "[ERROR] electron-vite not available!" -ForegroundColor Red
        Write-Host "[FIX] Try running: fix-dependencies-windows.bat" -ForegroundColor Yellow
        Read-Host "Press Enter to exit"
        exit 1
    }
    
    Write-Host ""
    Write-Host "[SUCCESS] All checks passed!" -ForegroundColor Green
}

# Start the development server
Write-Host "Starting development server..." -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Gray
Write-Host "========================================" -ForegroundColor White
Write-Host ""

try {
    $env:NODE_ENV = "development"
    & npm run dev:win
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "[INFO] Development server stopped normally" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "========================================" -ForegroundColor White
        Write-Host "[ERROR] Development server failed!" -ForegroundColor Red
        Write-Host "Exit code: $LASTEXITCODE" -ForegroundColor Red
        Write-Host ""
        Write-Host "Try these solutions:" -ForegroundColor Yellow
        Write-Host "1. Run: ./fix-dependencies-windows.bat" -ForegroundColor White
        Write-Host "2. Run: pnpm install --force" -ForegroundColor White
        Write-Host "3. Check if you have Visual Studio Build Tools installed" -ForegroundColor White
    }
} catch {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor White
    Write-Host "[ERROR] Exception occurred: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Try running: ./fix-dependencies-windows.bat" -ForegroundColor Yellow
}

Write-Host ""
Read-Host "Press Enter to exit"