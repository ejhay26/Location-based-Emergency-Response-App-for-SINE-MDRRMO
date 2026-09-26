#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "linux")]
    {
        // WebKitGTK DMA-BUF renderer compatibility fix for Linux (NixOS, Wayland, NVIDIA, Mesa):
        // WebKitGTK defaults to DMA-BUF hardware acceleration which aborts with `EGL_BAD_PARAMETER`
        // on NixOS FHS containers (appimage-run) and diverse GPU driver setups, resulting in a blank white window.
        // Disabling the DMA-BUF renderer falls back to standard shared memory / EGL compositing cleanly.
        if std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none() {
            std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        }
    }

    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
