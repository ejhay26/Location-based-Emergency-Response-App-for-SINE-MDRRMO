# Troubleshooting Guide

Common issues, error codes, and step-by-step solutions when developing, running, or deploying the SINE MDRRMO Emergency Response App.

---

## 1. Backend & Server Issues

<details>
<summary><b>1.1 Laravel Reverb WebSocket Connection Refused or Failing</b></summary>

**Symptoms:** Frontend console shows `WebSocket connection to 'ws://...' failed` or `Echo could not connect`.

**Solutions:**
1. **Check Reverb Process:** Ensure the Reverb worker is running:
   ```bash
   php artisan reverb:start --host=0.0.0.0 --port=6001
   ```
2. **Key Mismatch:** Confirm `REVERB_APP_KEY` in `backend/.env` matches `environment.reverbKey` in `frontend/src/environments/environment.ts` exactly.
3. **Nginx Proxy Config:** In production or containerized environments, ensure Nginx forwards WebSocket upgrade headers:
   ```nginx
   location /app/ {
       proxy_pass http://mdrrmo_reverb:6001;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection "upgrade";
       proxy_set_header Host $host;
   }
   ```
4. **Firewall:** If reaching Reverb directly, ensure port `6001` is open on your firewall (`ufw allow 6001/tcp` on Ubuntu/Debian).

</details>

<details>
<summary><b>1.2 PhilSMS OTP SMS Not Arriving</b></summary>

**Symptoms:** User registers or requests login OTP via phone, but no SMS arrives.

**Solutions:**
1. **API Token:** Verify `PHILSMS_API_TOKEN` is configured in `backend/.env` without leading `Bearer` keyword (the service adds the Bearer header automatically).
2. **Account Credits:** Log in to [dashboard.philsms.com](https://dashboard.philsms.com) and check your available SMS credit balance.
3. **Number Format:** The system automatically normalizes Philippine mobile numbers (`0917...` or `+63917...` to `63917...`). Check `backend/storage/logs/laravel.log` for any PhilSMS gateway rejection messages.

</details>

<details>
<summary><b>1.3 Email OTP Never Arrives</b></summary>

**Symptoms:** Verification code email does not appear in the user's inbox.

**Solutions:**
1. **Google App Password:** For Gmail SMTP (`smtp.gmail.com`), you **must** use a 16-character **Google App Password** (generated under *Google Account → Security → 2-Step Verification → App Passwords*), not your standard account password.
2. **Check Logs:** Inspect `backend/storage/logs/laravel.log` for SMTP authentication failure stack traces.

</details>

<details>
<summary><b>1.4 Uploaded Images / Proof Photos Return 404</b></summary>

**Symptoms:** Valid ID photos, SOS evidence, or user avatars fail to load in the browser or dashboard.

**Solutions:**
1. **Symlink:** Recreate the public storage symlink:
   ```bash
   php artisan storage:link
   ```
   *(On Windows, run terminal as Administrator if symlink creation fails).*
2. **S3 / Cloud Storage:** If using Cloudflare R2 or AWS S3 (`FILESYSTEM_DISK=s3`), ensure `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_BUCKET`, and `AWS_ENDPOINT` are set in `.env` and the bucket has public read permissions enabled for the `reports/` and `profiles/` paths.

</details>

<details>
<summary><b>1.5 Missing Reference Data or Fresh Database Setup Errors</b></summary>

**Symptoms:** Registration or dispatch fails because `barangay_id`, `incident_type_id`, responders, or default admin accounts are missing on a fresh database installation.

**Solutions:**
1. Populate all reference lookup tables (Barangays, Incident Types, Responders, Vehicles, and initial Admin/Dispatcher accounts) using Laravel's database seeder:
   ```bash
   php artisan db:seed
   ```
2. For a complete fresh database initialization:
   ```bash
   php artisan migrate --seed
   ```

</details>

---

## 2. Frontend & Mobile Issues (Ionic / Angular / Capacitor)

<details>
<summary><b>2.1 Android Build Cleartext (HTTP) Network Error</b></summary>

**Symptoms:** Android app cannot reach `http://localhost:8000` or an HTTP test IP.

**Solutions:**
- In development against plain HTTP, ensure `android:usesCleartextTraffic="true"` is set inside `<application>` in `frontend/android/app/src/main/AndroidManifest.xml`.
- In production, always use HTTPS (`https://api.yourdomain.com`).

</details>

<details>
<summary><b>2.2 Leaflet Map Blank / Disappears on Tab Switch</b></summary>

**Symptoms:** Map renders gray tiles or disappears after switching between tabs.

**Solutions:**
- Always use `[hidden]="activeTab !== 'map'"` instead of `*ngIf="activeTab === 'map'"` on the Leaflet map container. `*ngIf` destroys and recreates the DOM container, which corrupts Leaflet's tile coordinate calculations.
- Call `map.invalidateSize()` whenever the container changes size or tab visibility toggles.

</details>

<details>
<summary><b>2.3 Android SMS OTP Auto-Fill Not Triggering</b></summary>

**Symptoms:** One-tap SMS consent dialog does not appear when OTP arrives on Android.

**Solutions:**
- The Android SMS User Consent API requires the SMS length to be **under 140 bytes** and sent from an alphanumeric sender (PhilSMS), not in the user's contacts.
- `OtpAutofillService` uses `@capawesome/capacitor-android-sms-retriever`. Ensure you are testing on a real Android device with active cellular service (not an emulator without telephony).

</details>

<details>
<summary><b>2.4 Offline Queue Reports Not Syncing</b></summary>

**Symptoms:** An emergency report submitted while offline remains queued in IndexedDB.

**Solutions:**
- The app checks backend reachability via `NetworkService.recheck()` before flushing the queue.
- Ensure the device has re-established internet connectivity and that `GET /api/health` returns HTTP 200.
- The queue will automatically attempt to flush on the `online` event or app startup.

</details>

---

## 3. Desktop App Issues (Electron)

<details>
<summary><b>3.1 OpenStreetMap Tiles Blocked in Electron</b></summary>

**Symptoms:** Map shows broken image icons or 403 Forbidden errors for OpenStreetMap tiles.

**Solutions:**
- OpenStreetMap tile servers block the `file://` referer sent by Electron by default.
- `frontend/main.js` includes `registerOsmFix()`, which strips the `Referer` header and attaches a standard browser `User-Agent`. Ensure `registerOsmFix()` runs inside `app.whenReady()`.

</details>

<details>
<summary><b>3.2 Window Minimize / Maximize / Close Buttons Not Responding</b></summary>

**Symptoms:** Top titlebar control buttons do not work on desktop.

**Solutions:**
- Because Electron runs with `frame: false` for a modern borderless look, window controls communicate via IPC (`ipcRenderer.send('window:minimize')`, etc.).
- Ensure `nodeIntegration: true` and `contextIsolation: false` are configured in `webPreferences` in `frontend/main.js`.

</details>
