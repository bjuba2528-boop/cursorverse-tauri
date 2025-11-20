@echo off
chcp 65001 >nul
echo.
echo =============================================
echo     ИСПРАВЛЕНИЕ ВСЕХ КУРСОРОВ ДЛЯ CURSORVERSE
echo =============================================
echo.
echo Ищем папки с курсорами...
echo.

cd /d "%~dp0"

set count=0

for /d %%D in (*) do (
    if exist "%%D\Normal.ani" (
        echo [ОБРАБОТКА] %%D
        (
            ren "%%D\Normal.ani" "pointer.ani" 2>nul
            ren "%%D\Help.ani" "help.ani" 2>nul
            ren "%%D\Working.ani" "work.ani" 2>nul
            ren "%%D\Busy.ani" "busy.ani" 2>nul
            ren "%%D\Precision.ani" "cross.ani" 2>nul
            ren "%%D\Text.ani" "text.ani" 2>nul
            ren "%%D\Handwriting.ani" "hand.ani" 2>nul
            ren "%%D\Unavailable.ani" "unavailable.ani" 2>nul
            ren "%%D\Vertical.ani" "vert.ani" 2>nul
            ren "%%D\Horizontal.ani" "horz.ani" 2>nul
            ren "%%D\Diagonal1.ani" "dgn1.ani" 2>nul
            ren "%%D\Diagonal2.ani" "dgn2.ani" 2>nul
            ren "%%D\Move.ani" "move.ani" 2>nul
            ren "%%D\Alternate.ani" "alternate.ani" 2>nul
            ren "%%D\Link.ani" "link.ani" 2>nul
            ren "%%D\Person.cur" "person.cur" 2>nul
            ren "%%D\Pin.cur" "pin.cur" 2>nul
        )
        set /a count+=1
    ) else if exist "%%D\pointer.ani" (
        echo [УЖЕ ИСПРАВЛЕНО] %%D
    ) else (
        echo [ПРОПУЩЕНО] %%D — нет Normal.ani
    )
)

echo.
echo =============================================
echo ГОТОВО! Обработано папок: %count%
echo Все курсоры теперь совместимы с CursorVerse!
echo =============================================
echo.
pause
