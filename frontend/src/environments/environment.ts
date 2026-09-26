export const environment = {
  production: false,
  apiUrl: 'http://159.223.42.159/api',
  mapTileUrl: 'http://159.223.42.159/tiles/osm/{z}/{x}/{y}.png',
  satelliteTileUrl: 'http://159.223.42.159/tiles/satellite/{z}/{y}/{x}.jpg',

  // ── Laravel Reverb (WebSocket) ─────────────────────────────────────────
  // Proxied through Nginx on standard HTTP port 80.
  reverbKey: '6bc0e7b80b37c8d8d8f8',
  reverbHost: '159.223.42.159',
  reverbPort: 80,
  reverbScheme: 'http',
};
