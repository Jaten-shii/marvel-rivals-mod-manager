# Windows Hybrid Workflow - The Intended Design Pattern

## Understanding the Hybrid Approach

This Electron boilerplate uses a **hybrid approach** specifically designed for Windows compatibility:

- **🚀 pnpm for installing** - Fast, efficient dependency management
- **🎯 npm/npx for running** - Windows-compatible script execution

## Why This Design?

### pnpm Installation Advantages:
- ✅ **Faster installs** - Shared dependency store across projects
- ✅ **Disk space efficient** - Symlinked dependencies save ~30-50% space  
- ✅ **Strict resolution** - Prevents phantom dependencies and version conflicts

### npm/npx Execution Advantages:
- ✅ **Windows compatibility** - Proper handling of .cmd/.bat files
- ✅ **Binary resolution** - Reliable PATH and node_modules/.bin access
- ✅ **Shell neutrality** - No Unix shell assumptions (avoids 'sh' errors)

## The Correct Workflow

### 1. Install Dependencies with pnpm
```cmd
cd "C:\Users\James Watson\Desktop\Gaming Stuff\Marvel Rivals Mod Manager"
pnpm install
```

### 2. Run Development Server with npm
```cmd
npm run dev:win
```

**That's it!** The `dev:win` script is specifically designed for Windows and handles:
- Cleaning temporary files: `npm run clean:dev:win`
- Setting environment: `NODE_ENV=development`
- Starting server: `npx cross-env NODE_ENV=development electron-vite dev --watch`

## Available Scripts

### Development Scripts
```cmd
npm run dev:win          # Windows-specific development server (recommended)
npm run dev              # Cross-platform development server  
npm run dev:skip-clean   # Skip cleanup, start directly
```

### Build Scripts
```cmd
npm run build            # Build for production
npm run compile:app      # Compile application only
npm run prebuild         # Full prebuild process
```

### Utility Scripts
```cmd
npm run clean:dev:win    # Clean Windows development files
npm run lint             # Run code linting
npm run lint:fix         # Fix linting issues automatically
```

## Quick Test Commands

### Test the hybrid workflow:
```cmd
# 1. Verify pnpm can install (should work)
pnpm --version

# 2. Verify npm can run scripts (should work)  
npm run dev:win
```

### Verify individual components:
```cmd
# Test npx binary access (should work with pnpm-installed deps)
npx cross-env --version
npx electron-vite --version

# Test development command (should work)
npx cross-env NODE_ENV=development electron-vite --version
```

## Why Direct pnpm Execution Fails

When you try `pnpm cross-env --version`, you get:
```
'sh' is not recognized as an internal or external command
ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL Command "cross-env" not found
```

This happens because:
1. **Shell Assumption**: pnpm assumes Unix shell environment (`sh`)
2. **Binary Resolution**: pnpm looks for shell scripts, not Windows batch files
3. **Path Issues**: Different binary resolution strategy than npx

## Batch Scripts Now Use Intended Workflow

All debugging scripts now use the proper approach:

- **`start-dev-windows.bat`** → `npm run dev:win`
- **`debug-dev-windows.bat`** → Tests `npx` then runs `npm run dev:win`
- **`debug-dev-windows.ps1`** → Tests `npx` then runs `npm run dev:win`
- **`start-dev-simple.bat`** → `npm run dev:win`

## Troubleshooting

### If npm run dev:win fails:
1. **Check Node.js**: `node --version` (should be 18+)
2. **Check npm**: `npm --version` (should be 9+)
3. **Reinstall dependencies**: `pnpm install --force`
4. **Clean and retry**: `npm run clean:dev:win && npm run dev:win`

### If you prefer pure npm workflow:
```cmd
# Remove pnpm installation
rmdir /s /q node_modules
del pnpm-lock.yaml

# Install with npm
npm install

# Run normally
npm run dev:win
```

## Summary

The **hybrid approach** is the intended design:
- Install with `pnpm install` (fast, efficient)
- Run with `npm run dev:win` (Windows compatible)

This gives you the best of both worlds: fast installs with reliable execution on Windows.