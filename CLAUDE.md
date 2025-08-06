# CLAUDE.md - Marvel Rivals Mod Manager

This file provides comprehensive guidance for Claude Code when working with the Marvel Rivals Mod Manager codebase.

## Project Overview

**Marvel Rivals Mod Manager** is a professional, feature-rich desktop application for managing mods in the Marvel Rivals game. Built with modern web technologies wrapped in Electron, it provides seamless mod installation, automatic organization, real-time file monitoring, and a polished user experience.

### Key Features
- **Seamless Mod Installation**: Drag & drop support for .pak, .zip, and .rar files
- **Automatic Organization**: Smart categorization by UI, Audio, Skins, and Gameplay
- **Character-Based Filtering**: Organize mods by 40+ Marvel Rivals characters
- **Real-time File Monitoring**: Automatic detection of mod directory changes
- **Dual Theme System**: Dark and Light themes with smooth CSS animations
- **Advanced UI**: Grid/List view modes, search, filtering, thumbnails, statistics
- **Professional Distribution**: NSIS Windows installer with file associations

## Development Commands

### Core Development
```bash
pnpm dev              # Start development server with hot reload
pnpm start            # Preview the built application
```

### Building & Distribution
```bash
pnpm compile:app      # Compile application code only
pnpm prebuild         # Clean, compile, and prepare for packaging
pnpm build            # Build complete Windows installer (.exe)
pnpm release          # Build and publish release
```

### Code Quality & Validation
```bash
pnpm lint             # Run Biome linter
pnpm lint:fix         # Fix linting issues automatically
node validate.js      # Run comprehensive project validation (50+ checks)
```

### Maintenance
```bash
pnpm clean:dev        # Clean development artifacts
pnpm install:deps     # Install native dependencies for Electron
```

## Architecture Overview

### Technology Stack
- **Runtime**: Electron 34 + Node.js 20+
- **Frontend**: React 19 + TypeScript 5
- **Styling**: Tailwind CSS 4 + shadcn/ui components
- **Animations**: Framer Motion for smooth transitions
- **State Management**: React Context + Custom Hooks
- **File Operations**: Chokidar (watching) + yauzl/unzipper (archives)
- **Build System**: Electron Vite + Electron Builder
- **Package Manager**: pnpm 10.0.0

### Process Architecture

#### Main Process (`src/main/`)
Handles system-level operations and business logic:

**Services Layer:**
- `ModService.ts` - Core mod operations, file scanning, metadata management
- `FileWatcher.ts` - Real-time file system monitoring with Chokidar
- `ArchiveExtractor.ts` - ZIP/RAR extraction with progress tracking
- `SettingsManager.ts` - Game directory detection, settings persistence

**IPC Layer:**
- `mod-handlers.ts` - Mod management operations
- `system-handlers.ts` - System operations and settings
- `thumbnail-handlers.ts` - Thumbnail management

#### Preload Scripts (`src/preload/`)
Secure bridge between main and renderer processes:
- `index.ts` - Comprehensive API bridge with 40+ methods organized by namespace

#### Renderer Process (`src/renderer/`)
React-based user interface with modern architecture:

**Component Architecture:**
- `MainApplication.tsx` - Root application component with drag & drop
- `Sidebar.tsx` - Category filtering with expandable character sub-filters
- `ModCard.tsx` - Dual-mode (grid/list) mod display with animations
- `DetailsPanel.tsx` - Slide-out panel with thumbnails and actions
- `Toolbar.tsx` - Search, view controls, theme toggle, statistics

**State Management:**
- `ModContext.tsx` - Global mod state, filtering, statistics
- `SettingsContext.tsx` - Application settings with auto-detection
- `UIContext.tsx` - UI state (panels, dialogs, notifications)
- `AppProvider.tsx` - Root provider combining all contexts

**Custom Hooks:**
- `useMods.ts` - Mod operations with UI feedback
- `useSettings.ts` - Settings management with validation
- `useTheme.ts` - Theme switching and CSS management
- `useFileWatcher.ts` - Real-time file monitoring integration

### Project Structure
```
src/
├── main/                    # Electron main process
│   ├── services/           # Business logic services
│   │   ├── ModService.ts           # Mod operations & metadata
│   │   ├── FileWatcher.ts          # Real-time file monitoring
│   │   ├── ArchiveExtractor.ts     # ZIP/RAR extraction
│   │   └── SettingsManager.ts      # Settings & game detection
│   └── ipc/                # IPC communication handlers
│       ├── mod-handlers.ts         # Mod management IPC
│       ├── system-handlers.ts      # System operations IPC
│       └── thumbnail-handlers.ts   # Thumbnail management IPC
├── preload/                 # Security bridge
│   └── index.ts            # Comprehensive API bridge (40+ methods)
├── renderer/                # React frontend
│   ├── components/         # UI components
│   │   ├── MainApplication.tsx     # Root app with drag & drop
│   │   ├── Sidebar.tsx            # Category/character filtering
│   │   ├── ModCard.tsx            # Grid/list mod display
│   │   ├── DetailsPanel.tsx       # Slide-out mod details
│   │   ├── Toolbar.tsx            # Search, controls, stats
│   │   └── ui/                    # Base UI components
│   ├── contexts/           # State management
│   │   ├── ModContext.tsx         # Mod state & operations
│   │   ├── SettingsContext.tsx    # App settings
│   │   ├── UIContext.tsx          # UI state management
│   │   └── AppProvider.tsx        # Root provider
│   ├── hooks/              # Custom React hooks
│   │   ├── useMods.ts             # Mod operations + UI feedback
│   │   ├── useSettings.ts         # Settings + validation
│   │   ├── useTheme.ts            # Theme switching + CSS
│   │   └── useFileWatcher.ts      # File monitoring integration
│   ├── styles/             # CSS and themes
│   │   └── themes.css             # Dark/Light theme system
│   └── screens/            # Application screens
└── shared/                  # Shared types and constants
    ├── types.ts            # TypeScript interfaces & types
    └── constants.ts        # Marvel characters, categories, config
```

## Key Systems

### Theme System
Comprehensive Dark/Light theme implementation:
- **CSS Custom Properties**: Dynamic theme switching via CSS variables
- **Smooth Transitions**: 300ms cubic-bezier transitions for all theme elements
- **Component Integration**: Theme-aware badges, UI components, and animations
- **System Detection**: Automatic system theme detection with manual override
- **Persistence**: Theme preferences saved in user settings

### File Watching System
Real-time monitoring of the mod directory:
- **Chokidar Integration**: Efficient file system watching
- **Debounced Updates**: 2-second debounce to prevent excessive refreshes
- **Change Detection**: Automatic mod list updates on file changes
- **Progress Feedback**: Visual indicators for file operations
- **Error Recovery**: Graceful handling of file system errors

### Mod Management System
Comprehensive mod handling with metadata:
- **Multi-format Support**: .pak, .zip, .rar file handling
- **Automatic Categorization**: Smart detection of mod types
- **Character Association**: Link mods to specific Marvel characters
- **Metadata Management**: Custom thumbnails, descriptions, tags
- **Enable/Disable**: Instant toggling without game restart

### Windows Integration
Professional Windows application experience:
- **NSIS Installer**: Professional installer with custom options
- **File Associations**: .pak files open with mod manager
- **Context Menus**: Right-click integration for mod files
- **Start Menu**: Proper Windows Start Menu integration
- **Auto-start**: Optional Windows startup integration

## Development Workflow

### Setting Up Development Environment
1. **Prerequisites**: Node.js 20+, pnpm 10+, Windows (for full testing)
2. **Install**: `pnpm install` (handles native dependencies automatically)
3. **Validate**: `node validate.js` (runs 50+ validation checks)
4. **Develop**: `pnpm dev` (starts with hot reload)

### Working with Components
- **UI Components**: Located in `src/renderer/components/ui/`
- **Main Components**: Located in `src/renderer/components/`
- **Styling**: Use Tailwind classes + theme CSS variables
- **State**: Access via context hooks (`useMods`, `useSettings`, `useTheme`)
- **Animations**: Use Framer Motion for smooth transitions

### Adding New Features
1. **Types**: Add to `src/shared/types.ts` if needed
2. **Services**: Add business logic to appropriate service in `src/main/services/`
3. **IPC**: Add communication channels in `src/main/ipc/`
4. **Preload**: Expose APIs in `src/preload/index.ts`
5. **Components**: Create UI components in `src/renderer/components/`
6. **Context**: Add state management if needed in `src/renderer/contexts/`
7. **Hooks**: Create custom hooks in `src/renderer/hooks/`

### Working with Mods
- **Default Location**: `C:\Program Files (x86)\Steam\steamapps\common\MarvelRivals\MarvelGame\Marvel\Content\Paks\~mods`
- **Supported Formats**: .pak (native), .zip/.rar (extracted)
- **Categories**: UI, Audio, Skins, Gameplay (auto-detected)
- **Characters**: 40+ Marvel Rivals heroes (manual/auto-assignment)

### Theme Development
- **CSS Variables**: Defined in `src/renderer/styles/themes.css`
- **Component Variants**: Use theme-aware classes (`badge-ui`, `badge-audio`, etc.)
- **Testing**: Toggle themes via toolbar or `Ctrl+T`
- **Customization**: Modify CSS custom properties for theme adjustments

## Build & Distribution

### Development Builds
```bash
pnpm dev              # Development with hot reload
pnpm compile:app      # Compile without packaging
```

### Production Builds
```bash
pnpm prebuild         # Prepare for packaging
pnpm build            # Create Windows installer (.exe)
```

### Distribution Files
- **Installer**: `dist/Marvel-Rivals-Mod-Manager-Setup.exe`
- **Unpacked**: `dist/win-unpacked/` (for testing)
- **Build Assets**: `build/` (installer scripts, icons, license)

### Installer Features
- **NSIS-based**: Professional Windows installer
- **File Associations**: .pak files → Marvel Rivals Mod Manager
- **Context Menus**: Right-click "Install with..." for mod files
- **Optional Components**: Auto-start, enhanced file integration
- **Uninstaller**: Clean removal with registry cleanup

## Testing & Validation

### Validation System
```bash
node validate.js      # Comprehensive project validation
```

**Validation Categories:**
- Project structure (directories, files)
- Dependencies and configuration
- TypeScript types and interfaces
- Component architecture
- Build configuration
- Installer assets

### Manual Testing Checklist
- [ ] Mod installation (drag & drop, file browser)
- [ ] Category and character filtering
- [ ] Search functionality
- [ ] Theme switching (Dark/Light)
- [ ] View mode switching (Grid/List)
- [ ] Details panel operations
- [ ] File watching (add/remove mods externally)
- [ ] Settings management
- [ ] Windows installer

## Security Considerations

### Electron Security
- **Preload Scripts**: Secure bridge between processes
- **Context Isolation**: Enabled for security
- **Node Integration**: Disabled in renderer
- **Trusted Dependencies**: Listed in `trusted-dependencies-scripts.json`

### File Operations
- **Path Validation**: Prevent directory traversal attacks
- **Archive Safety**: Secure extraction with path validation
- **File Type Validation**: Whitelist approach for mod files
- **Error Handling**: Graceful failure without exposing internals

## Important Notes

### Game Integration
- **Marvel Rivals Detection**: Automatic Steam installation detection
- **Mod Directory**: `~mods` subfolder prevents game validation issues
- **File Naming**: Preserves original mod file names
- **Backup Options**: Optional mod backup before operations

### Performance Optimizations
- **Lazy Loading**: Components loaded on demand
- **Debounced Operations**: File watching, search, filtering
- **Efficient Rendering**: React keys, memoization where appropriate
- **Asset Optimization**: Optimized character icons and thumbnails

### Known Limitations
- **Windows Only**: Primary target platform (installer, file associations)
- **Steam Version**: Optimized for Steam version of Marvel Rivals
- **File Formats**: Limited to .pak, .zip, .rar (expandable)
- **Large Files**: Memory usage scales with mod collection size

### Troubleshooting

#### Windows-Specific Issues

**"'run-s' is not recognized" Error:**
```bash
# Solution 1: Use npx prefix (already fixed in package.json)
pnpm dev  # Now uses npx internally

# Solution 2: Skip cleaning and run directly
pnpm run dev:skip-clean

# Solution 3: Use Windows-specific commands
pnpm run dev:win
```

**"'rimraf' is not recognized" Error:**
```bash
# Solution 1: Use Windows clean command
pnpm run clean:dev:win

# Solution 2: Manual cleanup (Windows Command Prompt)
if exist "node_modules\.dev" rmdir /s /q "node_modules\.dev"

# Solution 3: Manual cleanup (PowerShell)
Remove-Item -Recurse -Force "node_modules/.dev" -ErrorAction SilentlyContinue
```

**Binary Resolution Issues on Windows:**
```bash
# Fix 1: Clear pnpm cache and reinstall
pnpm store prune
pnpm install --force

# Fix 2: Use npm instead of pnpm temporarily
npm install
npm run dev

# Fix 3: Run with full paths
npx electron-vite dev --watch
```

**Development Server Won't Start:**
```bash
# Quick fix: Skip all pre-scripts and run directly
npx cross-env NODE_ENV=development electron-vite dev --watch
```

#### General Issues
- **Build Errors**: Run `node validate.js` first
- **Rollup Issues**: Known WSL compatibility issue (development continues)
- **File Watching**: May require administrator privileges on restricted systems
- **Game Detection**: Manual path selection if auto-detection fails

#### Platform-Specific Commands

**For Windows Command Prompt:**
```batch
REM Clean development files
if exist "node_modules\.dev" rmdir /s /q "node_modules\.dev"

REM Start development server
npx cross-env NODE_ENV=development electron-vite dev --watch
```

**For PowerShell:**
```powershell
# Clean development files
Remove-Item -Recurse -Force "node_modules/.dev" -ErrorAction SilentlyContinue

# Start development server
npx cross-env NODE_ENV=development electron-vite dev --watch
```

**For WSL/Linux/macOS:**
```bash
# Clean development files
rm -rf node_modules/.dev

# Start development server
cross-env NODE_ENV=development electron-vite dev --watch
```

This documentation should be sufficient for any Claude Code instance to understand and work effectively with the Marvel Rivals Mod Manager codebase.