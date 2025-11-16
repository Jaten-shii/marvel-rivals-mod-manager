# Marvel Rivals Mod Manager

A professional, feature-rich desktop application for managing mods in Marvel Rivals. Built with Tauri for a lightweight, secure, and blazingly fast experience.

## ✨ Features

### Core Functionality
- **Seamless Mod Installation** - Drag & drop support for `.pak`, `.zip`, and `.rar` files
- **Automatic Organization** - Smart categorization by UI, Audio, Skins, and Gameplay
- **Character-Based Filtering** - Organize and browse mods by 40+ Marvel Rivals characters
- **Real-time File Monitoring** - Automatic detection of mod directory changes
- **Profile System** - Create and manage multiple mod profiles for different playstyles

### Modern UI/UX
- **Dual Theme System** - Dark and Light themes with smooth animations
- **Multiple View Modes** - Grid and List layouts for mod browsing
- **Advanced Search & Filtering** - Quickly find mods by name, category, or character
- **Mod Details Panel** - View thumbnails, descriptions, and metadata
- **Statistics Dashboard** - Track your mod collection at a glance

### Advanced Features
- **In-App Auto-Updater** - Automatic updates with cryptographic signing
- **Changelog Viewer** - Browse release notes and version history
- **Custom Thumbnails** - Add custom images to your mods
- **Bulk Operations** - Enable, disable, or delete multiple mods at once
- **File Associations** - Open `.pak` files directly with the mod manager

## 🎮 Installation

### Download
Download the latest release from the [Releases page](https://github.com/Jaten-shii/marvel-rivals-mod-manager/releases)

### System Requirements
- **Platform**: Windows 10/11 (64-bit)
- **Game**: Marvel Rivals (Steam version)
- **Disk Space**: ~15 MB for application

### First-Time Setup
1. Run the installer (`Marvel Rivals Mod Manager_x.x.x_x64-setup.exe`)
2. Launch the application
3. The mod manager will automatically detect your Marvel Rivals installation
4. If auto-detection fails, manually set your game directory in Settings

## 🚀 Usage

### Installing Mods
1. **Drag & Drop**: Drag mod files directly into the application window
2. **File Browser**: Click "Browse Files" to select mods from your computer
3. **Automatic Extraction**: ZIP/RAR archives are automatically extracted

### Managing Mods
- **Enable/Disable**: Toggle mods with a single click
- **View Details**: Click any mod to see details in the side panel
- **Search**: Use the search bar to find specific mods
- **Filter**: Filter by category (UI, Audio, Skins, Gameplay) or character
- **Switch Views**: Toggle between Grid and List view modes

### Profiles
- Create different profiles for competitive vs. casual gameplay
- Switch between profiles instantly
- Each profile maintains its own enabled/disabled mod states

## 🛠 Built With

### Frontend
- **React 19** - Modern UI library
- **TypeScript** - Type-safe development
- **Tailwind CSS 4** - Utility-first styling
- **shadcn/ui** - High-quality UI components
- **Framer Motion** - Smooth animations
- **Zustand** - State management

### Backend
- **Tauri 2** - Rust-powered native backend
- **Rust** - Performance and security
- **File Watching** - Real-time directory monitoring
- **Archive Extraction** - ZIP/RAR support

### Build Tools
- **Vite** - Lightning-fast development
- **NSIS** - Professional Windows installer
- **Electron Builder** - Application packaging

## 🔧 Building from Source

### Prerequisites
- [Node.js](https://nodejs.org/) (v20+)
- [Rust](https://rustup.rs/) (latest stable)
- [pnpm](https://pnpm.io/) (v10+)

### Development
```bash
# Clone the repository
git clone https://github.com/Jaten-shii/marvel-rivals-mod-manager.git
cd marvel-rivals-mod-manager

# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm run tauri:build
```

### Project Structure
```
src/
├── components/         # React UI components
├── hooks/             # Custom React hooks
├── stores/            # Zustand state management
├── services/          # API services
└── screens/           # Application screens

src-tauri/
├── src/               # Rust backend code
├── icons/             # Application icons
└── tauri.conf.json    # Tauri configuration
```

## 📋 License

This project is licensed under the [MIT](LICENSE.md) license.

## 🙏 Acknowledgments

- Marvel Rivals mod community for inspiration
- All contributors and testers
- Open source libraries that made this possible

---

**Note**: This mod manager is a community project and is not affiliated with or endorsed by NetEase or Marvel.
