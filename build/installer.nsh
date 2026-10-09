; Keep the assisted wizard simple: install for the current user without UAC.
; User data is intentionally retained by the standard NSIS uninstaller.
!macro customInstallMode
  StrCpy $isForceCurrentInstall "1"
  StrCpy $isForceMachineInstall "0"
!macroend
