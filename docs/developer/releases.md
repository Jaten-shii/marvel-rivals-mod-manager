# Release System

This document explains how the automated release system works and how to use it.

## Overview

The release system provides:

- **Automated GitHub Actions workflow** for building releases
- **Version management script** for updating all version files
- **Auto-updater support** for seamless user updates
- **Cross-platform builds** (currently macOS, easily extended)

## Initial Setup

### 1. Generate Signing Keys

First, generate a keypair for signing updates:

```bash
# Install Tauri CLI if not already installed
npm install -g @tauri-apps/cli@next

# Generate keypair
tauri signer generate -w ~/.tauri/myapp.key

# This outputs:
# Private key: (saved to ~/.tauri/myapp.key)
# Public key: dW50cnVzdGVkIGNvbW1lbnQ6...
```

### 2. Configure GitHub Repository

Add these secrets to your GitHub repository (Settings → Secrets and variables → Actions):

- `TAURI_PRIVATE_KEY`: Content of `~/.tauri/myapp.key`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: Password you set (if any)

### 3. Update Configuration Files

**Update `src-tauri/tauri.conf.json`:**

```json
{
  "plugins": {
    "updater": {
      "active": true,
      "endpoints": [
        "https://github.com/YOUR_USERNAME/YOUR_REPO/releases/latest/download/latest.json"
      ],
      "dialog": true,
      "pubkey": "YOUR_PUBLIC_KEY_FROM_STEP_1"
    }
  }
}
```

**Update GitHub workflow in `.github/workflows/release.yml`:**

- Change `Tauri Template App` to your app name
- Update release body text

**Update bundle info in `tauri.conf.json`:**

- Change `publisher`, `shortDescription`, `longDescription`
- Update `productName` and `identifier`

## Release Process

### Simple Method

1. **Prepare release:**

   ```bash
   npm run release:prepare v1.0.0
   ```

2. **Script will:**
   - Check git status is clean
   - Run all quality checks (`npm run check:all`)
   - Update versions in `package.json`, `Cargo.toml`, `tauri.conf.json`
   - Ask if you want to commit and push automatically

3. **GitHub Actions will:**
   - Build the app for all platforms
   - Create a draft release
   - Generate `latest.json` for auto-updates
   - Upload all installers and signatures

4. **Manually publish the draft release** on GitHub

### Manual Method

If you prefer more control:

```bash
# 1. Update versions manually in:
#    - package.json
#    - src-tauri/Cargo.toml
#    - src-tauri/tauri.conf.json

# 2. Run checks
npm run check:all

# 3. Commit and tag
git add .
git commit -m "chore: release v1.0.0"
git tag v1.0.0
git push origin main --tags
```

## Auto-Updater

The auto-updater provides:

- **Optional automatic update checks** on app startup (configurable in Settings)
- **Styled update dialogs** using the app's design system
- **Background downloads** with progress tracking
- **Seamless installation** with restart prompts
- **Silent mode** for auto-checks (no spam notifications)
- **Visual indicators** with blinking red exclamation points when updates are available

### How It Works

1. **On Startup** (if enabled in Settings):
   - Waits 5 seconds after app launch
   - Silently checks for updates using `@tauri-apps/plugin-updater`
   - Only shows notification if update is actually available
   - Runs once per session to avoid spam

2. **Manual Check** (via sidebar):
   - User clicks "Check for Updates" in App Version dropdown
   - Shows styled dialog with full update information
   - Provides feedback for all scenarios (up-to-date, update available, errors)

3. **Visual Indicators**:
   - Blinking red exclamation point appears when update is available
   - Appears on both "App Version" button and "Check for Updates" button
   - Uses Framer Motion for smooth animations

4. **Installation Flow**:
   - Downloads and installs in background with progress tracking
   - Shows completion notification
   - Offers restart option using `@tauri-apps/plugin-process`

### Implementation

The auto-updater is implemented across multiple components:

**`src/hooks/useUpdater.ts`** - Core update logic:
```typescript
import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'

const checkForUpdates = async (silent = false) => {
  const update = await check()
  if (update?.available) {
    // Always show update available toast
    toast.success(`Update available: v${update.version}`)
  } else if (!silent) {
    // Only show "latest version" when manual check
    toast.info('You are running the latest version')
  }
}
```

**`src/components/layout/MainWindow.tsx`** - Startup check:
```typescript
// Check once per session if enabled in settings
const hasCheckedForUpdates = useRef(false)

useEffect(() => {
  if (settings?.autoCheckUpdates && !hasCheckedForUpdates.current) {
    hasCheckedForUpdates.current = true
    setTimeout(() => checkForUpdates(true), 5000) // silent mode
  }
}, [settings?.autoCheckUpdates])
```

**`src/components/Sidebar.tsx`** - Visual indicators and manual check button

**`src/components/UpdateDialog.tsx`** - Styled update dialog with progress tracking

### Configuration

The updater is configured in `tauri.conf.json`:

- **Active**: `true` to enable update checks
- **Dialog**: `true` to show built-in dialogs (we use custom confirm dialogs)
- **Endpoints**: GitHub releases URL with template placeholder
- **Public Key**: Template placeholder for signing verification

## File Structure

```
.github/workflows/
  release.yml              # GitHub Actions workflow

scripts/
  prepare-release.js       # Version management script

src-tauri/
  tauri.conf.json         # Bundle and updater configuration

package.json              # Release scripts
```

## Release Artifacts

Each release creates:

- **macOS**: `.dmg` installer
- **Windows**: `.msi` installer (when configured)
- **Linux**: `.deb` and `.AppImage` (when configured)
- **Auto-updater**: `latest.json` manifest and `.sig` signature files

## Troubleshooting

**Release workflow doesn't trigger:**

- Ensure tag starts with `v` (e.g., `v1.0.0`)
- Check that tag was pushed: `git push origin --tags`

**Build fails:**

- Verify GitHub secrets are set correctly
- Ensure all tests pass locally: `npm run check:all`

**Auto-updater issues:**

- Check that public key matches the private key used for signing
- Verify endpoint URL matches your GitHub repository
- Check console logs in the app for error details

## Version Strategy

We use semantic versioning (`v1.0.0`):

- **Major** (1.x.x): Breaking changes
- **Minor** (x.1.x): New features, backwards compatible
- **Patch** (x.x.1): Bug fixes, backwards compatible

All three files must have matching versions:

- `package.json` → `"version": "1.0.0"`
- `src-tauri/Cargo.toml` → `version = "1.0.0"`
- `src-tauri/tauri.conf.json` → `"version": "1.0.0"`

The prepare-release script handles this automatically.
