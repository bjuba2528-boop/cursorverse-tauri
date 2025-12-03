@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ====================================
echo  Shimeji to DPET Converter
echo ====================================
echo.

if "%~1"=="" (
    echo Использование: convert-shimeji-to-dpet.bat [путь_к_папке_shimeji]
    echo.
    echo Пример: convert-shimeji-to-dpet.bat "C:\Downloads\my-shimeji"
    echo.
    pause
    exit /b 1
)

set "SOURCE_DIR=%~1"
set "PET_NAME=%~n1"
set "DPET_DIR=%cd%\%PET_NAME%-dpet"

if not exist "%SOURCE_DIR%" (
    echo ✗ Ошибка: Папка не найдена: %SOURCE_DIR%
    pause
    exit /b 1
)

echo Исходная папка: %SOURCE_DIR%
echo Имя питомца: %PET_NAME%
echo Целевая папка: %DPET_DIR%
echo.

if exist "%DPET_DIR%" (
    echo Папка %DPET_DIR% уже существует.
    set /p "CONFIRM=Перезаписать? (Y/N): "
    if /i not "!CONFIRM!"=="Y" exit /b 0
    rmdir /s /q "%DPET_DIR%"
)

echo [1/3] Создание структуры DPET...
mkdir "%DPET_DIR%"
mkdir "%DPET_DIR%\animations"
mkdir "%DPET_DIR%\animations\idle"
mkdir "%DPET_DIR%\animations\walk"
mkdir "%DPET_DIR%\animations\fall"
mkdir "%DPET_DIR%\animations\drag"
mkdir "%DPET_DIR%\animations\click"
echo ✓ Структура создана

echo.
echo [2/3] Копирование и сортировка анимаций...

set "IDLE_COUNT=0"
set "WALK_COUNT=0"
set "FALL_COUNT=0"
set "DRAG_COUNT=0"
set "CLICK_COUNT=0"

REM Обработка GIF файлов
for /r "%SOURCE_DIR%" %%f in (*.gif) do (
    set "FILENAME=%%~nxf"
    set "COPIED=0"
    
    REM Idle/Stand анимации
    echo !FILENAME! | findstr /i "idle stand still rest shime1 motionless" >nul
    if !errorlevel! equ 0 (
        copy "%%f" "%DPET_DIR%\animations\idle\!FILENAME!" >nul
        set /a IDLE_COUNT+=1
        set "COPIED=1"
        echo   ✓ idle: !FILENAME!
    )
    
    REM Walk/Move анимации
    if !COPIED! equ 0 (
        echo !FILENAME! | findstr /i "walk move run crawl slide" >nul
        if !errorlevel! equ 0 (
            copy "%%f" "%DPET_DIR%\animations\walk\!FILENAME!" >nul
            set /a WALK_COUNT+=1
            set "COPIED=1"
            echo   ✓ walk: !FILENAME!
        )
    )
    
    REM Fall/Jump анимации
    if !COPIED! equ 0 (
        echo !FILENAME! | findstr /i "fall jump leap drop descend" >nul
        if !errorlevel! equ 0 (
            copy "%%f" "%DPET_DIR%\animations\fall\!FILENAME!" >nul
            set /a FALL_COUNT+=1
            set "COPIED=1"
            echo   ✓ fall: !FILENAME!
        )
    )
    
    REM Drag анимации
    if !COPIED! equ 0 (
        echo !FILENAME! | findstr /i "drag grab thrown being_dragged" >nul
        if !errorlevel! equ 0 (
            copy "%%f" "%DPET_DIR%\animations\drag\!FILENAME!" >nul
            set /a DRAG_COUNT+=1
            set "COPIED=1"
            echo   ✓ drag: !FILENAME!
        )
    )
    
    REM Click/Action анимации
    if !COPIED! equ 0 (
        echo !FILENAME! | findstr /i "click action interact wave hello" >nul
        if !errorlevel! equ 0 (
            copy "%%f" "%DPET_DIR%\animations\click\!FILENAME!" >nul
            set /a CLICK_COUNT+=1
            set "COPIED=1"
            echo   ✓ click: !FILENAME!
        )
    )
    
    REM Если не подошло ни под одну категорию - в idle
    if !COPIED! equ 0 (
        copy "%%f" "%DPET_DIR%\animations\idle\!FILENAME!" >nul
        set /a IDLE_COUNT+=1
        echo   ✓ idle (default): !FILENAME!
    )
)

echo.
echo Статистика:
echo   - Idle: %IDLE_COUNT% файлов
echo   - Walk: %WALK_COUNT% файлов
echo   - Fall: %FALL_COUNT% файлов
echo   - Drag: %DRAG_COUNT% файлов
echo   - Click: %CLICK_COUNT% файлов

if %IDLE_COUNT% equ 0 (
    echo.
    echo ✗ Внимание: Не найдено GIF файлов для idle анимации!
    echo   DPET требует хотя бы одну idle анимацию.
    pause
    exit /b 1
)

echo.
echo [3/3] Создание конфигурации DPET...

REM Создаем базовый dpet.json
(
echo {
echo   "name": "%PET_NAME%",
echo   "author": "Конвертировано из Shimeji",
echo   "fps": 24,
echo   "scale": 1.0,
echo   "behavior_change_rarity": 40.0,
echo   "can_move": true,
echo   "can_drag": true,
echo   "can_click": true,
echo   "can_fall": true,
echo   "move_speed": 2.0,
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
) > "%DPET_DIR%\dpet_template.json"

REM Используем PowerShell для заполнения путей к файлам
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$json = Get-Content '%DPET_DIR%\dpet_template.json' | ConvertFrom-Json; " ^
    "$idleFiles = @(Get-ChildItem '%DPET_DIR%\animations\idle\*.gif' -ErrorAction SilentlyContinue | ForEach-Object { 'animations/idle/' + $_.Name }); " ^
    "$walkFiles = @(Get-ChildItem '%DPET_DIR%\animations\walk\*.gif' -ErrorAction SilentlyContinue | ForEach-Object { 'animations/walk/' + $_.Name }); " ^
    "$fallFiles = @(Get-ChildItem '%DPET_DIR%\animations\fall\*.gif' -ErrorAction SilentlyContinue | ForEach-Object { 'animations/fall/' + $_.Name }); " ^
    "$dragFiles = @(Get-ChildItem '%DPET_DIR%\animations\drag\*.gif' -ErrorAction SilentlyContinue | ForEach-Object { 'animations/drag/' + $_.Name }); " ^
    "$clickFiles = @(Get-ChildItem '%DPET_DIR%\animations\click\*.gif' -ErrorAction SilentlyContinue | ForEach-Object { 'animations/click/' + $_.Name }); " ^
    "if ($idleFiles.Count -gt 0) { $json.animations.idle = $idleFiles }; " ^
    "if ($walkFiles.Count -gt 0) { $json.animations.walk = $walkFiles } else { $json.animations.walk = $idleFiles }; " ^
    "if ($fallFiles.Count -gt 0) { $json.animations.fall = $fallFiles } else { $json.animations.fall = $idleFiles }; " ^
    "if ($dragFiles.Count -gt 0) { $json.animations.drag = $dragFiles } else { $json.animations.drag = $idleFiles }; " ^
    "if ($clickFiles.Count -gt 0) { $json.animations.click = $clickFiles } else { $json.animations.click = $idleFiles }; " ^
    "$json | ConvertTo-Json -Depth 10 | Set-Content '%DPET_DIR%\dpet.json' -Encoding UTF8"

del "%DPET_DIR%\dpet_template.json" >nul 2>&1

REM Создаем README
(
echo # %PET_NAME% - DPET Package
echo.
echo Конвертировано из Shimeji формата
echo.
echo ## Установка
echo.
echo 1. Откройте CursorVerse
echo 2. Перейдите на вкладку "🐾 DPET"
echo 3. Нажмите "➕ Импортировать пакет"
echo 4. Выберите папку `%PET_NAME%-dpet`
echo 5. Создайте питомца!
echo.
echo ## Статистика анимаций
echo.
echo - Idle: %IDLE_COUNT% анимаций
echo - Walk: %WALK_COUNT% анимаций
echo - Fall: %FALL_COUNT% анимаций
echo - Drag: %DRAG_COUNT% анимаций
echo - Click: %CLICK_COUNT% анимаций
echo.
echo ## Примечания
echo.
echo Если какие-то анимации отсутствовали, они были заменены на idle анимации.
echo Вы можете отредактировать `dpet.json` для тонкой настройки.
) > "%DPET_DIR%\README.md"

echo ✓ Конфигурация создана

echo.
echo ====================================
echo  ✓ Конвертация завершена!
echo ====================================
echo.
echo Пакет DPET создан: %DPET_DIR%
echo.
echo Следующие шаги:
echo 1. Откройте CursorVerse
echo 2. Перейдите на вкладку "🐾 DPET"
echo 3. Импортируйте папку: %DPET_DIR%
echo 4. Создайте питомца!
echo.
pause
