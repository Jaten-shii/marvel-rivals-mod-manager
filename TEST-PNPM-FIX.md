# OUTDATED - Use WINDOWS-HYBRID-WORKFLOW.md Instead

⚠️ **This file contains outdated information that doesn't work on Windows.**

## Correct Approach

The Electron boilerplate uses a **hybrid approach**:
- Install with `pnpm install` 
- Run with `npm run dev:win`

**See `WINDOWS-HYBRID-WORKFLOW.md` for the complete guide.**

## Quick Test (Correct Commands)

Navigate to your project folder:
```cmd
cd "C:\Users\James Watson\Desktop\Gaming Stuff\Marvel Rivals Mod Manager"
```

### Test the intended workflow:
```cmd
npm run dev:win
```
**Expected**: Should start the development server successfully

### Verify components work:
```cmd
npx cross-env --version
npx electron-vite --version
```
**Expected**: Should show version numbers without errors

## If Tests Pass ✅

Your development environment is now working! You can use any of these scripts:

- `start-dev-windows.bat` - Main development script
- `start-dev-simple.bat` - Simplified version  
- `debug-dev-windows.bat` - Debug version with detailed output
- `debug-dev-windows.ps1` - PowerShell debug version

## If Tests Fail ❌

### Still getting "command not recognized"?

Try this command to make sure pnpm is installed:
```cmd
pnpm --version
```

If pnpm is not installed:
```cmd
npm install -g pnpm
```

### Dependencies missing?

Run the dependency fixer:
```cmd
fix-dependencies-windows.bat
```

## Alternative: Use package.json scripts

You can also run the development server using:
```cmd
pnpm run dev
```

This uses the scripts defined in package.json and should work identically.

## What Was Fixed

- **Problem**: Dependencies installed with `pnpm` but scripts used `npx`
- **Solution**: Updated all batch and PowerShell scripts to use `pnpm` consistently
- **Files Updated**: 
  - `start-dev-windows.bat`
  - `debug-dev-windows.bat` 
  - `debug-dev-windows.ps1`
  - `fix-dependencies-windows.bat`
  - `start-dev-simple.bat`

The dependencies were already properly installed - they just needed to be accessed through `pnpm` instead of `npx`.