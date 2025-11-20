"""
Скрипт для создания EXE файла CursorVerse
"""
import subprocess
import sys
import os

def install_pyinstaller():
    """Установка PyInstaller если не установлен"""
    try:
        import PyInstaller
        print("PyInstaller уже установлен")
    except ImportError:
        print("Установка PyInstaller...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pyinstaller"])
        print("PyInstaller успешно установлен!")

def build_exe():
    """Создание EXE файла"""
    print("Создание EXE файла CursorVerse...")
    
    # Параметры для PyInstaller
    cmd = [
        "pyinstaller",
        "--onefile",  # Один файл
        "--windowed",  # Без консоли
        "--icon=CursorVerse.ico",  # Иконка
        "--name=CursorVerse",  # Имя файла
        "--noconsole",  # Без консоли
        "--clean",  # Очистка перед сборкой
        "main.py"
    ]
    
    # Добавляем файлы только если они существуют
    if os.path.exists("CursorVerse.ico"):
        cmd.append("--add-data=CursorVerse.ico;.")
        print("✅ Добавлена иконка: CursorVerse.ico")
    
    if os.path.exists("language.json"):
        cmd.append("--add-data=language.json;.")
        print("✅ Добавлен файл переводов: language.json")
    
    if os.path.exists("nyan-cat-transparent.gif"):
        cmd.append("--add-data=nyan-cat-transparent.gif;.")
        print("✅ Добавлен gif: nyan-cat-transparent.gif")
    
    try:
        subprocess.check_call(cmd)
        print("\n" + "="*60)
        print("✅ EXE файл успешно создан!")
        print("📂 Найти его можно в папке: dist\\CursorVerse.exe")
        print("="*60)
    except subprocess.CalledProcessError as e:
        print(f"\n❌ Ошибка при создании EXE: {e}")
        sys.exit(1)

if __name__ == "__main__":
    print("="*60)
    print("  CursorVerse - Создание EXE файла")
    print("="*60)
    
    # Проверяем наличие необходимых файлов
    if not os.path.exists("main.py"):
        print("❌ Ошибка: файл main.py не найден!")
        sys.exit(1)
    
    if not os.path.exists("CursorVerse.ico"):
        print("⚠️ Предупреждение: файл CursorVerse.ico не найден!")
    
    if not os.path.exists("language.json"):
        print("⚠️ Предупреждение: файл language.json не найден!")
    
    # Устанавливаем PyInstaller
    install_pyinstaller()
    
    # Создаем EXE
    build_exe()
