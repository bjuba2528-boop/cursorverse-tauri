use discord_rich_presence::{DiscordIpc, DiscordIpcClient, activity::{Activity, Assets, Timestamps, Button}};
use std::sync::Mutex;
use once_cell::sync::Lazy;
use std::time::{SystemTime, UNIX_EPOCH};

static DISCORD_CLIENT: Lazy<Mutex<Option<DiscordIpcClient>>> = Lazy::new(|| Mutex::new(None));
static START_TIME: Lazy<i64> = Lazy::new(|| {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64
});

const CLIENT_ID: &str = "1444795416846663914";

#[tauri::command]
pub fn init_discord_rpc() -> Result<String, String> {
    println!("[Discord] Начало инициализации...");
    println!("[Discord] Client ID: {}", CLIENT_ID);
    
    let mut client_guard = DISCORD_CLIENT.lock().map_err(|e| e.to_string())?;
    
    if client_guard.is_some() {
        println!("[Discord] Клиент уже инициализирован, обновляем presence");
        // Уже инициализирован, обновляем presence
        drop(client_guard);
        let _ = update_discord_presence(
            Some("🖱️ CursorVerse запущен".to_string()),
            Some("Настройка Windows".to_string()),
            None,
            None
        );
        return Ok("Discord RPC уже инициализирован".to_string());
    }

    println!("[Discord] Создание клиента...");
    let mut client = DiscordIpcClient::new(CLIENT_ID)
        .map_err(|e| {
            let err = format!("Ошибка создания Discord клиента: {}", e);
            println!("[Discord] ❌ {}", err);
            err
        })?;
    
    println!("[Discord] Подключение к Discord...");
    client.connect()
        .map_err(|e| {
            let err = format!("Ошибка подключения к Discord: {}. Убедитесь что Discord запущен!", e);
            println!("[Discord] ❌ {}", err);
            err
        })?;
    
    println!("[Discord] ✅ Успешно подключен к Discord IPC!");
    println!("[Discord] ℹ️  Application ID: {}", CLIENT_ID);
    println!("[Discord] ℹ️  Если активность не появляется:");
    println!("[Discord]    1. Проверьте https://discord.com/developers/applications/{}", CLIENT_ID);
    println!("[Discord]    2. Убедитесь что Rich Presence включен");
    println!("[Discord]    3. Перезапустите Discord если нужно");
    
    *client_guard = Some(client);
    drop(client_guard);
    
    // Устанавливаем начальное состояние
    let _ = update_discord_presence(
        Some("🖱️ CursorVerse запущен".to_string()),
        Some("Настройка Windows".to_string()),
        None,
        None
    );
    
    Ok("Discord RPC успешно инициализирован".to_string())
}

#[tauri::command]
pub fn update_discord_presence(
    details: Option<String>,
    state: Option<String>,
    large_image: Option<String>,
    large_text: Option<String>,
) -> Result<String, String> {
    println!("[Discord] Обновление presence...");
    println!("[Discord] Details: {:?}", details);
    println!("[Discord] State: {:?}", state);
    
    let mut client_guard = DISCORD_CLIENT.lock().map_err(|e| e.to_string())?;
    
    if let Some(client) = client_guard.as_mut() {
        let mut activity = Activity::new();
        
        // Храним строки чтобы они жили до конца функции
        let details_str = details.unwrap_or_default();
        let state_str = state.unwrap_or_default();
        let large_image_str = large_image.unwrap_or_else(|| "cursorverse_logo".to_string());
        let large_text_str = large_text.unwrap_or_else(|| "CursorVerse - Windows Customization".to_string());
        
        if !details_str.is_empty() {
            activity = activity.details(&details_str);
        }
        
        if !state_str.is_empty() {
            activity = activity.state(&state_str);
        }
        
        // Добавляем изображение и время
        let assets = Assets::new()
            .large_image(&large_image_str)
            .large_text(&large_text_str);
        
        activity = activity.assets(assets);
        
        // Добавляем время начала
        let timestamps = Timestamps::new().start(*START_TIME);
        activity = activity.timestamps(timestamps);
        
        // Пробуем добавить кнопку Telegram (если поддерживается версией)
        // Примечание: кнопки могут не отображаться в старых версиях discord-rich-presence
        let button_label = "📱 Telegram: t.me/CursorVerse".to_string();
        let button_url = "https://t.me/CursorVerse".to_string();
        
        match Button::new(&button_label, &button_url) {
            button => {
                activity = activity.buttons(vec![button]);
                println!("[Discord] ✅ Кнопка Telegram добавлена");
            }
        }
        
        client.set_activity(activity)
            .map_err(|e| {
                let err = format!("Ошибка обновления активности: {}", e);
                println!("[Discord] ❌ {}", err);
                err
            })?;
        
        println!("[Discord] ✅ Presence успешно обновлен!");
        println!("[Discord] 📊 Данные отправлены в Discord:");
        println!("[Discord]    Details: {:?}", details_str);
        println!("[Discord]    State: {:?}", state_str);
        println!("[Discord]    Image: {:?}", large_image_str);
        println!("[Discord] ⏰ Время с запуска: {} секунд", SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs() - *START_TIME as u64);
        Ok("Discord presence обновлен".to_string())
    } else {
        Err("Discord RPC не инициализирован. Вызовите init_discord_rpc сначала".to_string())
    }
}

// Простая обёртка для фронтенда: принимает обязательные поля и прокидывает в update_discord_presence
#[tauri::command]
pub fn discord_set_activity(state: String, details: String) -> Result<String, String> {
    // Инициализируем клиент, если ещё не инициализирован
    {
        let client_guard = DISCORD_CLIENT.lock().map_err(|e| e.to_string())?;
        if client_guard.is_none() {
            drop(client_guard);
            let _ = init_discord_rpc();
        }
    }
    update_discord_presence(Some(details), Some(state), None, None)
}

#[tauri::command]
pub fn clear_discord_presence() -> Result<String, String> {
    let mut client_guard = DISCORD_CLIENT.lock().map_err(|e| e.to_string())?;
    
    if let Some(client) = client_guard.as_mut() {
        client.clear_activity()
            .map_err(|e| format!("Ошибка очистки активности: {}", e))?;
        Ok("Discord presence очищен".to_string())
    } else {
        Err("Discord RPC не инициализирован".to_string())
    }
}

#[tauri::command]
pub fn disconnect_discord_rpc() -> Result<String, String> {
    let mut client_guard = DISCORD_CLIENT.lock().map_err(|e| e.to_string())?;
    
    if let Some(mut client) = client_guard.take() {
        client.close()
            .map_err(|e| format!("Ошибка отключения: {}", e))?;
        Ok("Discord RPC отключен".to_string())
    } else {
        Ok("Discord RPC не был подключен".to_string())
    }
}
