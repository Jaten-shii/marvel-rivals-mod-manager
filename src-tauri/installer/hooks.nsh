; NSIS installer hooks for Marvel Rivals Mod Manager.
; Wired up via bundle.windows.nsis.installerHooks in tauri.conf.json.

; Uninstall: offer to also remove installed mods from the game's ~mods folder.
; The app keeps the mods path in game-mods-dir.txt next to its settings
; (written by save_app_settings_internal in lib.rs) because the uninstaller
; can't parse settings.json.
!macro NSIS_HOOK_PREUNINSTALL
  ; Never touch mods during silent/automated uninstalls (e.g. updates)
  IfSilent mods_cleanup_skipped

  Push $R0
  Push $R1
  Push $R2

  ClearErrors
  FileOpen $R0 "$APPDATA\com.marvelrivalsmodmanager.app\game-mods-dir.txt" r
  IfErrors mods_cleanup_done
  FileRead $R0 $R1
  FileClose $R0

  ; Safety: only act on a path that actually ends in "~mods"
  StrCpy $R2 $R1 "" -5
  StrCmp $R2 "~mods" 0 mods_cleanup_done
  IfFileExists "$R1\*.*" 0 mods_cleanup_done

  MessageBox MB_YESNO|MB_ICONQUESTION "Also remove your installed mods from the Marvel Rivals game folder?$\r$\n$\r$\n$R1" IDNO mods_cleanup_done
  RMDir /r "$R1"

mods_cleanup_done:
  Pop $R2
  Pop $R1
  Pop $R0
mods_cleanup_skipped:
!macroend
