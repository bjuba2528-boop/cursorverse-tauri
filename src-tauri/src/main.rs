#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
#![feature(never_type)]

mod theme_manager;
mod cursor_manager;
mod toolbar;
mod task_switcher;
mod resource_editor;
mod system_tray;
mod taskbar;
mod start_menu;
mod pinned_apps;
mod window_thumbnails;
mod notification_center;
mod taskbar_customizer;
mod autostart;
mod ai_assistant;
mod autonomous_agent;
mod hotkey;
mod discord_rpc;
mod lucy_notification;
mod dpet_engine_clean; // Replaces corrupted dpet_engine

use cursorverse::{APP_HANDLE, set_tokio_handle};
use tauri::{Manager, Emitter};
use tauri_plugin_global_shortcut::GlobalShortcutExt;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{TrayIconBuilder, MouseButton, MouseButtonState};

pub fn get_app_handle() -> &'static tauri::AppHandle<tauri::Wry> {
    APP_HANDLE.get().expect("App handle not initialized")
}

#[tokio::main]
async fn main() {
    set_tokio_handle(tokio::runtime::Handle::current());

    // Tray menu will be created in setup
    
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            theme_manager::set_dark_mode,
            theme_manager::get_dark_mode,
            theme_manager::set_accent_color,
            theme_manager::set_transparency,
            theme_manager::set_taskbar_autohide,
            theme_manager::reset_to_defaults,
            theme_manager::toggle_desktop_icons,
            theme_manager::toggle_window_animations,
            theme_manager::toggle_taskview_button,
            theme_manager::set_start_menu_style,
            theme_manager::change_windows_icon,
            cursor_manager::get_cursor_library,
            cursor_manager::apply_cursor,
            cursor_manager::reset_cursor,
            cursor_manager::get_favorites,
            cursor_manager::add_favorite,
            cursor_manager::remove_favorite,
            cursor_manager::check_cursorlib,
            cursor_manager::check_cursorlib_files,
            cursor_manager::download_cursorlib,
            cursor_manager::get_preview_base64,
            cursor_manager::get_cursor_size,
            cursor_manager::open_cursor_size_settings,
            ai_assistant::check_ollama_status,
            ai_assistant::process_voice_command,
            ai_assistant::clear_conversation,
            ai_assistant::get_conversation,
            ai_assistant::transcribe_audio,
            toolbar::get_toolbar_config,
            toolbar::save_toolbar_config,
            toolbar::launch_app,
            task_switcher::get_window_list,
            task_switcher::activate_window,
            resource_editor::extract_icons_from_file,
            resource_editor::get_system_icon_files,
            resource_editor::set_system_icon,
            resource_editor::replace_icon_in_exe,
            resource_editor::get_current_system_icons,
            system_tray::get_system_tray_icons,
            system_tray::send_tray_icon_click,
            system_tray::show_tray_icon_menu,
            taskbar::get_taskbar_windows,
            // taskbar::activate_window,
            taskbar::taskbar_close_window,
            taskbar::taskbar_minimize_window,
            taskbar::taskbar_maximize_window,
            taskbar::taskbar_hide_windows_taskbar,
            taskbar::taskbar_show_windows_taskbar,
            taskbar::get_pinned_apps_list,
            taskbar::launch_pinned_app,
            start_menu::get_start_menu_items,
            start_menu::launch_start_menu_app,
            pinned_apps::get_pinned_apps,
            pinned_apps::add_pinned_app,
            pinned_apps::remove_pinned_app,
            pinned_apps::reorder_pinned_apps,
            window_thumbnails::get_window_thumbnail,
            window_thumbnails::get_all_window_thumbnails,
            notification_center::get_notifications,
            notification_center::dismiss_notification,
            notification_center::clear_notifications,
            notification_center::send_test_notification,
            taskbar_customizer::customize_taskbar_transparency,
            taskbar_customizer::customize_taskbar_color,
            taskbar_customizer::customize_taskbar_height,
            taskbar_customizer::customize_taskbar_position,
            taskbar_customizer::customize_taskbar_autohide,
            taskbar_customizer::apply_full_taskbar_customization,
            taskbar_customizer::reset_taskbar_to_default,
            autostart::enable_autostart,
            autostart::disable_autostart,
            autostart::is_autostart_enabled,
            autonomous_agent::execute_shell_command,
            autonomous_agent::open_application,
            autonomous_agent::create_file,
            autonomous_agent::read_file,
            autonomous_agent::get_process_list,
            autonomous_agent::get_system_info,
            autonomous_agent::kill_process,
            autonomous_agent::execute_powershell,
            autonomous_agent::get_directory_contents,
            autonomous_agent::get_installed_apps,
            autonomous_agent::search_web,
            hotkey::get_listen_hotkey,
            hotkey::set_listen_hotkey,
            discord_rpc::init_discord_rpc,
            discord_rpc::update_discord_presence,
            discord_rpc::discord_set_activity,
            discord_rpc::clear_discord_presence,
            discord_rpc::disconnect_discord_rpc,
            lucy_notification::show_lucy_notification,
            lucy_notification::hide_lucy_notification,
            lucy_notification::is_main_window_visible,
            dpet_engine_clean::dpet_load_packages,
            dpet_engine_clean::dpet_import_package,
            dpet_engine_clean::dpet_create_pet,
            dpet_engine_clean::dpet_remove_pet,
            dpet_engine_clean::dpet_get_all_pets,
            dpet_engine_clean::dpet_get_active_pets,
            dpet_engine_clean::dpet_get_all_packages,
            dpet_engine_clean::dpet_update_position,
            dpet_engine_clean::dpet_update_state,
            dpet_engine_clean::dpet_get_pet_data,
            dpet_engine_clean::dpet_restore_pets,
            dpet_engine_clean::dpet_get_sprite_sheet,
            dpet_engine_clean::add_pet_from_catalog,
            dpet_engine_clean::get_available_pets,
            dpet_engine_clean::get_all_pets,
            dpet_engine_clean::remove_pet,
        ])
        .manage(ai_assistant::AssistantState::new())
        .manage(hotkey::ListenHotkey(std::sync::Mutex::new(Some("Ctrl+Shift+L".into()))))
        .setup(|app| {
            APP_HANDLE.set(app.handle().clone()).unwrap();

            // Создание меню для трея
            let show_item = MenuItem::with_id(app, "show", "Показать", true, None::<&str>)?;
            let listen_item = MenuItem::with_id(app, "listen", "🎤 Прослушивание (Ctrl+Shift+L)", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Выход", true, None::<&str>)?;
            
            let menu = Menu::with_items(app, &[&show_item, &listen_item, &quit_item])?;

            // Создание иконки в трее
            let _tray = TrayIconBuilder::new()
                .menu(&menu)
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("CursorVerse")
                .on_menu_event(move |app, event| {
                    match event.id.as_ref() {
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "listen" => {
                            let _ = app.emit("start-listening", ());
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    use tauri::tray::TrayIconEvent;
                    if let TrayIconEvent::Click { button, button_state, .. } = event {
                        if button == MouseButton::Left && button_state == MouseButtonState::Up {
                            if let Some(app) = tray.app_handle().get_webview_window("main") {
                                if app.is_visible().unwrap_or(false) {
                                    let _ = app.hide();
                                } else {
                                    let _ = app.show();
                                    let _ = app.set_focus();
                                }
                            }
                        }
                    }
                })
                .build(app)?;

            // Регистрация дефолтного хоткея из состояния
            if let Some(hotkey_str) = app.state::<hotkey::ListenHotkey>().0.lock().unwrap().clone() {
                if let Ok(shortcut) = hotkey_str.parse::<tauri_plugin_global_shortcut::Shortcut>() {
                    let gsm = app.handle().global_shortcut();
                    let h = app.handle().clone();
                    let _ = gsm.on_shortcut(shortcut, move |_app, _shortcut, _event| {
                        let _ = h.emit("start-listening", ());
                    });
                }
            }

            // Обработка события закрытия окна - скрываем вместо закрытия
            if let Some(window) = app.get_webview_window("main") {
                let window_clone = window.clone();
                window.on_window_event(move |win_event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = win_event {
                        // Предотвращаем закрытие и скрываем окно
                        api.prevent_close();
                        let _ = window_clone.hide();
                    }
                });
            }

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("Failed to initialize Tauri application. Check system tray or window configuration.");

    // share the current runtime with Tauri
    tauri::async_runtime::set(tokio::runtime::Handle::current());
    app.run(|_app, _event| {});
}
