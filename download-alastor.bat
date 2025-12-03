@echo off
chcp 65001 >nul
echo ====================================
echo  Загрузка Alastor Shimeji из Steam Workshop
echo ====================================
echo.

set WORKSHOP_ID=2970172335
set STEAM_DIR=%cd%\steam_workshop
set DOWNLOAD_DIR=%STEAM_DIR%\steamapps\workshop\content\1980920\%WORKSHOP_ID%
set DPET_DIR=%cd%\alastor-dpet

echo [1/4] Создание директорий...
if not exist "%STEAM_DIR%" mkdir "%STEAM_DIR%"
if exist "%DPET_DIR%" (
    echo Удаление старой версии...
    rmdir /s /q "%DPET_DIR%"
)
mkdir "%DPET_DIR%"
echo ✓ Директории готовы

echo.
echo [2/4] Загрузка из Steam Workshop (ID: %WORKSHOP_ID%)...
echo Это может занять несколько минут...

steamcmd.exe +login anonymous +workshop_download_item 1980920 %WORKSHOP_ID% +quit

if not exist "%DOWNLOAD_DIR%" (
    echo ✗ Ошибка: Файлы не загружены
    echo Проверьте подключение к интернету и ID предмета
    pause
    exit /b 1
)

echo ✓ Загрузка завершена

echo.
echo [3/4] Конвертация в формат DPET...

REM Создаем структуру DPET
mkdir "%DPET_DIR%\animations"
mkdir "%DPET_DIR%\animations\idle"
mkdir "%DPET_DIR%\animations\walk"
mkdir "%DPET_DIR%\animations\fall"
mkdir "%DPET_DIR%\animations\drag"
mkdir "%DPET_DIR%\animations\click"

REM Копируем файлы (Shimeji обычно использует PNG/GIF)
echo Копирование анимаций...

REM Ищем GIF файлы
for /r "%DOWNLOAD_DIR%" %%f in (*.gif) do (
    echo Найден: %%~nxf
    
    REM Определяем тип анимации по имени файла
    echo %%~nxf | findstr /i "idle stand still" >nul
    if not errorlevel 1 (
        copy "%%f" "%DPET_DIR%\animations\idle\" >nul
        echo   → idle
    )
    
    echo %%~nxf | findstr /i "walk move run" >nul
    if not errorlevel 1 (
        copy "%%f" "%DPET_DIR%\animations\walk\" >nul
        echo   → walk
    )
    
    echo %%~nxf | findstr /i "fall jump drop" >nul
    if not errorlevel 1 (
        copy "%%f" "%DPET_DIR%\animations\fall\" >nul
        echo   → fall
    )
    
    echo %%~nxf | findstr /i "drag grab" >nul
    if not errorlevel 1 (
        copy "%%f" "%DPET_DIR%\animations\drag\" >nul
        echo   → drag
    )
    
    echo %%~nxf | findstr /i "click action interact" >nul
    if not errorlevel 1 (
        copy "%%f" "%DPET_DIR%\animations\click\" >nul
        echo   → click
    )
)

REM Если не нашли специфичные файлы, копируем первые попавшиеся
dir "%DPET_DIR%\animations\idle\*.gif" >nul 2>&1
if errorlevel 1 (
    echo Копирование всех GIF в idle...
    for /r "%DOWNLOAD_DIR%" %%f in (*.gif) do (
        copy "%%f" "%DPET_DIR%\animations\idle\" >nul
        goto :found_idle
    )
    :found_idle
)

REM Создаем dpet.json
echo Создание конфигурации...
(
echo {
echo   "name": "Alastor Shimeji",
echo   "author": "EmberCL ^(Steam Workshop^)",
echo   "fps": 24,
echo   "scale": 1.0,
echo   "behavior_change_rarity": 50.0,
echo   "can_move": true,
echo   "can_drag": true,
echo   "can_click": true,
echo   "can_fall": true,
echo   "move_speed": 2.5,
echo   "physics": {
echo     "max_velocity": 40.0,
echo     "friction": 0.9,
echo     "gravity": 2.0
echo   },
echo   "animations": {
echo     "idle": [],
echo     "walk": [],
echo     "fall": [],
echo     "drag": [],
echo     "click": []
echo   }
echo }
) > "%DPET_DIR%\dpet.json.tmp"

REM Обновляем пути к анимациям в JSON через PowerShell
powershell -NoProfile -Command ^
    "$json = Get-Content '%DPET_DIR%\dpet.json.tmp' | ConvertFrom-Json; " ^
    "$idleFiles = Get-ChildItem '%DPET_DIR%\animations\idle\*.gif' -ErrorAction SilentlyContinue | ForEach-Object { 'animations/idle/' + $_.Name }; " ^
    "$walkFiles = Get-ChildItem '%DPET_DIR%\animations\walk\*.gif' -ErrorAction SilentlyContinue | ForEach-Object { 'animations/walk/' + $_.Name }; " ^
    "$fallFiles = Get-ChildItem '%DPET_DIR%\animations\fall\*.gif' -ErrorAction SilentlyContinue | ForEach-Object { 'animations/fall/' + $_.Name }; " ^
    "$dragFiles = Get-ChildItem '%DPET_DIR%\animations\drag\*.gif' -ErrorAction SilentlyContinue | ForEach-Object { 'animations/drag/' + $_.Name }; " ^
    "$clickFiles = Get-ChildItem '%DPET_DIR%\animations\click\*.gif' -ErrorAction SilentlyContinue | ForEach-Object { 'animations/click/' + $_.Name }; " ^
    "if ($idleFiles) { $json.animations.idle = @($idleFiles) }; " ^
    "if ($walkFiles) { $json.animations.walk = @($walkFiles) }; " ^
    "if ($fallFiles) { $json.animations.fall = @($fallFiles) }; " ^
    "if ($dragFiles) { $json.animations.drag = @($dragFiles) }; " ^
    "if ($clickFiles) { $json.animations.click = @($clickFiles) }; " ^
    "if (-not $idleFiles -and -not $walkFiles -and -not $fallFiles) { " ^
    "  $allFiles = Get-ChildItem '%DPET_DIR%\animations\idle\*.gif' -ErrorAction SilentlyContinue | ForEach-Object { 'animations/idle/' + $_.Name }; " ^
    "  if ($allFiles) { $json.animations.idle = @($allFiles) }; " ^
    "}; " ^
    "$json | ConvertTo-Json -Depth 10 | Set-Content '%DPET_DIR%\dpet.json'"

del "%DPET_DIR%\dpet.json.tmp" >nul 2>&1

echo ✓ Конвертация завершена

echo.
echo [4/4] Создание README...
(
echo # Alastor Shimeji - DPET Package
echo.
echo Загружено из Steam Workshop
echo ID: %WORKSHOP_ID%
echo Автор: EmberCL
echo.
echo ## Описание
echo.
echo Alastor из Hazbin Hotel в качестве desktop pet!
echo.
echo ## Установка
echo.
echo 1. Откройте CursorVerse
echo 2. Перейдите на вкладку "🐾 DPET"
echo 3. Нажмите "➕ Импортировать пакет"
echo 4. Выберите папку `alastor-dpet`
echo 5. Создайте питомца!
echo.
echo ## Оригинальный контент
echo.
echo Steam Workshop: https://steamcommunity.com/sharedfiles/filedetails/?id=%WORKSHOP_ID%
echo.
echo ## Благодарности
echo.
echo - EmberCL - оригинальный автор Shimeji
echo - Создатели Hazbin Hotel
) > "%DPET_DIR%\README.md"

echo ✓ README создан

echo.
echo ====================================
echo  ✓ Готово!
echo ====================================
echo.
echo Пакет создан в: %DPET_DIR%
echo.

REM Показываем статистику
echo Статистика:
dir "%DPET_DIR%\animations\idle\*.gif" 2>nul | find "File(s)"
dir "%DPET_DIR%\animations\walk\*.gif" 2>nul | find "File(s)"
dir "%DPET_DIR%\animations\fall\*.gif" 2>nul | find "File(s)"

echo.
echo Теперь импортируйте папку alastor-dpet через DPET Manager!
echo.
pause
