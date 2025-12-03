@echo off
chcp 65001 >nul
echo ======================================
echo Конвертация Alastor Shimeji в DPET
echo ======================================
echo.

set "SOURCE_DIR=C:\Users\shust\AppData\Local\CursorVerse\CustomPets\Alastor"
set "TARGET_DIR=C:\Users\shust\AppData\Local\CursorVerse\CustomPets\Alastor-DPET"

echo Создаем структуру DPET пакета...
if not exist "%TARGET_DIR%" mkdir "%TARGET_DIR%"
if not exist "%TARGET_DIR%\animations" mkdir "%TARGET_DIR%\animations"
if not exist "%TARGET_DIR%\animations\idle" mkdir "%TARGET_DIR%\animations\idle"
if not exist "%TARGET_DIR%\animations\walk" mkdir "%TARGET_DIR%\animations\walk"
if not exist "%TARGET_DIR%\animations\fall" mkdir "%TARGET_DIR%\animations\fall"
if not exist "%TARGET_DIR%\animations\drag" mkdir "%TARGET_DIR%\animations\drag"
if not exist "%TARGET_DIR%\animations\click" mkdir "%TARGET_DIR%\animations\click"

echo.
echo Копируем изображения...
copy "%SOURCE_DIR%\Alastor Shimeji - EmberCL.png" "%TARGET_DIR%\animations\idle\idle.png" >nul
copy "%SOURCE_DIR%\Alastor Shimeji - EmberCL.png" "%TARGET_DIR%\animations\walk\walk.png" >nul
copy "%SOURCE_DIR%\Alastor Shimeji - EmberCL.png" "%TARGET_DIR%\animations\fall\fall.png" >nul
copy "%SOURCE_DIR%\Alastor Shimeji - EmberCL.png" "%TARGET_DIR%\animations\drag\drag.png" >nul
copy "%SOURCE_DIR%\Alastor Shimeji - EmberCL.png" "%TARGET_DIR%\animations\click\click.png" >nul
copy "%SOURCE_DIR%\Alastor Shimeji - EmberCL.png" "%TARGET_DIR%\preview.png" >nul

echo.
echo Создаем dpet.json...
(
echo {
echo   "name": "Alastor from Hazbin Hotel",
echo   "author": "EmberCL ^(converted^)",
echo   "description": "Демон-радиоведущий из Hazbin Hotel",
echo   "fps": 12,
echo   "scale": 1.0,
echo   "behavior_change_rarity": 0.05,
echo   "can_move": true,
echo   "can_drag": true,
echo   "can_click": true,
echo   "can_fall": true,
echo   "physics": {
echo     "max_velocity": 40.0,
echo     "friction": 0.9,
echo     "gravity": 2.0
echo   },
echo   "animations": {
echo     "idle": ["animations/idle/idle.png"],
echo     "walk": ["animations/walk/walk.png"],
echo     "fall": ["animations/fall/fall.png"],
echo     "drag": ["animations/drag/drag.png"],
echo     "click": ["animations/click/click.png"]
echo   }
echo }
) > "%TARGET_DIR%\dpet.json"

echo.
echo ✅ Конвертация завершена!
echo 📁 Пакет создан: %TARGET_DIR%
echo.
echo Теперь в CursorVerse:
echo 1. Откройте вкладку "Pets"
echo 2. Alastor появится в библиотеке
echo 3. Нажмите "Создать" чтобы запустить питомца
echo.
pause
