# Changelog

All notable changes to the Marvel Rivals Mod Manager will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.2] - 2025-08-07

### Fixed
- **Add Mod Button** - Multi-mod selection modal now properly appears when using the Add Mod button for archives with multiple mods
- **File Browser** - Archives containing multiple mod variations now show selection modal instead of auto-installing all

### Improved  
- **Mod Installation** - Consistent behavior between file browser and other installation methods
- **User Experience** - All mod installation paths now properly support selective installation from multi-mod archives

## [1.1.1] - 2025-08-06

### Improved
- **Mod Selection Modal UX** - Cleaner file name display without path clutter in associated files dropdown
- **Modal Scrolling** - Fixed scrolling behavior when multiple dropdowns are expanded, now uses smooth scrolling
- **UI Simplification** - Removed redundant move button from mod cards since entire card is draggable
- **Visual Polish** - Better visual hierarchy and reduced cognitive load in multi-mod selection interface

## [1.1.0] - 2025-08-06

### Added
- **Multi-Mod Selection Modal** - Choose which mods to install from archives containing multiple variations
- **Enhanced File Processing** - Fixed buffer-based processing for archives to show selection modal
- **Metadata Editor Queue** - Sequential metadata editing for all selected mods with proper queue management
- **Buffer-based Archive Processing** - Handles archive files even when path property is unavailable

### Fixed
- **RAR File Handling** - Multi-mod RAR archives now properly show selection modal instead of installing all variants
- **Metadata Editor Flow** - Cancel/save operations now advance through mod queue instead of canceling entire workflow
- **Queue Management** - All selected mods are properly added to metadata editor queue for sequential processing

## [1.0.2] - 2025-08-05

### Fixed
- **Live Metadata Updates** - Mod character and name changes now update immediately in the UI without requiring app restart

## [1.0.1] - 2025-08-05

### Added
- **Changelog Viewer** - In-app changelog display with version history and formatted change descriptions
- **Version Display** - Current version shown in sidebar with clickable access to changelog
- **Semantic Versioning Support** - Full changelog system with proper version management

## [1.0.0] - 2025-08-05

### Added
- **Seamless Mod Installation** - File browser support for .pak, .zip, and .rar files
- **Automatic Organization** - Smart categorization by UI, Audio, Skins, and Gameplay
- **Character-Based Filtering** - Organize mods by 40+ Marvel Rivals characters
- **Real-time File Monitoring** - Automatic detection of mod directory changes
- **Dual Theme System** - Dark and Light themes with smooth CSS animations
- **Advanced UI Features** - Grid/List view modes, search, filtering, thumbnails, statistics
- **Professional Windows Integration** - NSIS installer with file associations and context menus
- **Mod Management** - Enable/disable mods, bulk operations, metadata editing
- **Game Integration** - Automatic Marvel Rivals game directory detection
- **Settings System** - Persistent configuration and preferences