use tauri::http::{Response, StatusCode};

/// OSM TILE FIX — Tauri equivalent of the Electron main.js
/// `session.defaultSession.webRequest.onBeforeSendHeaders` intercept.
///
/// Electron had to strip the `Referer` header and set a browser-like
/// `User-Agent` because tiles were being requested from a `file://`
/// origin, which OSM's CDN rejects. Here we sidestep the problem
/// entirely: instead of Leaflet requesting `https://*.tile.openstreetmap.org/...`
/// directly from the webview, its tile URL template points at our own
/// `osmtile://` scheme (see `incident-map.panel.ts`), which this handler
/// registers. Requests never leave the webview looking like a browser
/// request at all — they're re-fetched here in Rust via `reqwest` (which
/// has no `Referer` of its own to send) with an explicit `User-Agent`,
/// and the resulting image bytes are handed back to the webview as if
/// they'd come from a normal same-origin resource.
fn register_osm_tile_protocol(builder: tauri::Builder<tauri::Wry>) -> tauri::Builder<tauri::Wry> {
    builder.register_asynchronous_uri_scheme_protocol("osmtile", move |_app, request, responder| {
        // request.uri() looks like: osmtile://a.tile.openstreetmap.org/14/1234/5678.png
        let upstream_url = request.uri().to_string().replacen("osmtile://", "https://", 1);

        tauri::async_runtime::spawn(async move {
            let client = reqwest::Client::new();
            let result = client
                .get(&upstream_url)
                .header(
                    "User-Agent",
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 \
                     (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                )
                .header("Accept", "image/avif,image/webp,image/apng,image/*,*/*;q=0.8")
                .send()
                .await;

            let response = match result {
                Ok(upstream_resp) => {
                    let status = upstream_resp.status().as_u16();
                    match upstream_resp.bytes().await {
                        Ok(bytes) => Response::builder()
                            .status(StatusCode::from_u16(status).unwrap_or(StatusCode::OK))
                            .header("Content-Type", "image/png")
                            .body(bytes.to_vec())
                            .unwrap(),
                        Err(_) => Response::builder()
                            .status(StatusCode::BAD_GATEWAY)
                            .body(Vec::new())
                            .unwrap(),
                    }
                }
                Err(_) => Response::builder()
                    .status(StatusCode::BAD_GATEWAY)
                    .body(Vec::new())
                    .unwrap(),
            };

            responder.respond(response);
        });
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();
    let builder = register_osm_tile_protocol(builder);

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
