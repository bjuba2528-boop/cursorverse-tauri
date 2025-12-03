@echo off
echo ================================================
echo  CursorVerse - Quick Build (EXE only)
echo ================================================
echo.

echo Building...
call npm run tauri build

echo.
echo Done! Files:
echo - EXE: src-tauri\target\release\CursorVerse.exe
echo - Installer(s): src-tauri\target\release\bundle\*
echo.
pause
