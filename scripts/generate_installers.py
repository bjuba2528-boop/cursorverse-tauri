import os
import subprocess

# Определим пути
CURSOR_LIB_PATH = os.path.join(os.path.expanduser("~"), "AppData", "Local", "CursorVerse")
ANIME_PATH = os.path.join(CURSOR_LIB_PATH, "Anime")
CLASSIC_PATH = os.path.join(CURSOR_LIB_PATH, "Classic")

# Проверяем, существуют ли папки
anime_exists = os.path.exists(ANIME_PATH)
classic_exists = os.path.exists(CLASSIC_PATH)

print(f"ANIME_PATH exists: {anime_exists}")
print(f"CLASSIC_PATH exists: {classic_exists}")

# Если папки существуют, проверим содержимое
if anime_exists:
    anime_folders = len([f for f in os.listdir(ANIME_PATH) if os.path.isdir(os.path.join(ANIME_PATH, f))])
    print(f"Number of folders in Anime: {anime_folders}")

if classic_exists:
    classic_folders = len([f for f in os.listdir(CLASSIC_PATH) if os.path.isdir(os.path.join(CLASSIC_PATH, f))])
    print(f"Number of folders in Classic: {classic_folders}")

# Попробуем запустить generate_installers.py
generate_code = """
import os

CURSOR_BASE = os.path.join(os.path.expanduser('~'), 'AppData', 'Local', 'CursorVerse')
ANIME = os.path.join(CURSOR_BASE, 'Anime')
CLASSIC = os.path.join(CURSOR_BASE, 'Classic')

MAPPING = {
    "pointer.ani": "Arrow",
    "help.ani": "Help",
    "work.ani": "WorkingInBackground",
    "busy.ani": "Busy",
    "cross.ani": "Crosshair",
    "text.ani": "IBeam",
    "hand.ani": "Hand",
    "unavailable.ani": "No",
    "vert.ani": "SizeNS",
    "horz.ani": "SizeWE",
    "dgn1.ani": "SizeNWSE",
    "dgn2.ani": "SizeNESW",
    "move.ani": "SizeAll",
    "alternate.ani": "UpArrow",
    "link.ani": "AppStarting",
    "person.cur": "Person",
    "pin.cur": "Pin"
}

INSTALL_TEMPLATE_HEADER = [
    '@echo off',
    'chcp 65001 >nul',
    'echo.',
]

UNINSTALL_TEMPLATE = [
    '@echo off',
    'chcp 65001 >nul',
    'echo.',
    'echo  Сброс курсора на стандартные Windows...',
    'echo.',
    'reg delete "HKCU\\Control Panel\\Cursors" /f >nul 2>&1',
    'reg add "HKCU\\Control Panel\\Cursors" /ve /t REG_SZ /d "" /f >nul',
    'rundll32.exe user32.dll,UpdatePerUserSystemParameters',
    'rundll32.exe user32.dll,UpdatePerUserSystemParameters',
    'echo.',
    'echo  СБРОШЕНО! Используются стандартные курсоры Windows.',
    'echo.',
    'exit /b 0'
]


def make_install_for_folder(folder_path, folder_name):
    lines = INSTALL_TEMPLATE_HEADER[:] + [f'echo  Установка курсора: {folder_name}', 'echo  Сброс и применение...', 'echo.']
    lines += [
        ':: ШАГ 1: СБРОС КУРСОРОВ',
        'reg delete "HKCU\\Control Panel\\Cursors" /f >nul 2>&1',
        'reg add "HKCU\\Control Panel\\Cursors" /ve /t REG_SZ /d "" /f >nul',
        ''
    ]

    # Добавляем только существующие файлы
    for file_name, reg_name in MAPPING.items():
        full_path = os.path.join(folder_path, file_name)
        if os.path.exists(full_path):
            lines.append(f'reg add "HKCU\\Control Panel\\Cursors" /v "{reg_name}" /t REG_SZ /d "%~dp0{file_name}" /f >nul')

    lines += [
        '',
        ':: Применение',
        'rundll32.exe user32.dll,UpdatePerUserSystemParameters',
        'rundll32.exe user32.dll,UpdatePerUserSystemParameters',
        '',
        f'echo  УСТАНОВЛЕНО! Курсор "{folder_name}" применён.',
        '',
        'exit /b 0'  # Убрал pause для автоматического закрытия
    ]

    install_path = os.path.join(folder_path, 'install.bat')
    uninstall_path = os.path.join(folder_path, 'uninstall.bat')

    with open(install_path, 'w', encoding='utf-8') as f:
        f.write('\\n'.join(lines))

    with open(uninstall_path, 'w', encoding='utf-8') as f:
        f.write('\\n'.join(UNINSTALL_TEMPLATE))

    print(f'Созданы install.bat и uninstall.bat в {folder_path}')

if __name__ == '__main__':
    created = 0
    for base in (ANIME, CLASSIC):
        if not os.path.exists(base):
            print(f'Папка не найдена: {base}')
            continue
        for folder in os.listdir(base):
            folder_path = os.path.join(base, folder)
            if not os.path.isdir(folder_path):
                continue
            has_cursor = any(name.lower().endswith(('.cur', '.ani')) for name in os.listdir(folder_path))
            if not has_cursor:
                continue
            make_install_for_folder(folder_path, folder)
            created += 1
    print(f'Готово. Создано установщиков: {created}')
"""

# Выполняем код генератора
exec(generate_code)

# Проверяем, создался ли install.bat в одной папке, например Sylviarill
test_folder = os.path.join(ANIME_PATH, "Sylviarill")
install_exists = os.path.exists(os.path.join(test_folder, "install.bat"))
print(f"install.bat in Sylviarill: {install_exists}")