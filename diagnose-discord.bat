@echo off
chcp 65001 >nul
echo ========================================
echo 🔍 Discord RPC - Диагностика
echo ========================================
echo.

echo 1️⃣ Проверка Application ID в Discord Developer Portal
echo.
echo Откройте: https://discord.com/developers/applications/1444795416846663914
echo.
echo ❓ Что проверить:
echo    ✅ Приложение существует (не 404 ошибка)
echo    ✅ Rich Presence включен (Rich Presence -^> Enable)
echo    ✅ В Art Assets загружен логотип с именем: cursorverse_logo
echo.

pause
echo.

echo 2️⃣ Проверка Discord процесса
tasklist | findstr /I Discord
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Discord НЕ запущен!
    echo Запустите Discord и повторите попытку
    pause
    exit /b 1
) else (
    echo ✅ Discord запущен
)

echo.
echo 3️⃣ Проверка Discord IPC
if exist "%TEMP%\discord-ipc-0" (
    echo ✅ Discord IPC активен
) else (
    echo ⚠️ Discord IPC не найден
    echo Рекомендация: Перезапустите Discord
)

echo.
echo 4️⃣ Запуск CursorVerse с логированием
echo.
if exist "target\release\CursorVerse.exe" (
    echo Запускаю CursorVerse...
    start "" "target\release\CursorVerse.exe"
    echo.
    echo ✅ CursorVerse запущен
    echo.
    echo 📝 Проверьте в приложении:
    echo    1. Нажмите F12 (DevTools)
    echo    2. Перейдите на вкладку Lucy AI
    echo    3. Напишите любое сообщение
    echo    4. В консоли должно быть:
    echo       [Discord] Начало инициализации...
    echo       [Discord] Client ID: 1444795416846663914
    echo       [Discord] ✅ Успешно подключен!
    echo       [Discord] ✅ Presence успешно обновлен!
    echo.
    echo 📱 Проверьте в Discord:
    echo    1. Откройте свой профиль (кликните на аватар)
    echo    2. Должна появиться активность "Играет в CursorVerse"
    echo.
    echo ⚠️ ЕСЛИ АКТИВНОСТЬ НЕ ПОЯВИЛАСЬ:
    echo    Причина 1: Application ID не зарегистрирован
    echo       → Создайте новое приложение: https://discord.com/developers/applications
    echo       → Скопируйте новый Application ID
    echo       → Замените в src-tauri/src/discord_rpc.rs
    echo.
    echo    Причина 2: Rich Presence не включен
    echo       → Откройте приложение в Developer Portal
    echo       → Rich Presence → Enable Rich Presence ✅
    echo.
    echo    Причина 3: Discord кеш
    echo       → Закройте Discord ПОЛНОСТЬЮ (Ctrl+Q)
    echo       → Закройте через диспетчер задач если не помогло
    echo       → Запустите заново
    echo.
) else (
    echo ❌ Файл не найден: target\release\CursorVerse.exe
    echo.
    echo Запустите сборку:
    echo cargo build --release --manifest-path src-tauri/Cargo.toml
)

echo.
echo ========================================
pause
