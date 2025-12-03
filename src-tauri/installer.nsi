; CursorVerse NSIS Installer Script
; Crimson/Elfen Theme

!include "MUI2.nsh"

; ===============================
; Installer Settings
; ===============================
Name "CursorVerse"
OutFile "CursorVerse-Setup.exe"
InstallDir "$PROGRAMFILES64\CursorVerse"
InstallDirRegKey HKLM "Software\CursorVerse" "Install_Dir"
RequestExecutionLevel admin

; ===============================
; UI Settings (Crimson Theme)
; ===============================
!define MUI_ABORTWARNING
!define MUI_ICON "icons\CursorVerse.ico"
!define MUI_UNICON "icons\CursorVerse.ico"

; Цвета в стиле Crimson
!define MUI_BGCOLOR DC143C
!define MUI_TEXTCOLOR FFFFFF

; Описание
!define MUI_WELCOMEPAGE_TITLE "Добро пожаловать в CursorVerse!"
!define MUI_WELCOMEPAGE_TEXT "Эта программа установит CursorVerse - систему персонализации Windows с AI-помощником Люси на базе Google Gemini.$\r$\n$\r$\nВозможности:$\r$\n• Управление курсорами и темами$\r$\n• AI-помощник с голосовым управлением$\r$\n• Настройка обоев и рабочего стола$\r$\n• Кастомизация панели задач$\r$\n$\r$\nНажмите Далее для продолжения."

!define MUI_FINISHPAGE_TITLE "Установка завершена!"
!define MUI_FINISHPAGE_TEXT "CursorVerse успешно установлен.$\r$\n$\r$\nЛюси - ваш умный AI-помощник готов к работе!$\r$\n$\r$\nНажмите Готово для завершения."
!define MUI_FINISHPAGE_RUN "$INSTDIR\CursorVerse.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Запустить CursorVerse"

; ===============================
; Pages
; ===============================
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "LICENSE.txt"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

; ===============================
; Languages
; ===============================
!insertmacro MUI_LANGUAGE "Russian"
!insertmacro MUI_LANGUAGE "English"

; ===============================
; Installer Section
; ===============================
Section "CursorVerse" SecMain
    SetOutPath "$INSTDIR"
    
    ; Установка файлов
    File /r "release\*.*"
    
    ; Создание ярлыков
    CreateDirectory "$SMPROGRAMS\CursorVerse"
    CreateShortcut "$SMPROGRAMS\CursorVerse\CursorVerse.lnk" "$INSTDIR\CursorVerse.exe"
    CreateShortcut "$SMPROGRAMS\CursorVerse\Удалить CursorVerse.lnk" "$INSTDIR\Uninstall.exe"
    CreateShortcut "$DESKTOP\CursorVerse.lnk" "$INSTDIR\CursorVerse.exe"
    
    ; Запись информации об удалении
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\CursorVerse" "DisplayName" "CursorVerse"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\CursorVerse" "DisplayVersion" "1.5.0"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\CursorVerse" "Publisher" "CursorVerse Team"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\CursorVerse" "DisplayIcon" "$INSTDIR\CursorVerse.exe"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\CursorVerse" "UninstallString" "$INSTDIR\Uninstall.exe"
    WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\CursorVerse" "NoModify" 1
    WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\CursorVerse" "NoRepair" 1
    
    WriteUninstaller "$INSTDIR\Uninstall.exe"
    
    ; Автозапуск (опционально)
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "CursorVerse" "$INSTDIR\CursorVerse.exe --minimize"
    
SectionEnd

; ===============================
; Uninstaller Section
; ===============================
Section "Uninstall"
    ; Удаление файлов
    Delete "$INSTDIR\*.*"
    RMDir /r "$INSTDIR"
    
    ; Удаление ярлыков
    Delete "$DESKTOP\CursorVerse.lnk"
    Delete "$SMPROGRAMS\CursorVerse\*.*"
    RMDir "$SMPROGRAMS\CursorVerse"
    
    ; Удаление записей реестра
    DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\CursorVerse"
    DeleteRegKey HKLM "Software\CursorVerse"
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "CursorVerse"
    
SectionEnd
