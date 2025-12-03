@echo off
echo ===================================
echo Discord RPC Test для CursorVerse
echo ===================================
echo.
echo Application ID: 1444795416846663914
echo.
echo Проверка:
echo 1. Discord запущен?
tasklist | findstr "Discord.exe" >nul
if %errorlevel%==0 (
    echo    [OK] Discord запущен
) else (
    echo    [X] Discord НЕ запущен - ЗАПУСТИТЕ DISCORD!
    pause
    exit /b 1
)
echo.
echo 2. Проверяем Developer Portal...
echo    Откройте: https://discord.com/developers/applications/1444795416846663914
echo    Убедитесь что:
echo    - Application активен
echo    - Rich Presence enabled
echo.
echo 3. Запускаем CursorVerse...
start "" "%~dp0target\release\CursorVerse.exe"
echo.
echo 4. Проверка статуса через 5 секунд...
timeout /t 5 /nobreak >nul
echo.
echo Откройте свой профиль Discord и проверьте активность!
echo.
echo Если не работает:
echo - Перезапустите Discord полностью (закройте из трея)
echo - Проверьте что Application ID правильный
echo - Убедитесь что нет ошибок в логах CursorVerse
echo.
pause
