; Custom NSIS finish-page handling for electron-builder's assisted installer.
;
; WHY THIS EXISTS
; ---------------
; This app ships an assisted installer (`oneClick: false`,
; `allowToChangeInstallationDirectory: true`). With that configuration the
; assisted installer does not reliably honour `--force-run` on auto-update:
; the update installs silently but the app is not relaunched. This is a known
; electron-builder limitation (issues #2179 and #5792), observed in this app on
; a real 1.11.0 -> 1.12.0 update.
;
; WHAT IT DOES
; ------------
; Defines the `customFinishPage` macro that electron-builder's
; `assistedInstaller.nsh` looks for (`!ifmacrodef customFinishPage`). When an
; update is detected (`${isUpdated}`), the finish page is skipped and the freshly
; installed app is started, so the user always comes back on the new version.
; `oneClick: false` and the install-directory picker are preserved.
;
; `StartApp` mirrors electron-builder's own default so a first-time assisted
; install keeps its "run the app" behaviour.

!macro customFinishPage
  Function StartApp
    ${if} ${isUpdated}
      StrCpy $1 "--updated"
    ${else}
      StrCpy $1 ""
    ${endif}
    ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" "$1"
  FunctionEnd

  Function finishPageCustomPRE
    ${if} ${isUpdated}
      HideWindow
      Call StartApp
      Abort
    ${endif}
  FunctionEnd

  !ifndef HIDE_RUN_AFTER_FINISH
    !define MUI_FINISHPAGE_RUN
    !define MUI_FINISHPAGE_RUN_FUNCTION "StartApp"
  !endif

  !define MUI_PAGE_CUSTOMFUNCTION_PRE finishPageCustomPRE
  !insertmacro MUI_PAGE_FINISH
!macroend
