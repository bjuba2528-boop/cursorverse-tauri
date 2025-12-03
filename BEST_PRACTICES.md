# CursorVerse - Лучшие Практики Разработки

## 📚 Источники Best Practices

Этот документ основан на лучших практиках из следующих источников:
- [JavaScript.info (ru)](https://github.com/javascript-tutorial/ru.javascript.info) - Modern JavaScript Tutorial
- [Simple About Rust](https://github.com/rustkas/simple-about-rust) - Rust Best Practices
- [Tauri Base](https://github.com/SoinRoma/tauri-base) - Tauri Application Structure

---

## 🎯 TypeScript / React Best Practices

### 1. Типизация Функций
```typescript
// ✅ ПРАВИЛЬНО - явные типы возвращаемых значений
const startListening = async (): Promise<void> => {
  // ...
}

// ❌ НЕПРАВИЛЬНО - неявные типы
const startListening = async () => {
  // ...
}
```

### 2. Async/Await и Promise
```typescript
// ✅ ПРАВИЛЬНО - корректная обработка промисов
const activateLucy = async (): Promise<void> => {
  stopClapDetection()
  await new Promise(resolve => setTimeout(resolve, 500))
  startListening()
}

// ❌ НЕПРАВИЛЬНО - блокирующий код без await
const activateLucy = () => {
  stopClapDetection()
  setTimeout(() => startListening(), 500)
}
```

### 3. Обработка Ошибок
```typescript
// ✅ ПРАВИЛЬНО - детальная обработка ошибок
try {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    .catch((error: DOMException) => {
      console.error('❌ getUserMedia failed:', error.name, error.message)
      throw error
    })
} catch (error: any) {
  if (error.name === 'NotAllowedError') {
    alert('Доступ к микрофону запрещен')
  } else if (error.name === 'NotFoundError') {
    alert('Микрофон не найден')
  }
}

// ❌ НЕПРАВИЛЬНО - общая обработка без деталей
try {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
} catch (error) {
  alert('Ошибка')
}
```

### 4. Promise Обертки
```typescript
// ✅ ПРАВИЛЬНО - функция возвращает Promise для async операций
const startListening = async (): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    try {
      recognition.start()
      resolve()
    } catch (e) {
      reject(e)
    }
  })
}
```

### 5. Refs для Нестабильного State
```typescript
// ✅ ПРАВИЛЬНО - используем ref для критичной логики
const recognitionRef = useRef<any>(null)
const shouldListenRef = useRef<boolean>(false)

recognition.onend = () => {
  if (shouldListenRef.current) { // ref всегда актуален
    recognition.start()
  }
}

// ❌ НЕПРАВИЛЬНО - state может быть устаревшим в callback
const [shouldListen, setShouldListen] = useState(false)

recognition.onend = () => {
  if (shouldListen) { // может быть старым значением!
    recognition.start()
  }
}
```

---

## 🦀 Rust Best Practices

### 1. Обработка Ошибок через Result
```rust
// ✅ ПРАВИЛЬНО - использование Result<T, E>
#[tauri::command]
fn process_command(input: String) -> Result<String, String> {
    if input.is_empty() {
        return Err("Пустой ввод".to_string());
    }
    Ok(format!("Обработано: {}", input))
}

// ❌ НЕПРАВИЛЬНО - паника на ошибках
#[tauri::command]
fn process_command(input: String) -> String {
    if input.is_empty() {
        panic!("Пустой ввод"); // Крашит приложение!
    }
    format!("Обработано: {}", input)
}
```

### 2. Документация Кода
```rust
/// Инициализирует Discord RPC с заданным Application ID
/// 
/// # Arguments
/// * `app_id` - Строка с Application ID из Discord Developer Portal
/// 
/// # Returns
/// * `Ok(())` при успешной инициализации
/// * `Err(String)` с описанием ошибки при неудаче
/// 
/// # Example
/// ```
/// init_discord_rpc("1234567890".to_string())?;
/// ```
#[tauri::command]
fn init_discord_rpc(app_id: String) -> Result<(), String> {
    // ...
}
```

### 3. Типобезопасность
```rust
// ✅ ПРАВИЛЬНО - строгие типы
#[derive(serde::Serialize, serde::Deserialize)]
struct WindowInfo {
    title: String,
    hwnd: isize,
    visible: bool,
}

#[tauri::command]
fn get_windows() -> Vec<WindowInfo> {
    // ...
}

// ❌ НЕПРАВИЛЬНО - динамические типы
#[tauri::command]
fn get_windows() -> Vec<serde_json::Value> {
    // Теряется типобезопасность
}
```

---

## 🖥️ Tauri Best Practices

### 1. System Tray с Prevent Exit
```rust
// ✅ ПРАВИЛЬНО - приложение работает в фоне
.run(|_app_handle, event| match event {
    tauri::RunEvent::ExitRequested { api, .. } => {
        api.prevent_exit(); // Предотвращаем закрытие
    }
    _ => {}
})

// ❌ НЕПРАВИЛЬНО - приложение закрывается полностью
.run(|_app_handle, event| {
    // Нет обработки ExitRequested
})
```

### 2. Обработка System Tray Events
```rust
// ✅ ПРАВИЛЬНО - все события обработаны
.on_system_tray_event(|app, event| match event {
    SystemTrayEvent::LeftClick { .. } => {
        let window = app.get_window("main").unwrap();
        if window.is_visible().unwrap() {
            window.set_focus().unwrap();
        } else {
            window.show().unwrap();
        }
    }
    SystemTrayEvent::MenuItemClick { id, .. } => {
        match id.as_str() {
            "quit" => std::process::exit(0),
            "hide" => {
                app.get_window("main").unwrap().hide().unwrap();
            }
            _ => {}
        }
    }
    _ => {}
})
```

### 3. Invoke Handler Organization
```rust
// ✅ ПРАВИЛЬНО - логическая группировка команд
.invoke_handler(tauri::generate_handler![
    // Тема и персонализация
    theme_manager::set_dark_mode,
    theme_manager::get_dark_mode,
    
    // Управление курсорами
    cursor_manager::get_cursor_library,
    cursor_manager::apply_cursor,
    
    // AI ассистент
    ai_assistant::process_voice_command,
    ai_assistant::transcribe_audio,
])
```

---

## 🎨 Архитектурные Паттерны

### 1. Разделение Ответственности
```
src/
├── components/          # React компоненты (UI)
│   ├── LucyAssistant.tsx
│   └── CommandAssistant.tsx
├── utils/              # Утилиты и сервисы
│   ├── llmService.ts
│   └── discordRpc.ts
└── types/              # TypeScript типы
    └── index.ts

src-tauri/src/
├── main.rs             # Entry point
├── theme_manager.rs    # Модуль темы
├── cursor_manager.rs   # Модуль курсоров
└── ai_assistant.rs     # Модуль AI
```

### 2. Service Pattern
```typescript
// utils/audioService.ts
class AudioService {
  private stream: MediaStream | null = null
  private context: AudioContext | null = null
  
  async start(): Promise<void> { /* ... */ }
  async stop(): Promise<void> { /* ... */ }
  isActive(): boolean { /* ... */ }
}

export const audioService = new AudioService()
```

### 3. Error Boundary для React
```typescript
class ErrorBoundary extends React.Component<Props, State> {
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('❌ React Error:', error, errorInfo)
    // Логирование в Tauri backend
    invoke('log_error', { error: error.toString() })
  }
  
  render() {
    if (this.state.hasError) {
      return <ErrorFallback />
    }
    return this.props.children
  }
}
```

---

## 🔧 Debugging Best Practices

### 1. Структурированное Логирование
```typescript
// ✅ ПРАВИЛЬНО - с контекстом и категориями
console.log('\n🎯 === ДИАГНОСТИКА РАСПОЗНАВАНИЯ РЕЧИ ===')
console.log('1️⃣ SpeechRecognition API:', !!SpeechRecognition)
console.log('2️⃣ window.SpeechRecognition:', !!window.SpeechRecognition)

// ❌ НЕПРАВИЛЬНО - без контекста
console.log('speech rec available')
```

### 2. Временные Метки
```typescript
// ✅ ПРАВИЛЬНО - отслеживание времени выполнения
const startTime = performance.now()
await someAsyncOperation()
const elapsed = performance.now() - startTime
console.log(`⏱️ Операция заняла ${elapsed.toFixed(2)}мс`)
```

### 3. Условное Логирование
```typescript
// Отключаем детальные логи в продакшене
const DEBUG = !import.meta.env.PROD

if (DEBUG) {
  console.log('🐛 Debug info:', detailedData)
}
```

---

## 🚀 Performance Best Practices

### 1. Debounce для Частых Событий
```typescript
// ✅ ПРАВИЛЬНО - debounce для поиска
const debouncedSearch = useMemo(
  () => debounce((query: string) => performSearch(query), 300),
  []
)
```

### 2. Lazy Loading
```typescript
// ✅ ПРАВИЛЬНО - ленивая загрузка тяжелых компонентов
const CommandAssistant = React.lazy(() => import('./CommandAssistant'))

<Suspense fallback={<LoadingSpinner />}>
  <CommandAssistant />
</Suspense>
```

### 3. Мемоизация
```typescript
// ✅ ПРАВИЛЬНО - избегаем лишних рендеров
const expensiveValue = useMemo(() => {
  return computeExpensiveValue(data)
}, [data])
```

---

## ✅ Чеклист Перед Коммитом

- [ ] Все функции имеют явные типы возвращаемых значений
- [ ] Async функции правильно обрабатывают Promise
- [ ] Ошибки обрабатываются детально с понятными сообщениями
- [ ] Критичная логика использует refs вместо state
- [ ] Логирование структурировано и информативно
- [ ] Rust команды возвращают Result<T, E>
- [ ] Нет блокирующего кода в main thread
- [ ] Ресурсы (streams, contexts) корректно освобождаются
- [ ] Код протестирован в dev и production режимах

---

## 📖 Полезные Ссылки

- [Modern JavaScript Tutorial (RU)](https://learn.javascript.ru/)
- [Rust Book (RU)](https://doc.rust-lang.ru/book/)
- [Tauri Documentation](https://tauri.app/v1/guides/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/)
- [React Best Practices](https://react.dev/learn)

---

*Последнее обновление: 3 декабря 2025*
