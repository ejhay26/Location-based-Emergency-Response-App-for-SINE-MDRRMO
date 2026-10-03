export const environment = {
  production: false,
  apiUrl: 'http://159.223.42.159:3000/api',
  mapTileUrl: 'http://159.223.42.159:3000/tiles/osm/{z}/{x}/{y}.png',
  satelliteTileUrl: 'http://159.223.42.159:3000/tiles/satellite/{z}/{y}/{x}.jpg',

  // ── SINE Real-Time WebSocket Engine ─────────────────────────────────────
  // High-performance embedded WebSocket server on port 3000
  reverbKey: '6bc0e7b80b37c8d8d8f8',
  reverbHost: '159.223.42.159',
  reverbPort: 3000,
  reverbScheme: 'http',
};
