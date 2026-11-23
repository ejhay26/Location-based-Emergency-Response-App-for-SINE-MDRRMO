export const environment = {
  production: false,
  apiUrl: 'https://nuclei-oil-modular.ngrok-free.dev/api',
  mapTileUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  satelliteTileUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  offlinePmtilesUrl: '',

  // ── SINE Real-Time WebSocket Engine ─────────────────────────────────────
  wsUrl: 'wss://nuclei-oil-modular.ngrok-free.dev/ws',
  reverbKey: '6bc0e7b80b37c8d8d8f8',
  reverbHost: 'nuclei-oil-modular.ngrok-free.dev',
  reverbPort: 443,
  reverbScheme: 'https',
};
