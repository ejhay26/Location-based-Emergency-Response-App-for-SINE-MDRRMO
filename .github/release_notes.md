### Direct Application Downloads

| Platform | Target Architecture | Direct Download Link | Format |
|:---:|:---|:---|:---:|
| <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/android/android-original.svg" width="20" height="20" alt="Android" /> | Android 7.0+ (ARM / x86) | [Download Android Universal APK](https://github.com/ejhay26/Location-based-Emergency-Response-App-for-SINE-MDRRMO/releases/download/v0.93.4/MDRRMO.EMERGENCY.RESPONSE.APP_v0.93.4_android.apk) | `.apk` |
| <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/windows11/windows11-original.svg" width="20" height="20" alt="Windows" /> | Windows 10 / 11 (64-bit) | [Download Windows Setup Installer](https://github.com/ejhay26/Location-based-Emergency-Response-App-for-SINE-MDRRMO/releases/download/v0.93.4/MDRRMO.EMERGENCY.RESPONSE.APP_0.93.4_x64-setup.exe) | `.exe` |
| <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/windows11/windows11-original.svg" width="20" height="20" alt="Windows" /> | Windows 10 / 11 (Portable) | [Download Windows Portable Executable](https://github.com/ejhay26/Location-based-Emergency-Response-App-for-SINE-MDRRMO/releases/download/v0.93.4/MDRRMO.EMERGENCY.RESPONSE.APP_v0.93.4_x64-portable.exe) | `.exe` |
| <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/apple/apple-original.svg" width="20" height="20" alt="macOS" /> | Apple Silicon & Intel Macs | [Download macOS Universal DMG](https://github.com/ejhay26/Location-based-Emergency-Response-App-for-SINE-MDRRMO/releases/download/v0.93.4/MDRRMO.EMERGENCY.RESPONSE.APP_0.93.4_universal.dmg) | `.dmg` |
| <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/apple/apple-original.svg" width="20" height="20" alt="macOS" /> | Apple Silicon only (M1/M2/M3/M4) | [Download macOS Apple Silicon DMG](https://github.com/ejhay26/Location-based-Emergency-Response-App-for-SINE-MDRRMO/releases/download/v0.93.4/MDRRMO.EMERGENCY.RESPONSE.APP_0.93.4_aarch64.dmg) | `.dmg` |
| <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/apple/apple-original.svg" width="20" height="20" alt="macOS" /> | Intel Macs (x64) | [Download macOS Intel DMG](https://github.com/ejhay26/Location-based-Emergency-Response-App-for-SINE-MDRRMO/releases/download/v0.93.4/MDRRMO.EMERGENCY.RESPONSE.APP_0.93.4_x64.dmg) | `.dmg` |
| <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/linux/linux-original.svg" width="20" height="20" alt="Linux" /> | Debian, Ubuntu, Mint (x86_64) | [Download Linux Debian Package](https://github.com/ejhay26/Location-based-Emergency-Response-App-for-SINE-MDRRMO/releases/download/v0.93.4/MDRRMO.EMERGENCY.RESPONSE.APP_0.93.4_amd64.deb) | `.deb` |
| <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/linux/linux-original.svg" width="20" height="20" alt="Linux" /> | All Linux Distros (x86_64) | [Download Linux Standalone AppImage](https://github.com/ejhay26/Location-based-Emergency-Response-App-for-SINE-MDRRMO/releases/download/v0.93.4/MDRRMO.EMERGENCY.RESPONSE.APP_0.93.4_amd64.AppImage) | `.AppImage` |
| <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/linux/linux-original.svg" width="20" height="20" alt="Linux" /> | ARM64 Linux / Raspberry Pi | [Download Linux ARM64 Debian Package](https://github.com/ejhay26/Location-based-Emergency-Response-App-for-SINE-MDRRMO/releases/download/v0.93.4/MDRRMO.EMERGENCY.RESPONSE.APP_0.93.4_arm64.deb) | `.deb` |
| <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/linux/linux-original.svg" width="20" height="20" alt="Linux" /> | ARM64 Linux / Raspberry Pi | [Download Linux ARM64 AppImage](https://github.com/ejhay26/Location-based-Emergency-Response-App-for-SINE-MDRRMO/releases/download/v0.93.4/MDRRMO.EMERGENCY.RESPONSE.APP_0.93.4_aarch64.AppImage) | `.AppImage` |

---

### What's Changed in v0.93.4

- **Incident Map Proximate Clustering**: Grouped active emergencies and hazards within 150m into clean horizontal carousels with location badges.
- **Log Archive Finder Views**: Added macOS Finder-style Grid and List view switcher, eliminating stretched empty audit boxes.
- **Immersive Full-Screen Incident Map**: Moved full-screen map toggle to bottom left and preserved active incident cards as a floating drawer directly over the map.
- **Location Boundary Guarantees**: Proactively prevented out-of-bounds submissions with inline warning banners, snap-to-town shortcuts, and removed spam toasts.
- **Report Modal Discard Dialog Fix**: Corrected premature discard prompts by excluding default coordinates and allowing seamless tutorial progression.
- **Floating SOS Card Minimization**: Added a 5-second initial visibility timer that collapses into a left beacon with quick re-expand and minimize controls.
- **Android App Switching Network Resilience**: Suppressed false offline toasts caused by background socket closures during Android app switching.
- **Interactive UI Sound Controls**: Added dedicated volume sliders, first-gesture audio unlocking for mobile devices, and instant test chime playback.
- **Customizable Responder Callsigns**: Introduced editable responder callsigns and updated interactive guided tours for dispatchers.
- **Desktop Workstation Display Zoom**: Universal keyboard shortcuts (`Ctrl/Cmd +/-/0`) and Settings slider for high-resolution displays.
- **Native OS Desktop Notifications**: Full IPC desktop notification integration across Windows, macOS, and Linux.
