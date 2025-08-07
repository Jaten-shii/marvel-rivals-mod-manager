; Marvel Rivals Mod Manager Installer Script
; This script creates a Windows installer for the Marvel Rivals Mod Manager

; Use conditional definitions to avoid conflicts with electron-builder's command-line defines
!ifndef PRODUCT_NAME
  !define PRODUCT_NAME "Marvel Rivals Mod Manager"
!endif
!ifndef PRODUCT_VERSION
  !define PRODUCT_VERSION "1.0.0"
!endif
!ifndef PRODUCT_PUBLISHER
  !define PRODUCT_PUBLISHER "Marvel Rivals Mod Manager Team"
!endif
!ifndef PRODUCT_WEB_SITE
  !define PRODUCT_WEB_SITE "https://github.com/marvel-rivals-mod-manager/marvel-rivals-mod-manager"
!endif
!ifndef PRODUCT_DIR_REGKEY
  !define PRODUCT_DIR_REGKEY "Software\Microsoft\Windows\CurrentVersion\App Paths\MarvelRivalsModManager.exe"
!endif
!ifndef PRODUCT_UNINST_KEY
  !define PRODUCT_UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}"
!endif
!ifndef PRODUCT_UNINST_ROOT_KEY
  !define PRODUCT_UNINST_ROOT_KEY "HKCU"
!endif

; MUI Settings - Modern Dark Theme Configuration
!include "MUI2.nsh"
!include "nsDialogs.nsh"
!include "WinMessages.nsh"

; ============================================================================
; WINDOWS API CONSTANTS - Required for Dark Theme Implementation
; ============================================================================

; Window Messages
!ifndef WM_SETFONT
  !define WM_SETFONT 0x0030
!endif

; ShowWindow Constants  
!ifndef SW_SHOW
  !define SW_SHOW 5
!endif
!ifndef SW_HIDE
  !define SW_HIDE 0
!endif

; Window Styles
!ifndef WS_VISIBLE
  !define WS_VISIBLE 0x10000000
!endif
!ifndef WS_CHILD
  !define WS_CHILD 0x40000000
!endif

; Edit Control Styles for Text Wrapping
!ifndef ES_MULTILINE
  !define ES_MULTILINE 0x0004
!endif
!ifndef ES_READONLY
  !define ES_READONLY 0x0800
!endif



; Modern UI Configuration
!define MUI_ABORTWARNING
!define MUI_COMPONENTSPAGE_SMALLDESC
!define MUI_FINISHPAGE_NOAUTOCLOSE
!define MUI_UNFINISHPAGE_NOAUTOCLOSE

; Modern Visual Style - Dark Theme Enhanced
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_RIGHT

; Dark Theme Bitmap Configuration
; Note: Add dark-themed bitmaps here when available
; !define MUI_HEADERIMAGE_BITMAP "${BUILD_RESOURCES_DIR}\installer-header-dark.bmp"
; !define MUI_WELCOMEFINISHPAGE_BITMAP "${BUILD_RESOURCES_DIR}\installer-welcome-dark.bmp"


; Icon Configuration
!ifndef MUI_ICON
  !define MUI_ICON "${NSISDIR}\Contrib\Graphics\Icons\modern-install.ico"
!endif
!ifndef MUI_UNICON
  !define MUI_UNICON "${NSISDIR}\Contrib\Graphics\Icons\modern-uninstall.ico"
!endif

; Custom Welcome/Finish Page Styling
!define MUI_WELCOMEPAGE_TITLE "Welcome to Marvel Rivals Mod Manager Setup"
!define MUI_WELCOMEPAGE_TEXT "This wizard will guide you through the installation of Marvel Rivals Mod Manager.$\r$\n$\r$\nThe mod manager provides seamless mod installation, automatic organization, and real-time file monitoring for Marvel Rivals.$\r$\n$\r$\nClick Next to continue."

!define MUI_FINISHPAGE_TITLE "Installation Complete"
!define MUI_FINISHPAGE_TEXT "Marvel Rivals Mod Manager has been successfully installed on your computer.$\r$\n$\r$\nYou can now manage your Marvel Rivals mods with ease!"
!define MUI_FINISHPAGE_RUN_TEXT "Launch Marvel Rivals Mod Manager"

; Language Selection Dialog Settings
!define MUI_LANGDLL_REGISTRY_ROOT "${PRODUCT_UNINST_ROOT_KEY}"
!define MUI_LANGDLL_REGISTRY_KEY "${PRODUCT_UNINST_KEY}"
!define MUI_LANGDLL_REGISTRY_VALUENAME "NSIS:Language"


; Welcome page
!insertmacro MUI_PAGE_WELCOME

; Directory page
!insertmacro MUI_PAGE_DIRECTORY

; Instfiles page
!insertmacro MUI_PAGE_INSTFILES

; Finish page
!define MUI_FINISHPAGE_RUN "$INSTDIR\Marvel Rivals Mod Manager.exe"
!insertmacro MUI_PAGE_FINISH

; Uninstaller pages
!insertmacro MUI_UNPAGE_INSTFILES

; Language files
!insertmacro MUI_LANGUAGE "English"

; Reserve files
!insertmacro MUI_RESERVEFILE_LANGDLL

Name "${PRODUCT_NAME}"
InstallDir "$LOCALAPPDATA\${PRODUCT_NAME}"
InstallDirRegKey HKCU "${PRODUCT_DIR_REGKEY}" ""
ShowInstDetails show
ShowUnInstDetails show

; Version information handled automatically by electron-builder

Section "Marvel Rivals Mod Manager (required)" SEC01
  SectionIn RO
  
  ; Progress: Preparing installation directory
  DetailPrint "Preparing installation directory: $INSTDIR"
  SetOutPath "$INSTDIR"
  SetOverwrite ifnewer
  
  ; Progress: Installing application files
  DetailPrint "Installing Marvel Rivals Mod Manager application files..."
  File /r "${PROJECT_DIR}\dist\win-unpacked\*.*"
  
  ; Verify installation was successful
  IfFileExists "$INSTDIR\Marvel Rivals Mod Manager.exe" installation_ok installation_failed
  
  installation_failed:
    MessageBox MB_ICONSTOP "Installation failed. The main application file could not be installed."
    Abort
  
  installation_ok:
  DetailPrint "Application files installed successfully"
  
  ; Progress: Creating shortcuts
  DetailPrint "Creating application shortcuts..."
  CreateDirectory "$SMPROGRAMS\${PRODUCT_NAME}"
  IfErrors 0 shortcuts_ok
    DetailPrint "Warning: Could not create Start Menu folder"
    Goto skip_start_menu
  
  shortcuts_ok:
  CreateShortCut "$SMPROGRAMS\${PRODUCT_NAME}\${PRODUCT_NAME}.lnk" "$INSTDIR\Marvel Rivals Mod Manager.exe"
  IfErrors 0 start_menu_ok
    DetailPrint "Warning: Could not create Start Menu shortcut"
    Goto skip_start_menu
  
  start_menu_ok:
  DetailPrint "Start Menu shortcut created"
  
  skip_start_menu:
  CreateShortCut "$DESKTOP\${PRODUCT_NAME}.lnk" "$INSTDIR\Marvel Rivals Mod Manager.exe"
  IfErrors 0 shortcuts_done
    DetailPrint "Warning: Could not create Desktop shortcut"
    Goto shortcuts_done
  
  DetailPrint "Desktop shortcut created"
  
  shortcuts_done:
  
  ; Progress: Creating uninstaller
  DetailPrint "Creating uninstaller..."
  WriteUninstaller "$INSTDIR\uninst.exe"
  
  ; Progress: Registering application
  DetailPrint "Registering application with Windows..."
  WriteRegStr HKCU "${PRODUCT_DIR_REGKEY}" "" "$INSTDIR\Marvel Rivals Mod Manager.exe"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "DisplayName" "$(^Name)"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "UninstallString" "$INSTDIR\uninst.exe"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "DisplayIcon" "$INSTDIR\Marvel Rivals Mod Manager.exe"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "DisplayVersion" "${PRODUCT_VERSION}"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "URLInfoAbout" "${PRODUCT_WEB_SITE}"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "Publisher" "${PRODUCT_PUBLISHER}"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "InstallLocation" "$INSTDIR"
  
  ; Progress: Setting up file associations
  DetailPrint "Setting up .pak file associations..."
  WriteRegStr HKCR ".pak" "" "MarvelRivalsMod"
  WriteRegStr HKCR "MarvelRivalsMod" "" "Marvel Rivals Mod File"
  WriteRegStr HKCR "MarvelRivalsMod\DefaultIcon" "" "$INSTDIR\Marvel Rivals Mod Manager.exe,0"
  WriteRegStr HKCR "MarvelRivalsMod\shell\open\command" "" '"$INSTDIR\Marvel Rivals Mod Manager.exe" "%1"'
  WriteRegStr HKCR "MarvelRivalsMod\shell\edit" "" "Install with Marvel Rivals Mod Manager"
  WriteRegStr HKCR "MarvelRivalsMod\shell\edit\command" "" '"$INSTDIR\Marvel Rivals Mod Manager.exe" --install "%1"'
  
  ; Progress: Configuring Marvel Rivals integration
  DetailPrint "Configuring Marvel Rivals game integration..."
  Call CreateModDirectory
  
  ; Progress: Setting up URL protocol support
  DetailPrint "Setting up URL protocol support..."
  Call RegisterURLProtocol
  
  ; Progress: Creating context menu entries
  DetailPrint "Creating context menu entries..."
  Call CreateContextMenuEntries
  
  ; Progress: Finalizing installation
  DetailPrint "Finalizing installation and refreshing system..."
  System::Call 'shell32.dll::SHChangeNotify(i, i, i, i) v (0x08000000, 0, 0, 0)'
  DetailPrint "Installation completed successfully!"
SectionEnd




Function .onInit
  ; Initialize installer with language selection
  !insertmacro MUI_LANGDLL_DISPLAY
FunctionEnd

Function un.onUninstSuccess
  HideWindow
  MessageBox MB_ICONINFORMATION|MB_OK "$(^Name) was successfully removed from your computer."
FunctionEnd

Function un.onInit
  MessageBox MB_ICONQUESTION|MB_YESNO|MB_DEFBUTTON2 "Are you sure you want to completely remove $(^Name) and all of its components?" IDYES +2
  Abort
FunctionEnd

Section Uninstall
  ; Ensure application is closed before uninstalling
  DetailPrint "Closing Marvel Rivals Mod Manager if running..."
  nsExec::ExecToLog 'taskkill /F /IM "Marvel Rivals Mod Manager.exe"'
  Sleep 500  ; Give Windows time to release file handles
  
  ; Remove shortcuts
  Delete "$DESKTOP\${PRODUCT_NAME}.lnk"
  Delete "$SMPROGRAMS\${PRODUCT_NAME}\${PRODUCT_NAME}.lnk"
  RMDir "$SMPROGRAMS\${PRODUCT_NAME}"
  
  ; Remove auto-start registry entry
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${PRODUCT_NAME}"
  
  ; Remove file associations
  DeleteRegKey HKCR ".pak"
  DeleteRegKey HKCR "MarvelRivalsMod"
  
  ; Remove context menu entries and URL protocol
  Call un.RemoveContextMenuEntries
  
  ; Remove application-specific registry entries (but NOT mod directory info)
  DeleteRegKey HKCU "SOFTWARE\MarvelRivalsModManager"
  
  ; Remove registry keys
  DeleteRegKey ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}"
  DeleteRegKey HKCU "${PRODUCT_DIR_REGKEY}"
  
  ; Remove application files explicitly (Electron/Chromium files)
  DetailPrint "Removing application files..."
  
  ; Main executable
  Delete "$INSTDIR\Marvel Rivals Mod Manager.exe"
  Delete "$INSTDIR\uninst.exe"
  
  ; Electron/Chromium DLL files
  Delete "$INSTDIR\d3dcompiler_47.dll"
  Delete "$INSTDIR\ffmpeg.dll"
  Delete "$INSTDIR\libEGL.dll"
  Delete "$INSTDIR\libGLESv2.dll"
  Delete "$INSTDIR\vk_swiftshader.dll"
  Delete "$INSTDIR\vulkan-1.dll"
  
  ; Electron/Chromium PAK files
  Delete "$INSTDIR\chrome_100_percent.pak"
  Delete "$INSTDIR\chrome_200_percent.pak"
  Delete "$INSTDIR\resources.pak"
  Delete "$INSTDIR\icudtl.dat"
  Delete "$INSTDIR\v8_context_snapshot.bin"
  
  ; Other Electron files
  Delete "$INSTDIR\vk_swiftshader_icd.json"
  Delete "$INSTDIR\LICENSE"
  Delete "$INSTDIR\LICENSES.chromium.html"
  Delete "$INSTDIR\version"
  
  ; Remove Electron directories
  RMDir /r "$INSTDIR\locales"
  RMDir /r "$INSTDIR\resources"
  RMDir /r "$INSTDIR\swiftshader"
  
  ; Now try to remove the main directory (should be empty)
  RMDir "$INSTDIR"
  
  ; If directory still exists, force remove with reboot option
  ${If} ${FileExists} "$INSTDIR\*.*"
    DetailPrint "Some files are locked. They will be removed on next reboot."
    RMDir /r /REBOOTOK "$INSTDIR"
  ${EndIf}
  
  ; Refresh shell
  System::Call 'shell32.dll::SHChangeNotify(i, i, i, i) v (0x08000000, 0, 0, 0)'
  
  DetailPrint "Uninstallation complete!"
  SetAutoClose true
SectionEnd