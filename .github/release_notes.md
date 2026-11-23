### Direct Application Downloads

| Platform | Target | Download | Format |
|:---:|:---|:---|:---:|
| <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/android/android-original.svg" width="18" height="18" alt="Android" /> | Android 7.0+ | [Download APK](https://github.com/ejhay26/Location-based-Emergency-Response-App-for-SINE-MDRRMO/releases/download/v0.99.4/SAGIP_0.99.4_android.apk) | `.apk` |
| <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/windows11/windows11-original.svg" width="18" height="18" alt="Windows" /> | Windows 10/11 x64 | [Download Setup](https://github.com/ejhay26/Location-based-Emergency-Response-App-for-SINE-MDRRMO/releases/download/v0.99.4/SAGIP_0.99.4_x64-setup.exe) | `.exe` |
| <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/windows11/windows11-original.svg" width="18" height="18" alt="Windows" /> | Windows Portable | [Download Portable](https://github.com/ejhay26/Location-based-Emergency-Response-App-for-SINE-MDRRMO/releases/download/v0.99.4/SAGIP_0.99.4_x64-portable.exe) | `.exe` |
| <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/apple/apple-original.svg" width="18" height="18" alt="macOS" /> | macOS Universal | [Download DMG](https://github.com/ejhay26/Location-based-Emergency-Response-App-for-SINE-MDRRMO/releases/download/v0.99.4/SAGIP_0.99.4_universal.dmg) | `.dmg` |
| <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/apple/apple-original.svg" width="18" height="18" alt="macOS" /> | Apple Silicon (M1-M4) | [Download DMG](https://github.com/ejhay26/Location-based-Emergency-Response-App-for-SINE-MDRRMO/releases/download/v0.99.4/SAGIP_0.99.4_aarch64.dmg) | `.dmg` |
| <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/apple/apple-original.svg" width="18" height="18" alt="macOS" /> | Intel Mac x64 | [Download DMG](https://github.com/ejhay26/Location-based-Emergency-Response-App-for-SINE-MDRRMO/releases/download/v0.99.4/SAGIP_0.99.4_x64.dmg) | `.dmg` |
| <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/linux/linux-original.svg" width="18" height="18" alt="Linux" /> | Debian / Ubuntu x64 | [Download DEB](https://github.com/ejhay26/Location-based-Emergency-Response-App-for-SINE-MDRRMO/releases/download/v0.99.4/SAGIP_0.99.4_amd64.deb) | `.deb` |
| <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/linux/linux-original.svg" width="18" height="18" alt="Linux" /> | Standalone AppImage | [Download AppImage](https://github.com/ejhay26/Location-based-Emergency-Response-App-for-SINE-MDRRMO/releases/download/v0.99.4/SAGIP_0.99.4_amd64.AppImage) | `.AppImage` |
| <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/linux/linux-original.svg" width="18" height="18" alt="Linux" /> | Linux ARM64 / RPi | [Download DEB](https://github.com/ejhay26/Location-based-Emergency-Response-App-for-SINE-MDRRMO/releases/download/v0.99.4/SAGIP_0.99.4_arm64.deb) | `.deb` |
| <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/linux/linux-original.svg" width="18" height="18" alt="Linux" /> | Linux ARM64 AppImage | [Download AppImage](https://github.com/ejhay26/Location-based-Emergency-Response-App-for-SINE-MDRRMO/releases/download/v0.99.4/SAGIP_0.99.4_aarch64.AppImage) | `.AppImage` |

---

### What's New in v0.99.4

- **Multi-Department Dispatch Dialog**: Replaced scrollable dispatch bottom sheet with a centered dialog box supporting multi-agency selection (e.g., BFP + RHU Medical together), multi-unit callsign chips, and smart department auto-preselection by incident type.
- **Live ID-Card Camera Viewfinder**: In-app fullscreen camera canvas locked to landscape card ratio (`1.586:1`) with native system camera fallback on mobile browsers.
- **Registration Flow & Clean UI**: Moved Terms & Conditions agreement to Step 1, added animated password checklist and graphical ID guides, and removed AI sparkle icons from UI badges.
- **Brevo Mail & Unified Server Sync**: Switched OTP/notification mailer to Brevo HTTP API, synced backend/frontend SQLite/analytics compatibility, and updated environment endpoints.

### What's New in v0.93.4

- **Application Rebrand & Identity (SAGIP)**: Rebranded from generic emergency app to **SAGIP** with new official brand icon and identity across desktop, mobile, and web distributions.
- **Philippine Standard Time (00:00 - 23:59 PHT) Calendar Synchronization**: Citizen report history, admin incident map filters, log archive records, and analytics trend graphs now strictly align with Philippine calendar days (Asia/Manila, UTC+8) instead of rolling 24-hour windows.
- **Citizen History Hazard Support**: Date filters in citizen report history now correctly index both emergency requests and community hazard submissions.
- **Log Archive & Analytics Official PDF Situational Reports**: Certified export workflow with editable titles, signatory details, operational notes, and high-resolution official MDRRMO branding.
- **Incident Map Morphic Fullscreen & Controls**: Fluid cubic-bezier transitions between split pane and immersive views, persistent report selection focus across background syncs, preserved queue visibility state, high-specificity selected card borders, unified dock with Street/Satellite toggle, custom Zoom controls, and responsive mobile horizontal cluster snapping.
- **Customizable Shortcuts & Conflict Guard**: Interactive key recording engine supporting custom modifiers and function keys, conflict detection, and individual row resets.
- **Per-Incident Audio Alert Library**: 16 categorized alert tones with individual volume sliders and live preview test capability.
- **Realistic Cartography Previews**: OpenStreetMap and satellite aerial textures in display settings.
- **Calendar Filter Streamlining**: Clean date selection without preset button clutter.
- **Log Archive Card Audit Alignment**: Clean typographical status presentation without box borders.
- **Analytics Charts & PDF Report Fix**: Barangay and type charts (emergency and hazard) and the exported PDF report now read the correct count field, so values no longer appear empty or undefined.
- **Lightbox Mouse Drag**: Zoomed images can be panned by dragging with the mouse on desktop.
- **Tablet Splitter Touch Support**: The Incident Map drag handle now responds to touch on tablets.
- **Desktop Notification Permission**: Notification permission is requested again on the next user interaction if the first automatic request was blocked.
- **Help Panel Icon**: The Help panel card icon now displays correctly.
- **Go Fiber Backend Synchronization**: Live server binary synchronized with Philippine timezone calendar-day analytics aggregations and fallback count metrics.
