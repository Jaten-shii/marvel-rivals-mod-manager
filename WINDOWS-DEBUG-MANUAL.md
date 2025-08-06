# Windows Development Server - Manual Debugging Guide

If the batch scripts are closing immediately, follow these manual debugging steps to identify the exact issue.

## Quick Diagnosis

**Your Issue**: `start-dev-windows.bat` runs for 1 second and closes instantly.

**Most Likely Causes**:
1. `npx` command not found or failing
2. `cross-env` dependency missing
3. `electron-vite` dependency missing
4. Node.js/npm installation issues
5. Permission or path problems

---

## Step-by-Step Manual Debugging

Open **Command Prompt** and navigate to your project folder:
```cmd
cd "C:\Users\James Watson\Desktop\Gaming Stuff\Marvel Rivals Mod Manager"
```

### Step 1: Verify Basic Environment

```cmd
:: Check current directory
echo %CD%

:: Check if you're in the right place
dir package.json
```
**Expected**: Should show `package.json` file

### Step 2: Test Node.js Installation

```cmd
:: Test Node.js
node --version

:: Test npm
npm --version

:: Test npx
npx --version
```
**Expected**: Should show version numbers (Node 18+, npm 9+)

### Step 3: Check Dependencies

```cmd
:: Check if node_modules exists
dir node_modules

:: Check package.json for electron-vite
findstr "electron-vite" package.json

:: Check package.json for cross-env
findstr "cross-env" package.json
```
**Expected**: Should show node_modules directory and find both dependencies

### Step 4: Test Critical Dependencies

```cmd
:: Test cross-env
npx cross-env --version

:: Test electron-vite
npx electron-vite --version
```
**Expected**: Should show version numbers without errors

### Step 5: Test the Development Command

```cmd
:: Set environment variable
set NODE_ENV=development

:: Test the exact command that's failing
npx cross-env NODE_ENV=development electron-vite --version
```
**Expected**: Should show electron-vite version

### Step 6: Try Starting Development Server

```cmd
:: The actual command from the batch file
npx cross-env NODE_ENV=development electron-vite dev --watch
```
**Expected**: Should start the development server (press Ctrl+C to stop)

---

## Common Error Solutions

### Error: `'npx' is not recognized`
**Solution**: 
```cmd
npm install -g npm@latest
```
Or reinstall Node.js from https://nodejs.org/

### Error: `cross-env not found`
**Solution**:
```cmd
npm install cross-env --save-dev
```

### Error: `electron-vite not found`
**Solution**:
```cmd
npm install electron-vite --save-dev
```

### Error: `Cannot find module`
**Solution**:
```cmd
:: Delete node_modules and reinstall
rmdir /s /q node_modules
npm install
```

### Error: Permission denied
**Solution**: Run Command Prompt as Administrator

### Error: Native module compilation failed
**Solution**: Install Visual Studio Build Tools
```cmd
npm install -g windows-build-tools
```

---

## Alternative Installation Methods

### Method 1: Force Reinstall Everything
```cmd
rmdir /s /q node_modules
del package-lock.json
del pnpm-lock.yaml
npm cache clean --force
npm install --force
```

### Method 2: Use npm instead of pnpm
```cmd
npm install
npm run dev
```

### Method 3: Install Dependencies Individually
```cmd
npm install electron@latest --save-dev
npm install electron-vite@latest --save-dev
npm install cross-env@latest --save-dev
npm install react@latest react-dom@latest
```

---

## Quick Test Commands

**Test if the issue is with the batch file itself**:
```cmd
npx electron-vite dev --watch
```

**Test with environment variable set manually**:
```cmd
set NODE_ENV=development && npx electron-vite dev --watch
```

**Test with full path (if PATH issues)**:
```cmd
.\node_modules\.bin\electron-vite dev --watch
```

---

## Emergency Fallback

If nothing else works, try running the app in development mode directly:
```cmd
cd src
node -r esbuild-register main/index.ts
```

Or use the debug scripts we created:
```cmd
:: Run comprehensive debugging
debug-dev-windows.bat

:: Run dependency fixer
fix-dependencies-windows.bat

:: Run simple version
start-dev-simple.bat
```

---

## What to Report

When asking for help, please include:

1. **Your Node.js version**: `node --version`
2. **Your npm version**: `npm --version`
3. **The exact error message** you see
4. **Which step above failed** and how
5. **Your Windows version**

Example:
```
Node.js: v18.17.0
npm: 9.6.7
Error: "npx cross-env --version" returns "'cross-env' is not recognized"
Windows 11 Pro
```