// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  apiUrl: 'https://nuclei-oil-modular.ngrok-free.dev/api',

  // ── Laravel Reverb (WebSocket) ─────────────────────────────────────────
  // Dev (ng serve): connect directly to Reverb on port 6001, bypassing
  // Nginx entirely — Nginx only runs inside the Docker/Podman stack.
  // The Nginx /app/ proxy is only needed in the containerised stack where
  // the browser can't reach the reverb container directly.
  //
  // When running the full Podman stack locally, switch to:
  //   reverbHost: 'localhost', reverbPort: 8080  (goes through Nginx proxy)
  //
  // reverbKey must match REVERB_APP_KEY in backend/.env exactly.
  reverbKey: 'xlq16kh4sisuz0kwe3sq',
  reverbHost: 'localhost',
  reverbPort: 6001,
  reverbScheme: 'http',
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
