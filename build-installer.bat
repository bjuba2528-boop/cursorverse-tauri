@echo off
echo ================================================
echo  CursorVerse - Build Script
echo  Crimson Edition
echo ================================================
echo.

:: Проверка Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js not found! Please install Node.js
    pause
    exit /b 1
)

:: Проверка Rust
where cargo >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Rust not found! Please install Rust from rustup.rs
    pause
    exit /b 1
)

echo [1/5] Installing dependencies...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo [2/5] Building frontend...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to build frontend
    pause
    exit /b 1
)

echo.
echo [3/5] Building Tauri app...
call npm run tauri build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to build Tauri app
    pause
    exit /b 1
)

echo.
echo [4/5] Copying files...
if not exist "release" mkdir release
xcopy /E /I /Y "src-tauri\target\release\CursorVerse.exe" "release\"
xcopy /E /I /Y "src-tauri\target\release\bundle\msi\*.msi" "release\"
xcopy /E /I /Y "src-tauri\target\release\bundle\nsis\*.exe" "release\"

echo.
echo [5/5] Build complete!
echo.
echo ================================================
echo  Output files:
echo  - EXE: release\CursorVerse.exe
echo  - MSI: release\*.msi
echo  - NSIS: release\*.exe
echo ================================================
echo.
echo Press any key to open release folder...
pause >nul
explorer release

