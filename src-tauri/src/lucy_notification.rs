use tauri::{Manager, AppHandle, Emitter};
use serde::{Deserialize, Serialize};

#[derive(Clone, Serialize, Deserialize)]
pub struct LucyNotification {
    pub message: String,
    pub response: String,
}

#[tauri::command]
pub async fn show_lucy_notification(
    app: AppHandle,
    message: String,
    response: String,
) -> Result<(), String> {
    // Создаем окно уведомления если его нет
    let window = match app.get_webview_window("lucy-notification") {
        Some(w) => w,
        None => {
            tauri::WebviewWindowBuilder::new(
                &app,
                "lucy-notification",
                tauri::WebviewUrl::App("lucy-notification.html".into())
            )
            .title("Lucy AI")
            .inner_size(350.0, 200.0)
            .resizable(false)
            .decorations(false)
            .always_on_top(true)
            .skip_taskbar(true)
            .visible(false)
            .build()
            .map_err(|e| e.to_string())?
        }
    };

    // Позиционируем окно в правом нижнем углу
    if let Ok(monitor) = window.current_monitor() {
        if let Some(monitor) = monitor {
            let size = monitor.size();
            let scale = monitor.scale_factor();
            
            let window_width = (350.0 * scale) as i32;
            let window_height = (200.0 * scale) as i32;
            let screen_width = size.width as i32;
            let screen_height = size.height as i32;
            
            let x = screen_width - window_width - 20;
            let y = screen_height - window_height - 60; // 60px от низа для таскбара
            
            let _ = window.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x, y }));
        }
    }

    // Отправляем данные в окно
    let notification = LucyNotification {
        message,
        response,
    };
    
    window.emit("lucy-notification-data", notification).map_err(|e| e.to_string())?;
    
    // Показываем окно
    window.show().map_err(|e| e.to_string())?;
    window.set_focus().map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn hide_lucy_notification(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("lucy-notification") {
        window.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn is_main_window_visible(app: AppHandle) -> Result<bool, String> {
    if let Some(window) = app.get_webview_window("main") {
        window.is_visible().map_err(|e| e.to_string())
    } else {
        Ok(false)
    }
}
