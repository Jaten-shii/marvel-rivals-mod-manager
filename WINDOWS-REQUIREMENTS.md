# Windows Build Environment Requirements

Complete guide for setting up the Marvel Rivals Mod Manager development environment on Windows.

## System Requirements

### Minimum Requirements
- **OS**: Windows 10 (version 1903+) or Windows 11
- **RAM**: 8GB minimum, 16GB recommended
- **Storage**: 2GB free space for dependencies
- **Architecture**: x64 (64-bit)

### Required Software

#### 1. Node.js (Required)
- **Version**: Node.js 18.0.0 or higher
- **Download**: https://nodejs.org/
- **Installation**: 
  - Download the Windows Installer (.msi)
  - Choose "Add to PATH" during installation
  - Verify: `node --version` should show v18.0.0+

#### 2. Package Manager (Required)
Choose one of the following:

**Option A: npm (Included with Node.js)**
- Comes pre-installed with Node.js
- Verify: `npm --version`

**Option B: pnpm (Recommended)**
```cmd
npm install -g pnpm
```
- Faster and more efficient than npm
- Verify: `pnpm --version`

#### 3. Git (Recommended)
- **Download**: https://git-scm.com/download/win
- **Purpose**: Version control and dependency management
- **Verify**: `git --version`

### Development Tools

#### 1. Visual Studio Code (Recommended)
- **Download**: https://code.visualstudio.com/
- **Extensions**:
  - TypeScript and JavaScript Language Features
  - ESLint
  - Prettier
  - Electron

#### 2. Visual Studio Build Tools (Optional)
Required only if you encounter native module compilation errors.
- **Download**: https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022
- **Install**: "C++ build tools" workload
- **Alternative**: Install full Visual Studio Community

#### 3. Python (Optional)
Some native dependencies may require Python for compilation.
- **Version**: Python 3.8+ 
- **Download**: https://www.python.org/downloads/
- **Note**: Make sure to check "Add Python to PATH"

---

## Project Dependencies

### Core Framework
```json
{
  "electron": "^34.0.0",
  "react": "^19.0.0", 
  "react-dom": "^19.0.0",
  "typescript": "^5.0.0"
}
```

### Build Tools
```json
{
  "electron-vite": "^2.0.0",
  "cross-env": "^7.0.3",
  "npm-run-all": "^4.1.5",
  "rimraf": "^5.0.0"
}
```

### File Operations
```json
{
  "chokidar": "^3.5.3",
  "yauzl": "^3.0.0",
  "unzipper": "^0.10.14"
}
```

### UI Libraries
```json
{
  "framer-motion": "^10.16.0",
  "@radix-ui/react-*": "^1.0.0",
  "tailwindcss": "^4.0.0"
}
```

---

## Environment Setup

### 1. Clone/Download Project
```cmd
git clone <repository-url>
cd "Marvel Rivals Mod Manager"
```

### 2. Install Dependencies
```cmd
:: Using pnpm (recommended)
pnpm install

:: Or using npm
npm install
```

### 3. Verify Installation
```cmd
:: Check if all tools are available
node --version
npm --version
npx --version

:: Check project dependencies
npx electron-vite --version
npx cross-env --version
```

### 4. Development Server
```cmd
:: Using npm scripts
npm run dev

:: Or directly
npx cross-env NODE_ENV=development electron-vite dev --watch
```

---

## Build Configuration

### Development Build
```cmd
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
```

### Windows Distribution
```cmd
npm run build:win    # Build Windows installer
npm run dist         # Create distribution packages
```

### Build Outputs
- **Development**: `dist-electron/` directory
- **Production**: `dist/` directory  
- **Installer**: `release/` directory

---

## Common Issues & Solutions

### Issue: `'npm' is not recognized`
**Cause**: Node.js not properly installed or not in PATH
**Solution**: 
1. Reinstall Node.js from https://nodejs.org/
2. Make sure "Add to PATH" is checked during installation
3. Restart Command Prompt/PowerShell

### Issue: `'npx' is not recognized`
**Cause**: npm version too old
**Solution**:
```cmd
npm install -g npm@latest
```

### Issue: `electron-vite not found`
**Cause**: Dependencies not installed properly
**Solution**:
```cmd
npm install --force
# or
pnpm install --force
```

### Issue: Native module compilation errors
**Cause**: Missing build tools for native dependencies
**Solution**: Install Visual Studio Build Tools
```cmd
npm install -g windows-build-tools
```

### Issue: Permission denied errors
**Cause**: Windows User Account Control or antivirus
**Solution**: 
1. Run Command Prompt as Administrator
2. Add project folder to antivirus exclusions
3. Use PowerShell instead of Command Prompt

### Issue: Long path names (Windows limitation)
**Cause**: Windows path length limitation (260 characters)
**Solution**: 
1. Move project to shorter path (e.g., `C:\Projects\ModManager`)
2. Enable long path support in Windows
3. Use junction links for deep directories

---

## Antivirus Considerations

### Windows Defender
Add these exclusions to Windows Defender:
- Project directory: `C:\Path\To\Marvel Rivals Mod Manager`
- Node.js directory: `C:\Program Files\nodejs`
- npm cache: `%APPDATA%\npm-cache`

### Third-party Antivirus
- **Kaspersky**: May block Electron applications
- **McAfee**: May quarantine node_modules
- **Norton**: May slow down npm install

**Solution**: Add project folder to antivirus exclusions

---

## Performance Optimization

### For Faster Builds
```cmd
:: Use pnpm instead of npm
npm install -g pnpm

:: Clear caches regularly
npm cache clean --force
pnpm store prune

:: Use --force flag for problematic installs
pnpm install --force
```

### For Development
```cmd
:: Use development scripts with watch mode
npm run dev

:: Enable hot reload
npm run dev:watch
```

---

## Troubleshooting Scripts

The project includes several debugging scripts:

### `debug-dev-windows.bat`
Comprehensive step-by-step debugging with error detection
```cmd
debug-dev-windows.bat
```

### `fix-dependencies-windows.bat`
Automated dependency repair and reinstallation
```cmd
fix-dependencies-windows.bat
```

### `start-dev-simple.bat`
Simplified development server startup
```cmd
start-dev-simple.bat
```

### `debug-dev-windows.ps1`
PowerShell version with detailed logging
```powershell
.\debug-dev-windows.ps1
```

---

## Environment Variables

### Required
```cmd
NODE_ENV=development    # For development builds
NODE_ENV=production     # For production builds
```

### Optional
```cmd
ELECTRON_BUILDER_CACHE_DIR=C:\electron-cache    # Custom cache directory
npm_config_cache=C:\npm-cache                   # Custom npm cache
```

---

## File System Requirements

### Permissions
- **Read/Write**: Project directory
- **Read**: Node.js installation directory
- **Write**: Temp directories (`%TEMP%`, `%APPDATA%`)

### Directory Structure
```
Marvel Rivals Mod Manager/
├── src/                 # Source code
├── dist/               # Build output
├── node_modules/       # Dependencies
├── build/              # Build configuration
├── release/            # Distribution packages
└── package.json        # Project configuration
```

### Disk Space
- **Development**: ~500MB (with node_modules)
- **Production Build**: ~200MB
- **With Dependencies**: ~1GB total

---

## Support & Help

### Documentation
- `README.md` - Project overview
- `CLAUDE.md` - Comprehensive project documentation
- `WINDOWS-DEBUG-MANUAL.md` - Step-by-step debugging guide

### Common Commands
```cmd
npm run dev              # Start development
npm run build           # Build production
npm run test            # Run tests
npm run lint            # Check code quality
npm run format          # Format code
```

### Getting Help
1. Check the debugging scripts first
2. Follow the manual debugging guide
3. Include Node.js version, npm version, and exact error messages
4. Check Windows Event Viewer for system-level errors