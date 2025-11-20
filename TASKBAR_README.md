# Custom Windows Taskbar - Полная замена панели задач Windows

## Обзор

Модуль **CustomTaskbar** предоставляет полноценную замену стандартной панели задач Windows со всеми функциями:

- ✅ **Кнопка Start** - открытие меню приложений
- ✅ **Закреплённые приложения** - быстрый запуск избранных программ
- ✅ **Открытые окна** - список всех активных приложений
- ✅ **System Tray** - область уведомлений с иконками
- ✅ **Часы и дата** - текущее время и календарь
- ✅ **Скрытие Windows Taskbar** - автоматическое скрытие стандартной панели
- ✅ **Управление окнами** - активация, сворачивание, закрытие

## Архитектура

### Rust Backend

#### `src-tauri/src/taskbar.rs`
Основной модуль для работы с панелью задач:

**Структуры данных:**
```rust
pub struct WindowInfo {
    pub hwnd: isize,           // Handle окна
    pub title: String,          // Заголовок окна
    pub exe_path: String,       // Путь к exe файлу
    pub icon_base64: String,    // Иконка в base64
    pub is_visible: bool,       // Видимость
    pub is_minimized: bool,     // Свёрнуто/развёрнуто
}

pub struct PinnedApp {
    pub name: String,           // Название приложения
    pub exe_path: String,       // Путь к exe
    pub icon_base64: String,    // Иконка
    pub args: Option<String>,   // Аргументы запуска
}
```

**API команды:**
- `get_taskbar_windows()` - получить список всех открытых окон
- `taskbar_activate_window(hwnd)` - активировать окно
- `taskbar_close_window(hwnd)` - закрыть окно
- `taskbar_minimize_window(hwnd)` - свернуть окно
- `taskbar_maximize_window(hwnd)` - развернуть окно
- `taskbar_hide_windows_taskbar()` - скрыть стандартную панель Windows
- `taskbar_show_windows_taskbar()` - показать стандартную панель Windows
- `get_pinned_apps_list()` - получить список закреплённых приложений
- `launch_pinned_app(exe_path, args)` - запустить закреплённое приложение

**Технические детали:**
- Использует `EnumWindows` для перечисления всех окон
- `GetWindowTextW` для получения заголовков
- `K32GetModuleFileNameExW` для извлечения путей к exe
- `SendMessageW(WM_GETICON)` для получения иконок
- `AppBarData` API для управления панелью задач
- `ShowWindow(SW_HIDE)` для скрытия стандартной панели

#### `src-tauri/src/system_tray.rs`
Модуль для работы с системным треем:

**Структуры:**
```rust
pub struct SystemTrayIcon {
    pub id: String,
    pub window_handle: isize,
    pub uid: u32,
    pub callback_message: u32,
    pub tooltip: String,
    pub icon_base64: String,
    pub is_visible: bool,
}
```

**API команды:**
- `get_system_tray_icons()` - получить список иконок в трее
- `send_tray_icon_click(icon_id, button)` - отправить клик по иконке
- `show_tray_icon_menu(icon_id, x, y)` - показать контекстное меню

**Функции:**
- `extract_icon_to_base64(HICON)` - конвертация HICON → PNG base64
- `TrayIconManager` - менеджер для хранения и управления иконками

### React Frontend

#### `src/components/CustomTaskbar.tsx`
Главный компонент панели задач:

**State управление:**
```typescript
const [windows, setWindows] = useState<WindowInfo[]>([])
const [pinnedApps, setPinnedApps] = useState<PinnedApp[]>([])
const [trayIcons, setTrayIcons] = useState<SystemTrayIcon[]>([])
const [currentTime, setCurrentTime] = useState(new Date())
const [position, setPosition] = useState<'bottom' | 'top' | 'left' | 'right'>('bottom')
const [showStartMenu, setShowStartMenu] = useState(false)
```

**Функциональность:**
- Автоматическое обновление списка окон каждую секунду
- Автоматическое обновление трей-иконок каждые 2 секунды
- Обновление времени каждую секунду
- Скрытие Windows taskbar при монтировании
- Восстановление Windows taskbar при размонтировании

**События:**
- Click на Start → открытие Start Menu
- Click на закреплённое приложение → запуск
- Click на открытое окно → активация
- Click на X → закрытие окна
- Click на трей-иконку → отправка события приложению
- Right-click на трей-иконку → контекстное меню

#### `src/components/CustomTaskbar.css`
Стили с поддержкой 4 позиций:

**Позиции:**
- `.taskbar-bottom` - внизу (по умолчанию)
- `.taskbar-top` - вверху
- `.taskbar-left` - слева (вертикальная)
- `.taskbar-right` - справа (вертикальная)

**Эффекты:**
- Glassmorphism: `backdrop-filter: blur(20px)`
- Hover анимации на иконках
- Плавное появление Start Menu
- Автоскрытие Close button до hover

## Использование

### Интеграция в App.tsx

```tsx
import CustomTaskbar from './components/CustomTaskbar'

// Добавить в тип вкладок
type Tab = '...' | 'taskbar'

// В JSX
{activeTab === 'taskbar' && <CustomTaskbar />}
```

### Навигация

```tsx
<button onClick={() => setActiveTab('taskbar')}>
  ⚡ Панель Задач
</button>
```

### Автоматический запуск

Панель задач автоматически:
1. Скрывает стандартную Windows taskbar при активации
2. Начинает отслеживать открытые окна
3. Загружает список закреплённых приложений
4. Подключается к System Tray

## Windows API

### AppBarData API

```rust
use winapi::um::shellapi::{APPBARDATA, SHAppBarMessage};

// Скрытие панели задач
let mut abd: APPBARDATA = std::mem::zeroed();
abd.cbSize = std::mem::size_of::<APPBARDATA>() as u32;
abd.hWnd = taskbar_hwnd;
abd.lParam = ABS_AUTOHIDE as LPARAM;
SHAppBarMessage(ABM_SETSTATE, &mut abd);
ShowWindow(taskbar_hwnd, SW_HIDE);
```

### Window Enumeration

```rust
extern "system" fn enum_windows_proc(hwnd: HWND, lparam: LPARAM) -> i32 {
    unsafe {
        let windows = &mut *(lparam as *mut Vec<WindowInfo>);
        
        if IsWindowVisible(hwnd) == 0 {
            return 1; // Пропустить невидимые
        }
        
        // Получить заголовок
        let title_len = GetWindowTextLengthW(hwnd);
        let mut title_buf: Vec<u16> = vec![0; (title_len + 1) as usize];
        GetWindowTextW(hwnd, title_buf.as_mut_ptr(), title_buf.len() as i32);
        
        // Получить путь к exe
        let mut process_id: u32 = 0;
        GetWindowThreadProcessId(hwnd, &mut process_id);
        let h_process = OpenProcess(PROCESS_QUERY_INFORMATION, 0, process_id);
        
        // Получить иконку
        let icon = SendMessageW(hwnd, WM_GETICON, ICON_SMALL as WPARAM, 0);
        
        windows.push(WindowInfo { ... });
        1
    }
}

EnumWindows(Some(enum_windows_proc), &mut windows as *mut _ as LPARAM);
```

## Roadmap

### Текущая версия (v1.0)
- ✅ Базовая панель задач
- ✅ Скрытие Windows taskbar
- ✅ Список открытых окон
- ✅ Закреплённые приложения
- ✅ System Tray (структура)
- ✅ Часы и дата
- ✅ Start Menu (каркас)

### Планы (v2.0)
- ⏳ **System Tray Hook** - DLL injection для перехвата NIM_ADD/NIM_DELETE
- ⏳ **Start Menu** - полноценное меню с поиском приложений
- ⏳ **Thumbnails** - превью окон при hover
- ⏳ **Alt+Tab замена** - кастомный переключатель
- ⏳ **Notification Center** - центр уведомлений
- ⏳ **Quick Settings** - быстрые настройки (Wi-Fi, Bluetooth, Volume)
- ⏳ **Virtual Desktops** - поддержка виртуальных рабочих столов
- ⏳ **Pinned Apps Management** - drag & drop, контекстное меню
- ⏳ **Taskbar Settings** - настройки панели (размер, цвет, прозрачность)
- ⏳ **Multi-Monitor** - поддержка нескольких мониторов

## Известные ограничения

1. **System Tray перехват** требует DLL hook (как в Seelen-UI) - пока не реализовано
2. **Иконки приложений** могут не всегда извлекаться (fallback на первую букву)
3. **Start Menu** - только каркас, список приложений не реализован
4. **Pinned Apps** - список захардкожен, нет сохранения в реестр
5. **Уведомления** - пока не перехватываются

## Seelen-UI Architecture Reference

Этот модуль вдохновлён архитектурой [Seelen-UI](https://github.com/eythaann/Seelen-UI):

**Ключевые паттерны:**
- Hook DLL для перехвата Shell_TrayWnd сообщений
- AppBarData для управления панелью задач
- WinEvent hooks для отслеживания lifecycle окон
- IPC между hook процессом и главным приложением
- Конвертация HICON → PNG для React компонентов

**Отличия:**
- Seelen-UI использует multi-process архитектуру (hook DLL + service + UI)
- Мы используем single-process с прямыми WinAPI вызовами
- Seelen-UI перехватывает Shell_TrayWnd, мы пока только читаем окна

## Компиляция

```bash
cd src-tauri
cargo build --release
```

Требуемые features в `Cargo.toml`:
```toml
winapi = { version = "0.3", features = [
    "winuser", "shellapi", "dwmapi", "winnt", 
    "processthreadsapi", "wingdi", "psapi", "libloaderapi"
]}
```

## Лицензия

Часть проекта CursorVerse. Вдохновлено Seelen-UI (AGPL-3.0).
