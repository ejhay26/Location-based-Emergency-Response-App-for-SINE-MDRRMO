### Direct Application Downloads

| Platform | Target | Download | Format |
|:---:|:---|:---|:---:|
| <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/android/android-original.svg" width="18" height="18" alt="Android" /> | Android 7.0+ | [Download APK](https://github.com/ejhay26/Location-based-Emergency-Response-App-for-SINE-MDRRMO/releases/download/v0.99.5/SAGIP_0.99.5_android.apk) | `.apk` |
| <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/windows11/windows11-original.svg" width="18" height="18" alt="Windows" /> | Windows 10/11 x64 | [Download Setup](https://github.com/ejhay26/Location-based-Emergency-Response-App-for-SINE-MDRRMO/releases/download/v0.99.5/SAGIP_0.99.5_x64-setup.exe) | `.exe` |
| <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/windows11/windows11-original.svg" width="18" height="18" alt="Windows" /> | Windows Portable | [Download Portable](https://github.com/ejhay26/Location-based-Emergency-Response-App-for-SINE-MDRRMO/releases/download/v0.99.5/SAGIP_0.99.5_x64-portable.exe) | `.exe` |
| <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/apple/apple-original.svg" width="18" height="18" alt="macOS" /> | macOS Universal | [Download DMG](https://github.com/ejhay26/Location-based-Emergency-Response-App-for-SINE-MDRRMO/releases/download/v0.99.5/SAGIP_0.99.5_universal.dmg) | `.dmg` |
| <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/apple/apple-original.svg" width="18" height="18" alt="macOS" /> | Apple Silicon (M1-M4) | [Download DMG](https://github.com/ejhay26/Location-based-Emergency-Response-App-for-SINE-MDRRMO/releases/download/v0.99.5/SAGIP_0.99.5_aarch64.dmg) | `.dmg` |
| <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/apple/apple-original.svg" width="18" height="18" alt="macOS" /> | Intel Mac x64 | [Download DMG](https://github.com/ejhay26/Location-based-Emergency-Response-App-for-SINE-MDRRMO/releases/download/v0.99.5/SAGIP_0.99.5_x64.dmg) | `.dmg` |
| <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/linux/linux-original.svg" width="18" height="18" alt="Linux" /> | Debian / Ubuntu x64 | [Download DEB](https://github.com/ejhay26/Location-based-Emergency-Response-App-for-SINE-MDRRMO/releases/download/v0.99.5/SAGIP_0.99.5_amd64.deb) | `.deb` |
| <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/linux/linux-original.svg" width="18" height="18" alt="Linux" /> | Standalone AppImage | [Download AppImage](https://github.com/ejhay26/Location-based-Emergency-Response-App-for-SINE-MDRRMO/releases/download/v0.99.5/SAGIP_0.99.5_amd64.AppImage) | `.AppImage` |
| <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/linux/linux-original.svg" width="18" height="18" alt="Linux" /> | Linux ARM64 / RPi | [Download DEB](https://github.com/ejhay26/Location-based-Emergency-Response-App-for-SINE-MDRRMO/releases/download/v0.99.5/SAGIP_0.99.5_arm64.deb) | `.deb` |
| <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/linux/linux-original.svg" width="18" height="18" alt="Linux" /> | Linux ARM64 AppImage | [Download AppImage](https://github.com/ejhay26/Location-based-Emergency-Response-App-for-SINE-MDRRMO/releases/download/v0.99.5/SAGIP_0.99.5_aarch64.AppImage) | `.AppImage` |

---

### What's New in v0.99.5

- **Incident Map Scroll Zoom & Popup Framing**: Tuned Leaflet scroll-wheel debounce/snap and expanded boundary padding (`0.75`) so zooming stays smooth, plus added a vertical camera offset (`170px` north) and top clearance padding so overhead pin popup headers never clip behind the top bar or controls dock.
- **San Isidro Boundary Accuracy**: Relocated all seeded emergency and hazard report coordinates inside verified San Isidro, Nueva Ecija barangay GeoJSON polygon boundaries.
- **Refined Incident Map & Dispatch Color System**: Unified Dispatch buttons to Brand Red (`#d32f2f`), paired Resolve actions with clean emerald hierarchy, neutral dispatched info cards, and crisp amber hazard resolution controls.
- **Unified Dialog Enter/Exit Animations, Blur & ESC Key**: Added matching blurred backdrops, GPU-composited enter/exit transitions, and `ESC` dismissal across the Dispatch dialog, Citizens Strike modal, Dispatchers modal, Analytics Export modal, and Log Archive Export modal.
- **Sequential Single-Click Launcher**: Unified startup sequence in `SAGIP-Server.bat` / `server.exe` (`[1/3] Database -> [2/3] Backend/Frontend -> [3/3] Ngrok`) and published clean single-version release notes.
