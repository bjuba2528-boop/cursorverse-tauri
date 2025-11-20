# CursorVerse Tauri - Полный аналог Seelen-UI

Мощный инструмент персонализации Windows на Rust + Tauri + TypeScript + React.

## Возможности

### ✅ Управление темами и обоями Windows
- Переключение темного/светлого режима
- Настройка акцентного цвета
- Прозрачность элементов
- Автоскрытие панели задач
- Статичные обои (JPG/PNG/BMP/WebP)
- Анимированные обои (GIF/Видео) через встроенную конвертацию в WMV
- Сохранение и восстановление оригинальных обоев
- Сброс к стандартным настройкам

### ✅ Браузер курсоров
- Библиотека всех системных курсоров
- Применение схем курсоров
- Избранные курсоры
- Поиск по схемам
- Сброс к стандартным курсорам

### ✅ Панель инструментов (Toolbar/Dock)
- Закрепление приложений (.exe, .lnk, .url)
- Быстрый запуск приложений
- Автозагрузка при старте Windows
- Настройка виджетов (погода и др.)

### ✅ Переключатель задач
- Список всех открытых окон
- Быстрое переключение между окнами
- Поиск по заголовкам
- Горячая клавиша Alt+Space для лаунчера

## Технологии

- **Backend:** Rust 2021, Tauri 1.5
- **Frontend:** React 18, TypeScript 5.3, Vite 5
- **Windows API:** winreg, winapi (SystemParametersInfoW, FindWindowW, SetParent)
- **Стиль:** Modern CSS с градиентами

## Установка и запуск

### Требования
- Node.js 18+
- Rust 1.70+
- Visual Studio Build Tools
- ffmpeg (для конвертации GIF / Видео → WMV)

### Установка зависимостей

```powershell
# Установите npm зависимости
npm install

# Rust зависимости подтянутся при сборке
```

### Режим разработки

```powershell
npm run tauri:dev
```

### Сборка production

```powershell
npm run tauri:build
```

Установщик: `src-tauri/target/release/bundle/`

## Анимированные обои (GIF / Видео → WMV)

Вместо внешних программ (Lively / Wallpaper Engine) создаётся Tauri-окно позади иконок рабочего стола. В него отправляется HTML с `<video>` или `<img>`.

### Поток установки
1. Пользователь выбирает GIF / видео.
2. Frontend вызывает `convert_to_wmv(path)` (если не WMV).
3. Затем `set_animated_wallpaper(pathConverted)`.
4. Событие `wallpaper-html` передает HTML в окно `wallpaper-window`.

### Команды
- `convert_to_wmv(path: String) -> String` — конвертация через ffmpeg (WMV2).
- `set_animated_wallpaper(path: String, wallpaperType: "gif"|"video")` — запуск слоя.
- `set_wallpaper(path: String, wallpaperType: "image")` — статичные обои.
- `reset_wallpaper()` — закрыть окно и восстановить исходные.
- `get_file_base64(path: String)` — превью для UI.

### Ограничения vs Wallpaper Engine
- Нет аппаратного рендера шейдеров / эффектов.
- Окно имитирует слой и может мигнуть при смене.
- Нет аудио в обоях (mute по умолчанию).
- Возможны артефакты при изменении масштабирования дисплея.

### Рекомендации
- Использовать ≤1080p @ 30fps.
- Ограничить битрейт до ~4–8 Mbps.
- Кэшировать уже сконвертированные WMV (можно расширить функцию).
- Добавить ffmpeg в PATH:
	- Chocolatey: `choco install ffmpeg -y`
	- Scoop: `scoop install ffmpeg`
	- Ручной: скачать архив с https://ffmpeg.org/download.html и добавить `bin` в PATH.

### Возможные будущие улучшения
- DirectComposition / D3D11 рендер вместо HTML.
- Плейлист с плавными переходами.
- Отдельный кэш `%AppData%/CursorVerse/cache/wallpapers`.
- Настройки качества/битрейта в UI.

## Структура проекта

```
cursorverse-tauri/
├── src/                      # React frontend
│   ├── components/           # Компоненты (Theme, Cursor, Toolbar, TaskSwitcher, Wallpaper)
│   ├── App.tsx               # Главный компонент
│   ├── App.css               # Стили
│   ├── main.tsx              # Точка входа / режим обоев
│   └── styles.css            # Глобальные стили
├── src-tauri/                # Rust backend
│   ├── src/
│   │   ├── main.rs           # Запуск Tauri
│   │   ├── theme_manager.rs  # Темы / реестр
│   │   ├── wallpaper_manager.rs # Обои (статичные, анимированные, конвертация)
│   │   ├── cursor_manager.rs # Курсоры
│   │   ├── toolbar.rs        # Панель
│   │   └── task_switcher.rs  # Окна
│   ├── Cargo.toml            # Зависимости Rust
│   └── tauri.conf.json       # Конфигурация Tauri
├── package.json              # Зависимости npm
├── tsconfig.json             # TypeScript конфиг
└── vite.config.ts            # Vite конфиг
```

## Конфигурация

`%AppData%/CursorVerse/`
- `toolbar_config.json` — конфигурация панели
- `favorites_cursors.json` — избранные курсоры

## Горячие клавиши

- **Alt+Space** — лаунчер приложений

## API (сводка IPC)

См. разделы выше. Основные рабочие модули: `theme_manager`, `wallpaper_manager`, `cursor_manager`, `toolbar`, `task_switcher`.

## Лицензия

Персональное использование. Аналог Seelen-UI для Windows.

## Автор

CursorVerse v1.5.x - Rust + Tauri + TypeScript
