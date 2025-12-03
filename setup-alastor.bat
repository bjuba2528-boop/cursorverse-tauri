@echo off
chcp 65001 >nul
echo ╔════════════════════════════════════════════╗
echo ║   🎭 Alastor DPET - Быстрая установка    ║
echo ╚════════════════════════════════════════════╝
echo.
echo У вас есть 3 варианта установки Alastor:
echo.
echo [1] Скачать из Steam Workshop (требует steamcmd)
echo [2] Конвертировать существующий Shimeji
echo [3] Использовать шаблон и добавить GIF вручную
echo.
set /p "CHOICE=Выберите вариант (1-3): "

if "%CHOICE%"=="1" goto steam
if "%CHOICE%"=="2" goto shimeji
if "%CHOICE%"=="3" goto manual
echo Неверный выбор!
pause
exit /b 1

:steam
echo.
echo ════════════════════════════════════════════
echo  Вариант 1: Загрузка из Steam Workshop
echo ════════════════════════════════════════════
echo.
if not exist "steamcmd.exe" (
    echo ✗ Ошибка: steamcmd.exe не найден!
    echo.
    echo Скачайте steamcmd отсюда:
    echo https://steamcdn-a.akamaihd.net/client/installer/steamcmd.zip
    pause
    exit /b 1
)
echo Запуск download-alastor.bat...
call download-alastor.bat
goto end

:shimeji
echo.
echo ════════════════════════════════════════════
echo  Вариант 2: Конвертация Shimeji
echo ════════════════════════════════════════════
echo.
set /p "SHIMEJI_PATH=Введите путь к папке Shimeji: "
if not exist "%SHIMEJI_PATH%" (
    echo ✗ Папка не найдена!
    pause
    exit /b 1
)
echo Запуск convert-shimeji-to-dpet.bat...
call convert-shimeji-to-dpet.bat "%SHIMEJI_PATH%"
goto end

:manual
echo.
echo ════════════════════════════════════════════
echo  Вариант 3: Ручная установка
echo ════════════════════════════════════════════
echo.
echo Папка alastor-dpet уже создана с шаблоном!
echo.
echo Следующие шаги:
echo.
echo 1. Найдите GIF анимации Alastor:
echo    - GIPHY: https://giphy.com/search/alastor-hazbin-hotel
echo    - Tenor: https://tenor.com/search/alastor
echo    - Pinterest, DeviantArt
echo.
echo 2. Поместите GIF файлы в папки:
echo    alastor-dpet\animations\idle\
echo    alastor-dpet\animations\walk\
echo    alastor-dpet\animations\fall\
echo    alastor-dpet\animations\drag\
echo    alastor-dpet\animations\click\
echo.
echo 3. Обновите пути в dpet.json
echo.
echo 4. Импортируйте через CursorVerse:
echo    - Откройте вкладку 🐾 DPET
echo    - Нажмите ➕ Импортировать пакет
echo    - Выберите папку alastor-dpet
echo    - Создайте питомца!
echo.
echo Открыть папку alastor-dpet? (Y/N)
set /p "OPEN=Выбор: "
if /i "%OPEN%"=="Y" explorer alastor-dpet
goto end

:end
echo.
echo ════════════════════════════════════════════
echo  ✓ Готово!
echo ════════════════════════════════════════════
echo.
pause
