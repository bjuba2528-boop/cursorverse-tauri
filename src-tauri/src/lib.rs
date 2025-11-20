#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
#![feature(never_type)]

#[macro_use]
extern crate rust_i18n;
i18n!("background/i18n", fallback = "en");

use std::sync::{atomic::AtomicBool, OnceLock};

// Global flags for CLI options
pub static STARTUP: AtomicBool = AtomicBool::new(false);
pub static SILENT: AtomicBool = AtomicBool::new(false);
pub static VERBOSE: AtomicBool = AtomicBool::new(false);

// Global app handle for both main and seelen
pub static APP_HANDLE: OnceLock<tauri::AppHandle<tauri::Wry>> = OnceLock::new();

// Tokio runtime handle
static TOKIO_RUNTIME_HANDLE: OnceLock<tokio::runtime::Handle> = OnceLock::new();

pub fn get_tokio_handle() -> &'static tokio::runtime::Handle {
    TOKIO_RUNTIME_HANDLE
        .get()
        .expect("Tokio runtime was not initialized")
}

pub fn set_tokio_handle(handle: tokio::runtime::Handle) {
    TOKIO_RUNTIME_HANDLE
        .set(handle)
        .expect("Failed to set runtime handle");
}

// Check if running in development mode
pub fn is_local_dev() -> bool {
    cfg!(debug_assertions)
}
