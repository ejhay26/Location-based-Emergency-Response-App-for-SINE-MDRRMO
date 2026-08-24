export const environment = {
  production: true,
  apiUrl: 'http://159.223.42.159/api',

  // ── Laravel Reverb (WebSocket) ─────────────────────────────────────────
  // In production, Nginx on standard HTTP port 80 proxies /app/ → reverb container.
  reverbKey: '6bc0e7b80b37c8d8d8f8',
  reverbHost: '159.223.42.159',
  reverbPort: 80,
  reverbScheme: 'http',
};
