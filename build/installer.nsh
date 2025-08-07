; Marvel Rivals Mod Manager Installer Helper Functions
; Additional NSIS functions and macros for the installer

!include "LogicLib.nsh"
!include "FileFunc.nsh"
!include "WordFunc.nsh"

; Custom function to detect Marvel Rivals installation
Function DetectMarvelRivals
  Push $0
  Push $1
  Push $2
  
  ; Common Steam installation paths
  StrCpy $0 ""
  
  ; Check default Steam path
  ReadRegStr $1 HKLM "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\Steam" "InstallLocation"
  ${If} $1 != ""
    StrCpy $2 "$1\steamapps\common\MarvelRivals"
    ${If} ${FileExists} "$2\MarvelGame\Binaries\Win64\MarvelGame.exe"
      StrCpy $0 $2
      Goto done
    ${EndIf}
  ${EndIf}
  
  ; Check common installation directories
  ${If} ${FileExists} "C:\Program Files (x86)\Steam\steamapps\common\MarvelRivals\MarvelGame\Binaries\Win64\MarvelGame.exe"
    StrCpy $0 "C:\Program Files (x86)\Steam\steamapps\common\MarvelRivals"
    Goto done
  ${EndIf}
  
  ${If} ${FileExists} "C:\Program Files\Steam\steamapps\common\MarvelRivals\MarvelGame\Binaries\Win64\MarvelGame.exe"
    StrCpy $0 "C:\Program Files\Steam\steamapps\common\MarvelRivals"
    Goto done
  ${EndIf}
  
  ; Check user Steam library folders
  EnumRegKey $1 HKCU "SOFTWARE\Valve\Steam" 0
  ${If} $1 != ""
    ReadRegStr $1 HKCU "SOFTWARE\Valve\Steam" "SteamPath"
    ${If} $1 != ""
      StrCpy $2 "$1\steamapps\common\MarvelRivals"
      ${If} ${FileExists} "$2\MarvelGame\Binaries\Win64\MarvelGame.exe"
        StrCpy $0 $2
        Goto done
      ${EndIf}
    ${EndIf}
  ${EndIf}
  
  done:
  Pop $2
  Pop $1
  Exch $0
FunctionEnd

; Function to create mod directory if it doesn't exist
Function CreateModDirectory
  Push $0
  Call DetectMarvelRivals
  Pop $0
  
  ${If} $0 != ""
    CreateDirectory "$0\MarvelGame\Marvel\Content\Paks\~mods"
    WriteRegStr HKCU "SOFTWARE\MarvelRivalsModManager" "GameDirectory" "$0"
    WriteRegStr HKCU "SOFTWARE\MarvelRivalsModManager" "ModDirectory" "$0\MarvelGame\Marvel\Content\Paks\~mods"
  ${EndIf}
  
  Pop $0
FunctionEnd

; Function to check for running processes using native Windows commands
Function CheckRunningProcesses
  Push $0
  Push $1
  
  check_mod_manager:
  ; Check for Marvel Rivals Mod Manager
  nsExec::ExecToStack 'tasklist /FI "IMAGENAME eq MarvelRivalsModManager.exe" /FO CSV /NH'
  Pop $0 ; return code
  Pop $1 ; output
  
  ${If} $0 == 0
    ${AndIf} $1 != ""
    ${AndIfNot} $1 == "INFO: No tasks are running which match the specified criteria."
      MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "Marvel Rivals Mod Manager is currently running. Please close it and click Retry, or click Cancel to exit the installer." IDRETRY check_mod_manager
      Abort
  ${EndIf}
  
  ; Check for Marvel Rivals game
  nsExec::ExecToStack 'tasklist /FI "IMAGENAME eq MarvelGame.exe" /FO CSV /NH'
  Pop $0 ; return code  
  Pop $1 ; output
  
  ${If} $0 == 0
    ${AndIf} $1 != ""
    ${AndIfNot} $1 == "INFO: No tasks are running which match the specified criteria."
      MessageBox MB_YESNO|MB_ICONQUESTION "Marvel Rivals appears to be running. It's recommended to close the game before installing the mod manager. Continue anyway?" IDYES continue_install
      Abort
  ${EndIf}
  
  continue_install:
  Pop $1
  Pop $0
FunctionEnd

; Function to register URL protocol for marvel-rivals-mod:// links
Function RegisterURLProtocol
  WriteRegStr HKCR "marvel-rivals-mod" "" "URL:Marvel Rivals Mod Protocol"
  WriteRegStr HKCR "marvel-rivals-mod" "URL Protocol" ""
  WriteRegStr HKCR "marvel-rivals-mod\DefaultIcon" "" "$INSTDIR\MarvelRivalsModManager.exe,0"
  WriteRegStr HKCR "marvel-rivals-mod\shell\open\command" "" '"$INSTDIR\MarvelRivalsModManager.exe" --url "%1"'
FunctionEnd

; Function to create right-click context menu entries
Function CreateContextMenuEntries
  ; For .pak files
  WriteRegStr HKCR "MarvelRivalsMod\shell\install" "" "Install with Marvel Rivals Mod Manager"
  WriteRegStr HKCR "MarvelRivalsMod\shell\install" "Icon" "$INSTDIR\MarvelRivalsModManager.exe,0"
  WriteRegStr HKCR "MarvelRivalsMod\shell\install\command" "" '"$INSTDIR\MarvelRivalsModManager.exe" --install "%1"'
  
  ; For directories (right-click on folder to open in mod manager)
  WriteRegStr HKCR "Directory\shell\OpenWithModManager" "" "Open with Marvel Rivals Mod Manager"
  WriteRegStr HKCR "Directory\shell\OpenWithModManager" "Icon" "$INSTDIR\MarvelRivalsModManager.exe,0"
  WriteRegStr HKCR "Directory\shell\OpenWithModManager\command" "" '"$INSTDIR\MarvelRivalsModManager.exe" --path "%1"'
FunctionEnd

; Function to remove context menu entries during uninstall
Function un.RemoveContextMenuEntries
  DeleteRegKey HKCR "MarvelRivalsMod\shell\install"
  DeleteRegKey HKCR "Directory\shell\OpenWithModManager"
  DeleteRegKey HKCR "marvel-rivals-mod"
FunctionEnd

; Macro to add firewall exception
!macro AddFirewallException
  ; Add Windows Firewall exception for the application
  nsExec::ExecToLog 'netsh advfirewall firewall add rule name="Marvel Rivals Mod Manager" dir=in action=allow program="$INSTDIR\MarvelRivalsModManager.exe" enable=yes'
!macroend

; Macro to remove firewall exception
!macro RemoveFirewallException
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="Marvel Rivals Mod Manager"'
!macroend