# Marvel Rivals Mod Manager - Windows Development Server (PowerShell)
Write-Host "Marvel Rivals Mod Manager - Windows Development Server" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Cleaning development files..." -ForegroundColor Yellow
if (Test-Path "node_modules/.dev") {
    Write-Host "Removing node_modules/.dev..." -ForegroundColor Gray
    Remove-Item -Recurse -Force "node_modules/.dev" -ErrorAction SilentlyContinue
    Write-Host "Cleaned successfully." -ForegroundColor Green
} else {
    Write-Host "No cleanup needed - directory doesn't exist." -ForegroundColor Gray
}
Write-Host ""

Write-Host "Starting development server..." -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Gray
Write-Host ""

try {
    & npx cross-env NODE_ENV=development electron-vite dev --watch
} catch {
    Write-Host "Error starting development server: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Try running: pnpm install --force" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Development server stopped." -ForegroundColor Yellow
Read-Host "Press Enter to exit"