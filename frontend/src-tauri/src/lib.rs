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
        .setup(|app| {
            #[cfg(desktop)]
            {
                use tauri::Manager;
                if let Some(window) = app.get_webview_window("main") {
                    let win = window.clone();
                    // Safety net: JS in main.ts reveals the window as soon as the DOM splash is mounted (~200ms).
                    // In case of an unexpected frontend freeze or crash, force-show after 2.5s so it never hangs.
                    std::thread::spawn(move || {
                        std::thread::sleep(std::time::Duration::from_millis(2500));
                        let _ = win.show();
                    });
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
