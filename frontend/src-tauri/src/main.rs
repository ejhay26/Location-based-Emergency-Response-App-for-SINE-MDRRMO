// This binary entry point stays intentionally empty — all setup lives in
// lib.rs's `run()` so the same lib target can be reused by a future
// mobile (Android/iOS) Tauri build, which needs a different entry point
// than a plain `fn main()`.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    mdrrmo_emergency_response_app_lib::run();
}
