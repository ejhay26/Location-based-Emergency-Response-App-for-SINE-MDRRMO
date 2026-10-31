### Direct Downloads

- **Android**: [Download Universal APK (v0.93.4)](https://github.com/ejhay26/Location-based-Emergency-Response-App-for-SINE-MDRRMO/releases/download/v0.93.4/MDRRMO.EMERGENCY.RESPONSE.APP_v0.93.4_android.apk) *(Android 7.0+, ARM and x86)*
- **Windows (x64)**: [Setup Installer (.exe)](https://github.com/ejhay26/Location-based-Emergency-Response-App-for-SINE-MDRRMO/releases/download/v0.93.4/MDRRMO.EMERGENCY.RESPONSE.APP_0.93.4_x64-setup.exe) | [Portable (.exe)](https://github.com/ejhay26/Location-based-Emergency-Response-App-for-SINE-MDRRMO/releases/download/v0.93.4/MDRRMO.EMERGENCY.RESPONSE.APP_v0.93.4_x64-portable.exe)
- **macOS**: [Universal DMG](https://github.com/ejhay26/Location-based-Emergency-Response-App-for-SINE-MDRRMO/releases/download/v0.93.4/MDRRMO.EMERGENCY.RESPONSE.APP_0.93.4_universal.dmg) | [Apple Silicon DMG](https://github.com/ejhay26/Location-based-Emergency-Response-App-for-SINE-MDRRMO/releases/download/v0.93.4/MDRRMO.EMERGENCY.RESPONSE.APP_0.93.4_aarch64.dmg) | [Intel DMG](https://github.com/ejhay26/Location-based-Emergency-Response-App-for-SINE-MDRRMO/releases/download/v0.93.4/MDRRMO.EMERGENCY.RESPONSE.APP_0.93.4_x64.dmg)
- **Linux (x64)**: [Debian (.deb)](https://github.com/ejhay26/Location-based-Emergency-Response-App-for-SINE-MDRRMO/releases/download/v0.93.4/MDRRMO.EMERGENCY.RESPONSE.APP_0.93.4_amd64.deb) | [AppImage](https://github.com/ejhay26/Location-based-Emergency-Response-App-for-SINE-MDRRMO/releases/download/v0.93.4/MDRRMO.EMERGENCY.RESPONSE.APP_0.93.4_amd64.AppImage)
- **Linux (ARM64)**: [Debian (.deb)](https://github.com/ejhay26/Location-based-Emergency-Response-App-for-SINE-MDRRMO/releases/download/v0.93.4/MDRRMO.EMERGENCY.RESPONSE.APP_0.93.4_arm64.deb) | [AppImage](https://github.com/ejhay26/Location-based-Emergency-Response-App-for-SINE-MDRRMO/releases/download/v0.93.4/MDRRMO.EMERGENCY.RESPONSE.APP_0.93.4_aarch64.AppImage)

---

### What's Changed in v0.93.4

- **Incident Audio Alert Profiles**: Configurable audible alert tones per incident type (Fire, Flood, Medical, Crime, Accident, Hazard) with volume control, immediate sound preview, and user-gesture audio unlock.
- **Log Archive Finder Views & Motion**: Added Grid and List view switcher with elevation and spring hover transitions matching the admin management panels.
- **Incident Map Proximate Clustering**: Grouped active emergencies and hazards within 150m into a horizontal carousel to avoid map pin clutter.
- **Immersive Full-Screen Incident Map**: Full-screen map workspace with floating incident card overlay.
- **Location Boundary Verification**: Warning banner and snap-to-town center controls to prevent out-of-bounds report submissions.
- **Report Modal Discard Dialog Fix**: Prevented premature discard confirmations by properly ignoring pre-filled GPS coordinates.
- **Floating SOS Card Minimization**: 5-second initial visibility timer that automatically docks to a left beacon with quick expand and minimize toggles.
- **Android App Switching Network Resilience**: Suppressed false disconnect toasts triggered by background WebSocket pauses during app switching.
- **Customizable Responder Callsigns**: Editable responder callsign tags with persistent local configuration and guided tours.
- **Desktop Display Zoom**: Universal keyboard shortcuts (`Ctrl/Cmd +/-/0`) and settings slider for high-resolution displays.
- **Native OS Desktop Notifications**: Cross-platform desktop alert notifications on Windows, macOS, and Linux.
