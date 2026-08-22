// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  apiUrl: 'https://nuclei-oil-modular.ngrok-free.dev/api',

  // ── Laravel Reverb (WebSocket) ─────────────────────────────────────────
  // Proxied through Nginx on port 8080 via the single ngrok tunnel.
  // Port 443 + https because ngrok terminates TLS for both REST and WebSockets.
  reverbKey: 'xlq16kh4sisuz0kwe3sq',
  reverbHost: 'nuclei-oil-modular.ngrok-free.dev',
  reverbPort: 443,
  reverbScheme: 'https',
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
