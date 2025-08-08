# Release Checklist

This document outlines all the steps and files that need to be updated when creating a new version release of Marvel Rivals Mod Manager.

## Version Update Checklist

### 1. Update Version Numbers
- [ ] **package.json** - Update the `version` field
- [ ] **CHANGELOG.md** - Add new version entry at the top with user-friendly descriptions
- [ ] **changelog-handlers.ts** - Update fallback data with new version as first entry and update `latestVersion`
- [ ] **ChangelogModal.tsx** - Update fallback data with new version as first entry and update `latestVersion`

### 2. Build & Distribution
- [ ] Run `pnpm prebuild` to compile and prepare for packaging
- [ ] Run `pnpm build` to create the Windows installer
- [ ] Verify the installer is created in `dist/Marvel-Rivals-Mod-Manager-Setup.exe`
- [ ] Test the installer on a clean Windows system

### 3. NSIS Installer Configuration
- [ ] **installer.nsi** - Version is automatically injected by electron-builder via `${PRODUCT_VERSION}`
- [ ] Welcome page title already includes version: `"Welcome to Marvel Rivals Mod Manager ${PRODUCT_VERSION} Setup"`
- [ ] No manual NSIS updates needed (handled automatically)

### 4. GitHub Release
- [ ] Create new GitHub release with tag `v{VERSION}` (e.g., `v1.3.1`)
- [ ] Use proper release notes formatting:
  - Header emoji (e.g., 🌐 for general releases)
  - **What's New** section with sparkle emojis (✨) for completely new features
  - **What's Changed** section with wrench emojis (🔧) for improvements to existing features
  - **What's Fixed** section with sparkle emojis (✨) for bug fixes
- [ ] Upload the setup.exe file from `dist/` folder
- [ ] Mark as latest release

### 5. Documentation Updates
- [ ] **README.md** - Update any version-specific information if needed
- [ ] Verify all links and system requirements are current

### 6. Quality Assurance
- [ ] Run `node validate.js` to perform comprehensive project validation
- [ ] Test the application functionality after building
- [ ] Test the update mechanism (Check for Updates button)
- [ ] Verify the changelog modal displays the new version
- [ ] Test the installer on a clean system
- [ ] Verify file associations work correctly

### 7. Version-Specific Files to Check

#### Always Update These Files:
1. `package.json` - Main version source
2. `CHANGELOG.md` - User-facing changelog  
3. `src/main/ipc/changelog-handlers.ts` - Fallback changelog data
4. `src/renderer/components/ChangelogModal.tsx` - Fallback changelog data

#### Automatically Handled:
- `build/installer.nsi` - Version injected automatically via `${PRODUCT_VERSION}`
- All built files in `dist/` - Generated during build process

## Release Notes Format

### Header Format
```
🌐 [Descriptive Title] Release

**What's New** (only for completely new features)
✨ [New feature 1 description]
✨ [New feature 2 description]

**What's Changed** (for improvements to existing features)
🔧 [Enhancement 1 description]
🔧 [Enhancement 2 description]

**What's Fixed** (for bug fixes)
✨ [Bug fix 1 description]
✨ [Bug fix 2 description]
```

### Example Release Notes
```
🌐 Browse Mods & UI Enhancement Release

**What's New**
✨ **Browse Mods Button** - New button next to "Add Mod" that opens the Nexus Mods website to discover and download new mods

**What's Changed**
🔧 **Bigger Window Size** - The app window is now taller so you can see more mods without scrolling
🔧 **Better List View** - Mod preview images are now much larger and use a proper widescreen format to look cleaner
```

### Section Usage Guidelines

**What's New (✨)**: Use only for completely new features that didn't exist before
- New buttons, menus, or UI components
- Brand new functionality or capabilities
- First-time implementations of features

**What's Changed (🔧)**: Use for improvements, enhancements, or modifications to existing features
- Performance improvements
- UI/UX enhancements to existing components
- Size, styling, or behavior changes
- Better error messages or user feedback

**What's Fixed (✨)**: Use for bug fixes and error corrections
- Fixing broken functionality
- Resolving crashes or errors
- Correcting display issues
- Addressing reported problems

### User-Friendly Language Guidelines

**Write for Regular Users**: Release notes should be easy to understand for non-technical users

**Language Style**:
- Use simple, everyday words instead of technical jargon
- Focus on user benefits rather than technical details
- Explain what users can do, not how it was implemented

**Examples**:
❌ **Technical**: "Enhanced Window Size - Increased app window height from 850px to 915px for better viewing and navigation of your mod collection"
✅ **User-Friendly**: "Bigger Window Size - The app window is now taller so you can see more mods without scrolling"

❌ **Technical**: "Improved List View - Made mod preview images much larger and clearer when using list view mode with proper 16:9 aspect ratio"
✅ **User-Friendly**: "Better List View - Mod preview images are now much larger and use a proper widescreen format to look cleaner"

**Word Choices**:
- "Bigger/Better/Faster" instead of "Enhanced/Improved/Optimized"
- "Window/Size/Button" instead of "Interface/Dimensions/Component"
- "See more/Works better/Loads faster" instead of "Increased visibility/Enhanced functionality/Reduced latency"

## Common Pitfalls to Avoid

1. **Don't forget fallback data** - Both `changelog-handlers.ts` and `ChangelogModal.tsx` need to be updated
2. **Maintain changelog consistency** - Use the same change descriptions in all files
3. **Test the installer** - Always test on a clean system before release
4. **Version format** - Use semantic versioning (Major.Minor.Patch)
5. **Release notes emojis** - Use sparkle emojis (✨) for bullet points, custom emoji for header
6. **File uploads** - Always upload the setup.exe file to the GitHub release

## Post-Release Verification

After creating a release:
- [ ] Verify the GitHub release shows correctly
- [ ] Test downloading and installing from the release
- [ ] Verify the "Check for Updates" feature detects the new version
- [ ] Confirm the changelog modal shows the new version information
- [ ] Test that the installer shows the correct version in the welcome page

## Automation Opportunities

Future improvements could automate:
- Version bumping across all files
- Changelog entry creation from git commits
- Automatic fallback data updates
- Release notes generation from changelog
- Automated testing of the installer

---

*Last updated: v1.3.2 - 2025-08-08*