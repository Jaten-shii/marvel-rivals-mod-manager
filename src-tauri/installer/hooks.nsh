; NSIS installer hooks for Marvel Rivals Mod Manager.
; Wired up via bundle.windows.nsis.installerHooks in tauri.conf.json.

; Uninstall: optionally remove installed mods from the game's ~mods folder.
;
; This is OPT-IN via the in-app setting "Remove mods on uninstall" (default
; off), which writes remove-mods-on-uninstall.txt next to the app's settings.
; No marker file = no prompt and mods are never touched, so there is nothing
; to misclick during a normal uninstall. With the marker present, one
; confirmation is shown with "No" as the default button.
;
; The mods path comes from game-mods-dir.txt (written by
; save_app_settings_internal in lib.rs) because the uninstaller can't parse
; settings.json.
!macro NSIS_HOOK_PREUNINSTALL
  ; Never touch mods during silent/automated uninstalls (e.g. updates)
  IfSilent mods_cleanup_skipped

  ; Opt-in gate: without the marker written by the app's settings toggle,
  ; skip everything — no dialog, no deletion.
  IfFileExists "$APPDATA\com.marvelrivalsmodmanager.app\remove-mods-on-uninstall.txt" 0 mods_cleanup_skipped

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

  ; "No" is the default button — Enter or a reflexive click keeps the mods
  MessageBox MB_YESNO|MB_ICONEXCLAMATION|MB_DEFBUTTON2 \
    "Mod cleanup is enabled in the app's settings.$\r$\n$\r$\nDelete ALL installed mods from:$\r$\n$R1$\r$\n$\r$\nThis cannot be undone. Choose No to keep them." \
    IDYES mods_cleanup_delete
  Goto mods_cleanup_done

mods_cleanup_delete:
  RMDir /r "$R1"

mods_cleanup_done:
  Pop $R2
  Pop $R1
  Pop $R0
mods_cleanup_skipped:
!macroend
