# Troubleshooting

Common issues when setting up or running the project locally. Each one below is collapsed — click to expand.

## Backend

<details>
<summary><b>MySQL/MariaDB SSL error (error 2026)</b></summary>

If `php artisan migrate` or any DB connection fails with an SSL-related error, add the right SSL options to your MySQL PDO connection, or turn off SSL enforcement for local connections in your MariaDB config. This usually only shows up with certain MariaDB versions/client library combos on Windows.

</details>

<details>
<summary><b>"Class not found" / Composer autoload errors</b></summary>

```bash
composer dump-autoload
```

</details>

<details>
<summary><b>Composer install fails on platform requirements</b></summary>

```bash
composer install --ignore-platform-reqs
```
Usually happens when the PHP version Composer sees doesn't match what `composer.json` asks for.

</details>

<details>
<summary><b>Images/uploads return 404</b></summary>

The public storage symlink is missing or broken. Re-run:
```bash
php artisan storage:link
```
On Windows, you may need to run the terminal as Administrator for this to work.

</details>

<details>
<summary><b>OTP emails never arrive</b></summary>

- Check that `MAIL_PASSWORD` in `.env` is an **app password**, not your regular account password (Gmail SMTP requires this).
- Check `backend/storage/logs/laravel.log` for mail errors.
- See [Environment Variables](./environment.md#mail-otp-emails).

</details>

<details>
<summary><b>Updating PHP inside XAMPP to a newer version</b></summary>

XAMPP doesn't have a built-in "update PHP" button — you have to swap the `php` folder yourself. General steps:

1. **Stop everything first.** Close XAMPP Control Panel and make sure Apache and MySQL aren't running.
2. **Back up what you'll need again.** Before deleting anything, copy out the files you'll want to reuse — mainly `php.ini` (so you don't lose your extension settings and custom config) and any custom extensions you added by hand.
3. **Remove the old PHP folder.** Delete (or rename, if you want a safety net) the existing `xampp/php` folder.
4. **Unzip the new PHP version.** Download the matching PHP zip package (same architecture — usually x64 — and thread-safe build if that's what XAMPP expects), then extract it into `xampp/php`, replacing the folder you removed.
5. **Restore your settings.** Copy your backed-up `php.ini` back in, or manually re-apply the extension lines you had uncommented before — see the "Required PHP extensions — Windows (XAMPP)" section in the [Installation Guide](./installation.md).
6. **Restart Apache and MySQL** and confirm the version with `php -v` or by checking the phpMyAdmin footer.

If something breaks after the swap, it's almost always a missing extension or a mismatched `php.ini` — compare it against a fresh copy of `php.ini-production`/`php.ini-development` from the new PHP package to spot what's missing.

</details>

## Frontend

<details>
<summary><b>Android build fails with a cleartext (HTTP) network error</b></summary>

Android blocks plain HTTP by default. Make sure `android:usesCleartextTraffic="true"` is set in `AndroidManifest.xml` when testing locally against a non-HTTPS backend (e.g. `php artisan serve` or ngrok without TLS).

</details>

<details>
<summary><b>Blank map / map not showing after switching tabs</b></summary>

This project renders the Leaflet map using `[hidden]` bindings instead of `*ngIf`, specifically to avoid a Leaflet bug where the map goes blank if its container gets destroyed and rebuilt when switching tabs. If you're building more map-based pages, stick to the same pattern.

</details>

<details>
<summary><b><code>node_modules</code> acting up after a pull</b></summary>

Delete `frontend/node_modules` and reinstall:
```bash
rm -rf node_modules
npm install
```

</details>

<details>
<summary><b>Ionic CLI not found</b></summary>

```bash
npm install -g @ionic/cli
```

</details>

## General

<details>
<summary><b>Backend and frontend can't reach each other</b></summary>

Make sure both are running (`localhost:8000` for Laravel, `localhost:8100` for Ionic) and that `APP_URL` / your frontend's API base URL match the setup you're testing (local vs. ngrok vs. deployed).

</details>

<details>
<summary><b>Still stuck?</b></summary>

Check `backend/storage/logs/laravel.log` for backend errors, and your browser/Ionic DevTools console for frontend errors — most issues show up clearly in one of the two.

</details>
