use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;
use reqwest;

#[derive(Clone, Serialize, Deserialize)]
pub struct AssistantMessage {
    pub role: String,
    pub content: String,
}

pub struct AssistantState {
    pub conversation: Mutex<Vec<AssistantMessage>>,
}

impl AssistantState {
    pub fn new() -> Self {
        Self {
            conversation: Mutex::new(Vec::new()),
        }
    }
}

#[derive(Serialize, Deserialize)]
struct OllamaRequest {
    model: String,
    prompt: String,
    stream: bool,
}

#[derive(Serialize, Deserialize)]
struct OllamaResponse {
    response: String,
}

/// Проверка доступности Ollama
#[tauri::command]
pub async fn check_ollama_status() -> Result<bool, String> {
    match reqwest::get("http://localhost:11434/api/tags").await {
        Ok(response) => Ok(response.status().is_success()),
        Err(_) => Ok(false),
    }
}

/// Обработка голосовой команды через Ollama
#[tauri::command]
pub async fn process_voice_command(
    command: String,
    state: State<'_, AssistantState>,
) -> Result<String, String> {
    // Добавляем команду пользователя в историю
    {
        let mut conv = state.conversation.lock().unwrap();
        conv.push(AssistantMessage {
            role: "user".to_string(),
            content: command.clone(),
        });
    }

    // Формируем контекст для AI
    let system_prompt = r#"Ты - AI-ассистент приложения CursorVerse. Твоя задача - понимать голосовые команды пользователя на русском языке и возвращать JSON с действием.

Доступные команды:
- "открой курсоры" / "покажи курсоры" → {"action": "open_cursors"}
- "добавь питомца" / "новый питомец" → {"action": "add_pet"}
- "открой настройки обоев" → {"action": "open_wallpaper"}
- "открой панель инструментов" → {"action": "open_toolbar"}
- "открой тасккаст" / "переключатель окон" → {"action": "open_task_switcher"}
- "сверни окно" / "спрячься" → {"action": "minimize"}
- "закрой приложение" / "выход" → {"action": "quit"}
- Любой другой вопрос → {"action": "chat", "response": "твой ответ"}

Отвечай ТОЛЬКО в формате JSON. Ничего лишнего."#;

    let full_prompt = format!("{}\n\nКоманда пользователя: {}\n\nJSON:", system_prompt, command);

    // Отправляем запрос к Ollama
    let client = reqwest::Client::new();
    let ollama_request = OllamaRequest {
        model: "llama3.2".to_string(),
        prompt: full_prompt,
        stream: false,
    };

    match client
        .post("http://localhost:11434/api/generate")
        .json(&ollama_request)
        .send()
        .await
    {
        Ok(response) => {
            let ollama_response: OllamaResponse = response
                .json()
                .await
                .map_err(|e| format!("Ошибка парсинга ответа: {}", e))?;

            // Сохраняем ответ в историю
            {
                let mut conv = state.conversation.lock().unwrap();
                conv.push(AssistantMessage {
                    role: "assistant".to_string(),
                    content: ollama_response.response.clone(),
                });
            }

            Ok(ollama_response.response)
        }
        Err(_) => {
            // Если Ollama недоступна, используем простой парсинг
            let action = parse_command_simple(&command);
            Ok(action)
        }
    }
}

/// Простой парсер команд (фолбэк без AI)
fn parse_command_simple(command: &str) -> String {
    let cmd = command.to_lowercase();
    
    if cmd.contains("курсор") {
        return r#"{"action": "open_cursors"}"#.to_string();
    } else if cmd.contains("питом") || cmd.contains("pet") {
        return r#"{"action": "add_pet"}"#.to_string();
    } else if cmd.contains("обои") || cmd.contains("wallpaper") {
        return r#"{"action": "open_wallpaper"}"#.to_string();
    } else if cmd.contains("панель") || cmd.contains("toolbar") {
        return r#"{"action": "open_toolbar"}"#.to_string();
    } else if cmd.contains("окн") || cmd.contains("переключ") {
        return r#"{"action": "open_task_switcher"}"#.to_string();
    } else if cmd.contains("сверн") || cmd.contains("спрячь") {
        return r#"{"action": "minimize"}"#.to_string();
    } else if cmd.contains("закр") || cmd.contains("выход") || cmd.contains("quit") {
        return r#"{"action": "quit"}"#.to_string();
    }
    
    format!(r#"{{"action": "chat", "response": "Извините, я не понял команду. Попробуйте: 'открой курсоры', 'добавь питомца', 'открой обои'"}}"#)
}

/// Очистка истории разговора
#[tauri::command]
pub async fn clear_conversation(state: State<'_, AssistantState>) -> Result<(), String> {
    let mut conv = state.conversation.lock().unwrap();
    conv.clear();
    Ok(())
}

/// Получить историю разговора
#[tauri::command]
pub async fn get_conversation(
    state: State<'_, AssistantState>,
) -> Result<Vec<AssistantMessage>, String> {
    let conv = state.conversation.lock().unwrap();
    Ok(conv.clone())
}

/// Транскрибация аудио через Whisper (локальный Rust биндинг или API)
#[tauri::command]
pub async fn transcribe_audio(_audio_path: String) -> Result<String, String> {
    // TODO: Интеграция с whisper.cpp или OpenAI Whisper API
    // Пока заглушка, которая возвращает тестовый текст
    Ok("Тестовая транскрипция аудио".to_string())
}
