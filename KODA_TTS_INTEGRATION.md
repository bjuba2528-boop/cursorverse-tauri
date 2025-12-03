# Интеграция голосовой модели Koda (Silero TTS)

## О модели Koda

**Koda** - это российская модель для озвучивания текста от команды Silero Models.

- **Репозиторий**: https://github.com/snakers4/silero-models
- **Качество**: Высочайшее качество русской речи
- **Голоса**: Несколько голосов (мужские и женские)
- **Лицензия**: Open Source

## Текущая реализация в Lucy

В данный момент Lucy использует **OpenAI TTS API** с адаптацией для языков:

```typescript
// Выбор голоса по языку
if (lang === 'ru') {
  voice = 'alloy'  // Хорошо говорит по-русски
} else if (lang === 'uk') {
  voice = 'shimmer'  // Украинский
} else {
  voice = 'nova'  // Английский (самый человечный)
}
```

## Варианты интеграции Koda

### Вариант 1: Локальная Silero TTS (рекомендуется)

```python
# Установка
pip install silero-tts torch soundfile

# Использование
import torch
from silero import silero_tts

model, example_text = torch.hub.load(
    repo_or_dir='snakers4/silero-models',
    model='silero_tts',
    language='ru',
    speaker='koda'
)

audio = model.apply_tts(
    text="Привет! Я Люси, твой AI-помощник.",
    speaker='koda',
    sample_rate=48000
)
```

### Вариант 2: REST API сервер

```bash
# Запустить Silero REST сервер
docker run -p 8080:8080 snakers4/silero-tts-server

# Использовать в Lucy через fetch
fetch('http://localhost:8080/tts', {
  method: 'POST',
  body: JSON.stringify({
    text: 'Привет',
    speaker: 'koda',
    sample_rate: 48000
  })
})
```

### Вариант 3: Tauri plugin (интеграция в Rust)

```rust
// src-tauri/src/tts_koda.rs
use silero_tts::SileroTTS;

#[tauri::command]
async fn speak_koda(text: String) -> Result<(), String> {
    let tts = SileroTTS::new("koda")?;
    let audio = tts.synthesize(&text)?;
    audio.play()?;
    Ok(())
}
```

## Доступные голоса Silero

### Русские голоса:
- **koda** - женский, естественный (рекомендуется)
- **aidar** - мужской, четкий
- **baya** - женский, мягкий
- **eugene** - мужской, приятный
- **xenia** - женский, выразительный

## Сравнение с OpenAI TTS

| Параметр | OpenAI TTS | Silero Koda |
|----------|-----------|-------------|
| Качество RU | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Качество EN | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| Скорость | Онлайн | Локально (быстро) |
| Стоимость | Платно | Бесплатно |
| Приватность | Облако | Локально |

## Рекомендация

Для **русскоязычных пользователей** рекомендуется:
1. Использовать **Silero Koda** для русского языка
2. OpenAI TTS для английского/украинского
3. Автоматическое переключение в зависимости от языка

## Пример интеграции в Lucy

```typescript
const speakWithBestVoice = async (text: string) => {
  if (lang === 'ru') {
    // Используем локальную Silero Koda
    await invoke('speak_koda', { text })
  } else {
    // OpenAI для других языков
    await speakWithOpenAI(text)
  }
}
```

## Ссылки

- [Silero Models GitHub](https://github.com/snakers4/silero-models)
- [Silero TTS Demo](https://models.silero.ai/models/tts/)
- [Документация](https://github.com/snakers4/silero-models/wiki)
- [Примеры использования](https://github.com/snakers4/silero-models/blob/master/src/silero/tts/example.ipynb)
