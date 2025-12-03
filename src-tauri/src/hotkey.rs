use std::sync::Mutex;
use tauri::{command, Emitter};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};

pub struct ListenHotkey(pub Mutex<Option<String>>);

#[command]
pub fn get_listen_hotkey(state: tauri::State<ListenHotkey>) -> Result<String, String> {
    Ok(state.0.lock().unwrap().clone().unwrap_or_else(|| "".into()))
}

#[command]
pub fn set_listen_hotkey(hotkey: String, state: tauri::State<ListenHotkey>) -> Result<(), String> {
    if hotkey.trim().is_empty() { return Err("Пустая строка хоткея".into()); }

    let app = crate::get_app_handle();
    let gsm = app.global_shortcut();

    // Снимаем предыдущую регистрацию
    if let Some(old) = state.0.lock().unwrap().as_ref() { 
        if let Ok(shortcut) = old.parse::<Shortcut>() {
            let _ = gsm.unregister(shortcut); 
        }
    }

    // Регистрируем новый
    let hotkey_clone = hotkey.clone();
    let shortcut: Shortcut = hotkey_clone.parse().map_err(|e| format!("Неправильный формат хоткея: {}", e))?;
    gsm.on_shortcut(shortcut, move |app, _shortcut, event| {
        if event.state == tauri_plugin_global_shortcut::ShortcutState::Pressed {
            println!("🎤 Global hotkey pressed: {:?}", _shortcut);
            let _ = app.emit("start-listening", ());
        }
    }).map_err(|e| format!("Не удалось зарегистрировать хоткей: {}", e))?;

    println!("✅ Глобальный хоткей установлен: {}", hotkey);
    *state.0.lock().unwrap() = Some(hotkey);
    Ok(())
}