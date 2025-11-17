# Release Notes - Version 3.5.0

## 🎉 Major Updates

### 🖼️ Enhanced Thumbnail System
- **Clipboard Support**: Paste images directly from your clipboard for mod thumbnails
  - Copy any image → Click "Paste Clipboard" → Crop and save
  - Supports all standard image formats (PNG, JPEG, WebP, etc.)
- **NexusMods AVIF Support**: Fixed thumbnail downloads from NexusMods
  - Automatically requests compatible image formats (PNG/JPEG/WebP)
  - No more "AVIF format not supported" errors
- **Improved Crop Dialog**:
  - Added clear instructions: "Click and drag on the image to create or adjust the crop box"
  - Darker, more stylized design with neutral color palette
  - 3D border effect with subtle glow around uploaded images
  - Transparent theme-colored buttons with brighter glow on hover
  - Side-by-side layout for Upload and Paste buttons

### 📁 Folder Organization Improvements
- **Universal Character Folders**: ALL categories now support character-specific subfolders
  - **Skins**: `Skins/Black-Widow/Mod-Name/`
  - **Gameplay**: `Gameplay/Black-Widow/Mod-Name/`
  - **UI**: `UI/Cloak-and-Dagger/Mod-Name/`
  - **Audio**: `Audio/Luna-Snow/Mod-Name/`
- **Smart Multi-Mod Handling**:
  - Detects when multiple mods share the same folder
  - Only moves the specific mod's files when renaming
  - Prevents breaking other mods in shared folders
- **Metadata Migration**: Automatically preserves metadata when merging duplicate character folders
  - Migrates thumbnails, descriptions, tags, and all custom data
  - No more lost metadata after folder reorganization

### 🎮 Character Detection Updates
- **Fixed Character Names**:
  - "Cloak & Dagger" → "Cloak and Dagger" (backend compatibility)
- **Added Missing Characters**:
  - Angela
  - Blade
  - Daredevil
  - Emma Frost
  - Gambit
  - Human Torch
  - Invisible Woman
  - Mister Fantastic
  - Phoenix
  - The Thing
  - Ultron
- **Removed Duplicates**: Cleaned up duplicate "Punisher" entry

### 🐛 Critical Bug Fixes

#### Archive Processing
- **Fixed HMR Duplicate Processing**:
  - Eliminated 30+ duplicate extractions when dropping archive files
  - Added global locks across Hot Module Replacement instances
  - Suppressed spam toast notifications from duplicate attempts
  - Archive extraction now runs exactly once per file

#### Metadata System
- **Fixed Metadata Corruption**:
  - Metadata no longer resets on app reload
  - Properly migrates metadata when folders are renamed or merged
  - Preserves custom thumbnails during folder operations
  - Fixed cross-category folder merging (Skins + Gameplay no longer merge)

## 🔧 Technical Improvements

### Performance
- **Optimized Archive Extraction**: Global extraction lock prevents resource waste
- **Efficient Folder Processing**: Each category processed separately for better performance

### Code Quality
- **Enhanced Error Handling**: Better error messages for archive and thumbnail operations
- **Improved Logging**: More detailed console logs for debugging
- **Type Safety**: Fixed TypeScript types for character detection

## 📝 Breaking Changes

**None** - This release is fully backward compatible with v3.x.x

## 🔄 Migration Notes

If you're upgrading from v3.4.x or earlier:

1. **Folder Structure**: Existing mods will be automatically organized with character folders
2. **Metadata**: All metadata will be preserved during folder reorganization
3. **Thumbnails**: Existing thumbnails will be migrated automatically

## 🙏 Known Issues

None at this time.

## 📦 Installation

Download the latest installer:
- **Windows**: `Marvel-Rivals-Mod-Manager-Setup-3.5.0.exe`

## 🔗 Links

- [Report Issues](https://github.com/yourusername/marvel-rivals-mod-manager/issues)
- [Documentation](https://github.com/yourusername/marvel-rivals-mod-manager/wiki)

---

**Full Changelog**: v3.4.x...v3.5.0
