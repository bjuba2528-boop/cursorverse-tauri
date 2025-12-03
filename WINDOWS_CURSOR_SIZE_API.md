# 🪟 Windows API для изменения размера курсора

## 📋 Как Windows меняет размер курсора

### Официальный путь через GUI:
```
Параметры (Win + I)
  → Специальные возможности
    → Мышь
      → Размер указателя мыши (ползунок)
```

---

## 🔧 Windows API Implementation

### 1. Реестр Windows
**Путь:** `HKEY_CURRENT_USER\Control Panel\Cursors`  
**Ключ:** `CursorBaseSize`  
**Тип:** `DWORD`

**Значения (в пикселях):**
```
32  = 100% (стандартный)
40  = 125%
48  = 150%
56  = 175%
64  = 200%
72  = 225%
80  = 250%
88  = 275%
96  = 300% (максимум)
```

### 2. SystemParametersInfo API
**Функция:** `SystemParametersInfoW`  
**Параметр:** `SPI_SETCURSORS` (0x0057)

**Сигнатура:**
```c
BOOL SystemParametersInfoW(
  UINT  uiAction,        // SPI_SETCURSORS
  UINT  uiParam,         // 0
  PVOID pvParam,         // NULL
  UINT  fWinIni          // SPIF_UPDATEINIFILE | SPIF_SENDCHANGE
);
```

---

## 💻 Наша реализация (Rust)

### Файл: `src-tauri/src/cursor_manager.rs`

#### 1. Чтение размера
```rust
pub fn get_cursor_size() -> Result<i32, String> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let cursor_key = hkcu
        .open_subkey("Control Panel\\Cursors")
        .map_err(|e| format!("Failed to open Cursors key: {}", e))?;

    let size_pixels: u32 = cursor_key
        .get_value("CursorBaseSize")
        .unwrap_or(32);

    // Конвертируем пиксели в проценты
    let percentage = ((size_pixels as f32 / 32.0) * 100.0) as i32;
    Ok(percentage)
}
```

#### 2. Установка размера
```rust
pub fn set_cursor_size(size_percent: i32) -> Result<(), String> {
    use winapi::um::winuser::{
        SystemParametersInfoW, 
        SPI_SETCURSORS, 
        SPIF_UPDATEINIFILE, 
        SPIF_SENDCHANGE
    };

    // Шаг 1: Конвертация процентов в пиксели
    let size_pixels = match size_percent {
        100 => 32,
        125 => 40,
        150 => 48,
        175 => 56,
        200 => 64,
        225 => 72,
        250 => 80,
        275 => 88,
        300 => 96,
        _ => ((size_percent as f32 / 100.0) * 32.0) as u32,
    };

    // Шаг 2: Запись в реестр
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let cursor_key = hkcu
        .open_subkey_with_flags("Control Panel\\Cursors", KEY_WRITE)
        .map_err(|e| format!("Failed to open Cursors key: {}", e))?;

    cursor_key
        .set_value("CursorBaseSize", &size_pixels)
        .map_err(|e| format!("Failed to set cursor size: {}", e))?;

    // Шаг 3: Применение изменений через SystemParametersInfo
    unsafe {
        SystemParametersInfoW(
            SPI_SETCURSORS,      // Команда: перезагрузить курсоры
            0,                   // Не используется
            std::ptr::null_mut(), // Не используется
            SPIF_UPDATEINIFILE | SPIF_SENDCHANGE, // Флаги
        );
    }

    Ok(())
}
```

---

## 🎨 Frontend Implementation (React/TypeScript)

### Файл: `src/components/CursorBrowser.tsx`

#### Ползунок в стиле Windows 11:
```tsx
<input
  type="range"
  min="100"
  max="300"
  step="25"
  value={cursorSize || 100}
  onChange={async (e) => {
    const newSize = parseInt(e.target.value)
    try {
      await invoke('set_cursor_size', { size: newSize })
      setCursorSize(newSize)
      showMessage(`Размер курсора: ${newSize}%`, 'success')
    } catch (error) {
      showMessage('Не удалось изменить размер: ' + error, 'error')
    }
  }}
  style={{
    position: 'absolute',
    width: '100%',
    height: 6,
    opacity: 0,
    cursor: 'pointer',
    zIndex: 10
  }}
/>
```

---

## 🔍 Как это работает:

### Последовательность действий:

1. **Пользователь двигает ползунок** → onChange event
2. **Frontend вызывает Rust** → `invoke('set_cursor_size', { size: 150 })`
3. **Rust конвертирует проценты** → 150% = 48 пикселей
4. **Запись в реестр** → `HKCU\Control Panel\Cursors\CursorBaseSize = 48`
5. **SystemParametersInfoW** → Windows перезагружает все курсоры
6. **Курсоры применяются мгновенно** → Без перезагрузки!

### Флаги SystemParametersInfo:

- **`SPIF_UPDATEINIFILE` (0x01)** - Обновить win.ini (устаревший, но совместимость)
- **`SPIF_SENDCHANGE` (0x02)** - Отправить WM_SETTINGCHANGE всем окнам

---

## 📊 Таблица конвертации

| Проценты | Пиксели | Описание |
|----------|---------|----------|
| 100% | 32px | Стандартный размер Windows |
| 125% | 40px | Удобно для HD мониторов |
| 150% | 48px | Удобно для 4K мониторов |
| 175% | 56px | Увеличенный |
| 200% | 64px | Удвоенный |
| 225% | 72px | Очень большой |
| 250% | 80px | Огромный |
| 275% | 88px | Максимальный - 1 |
| 300% | 96px | Максимальный размер |

---

## 🛠️ Windows API Constants

```c
// winuser.h
#define SPI_SETCURSORS           0x0057
#define SPIF_UPDATEINIFILE       0x0001
#define SPIF_SENDCHANGE          0x0002
```

---

## 🔗 Официальная документация

**Microsoft Docs:**
- [SystemParametersInfoW](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-systemparametersinfow)
- [SPI_SETCURSORS](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-systemparametersinfow#spi_setcursors)
- [Registry: Cursors](https://learn.microsoft.com/en-us/windows/win32/sysinfo/registry)

**Registry Path:**
```
Computer\HKEY_CURRENT_USER\Control Panel\Cursors
```

**Ключи реестра:**
- `CursorBaseSize` (DWORD) - Базовый размер курсора
- `Arrow` (REG_EXPAND_SZ) - Путь к файлу стандартного курсора
- `AppStarting`, `Wait`, `Hand`, и т.д. - Пути к другим курсорам

---

## ✅ Преимущества нашей реализации

1. **Официальный Windows API** - Используем те же вызовы, что и сама Windows
2. **Мгновенное применение** - Без перезагрузки системы
3. **Сохранение настроек** - Запись в реестр сохраняет изменения
4. **Кроссплатформенность** - Graceful degradation для non-Windows
5. **Ползунок как в Windows** - Привычный интерфейс для пользователей

---

## 🎯 Результат

Наш код **точно повторяет поведение Windows**:
- ✅ Тот же API (`SystemParametersInfoW`)
- ✅ Тот же реестр (`CursorBaseSize`)
- ✅ Те же флаги (`SPIF_UPDATEINIFILE | SPIF_SENDCHANGE`)
- ✅ Тот же диапазон (100% - 300%)
- ✅ Те же шаги (25%)

**Это не хак, а официальный способ изменения размера курсора в Windows!** 🎉
