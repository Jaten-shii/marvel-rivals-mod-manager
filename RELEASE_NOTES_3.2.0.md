# Marvel Rivals Mod Manager v3.2.0

## 🎉 What's New

### Update System Improvements
- **⚙️ Auto-Update Settings Toggle** - New option in Settings > General to enable/disable automatic update checks on app startup (enabled by default)
- **🔔 Smart Update Notifications** - Blinking red exclamation point indicators appear on "App Version" and "Check for Updates" buttons when a new version is available
- **🤫 Silent Auto-Checks** - Automatic update checks on startup no longer show annoying "already up-to-date" notifications - only alerts you when updates are actually available
- **🎯 Single Check Per Session** - Auto-check now runs only once when you first open the app, not repeatedly during the session
- **🔄 Auto-Publishing Releases** - GitHub releases now publish automatically, making updates immediately available

### Bug Fixes
- **🚫 Removed Unstyled Dialogs** - Eliminated native browser dialogs that appeared automatically for update notifications, replacing them with properly styled UI components
- **🔕 Fixed Toast Notification Spam** - Resolved issue where "You are running the latest version" notifications appeared infinitely
- **🔁 Fixed Update Check Loop** - Resolved infinite loop in update dialog that caused excessive update checks
- **📥 Fixed Download 404 Errors** - Installer filename now uses hyphens instead of spaces, preventing 404 errors during auto-update downloads
- **✨ Improved Update UX** - Update checking and installation now uses the app's modern design system instead of browser alerts

## 📥 Installation

### For New Users
1. Download `Marvel-Rivals-Mod-Manager_3.2.0_x64-setup.exe`
2. Run the installer
3. The app will automatically:
   - Create .pak file associations
   - Add right-click context menu integration
   - Install WebView2 if needed (no admin required)

### For Existing Users
- **Manual Update Recommended**: Due to filename changes, we recommend downloading the new installer manually this time
- **Future Updates**: Auto-updates will work seamlessly from v3.2.0 onwards
- **Settings Preserved**: Your settings and mods will be preserved during the update

## 🔧 Technical Details
- Enhanced update system with silent mode support
- Improved React hooks for update checking lifecycle
- Better session-based update check management with useRef
- TypeScript and Rust type synchronization for settings
- Fixed installer filename to use URL-safe characters (hyphens instead of spaces)
- GitHub Actions workflow now auto-publishes releases for immediate availability

## 📝 Full Changelog
See all changes: https://github.com/Jaten-shii/marvel-rivals-mod-manager/compare/v3.1.0...v3.2.0

---

**Enjoy modding! 🎮**

If you encounter any issues, please report them on our [GitHub Issues](https://github.com/Jaten-shii/marvel-rivals-mod-manager/issues) page.
