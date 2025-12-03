# AI Assistant Improvements Documentation

## 🤖 Самообучающийся AI Ассистент

### Текущее состояние:
- ✅ Web Speech API для распознавания речи (STT)
- ✅ Speech Synthesis API для голосового ответа (TTS)
- ✅ Ollama + Llama 3.2 интеграция
- ✅ Простой парсер команд (fallback)

### Улучшения для автономности:

## 1. Продвинутые модели AI

### Рекомендуемые модели через Ollama:

```bash
# Llama 3.2 (уже используется, 1.3GB)
ollama pull llama3.2

# Mistral 7B (лучше понимает контекст, 4.1GB)
ollama pull mistral

# Gemma 2 (от Google, быстрая, 5.4GB)
ollama pull gemma2

# Qwen 2.5 (мультиязычная, отлично работает с русским, 4.4GB)
ollama pull qwen2.5:7b

# DeepSeek Coder (специализирован на коде, 6.7GB)
ollama pull deepseek-coder
```

### Смена модели в коде:

В `src-tauri/src/ai_assistant.rs` изменить:
```rust
let request_body = json!({
    "model": "qwen2.5:7b", // или "mistral", "gemma2"
    "messages": messages,
    "stream": false
});
```

## 2. Контекстная память (RAG - Retrieval Augmented Generation)

### Добавление долговременной памяти:

```rust
// В ai_assistant.rs добавить структуру для памяти
use serde::{Deserialize, Serialize};
use std::fs;

#[derive(Serialize, Deserialize)]
struct MemoryEntry {
    timestamp: String,
    user_input: String,
    ai_response: String,
    action_performed: String,
    user_feedback: Option<String>,
}

// Сохранение в файл
fn save_memory(entry: MemoryEntry) -> Result<(), String> {
    let memory_path = dirs::data_local_dir()
        .unwrap()
        .join("CursorVerse")
        .join("ai_memory.json");
    
    let mut memories = load_all_memories()?;
    memories.push(entry);
    
    let json = serde_json::to_string_pretty(&memories)
        .map_err(|e| e.to_string())?;
    fs::write(memory_path, json).map_err(|e| e.to_string())?;
    Ok(())
}

// Загрузка памяти для контекста
fn load_relevant_memories(query: &str) -> Vec<MemoryEntry> {
    // Простой поиск по ключевым словам
    // Для продвинутого - использовать векторные embeddings
    load_all_memories()
        .unwrap_or_default()
        .into_iter()
        .filter(|m| {
            m.user_input.to_lowercase().contains(&query.to_lowercase())
        })
        .take(5) // Топ-5 релевантных
        .collect()
}
```

## 3. Улучшение голоса (TTS)

### В AIAssistant.tsx улучшить функцию speak():

```typescript
const speak = (text: string) => {
  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(text)
    
    // Получить лучший русский голос
    const voices = window.speechSynthesis.getVoices()
    const russianVoice = voices.find(v => 
      v.lang.startsWith('ru') && v.name.includes('Female')
    ) || voices.find(v => v.lang.startsWith('ru'))
    
    if (russianVoice) {
      utterance.voice = russianVoice
    }
    
    // Настройки голоса
    utterance.rate = 0.95 // Скорость (0.1 - 10)
    utterance.pitch = 1.1 // Высота (0 - 2)
    utterance.volume = 0.9 // Громкость (0 - 1)
    
    window.speechSynthesis.speak(utterance)
  }
}
```

## 4. Расширенная обработка команд

### Добавить в ai_assistant.rs системный промпт:

```rust
let system_prompt = r#"
Ты - голосовой AI ассистент приложения CursorVerse.
Твои возможности:
- Открывать вкладки: курсоры, обои, питомцы
- Управлять приложением: свернуть окно, выход
- Добавлять питомцев на экран
- Отвечать на вопросы о программе

ВАЖНО: Всегда отвечай на русском языке.
Будь дружелюбным и кратким.
В ответе указывай JSON с полями:
{
  "action": "open_cursors|open_wallpaper|open_pets|add_pet|minimize|exit|none",
  "response": "твой ответ пользователю"
}

Примеры:
Пользователь: "Открой курсоры"
Ответ: {"action": "open_cursors", "response": "Открываю раздел курсоров"}

Пользователь: "Как дела?"
Ответ: {"action": "none", "response": "Отлично! Чем могу помочь?"}
"#;

// Добавить в запрос к Ollama
let mut messages_with_system = vec![json!({
    "role": "system",
    "content": system_prompt
})];
messages_with_system.extend(messages);
```

## 5. GitHub репозитории для референса:

### Лучшие open-source AI ассистенты:

1. **Mycroft AI** - Open source voice assistant
   - https://github.com/MycroftAI/mycroft-core
   - Python, полностью оффлайн
   - Система навыков (skills)

2. **Rhasspy** - Voice assistant toolkit
   - https://github.com/rhasspy/rhasspy
   - Модульная архитектура
   - Поддержка многих языков

3. **Leon** - Open-source personal assistant
   - https://github.com/leon-ai/leon
   - Node.js + Python
   - NLP pipeline

4. **Jarvis** - Personal Assistant
   - https://github.com/sukeesh/Jarvis
   - Python
   - Плагины

5. **Dragonfire** - Virtual assistant for Ubuntu
   - https://github.com/DragonComputer/Dragonfire
   - Deep learning
   - TensorFlow integration

## 6. Интеграция внешних AI API (альтернатива Ollama):

### OpenAI GPT:
```rust
// Добавить в Cargo.toml
reqwest = { version = "0.11", features = ["json"] }

// В ai_assistant.rs
async fn process_with_openai(command: &str) -> Result<String, String> {
    let client = reqwest::Client::new();
    let api_key = std::env::var("OPENAI_API_KEY")
        .map_err(|_| "API key not found")?;
    
    let response = client
        .post("https://api.openai.com/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&json!({
            "model": "gpt-4",
            "messages": [{"role": "user", "content": command}]
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    // Parse response...
    Ok("response".to_string())
}
```

### Anthropic Claude:
```rust
async fn process_with_claude(command: &str) -> Result<String, String> {
    let client = reqwest::Client::new();
    let api_key = std::env::var("ANTHROPIC_API_KEY")
        .map_err(|_| "API key not found")?;
    
    let response = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .json(&json!({
            "model": "claude-3-sonnet-20240229",
            "max_tokens": 1024,
            "messages": [{"role": "user", "content": command}]
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    Ok("response".to_string())
}
```

## 7. Иконка AI ассистента:

В `src-tauri/tauri.conf.json` можно настроить отдельное окно для AI:
```json
{
  "windows": [
    {
      "title": "AI Assistant",
      "icon": "icons/CursorVerse.ico",
      "width": 400,
      "height": 600
    }
  ]
}
```

## 8. Автономное обучение:

### Добавить feedback loop:
```typescript
// В AIAssistant.tsx
const [feedbackMode, setFeedbackMode] = useState(false)

const handleFeedback = async (messageId: number, positive: boolean) => {
  await invoke('save_feedback', {
    messageId,
    feedback: positive ? 'positive' : 'negative'
  })
  
  // AI учится на обратной связи
  if (!positive) {
    // Запросить альтернативный ответ
    const newResponse = await invoke('regenerate_response', { messageId })
    // Обновить сообщение
  }
}
```

## 9. Полезные команды для расширения:

```typescript
const advancedCommands = {
  // Системные
  "какая погода": () => fetchWeather(),
  "который час": () => speak(new Date().toLocaleTimeString()),
  "установи таймер на X минут": (mins) => setTimer(mins),
  
  // Управление
  "увеличь громкость музыки": () => adjustMusicVolume(+10),
  "включи музыку": () => toggleMusic(true),
  "следующая песня": () => nextTrack(),
  
  // Информация
  "сколько курсоров": () => getCursorCount(),
  "покажи статистику": () => showStats(),
  "последние обои": () => showRecentWallpapers(),
  
  // Питомцы
  "покорми питомца": () => feedPet(),
  "убери всех питомцев": () => removeAllPets(),
  "добавь случайного питомца": () => addRandomPet()
}
```

## 10. Рекомендуемая архитектура:

```
AI Assistant Architecture:
┌────────────────────────────────┐
│   User Voice Input (STT)       │
└────────┬───────────────────────┘
         │
         ▼
┌────────────────────────────────┐
│  Intent Recognition            │
│  (Ollama / GPT / Claude)       │
└────────┬───────────────────────┘
         │
         ▼
┌────────────────────────────────┐
│  Context Memory (RAG)          │
│  - User preferences            │
│  - Command history             │
│  - Feedback data               │
└────────┬───────────────────────┘
         │
         ▼
┌────────────────────────────────┐
│  Action Executor               │
│  - App commands                │
│  - External APIs               │
│  - File operations             │
└────────┬───────────────────────┘
         │
         ▼
┌────────────────────────────────┐
│  Response Generator            │
└────────┬───────────────────────┘
         │
         ▼
┌────────────────────────────────┐
│  Voice Output (TTS)            │
└────────────────────────────────┘
```

## Резюме:

Для полностью автономного и самообучающегося AI:

1. ✅ Используйте Ollama с моделью Qwen 2.5 (лучше для русского)
2. ✅ Добавьте контекстную память (файл JSON)
3. ✅ Улучшите TTS голос (выбор лучшего female русского голоса)
4. ✅ Расширьте системный промпт
5. ✅ Добавьте feedback loop
6. ✅ Сохраняйте все взаимодействия для обучения

Код уже написан для базовой функциональности. Для полной автономности нужно:
- Векторная БД (например chromadb-rs) для semantic search
- Fine-tuning модели на ваших данных
- Continuous learning pipeline
