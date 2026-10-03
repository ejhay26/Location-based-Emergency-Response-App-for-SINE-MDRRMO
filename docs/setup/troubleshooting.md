# Troubleshooting Guide

Common issues, error codes, and step-by-step solutions when developing, running, or deploying the SINE MDRRMO Emergency Response App.

---

## 1. Backend & Server Issues

<details>
<summary><b>1.1 Embedded WebSocket Connection Refused or Failing</b></summary>

**Symptoms:** Frontend console shows `WebSocket connection to 'ws://...' failed` or `Echo could not connect`.

**Solutions:**
1. **Check Backend Process:** Ensure the Go Fiber service is running:
   ```bash
   # On VPS
   systemctl status backend.service

   # In Local Development
   go run main.go
   ```
2. **Key Mismatch:** Confirm `REVERB_APP_KEY` in `backend/.env` matches `environment.reverbKey` in `frontend/src/environments/environment.ts` (`6bc0e7b80b37c8d8d8f8`).
3. **Firewall / Port Access:** Ensure port `3000` is open on your VPS firewall:
   ```bash
   sudo ufw allow 3000/tcp
   sudo ufw status
   ```
4. **WebSocket Endpoint Verification:** You can verify the WebSocket endpoint using curl:
   ```bash
   curl -i "http://159.223.42.159:3000/app/6bc0e7b80b37c8d8d8f8?protocol=7&client=js&version=8.4.0"
   ```
   A response of `HTTP/1.1 426 Upgrade Required` confirms the WebSocket server is active and awaiting client handshake.

</details>

<details>
<summary><b>1.2 PhilSMS OTP SMS Not Arriving</b></summary>

**Symptoms:** User registers or requests login OTP via phone, but no SMS arrives.

**Solutions:**
1. **API Token:** Verify `PHILSMS_API_TOKEN` is configured in `backend/.env` without leading `Bearer` keyword (the service adds the Bearer header automatically).
2. **Account Credits:** Log in to [dashboard.philsms.com](https://dashboard.philsms.com) and check your available SMS credit balance.
3. **Number Format:** The system automatically normalizes Philippine mobile numbers (`0917...` or `+63917...` to `63917...`). Check the backend service logs via `journalctl -u backend -f` for any PhilSMS gateway rejection messages.

</details>

<details>
<summary><b>1.3 Email OTP Delivery via Resend</b></summary>

**Symptoms:** Verification code email does not appear in the user's inbox.

**Solutions:**
1. **Resend API Key:** Ensure `RESEND_API_KEY` is populated in `backend/.env`.
2. **Sandbox Recipient Restrictions:** When using Resend's default free test domain (`onboarding@resend.dev`), Resend only permits sending to the account owner's registered email. To send to arbitrary email addresses (e.g. citizens), verify a custom sending domain at [resend.com/domains](https://resend.com/domains) and update `MAIL_FROM_ADDRESS` in `.env`.
3. **Test CLI:** You can test email delivery directly from the command line:
   ```bash
   ./server test-mail recipient@example.com
   ```

</details>

<details>
<summary><b>1.4 Uploaded Images / Proof Photos Return 404</b></summary>

**Symptoms:** Valid ID photos, SOS evidence, or user avatars fail to load in the browser or dashboard.

**Solutions:**
1. **Storage Path:** Verify `STORAGE_PATH` in `backend/.env` points to the directory where uploads are stored (e.g. `/var/www/sine-storage/app/public` in production).
2. **Permissions:** Ensure the storage folder is readable and writable by the backend process:
   ```bash
   sudo chown -R root:www-data /var/www/sine-storage
   sudo chmod -R 775 /var/www/sine-storage
   ```
3. **Storage Route:** Go Fiber automatically serves files located under the public storage path via `http://host:3000/storage/...` and `http://host:3000/storage-proxy/...`.

</details>

<details>
<summary><b>1.5 Database Migrations & Initial Seed Data</b></summary>

**Symptoms:** Fresh database installation is missing schema tables or reference lookup records (Barangays, Incident Types, Responders, Vehicles).

**Solutions:**
1. The Go Fiber backend automatically executes `AutoMigrate()` and runs `Seed()` on startup.
2. If running locally against an empty database:
   ```bash
   cd backend
   go run main.go
   ```
   All 16 tables are created and seeded with San Isidro barangays, default responders, incident types, and fleet vehicles immediately.

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
<summary><b>2.2 Leaflet Map Blank / Tile Disappearance</b></summary>

**Symptoms:** Map renders gray tiles or disappears after switching views or resizing.

**Solutions:**
- Always call `map.invalidateSize()` after container dimensions change or tab visibility toggles.
- Custom cached tile layers (`CachedTileLayer`) use browser Cache API (`mdrrmo-tile-cache-v1`) with CORS-compliant fetch requests to prevent tile dropping during flaky network conditions.

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

## 3. Desktop App Issues (Tauri v2)

<details>
<summary><b>3.1 Tauri Compilation & Rust Prerequisites</b></summary>

**Symptoms:** `npm run build:tauri:win` fails with `cargo not found` or `tauri-cli` missing.

**Solutions:**
1. Install Rust via [rustup.rs](https://rustup.rs):
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```
2. Ensure C++ Build Tools are installed on Windows (via Microsoft Visual Studio C++ Build Tools or Build Tools for Visual Studio).
3. Test dev mode with `npm run start:desktop:tauri`.

</details>

<details>
<summary><b>3.2 Window Controls & Titlebar Handling</b></summary>

**Symptoms:** Frameless window controls do not respond to minimize/maximize/close.

**Solutions:**
- Window controls communicate directly via Tauri's `@tauri-apps/api/window` APIs (`getCurrentWindow().minimize()`, etc.).
- In development/browser previews, titlebar controls gracefully fallback with dummy handlers or remain hidden.

</details>
