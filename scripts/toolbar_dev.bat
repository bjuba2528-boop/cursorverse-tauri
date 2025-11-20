@echo off
setlocal
cd /d "%~dp0\..\tauri-toolbar"
if not exist node_modules (
  echo Installing Node dependencies...
  call npm install
)
where tauri >nul 2>nul
if %errorlevel% neq 0 (
  echo Installing Tauri CLI locally...
  call npm install -D @tauri-apps/cli
)
call npx tauri dev
endlocal
