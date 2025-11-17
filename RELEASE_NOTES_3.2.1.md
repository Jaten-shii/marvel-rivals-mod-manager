# Marvel Rivals Mod Manager v3.2.1

## 🐛 Bug Fixes

### Delete Confirmation Dialog
- **🔧 Fixed Delete Button Not Working** - Resolved issue where clicking the "Delete" button in the confirmation dialog did nothing. Switched from `onClick` to `onPointerDown` event handler for reliable button interaction
- **🎨 Redesigned Delete Dialog** - Complete visual overhaul of the delete confirmation dialog:
  - Added pulsing red alert icon (⚠️) at the top for better visual warning
  - Improved text contrast and readability with brighter colors
  - Transparent red background on delete button with glowing border effect
  - Equal-sized, properly styled buttons with smooth hover animations
  - Wider dialog layout for better spacing and readability
  - Enhanced typography with better font sizes and weights

## 📥 Installation

### For New Users
1. Download `Marvel-Rivals-Mod-Manager_3.2.1_x64-setup.exe`
2. Run the installer
3. The app will automatically:
   - Create .pak file associations
   - Add right-click context menu integration
   - Install WebView2 if needed (no admin required)

### For Existing Users
- **Automatic Update**: Users on v3.2.0 will receive an automatic update notification
- **Manual Update**: Download and run the new installer - your settings and mods will be preserved

## 🔧 Technical Details
- Fixed event handler for delete confirmation button (onClick → onPointerDown)
- Improved dialog component styling and accessibility
- Enhanced visual feedback for destructive actions

## 📝 Full Changelog
See all changes: https://github.com/Jaten-shii/marvel-rivals-mod-manager/compare/v3.2.0...v3.2.1

---

**Enjoy modding! 🎮**

If you encounter any issues, please report them on our [GitHub Issues](https://github.com/Jaten-shii/marvel-rivals-mod-manager/issues) page.
