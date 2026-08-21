export const environment = {
  production: true,
  apiUrl: 'https://nuclei-oil-modular.ngrok-free.dev/api',

  // ── Laravel Reverb (WebSocket) ─────────────────────────────────────────
  // In production, Nginx on the same host proxies /app/ → reverb container,
  // so the browser connects to the same ngrok hostname it already uses for
  // the REST API. Port 443 + https because ngrok terminates TLS.
  reverbKey: 'xlq16kh4sisuz0kwe3sq',
  reverbHost: 'nuclei-oil-modular.ngrok-free.dev',
  reverbPort: 443,
  reverbScheme: 'https',
};
