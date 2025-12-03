# 🔊 Улучшенная TTS озвучка (Rhasspy/Larynx/Piper)

## Проблема с Web Speech API

Встроенная Web Speech API имеет ограничения:
- ❌ Зависит от системных голосов Windows
- ❌ Качество голоса среднее (роботизированный)
- ❌ Нет контроля над интонацией
- ❌ Не работает оффлайн полностью

---

## 🎯 Решение: Piper TTS

**Piper** - современный нейронный TTS движок с отличным качеством.

### Преимущества:
- ✅ **Отличное качество** - нейронные голоса
- ✅ **Быстрая работа** - оптимизирован для CPU
- ✅ **Полностью оффлайн** - не требует интернета
- ✅ **Много голосов** - русские женские и мужские
- ✅ **Легкая интеграция** - один EXE файл

---

## 📥 Установка Piper

### Способ 1: Быстрая установка (Windows)

1. Скачайте Piper для Windows:
   ```
   https://github.com/rhasspy/piper/releases/latest
   ```
   Файл: `piper_windows_amd64.zip`

2. Распакуйте в `C:\piper\`

3. Скачайте русскую модель:
   ```
   https://github.com/rhasspy/piper/releases/download/v1.2.0/voice-ru-ru-dmitri-medium.tar.gz
   ```

4. Распакуйте модель в `C:\piper\models\`

5. Структура должна быть:
   ```
   C:\piper\
   ├── piper.exe
   ├── espeak-ng-data\
   └── models\
       └── ru-ru-dmitri-medium\
           ├── ru-ru-dmitri-medium.onnx
           └── ru-ru-dmitri-medium.onnx.json
   ```

---

## ⚙️ Интеграция в CursorVerse

### 1. Создать Rust команду для TTS

Добавить в `src-tauri/src/main.rs`:

```rust
#[tauri::command]
async fn speak_piper(text: String) -> Result<(), String> {
    use std::process::Command;
    
    let output = Command::new("C:\\piper\\piper.exe")
        .args(&[
            "--model", "C:\\piper\\models\\ru-ru-dmitri-medium\\ru-ru-dmitri-medium.onnx",
            "--output_file", "C:\\temp\\speech.wav"
        ])
        .stdin(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| e.to_string())?;
    
    use std::io::Write;
    if let Some(mut stdin) = output.stdin {
        stdin.write_all(text.as_bytes()).map_err(|e| e.to_string())?;
    }
    
    // Воспроизвести через powershell
    Command::new("powershell")
        .args(&[
            "-Command",
            "(New-Object Media.SoundPlayer 'C:\\temp\\speech.wav').PlaySync()"
        ])
        .spawn()
        .map_err(|e| e.to_string())?;
    
    Ok(())
}
```

### 2. Обновить ttsService.ts

```typescript
// Добавить в ttsService.ts
async speakPiper(text: string): Promise<void> {
  try {
    await invoke('speak_piper', { text })
  } catch (error) {
    console.error('Ошибка Piper TTS:', error)
    // Fallback на Web Speech API
    await this.speak(text)
  }
}
```

### 3. Использовать в LucyAssistant.tsx

```typescript
const speakResponse = async (text: string) => {
  if (!ttsEnabled || !ttsService.isSupported()) return
  
  const cleanText = text.replace(/\[EXECUTE:.+?\]/g, '').trim()
  
  if (cleanText.length > 0) {
    // Используем Piper вместо Web Speech API
    await ttsService.speakPiper(cleanText)
  }
}
```

---

## 🗣️ Доступные русские голоса

### Женские голоса:
1. **ru-ru-irina-medium** ⭐ (Рекомендуется)
   - Размер: 25 МБ
   - Качество: Отличное
   - Скорость: Быстро

2. **ru-ru-svetlana-medium**
   - Размер: 28 МБ
   - Качество: Очень хорошее
   - Особенность: Более эмоциональный

### Мужские голоса:
1. **ru-ru-dmitri-medium**
   - Размер: 25 МБ
   - Качество: Отличное
   - Особенность: Четкая дикция

Скачать все модели: https://huggingface.co/rhasspy/piper-voices/tree/main/ru

---

## 🔧 Настройка качества

В файле `.onnx.json` можно изменить параметры:

```json
{
  "audio": {
    "sample_rate": 22050,
    "quality": "medium"  // low, medium, high
  },
  "espeak": {
    "voice": "ru"
  },
  "inference": {
    "noise_scale": 0.667,     // Шум (0.0 - 1.0)
    "length_scale": 1.0,      // Скорость (0.5 - 2.0)
    "noise_w": 0.8            // Вариативность
  }
}
```

**Рекомендуемые настройки для Lucy:**
```json
{
  "noise_scale": 0.5,      // Меньше шума
  "length_scale": 0.95,    // Чуть быстрее
  "noise_w": 0.7           // Больше естественности
}
```

---

## 📊 Сравнение TTS движков

| Параметр | Web Speech API | Piper | Coqui TTS |
|----------|----------------|-------|-----------|
| **Качество** | 6/10 | 9/10 | 10/10 |
| **Скорость** | Мгновенно | ~0.5с | ~2-3с |
| **Размер** | 0 МБ | 25-50 МБ | 500+ МБ |
| **CPU** | 5% | 15% | 50%+ |
| **Оффлайн** | Частично | ✅ Да | ✅ Да |
| **Настройка** | ❌ Нет | ✅ Да | ✅✅ Много |

---

## 🚀 Продвинутые функции

### Эмоции через SSML

Piper поддерживает SSML разметку:

```xml
<speak>
  Привет! <prosody rate="fast">Я говорю быстро!</prosody>
  <break time="500ms"/>
  А теперь <prosody pitch="+20%">высоким голосом</prosody>.
</speak>
```

### Использование в Rust:

```rust
let ssml = format!(
    "<speak>Привет! Меня зовут <prosody pitch='+15%'>Люси</prosody>. Чем могу помочь?</speak>"
);
speak_piper(ssml).await?;
```

---

## 🐛 Решение проблем

### ❌ "piper.exe не найден"

**Решение:**
1. Проверьте путь: `C:\piper\piper.exe`
2. Добавьте в PATH или используйте полный путь
3. Убедитесь, что антивирус не блокирует

### ❌ "Модель не найдена"

**Решение:**
1. Проверьте структуру папок
2. Убедитесь, что `.onnx` и `.onnx.json` в одной папке
3. Скачайте модель заново

### ⏱️ "Медленная озвучка"

**Решение:**
1. Используйте модели с `-medium` (не `-high`)
2. Уменьшите `length_scale` в конфиге
3. Закройте другие программы

### 🔇 "Нет звука"

**Решение:**
1. Проверьте, что WAV файл создается: `C:\temp\speech.wav`
2. Воспроизведите его вручную
3. Проверьте звук в Windows

---

## 💡 Альтернативы

### Larynx TTS (тяжелее, но лучше)

```bash
# Установка через Docker
docker pull rhasspy/larynx

# Запуск
docker run -p 5002:5002 rhasspy/larynx
```

API endpoint: `http://localhost:5002/api/tts`

### Microsoft Edge TTS (онлайн)

```typescript
// Использует облачный API Microsoft
const url = `https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?trustedclienttoken=...`
```

---

## 📝 Полный пример интеграции

### 1. Создать `src-tauri/src/piper_tts.rs`:

```rust
use std::process::{Command, Stdio};
use std::io::Write;
use std::path::PathBuf;

pub struct PiperTTS {
    piper_path: PathBuf,
    model_path: PathBuf,
}

impl PiperTTS {
    pub fn new() -> Self {
        Self {
            piper_path: PathBuf::from("C:\\piper\\piper.exe"),
            model_path: PathBuf::from("C:\\piper\\models\\ru-ru-irina-medium\\ru-ru-irina-medium.onnx"),
        }
    }

    pub async fn speak(&self, text: &str) -> Result<(), String> {
        let temp_wav = std::env::temp_dir().join("lucy_speech.wav");
        
        let mut child = Command::new(&self.piper_path)
            .args(&[
                "--model", self.model_path.to_str().unwrap(),
                "--output_file", temp_wav.to_str().unwrap(),
            ])
            .stdin(Stdio::piped())
            .spawn()
            .map_err(|e| e.to_string())?;
        
        if let Some(mut stdin) = child.stdin.take() {
            stdin.write_all(text.as_bytes()).map_err(|e| e.to_string())?;
        }
        
        child.wait().map_err(|e| e.to_string())?;
        
        // Воспроизведение
        tokio::task::spawn_blocking(move || {
            Command::new("powershell")
                .args(&[
                    "-Command",
                    &format!("(New-Object Media.SoundPlayer '{}').PlaySync()", temp_wav.display())
                ])
                .output()
        }).await.map_err(|e| e.to_string())?;
        
        Ok(())
    }
}
```

### 2. Добавить команду в main.rs:

```rust
mod piper_tts;
use piper_tts::PiperTTS;

#[tauri::command]
async fn speak_with_piper(text: String) -> Result<(), String> {
    let tts = PiperTTS::new();
    tts.speak(&text).await
}
```

### 3. Зарегистрировать:

```rust
.invoke_handler(tauri::generate_handler![
    speak_with_piper,
    // ...
])
```

---

## ✨ Результат

После интеграции Lucy будет говорить:
- ✅ Естественным женским голосом
- ✅ С хорошей интонацией
- ✅ Быстро и плавно
- ✅ Полностью оффлайн

**Готово!** Piper TTS интегрирован! 🔊✨
