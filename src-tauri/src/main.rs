#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
#![feature(never_type)]

mod theme_manager;
mod cursor_manager;
mod toolbar;
mod task_switcher;
mod lively_integration;
mod resource_editor;
mod system_tray;
mod taskbar;
mod start_menu;
mod pinned_apps;
mod window_thumbnails;
mod notification_center;
mod taskbar_customizer;
mod pet_manager;
mod autostart;

use cursorverse::{APP_HANDLE, set_tokio_handle};
use tauri::{Manager, Emitter};

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
            cursor_manager::download_cursorlib,
            cursor_manager::get_preview_base64,
            toolbar::get_toolbar_config,
            toolbar::save_toolbar_config,
            toolbar::launch_app,
            task_switcher::get_window_list,
            task_switcher::activate_window,
            lively_integration::get_lively_wallpapers,
            lively_integration::set_lively_wallpaper,
            lively_integration::close_all_lively_wallpapers,
            lively_integration::add_wallpaper_to_library,
            lively_integration::get_wallpaper_thumbnail,
            lively_integration::delete_wallpaper,
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
            pet_manager::add_pet,
            pet_manager::add_pet_from_catalog,
            pet_manager::remove_pet,
            pet_manager::get_all_pets,
            pet_manager::get_available_pets,
            pet_manager::update_pet_position,
            pet_manager::update_pet_size,
            autostart::enable_autostart,
            autostart::disable_autostart,
            autostart::is_autostart_enabled,
        ])
        .setup(|app| {
            APP_HANDLE.set(app.handle().to_owned()).unwrap();
            
            // Initialize pet manager
            let pet_manager = pet_manager::PetManager::new(app.handle());
            
            // Restore saved pets on startup
            if let Err(e) = pet_manager.restore_all_pets(app.handle()) {
                eprintln!("Failed to restore pets: {}", e);
            }
            
            // Add pet manager to app state
            app.handle().manage(pet_manager);
            
            // Create system tray
            let quit = tauri::menu::MenuItemBuilder::with_id("quit", "Quit").build(app)?;
            let show = tauri::menu::MenuItemBuilder::with_id("show", "Show Main Window").build(app)?;
            let pets = tauri::menu::MenuItemBuilder::with_id("pets", "Manage Pets").build(app)?;
            
            let menu = tauri::menu::MenuBuilder::new(app)
                .items(&[&show, &pets, &quit])
                .build()?;
            
            let _tray = tauri::tray::TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "quit" => {
                        std::process::exit(0);
                    }
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "pets" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                            let _ = window.emit("show-pets", &());
                        }
                    }
                    _ => {}
                })
                .build(app)?;
            
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("Failed to initialize Tauri application. Check system tray or window configuration.");

    // share the current runtime with Tauri
    tauri::async_runtime::set(tokio::runtime::Handle::current());
    app.run(|_app, _event| {});
}
