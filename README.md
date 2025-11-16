<div align="center">

![Marvel Rivals Mod Manager Banner](./main%20banner.png)

# Marvel Rivals Mod Manager

### 🎮 Professional Mod Management for Marvel Rivals

[![Latest Release](https://img.shields.io/github/v/release/Jaten-shii/marvel-rivals-mod-manager?style=for-the-badge&color=e5c300)](https://github.com/Jaten-shii/marvel-rivals-mod-manager/releases)
[![Platform](https://img.shields.io/badge/Platform-Windows-0078D6?style=for-the-badge&logo=windows)](https://github.com/Jaten-shii/marvel-rivals-mod-manager/releases)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE.md)

A lightweight, blazingly fast desktop application built with Tauri for seamless mod management in Marvel Rivals.

[Download Latest Release](https://github.com/Jaten-shii/marvel-rivals-mod-manager/releases) • [Report Bug](https://github.com/Jaten-shii/marvel-rivals-mod-manager/issues) • [Request Feature](https://github.com/Jaten-shii/marvel-rivals-mod-manager/issues)

</div>

---

## ✨ Features

<table>
<tr>
<td width="50%">

### 🚀 Core Functionality
- **Drag & Drop Installation** - Instant mod installation from `.pak`, `.zip`, and `.rar` files
- **Smart Auto-Organization** - Automatic categorization by UI, Audio, Skins, and Gameplay
- **Character Filtering** - Browse mods by 40+ Marvel Rivals heroes
- **Real-Time Monitoring** - Auto-detect changes in mod directory
- **Profile Management** - Multiple mod configurations for different playstyles

</td>
<td width="50%">

### 🎨 Modern Interface
- **Dual Theme System** - Gorgeous Dark and Light themes
- **Flexible View Modes** - Switch between Grid and List layouts
- **Advanced Search** - Find mods instantly by name, category, or character
- **Details Panel** - Rich mod information with custom thumbnails
- **Live Statistics** - Track your mod collection at a glance

</td>
</tr>
</table>

### 🔥 Advanced Features

- **🔄 Auto-Updater** - Seamless app updates with cryptographic signing
- **📜 Changelog Viewer** - In-app release notes and version history
- **🖼️ Custom Thumbnails** - Personalize your mods with custom images
- **⚡ Bulk Operations** - Enable, disable, or remove multiple mods at once
- **🔗 File Associations** - Double-click `.pak` files to open directly in mod manager

---

## 🎮 Getting Started

### 📥 Installation

1. **Download** the latest installer from [Releases](https://github.com/Jaten-shii/marvel-rivals-mod-manager/releases)
2. **Run** `Marvel Rivals Mod Manager_x.x.x_x64-setup.exe`
3. **Launch** the application - game directory auto-detection handles the rest!

### 💻 System Requirements

| Requirement | Minimum |
|------------|---------|
| **OS** | Windows 10/11 (64-bit) |
| **Game** | Marvel Rivals (Steam) |
| **Disk Space** | ~15 MB |
| **RAM** | 100 MB |

---

## 🎯 How to Use

### Installing Mods

<table>
<tr>
<td width="33%">

**🎯 Drag & Drop**

Simply drag mod files into the app window

</td>
<td width="33%">

**📁 File Browser**

Click "Browse Files" to select mods from your PC

</td>
<td width="33%">

**📦 Auto-Extract**

ZIP/RAR archives extract automatically

</td>
</tr>
</table>

### Managing Your Collection

- **🔍 Search** - Use the search bar to find specific mods instantly
- **🏷️ Filter** - Sort by category (UI, Audio, Skins, Gameplay) or character
- **👁️ View Details** - Click any mod to see full information and screenshots
- **🎚️ Enable/Disable** - Toggle mods on/off with a single click
- **👥 Profiles** - Create separate mod setups for competitive vs. casual play

---

## 🛠️ Built With

<div align="center">

### Frontend
![React](https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)

### Backend
![Tauri](https://img.shields.io/badge/Tauri_2-FFC131?style=for-the-badge&logo=tauri&logoColor=white)
![Rust](https://img.shields.io/badge/Rust-000000?style=for-the-badge&logo=rust&logoColor=white)

### UI Components
shadcn/ui • Framer Motion • Lucide React • Zustand

</div>

---

## 🔧 Building from Source

### Prerequisites

- [Node.js](https://nodejs.org/) v20+
- [Rust](https://rustup.rs/) (latest stable)
- [pnpm](https://pnpm.io/) v10+

### Quick Start

```bash
# Clone the repository
git clone https://github.com/Jaten-shii/marvel-rivals-mod-manager.git
cd marvel-rivals-mod-manager

# Install dependencies
pnpm install

# Start development server with hot reload
pnpm dev

# Build production installer
pnpm run tauri:build
```

### Project Structure

```
marvel-rivals-mod-manager/
├── src/                    # React frontend
│   ├── components/         # UI components (ModCard, Sidebar, etc.)
│   ├── hooks/             # Custom React hooks
│   ├── stores/            # Zustand state management
│   ├── services/          # API and business logic
│   └── screens/           # Application screens
│
├── src-tauri/             # Rust backend
│   ├── src/               # Tauri commands and services
│   ├── icons/             # Application icons
│   └── tauri.conf.json    # App configuration
│
└── public/                # Static assets
```

---

## 📋 License

This project is licensed under the **MIT License** - see the [LICENSE.md](LICENSE.md) file for details.

---

## 🙏 Acknowledgments

- 💜 **Marvel Rivals Mod Community** - For inspiration and feedback
- 🧪 **Alpha Testers** - For helping iron out the bugs
- 🔧 **Open Source Contributors** - For the amazing libraries that power this app

---

<div align="center">

### ⚠️ Disclaimer

**Marvel Rivals Mod Manager** is a community-created tool and is **not affiliated with, endorsed by, or associated with NetEase Games or Marvel Entertainment**.

Use mods at your own risk. Always backup your game files before installing mods.

---

**Made with ❤️ by the Marvel Rivals modding community**

[⬆ Back to Top](#marvel-rivals-mod-manager)

</div>
