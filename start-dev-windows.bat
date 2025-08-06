@echo off
echo Marvel Rivals Mod Manager - Windows Development Server
echo =====================================================
echo.

echo Cleaning development files...
if exist "node_modules\.dev" (
    echo Removing node_modules\.dev...
    rmdir /s /q "node_modules\.dev"
    echo Cleaned successfully.
) else (
    echo No cleanup needed - directory doesn't exist.
)
echo.

echo Starting development server...
echo Press Ctrl+C to stop the server
echo.

npm run dev:win

echo.
echo Development server stopped.
pause