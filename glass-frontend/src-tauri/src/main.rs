// This binary entry point stays intentionally empty — all setup lives in
// lib.rs's `run()` so the same lib target can be reused by a future
// mobile (Android/iOS) Tauri build, which needs a different entry point
// than a plain `fn main()`.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Force WebKit to fall back to software rendering/compositing to prevent
    // EGL/DMABUF crashes on Wayland systems (e.g. NixOS) when bundled in an AppImage
    std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1");
    
    mdrrmo_emergency_response_app_lib::run();
}
