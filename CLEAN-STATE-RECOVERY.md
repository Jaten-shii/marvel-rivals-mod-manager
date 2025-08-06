# Clean State Recovery - Backend Engineering Protocol

## 🚨 **State Corruption Detected**: Mixed Package Manager Artifacts

**Issue**: `npm install` was run in a directory with existing `pnpm` installation, creating corrupted hybrid state.

**Backend Impact**: 
- Unpredictable dependency resolution
- Binary execution conflicts  
- Lock file inconsistencies
- Non-deterministic build behavior

## **Step-by-Step Recovery Procedure**

### Phase 1: Complete State Cleanup

**⚠️ CRITICAL**: Run these commands from the project root directory:

```cmd
cd "C:\Users\James Watson\Desktop\Gaming Stuff\Marvel Rivals Mod Manager"
```

#### 1.1 Remove All Node Modules
```cmd
rmdir /s /q node_modules
```
**Purpose**: Eliminate corrupted hybrid dependency tree

#### 1.2 Remove All Lock Files  
```cmd
del pnpm-lock.yaml
del package-lock.json
del yarn.lock
```
**Purpose**: Clear conflicting dependency resolution records

#### 1.3 Clean Package Manager Caches
```cmd
npm cache clean --force
pnpm store prune
```
**Purpose**: Remove cached artifacts that could cause recontamination

#### 1.4 Verify Clean State
```cmd
dir node_modules
dir *lock*
```
**Expected**: Both commands should show "File Not Found" or "cannot find the path"

### Phase 2: Fresh pnpm Installation

#### 2.1 Install Dependencies with pnpm
```cmd
pnpm install
```
**Expected**: 
- Creates fresh `pnpm-lock.yaml`
- Builds clean `.pnpm/` store structure  
- No errors or warnings about conflicting lock files

#### 2.2 Verify pnpm Installation
```cmd
pnpm list --depth=0
```
**Expected**: Should show clean dependency tree without conflicts

### Phase 3: Test Clean State

#### 3.1 Test pnpm Binary Access
```cmd
pnpm exec cross-env --version
pnpm exec electron-vite --version
```
**Expected**: Version numbers without shell errors

#### 3.2 Test Development Server
```cmd
pnpm run dev
```
**Expected**: Clean startup without mixed-state errors

### Phase 4: Validation Checklist

**✅ State Verification**:
- [ ] Only `pnpm-lock.yaml` exists (no package-lock.json)
- [ ] `node_modules/.pnpm/` directory structure present
- [ ] `pnpm exec` commands work without shell errors
- [ ] Development server starts cleanly

**🚫 Corruption Indicators** (Should NOT exist):
- [ ] ❌ `package-lock.json` file
- [ ] ❌ Mixed node_modules structure
- [ ] ❌ Shell execution errors from pnpm
- [ ] ❌ Binary resolution conflicts

## Expected File Structure After Recovery

```
Marvel Rivals Mod Manager/
├── pnpm-lock.yaml           ✅ (pnpm dependency lock)
├── package.json             ✅ (unchanged)
├── node_modules/
│   ├── .pnpm/              ✅ (pnpm store structure)
│   ├── .bin/               ✅ (pnpm-managed binaries)
│   └── [symlinked deps]    ✅ (pnpm symlink structure)
└── [no package-lock.json]  ✅ (npm artifacts removed)
```

## Troubleshooting Recovery Issues

### If cleanup fails:
```cmd
# Force removal with administrator privileges
# Run Command Prompt as Administrator, then:
takeown /r /d y /f "node_modules"
rmdir /s /q node_modules
```

### If pnpm install fails:
```cmd
# Check pnpm installation
pnpm --version

# If pnpm not installed:
npm install -g pnpm

# Retry with force flag:
pnpm install --force
```

### If shell errors persist:
```cmd
# Use pnpm run for package.json scripts (most reliable)
pnpm run dev

# Alternative: Try pnpm dlx
pnpm dlx cross-env --version
```

## Backend Engineering Notes

**Why This Recovery Is Necessary**:
1. **Deterministic Builds**: Single package manager ensures consistent dependency resolution
2. **Binary Reliability**: Eliminates execution environment conflicts  
3. **State Integrity**: Clean dependency graph prevents cascading failures
4. **Reproducible Environment**: Team members get identical setups

**Post-Recovery Protocol**:
- ✅ Only use `pnpm install` for adding dependencies
- ✅ Only use `pnpm run` for executing scripts  
- ✅ Never mix npm/yarn commands in this project
- ✅ Document pnpm-only workflow for team

## Success Criteria

**Recovery Complete When**:
1. ✅ `pnpm run dev` starts development server cleanly
2. ✅ No shell execution errors from pnpm commands
3. ✅ Only pnpm-lock.yaml exists (no package-lock.json)
4. ✅ Consistent, predictable behavior across runs

**Estimated Recovery Time**: 5-10 minutes (depending on internet speed for reinstall)