# System Requirements

What you need to actually run this app, depending on which side you're on. This is separate from the [Installation Guide](./installation.md), which is about setting up a local dev copy — this page is about what devices/OS versions the finished app supports.

## Citizen App (Mobile)

| Platform | Minimum version | Notes |
|---|---|---|
| Android | **Android 7.0 (API 24)** or newer | Set by `minSdkVersion` in `frontend/android/variables.gradle`. Built and tested against target SDK 36 (Android 16). |
| iOS | **iOS 15.0** or newer | Set by `IPHONEOS_DEPLOYMENT_TARGET` in the Xcode project. |

If a citizen asks "will this work on my phone" — as long as their Android is 7.0+ or their iPhone is on iOS 15+, yes. Anything older than that isn't supported out of the box (you'd have to lower the minimum SDK/deployment target yourself, which may break some plugins).

Also needed on the device:
- Internet connection (mobile data or Wi-Fi) — the app talks to the backend API over HTTPS
- Location permission — required for SOS and hazard reporting to work at all
- Camera permission — required for the anti-prank live photo/video capture on SOS

## Admin / Dispatcher Dashboard

This is a **native desktop app only** — there's no hosted web version, and no browser access. That's a deliberate choice: it avoids paying for frontend hosting, since the app is distributed as a downloadable install rather than served from a public URL. It's built with Electron (`electron-builder`), targeting:

| OS | Package formats |
|---|---|
| Windows | NSIS installer, portable `.exe` |
| macOS | `.dmg`, `.zip` |
| Linux | AppImage, `.deb`, `.tar.gz` |

There's no strict "minimum Windows version" pinned in the project — Electron itself (currently v42) generally needs **Windows 10 or later**, **macOS 11+**, or a reasonably modern Linux distro. If a dispatcher asks whether their older Windows machine can run the desktop app, Windows 10/11 is the safe answer; anything older isn't guaranteed to work.

The backend API still needs to be reachable over the internet for the desktop app to talk to it (see [Production Deployment](../deployment/production.md)) — only the *frontend* skips hosting, not the API.

## Backend Server (for whoever's hosting it)

| Requirement | Version |
|---|---|
| PHP | 8.3+ |
| Laravel | 13 |
| Database | MariaDB or MySQL (any version compatible with Laravel 13's query builder) |
| Docker | Required only for the containerized production deployment — see [Production Deployment](../deployment/production.md) |

## Quick Answer Table

| Who's asking | Answer |
|---|---|
| "Does my Android phone support this?" | Android 7.0 or newer — yes |
| "Does my iPhone support this?" | iOS 15 or newer — yes |
| "Can I use this on my office Windows PC?" | Yes, via the desktop app install (Windows 10+) — no browser version exists |
| "Can I use this on Mac/Linux as an admin?" | Yes — native desktop builds exist for both too |
