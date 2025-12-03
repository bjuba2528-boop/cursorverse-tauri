@echo off
chcp 65001 >nul
echo ========================================
echo 🎮 Discord Rich Presence - Полный тест
echo ========================================
echo.

:: Закрыть CursorVerse
echo 1. Закрываю CursorVerse...
taskkill /F /IM CursorVerse.exe 2>nul
timeout /t 2 /nobreak >nul

:: Закрыть Discord
echo 2. Закрываю Discord...
taskkill /F /IM Discord.exe 2>nul
taskkill /F /IM DiscordPTB.exe 2>nul
taskkill /F /IM DiscordCanary.exe 2>nul
timeout /t 2 /nobreak >nul

:: Запустить Discord
echo 3. Запускаю Discord...
start discord://
echo    Жду 5 секунд для инициализации Discord...
timeout /t 5 /nobreak >nul

:: Проверить Discord IPC
echo 4. Проверяю Discord IPC...
if exist "%TEMP%\discord-ipc-0" (
    echo    ✅ Discord IPC активен
) else (
    echo    ❌ Discord IPC не найден! Discord может быть не готов.
    echo    Жду еще 5 секунд...
    timeout /t 5 /nobreak >nul
)

:: Запустить CursorVerse
echo 5. Запускаю CursorVerse...
if exist "target\release\CursorVerse.exe" (
    start "" "target\release\CursorVerse.exe"
    echo    ✅ CursorVerse запущен
) else (
    echo    ❌ Файл не найден: target\release\CursorVerse.exe
    echo    Запустите сборку: cargo build --release --manifest-path src-tauri/Cargo.toml
    pause
    exit /b 1
)

echo.
echo ========================================
echo 📝 Проверьте в CursorVerse:
echo    1. Нажмите F12 (DevTools)
echo    2. Смотрите логи:
echo       [Discord] Начало инициализации...
echo       [Discord] ✅ Успешно подключен!
echo.
echo 📱 Проверьте в Discord:
echo    1. Откройте свой профиль
echo    2. Должно быть: "Играет в CursorVerse"
echo ========================================
echo.
pause
