# Desktop Workstation Keyboard Shortcuts & Quick Search Guide

This guide documents the native keyboard shortcuts, macOS-style fluid accordion animations, and Apple Spotlight-style **Quick Search & Command Palette** engineered for **MDRRMO Administrators and Dispatchers** running the desktop application on Windows, macOS, and Linux.

---

## 1. Global Keyboard Shortcuts Reference

The desktop application intercepts native workstation hotkeys to optimize emergency dispatch speeds and minimize mouse dependency.

| Shortcut (Windows / Linux) | Shortcut (macOS) | Target / Action | Description |
| :--- | :--- | :--- | :--- |
| <kbd>Ctrl</kbd> + <kbd>,</kbd> | <kbd>⌘</kbd> + <kbd>,</kbd> | **Settings Panel** | Instantly navigates to the administrative system settings, audio alert preferences, and appearance configurations. |
| <kbd>F1</kbd> | <kbd>F1</kbd> or <kbd>⌘</kbd> + <kbd>?</kbd> | **Help & Procedures Panel** | Opens the MDRRMO standard operating procedures, operator checklists, and interactive guided tours (suppresses browser help). |
| <kbd>Ctrl</kbd> + <kbd>F</kbd> or <kbd>Ctrl</kbd> + <kbd>K</kbd> | <kbd>⌘</kbd> + <kbd>F</kbd> or <kbd>⌘</kbd> + <kbd>K</kbd> | **Spotlight Command Palette** | Disables the native browser find bar and opens the custom **Quick Search & Command Palette** overlay. |
| <kbd>Ctrl</kbd> + <kbd>B</kbd> | <kbd>⌘</kbd> + <kbd>B</kbd> | **Toggle Sidebar** | Collapses or expands the left navigation menu between icon-only compact mode and full-width navigation. |
| <kbd>Ctrl</kbd> + <kbd>D</kbd> | <kbd>⌘</kbd> + <kbd>D</kbd> | **Toggle Dark / Light Mode** | Seamlessly switches between the night-shift dark workstation interface and the high-contrast light theme. |
| <kbd>Ctrl</kbd> + <kbd>N</kbd> | <kbd>⌘</kbd> + <kbd>N</kbd> | **New Announcement Composer** | Navigates to the Alert Broadcast panel and smoothly stretches open the announcement composer card. |
| <kbd>Ctrl</kbd> + <kbd>1</kbd> | <kbd>⌘</kbd> + <kbd>1</kbd> | **Incident & Hazard Map** | Quick switch to the live real-time incident map and dispatch queue. |
| <kbd>Ctrl</kbd> + <kbd>2</kbd> | <kbd>⌘</kbd> + <kbd>2</kbd> | **Alert Broadcast Center** | Quick switch to push notifications, SMS broadcast, and citizen advisories. |
| <kbd>Ctrl</kbd> + <kbd>3</kbd> | <kbd>⌘</kbd> + <kbd>3</kbd> | **ID Verifications** | Quick switch to the citizen KYC review and approval queue. |
| <kbd>Ctrl</kbd> + <kbd>4</kbd> | <kbd>⌘</kbd> + <kbd>4</kbd> | **Analytics & Reports** | Quick switch to response time trends, heatmaps, and dispatch benchmarks. |
| <kbd>ESC</kbd> | <kbd>esc</kbd> | **Dismiss / Cancel** | Cascading dismiss for open modal dialogs, media lightboxes, the Quick Search Palette, and mobile drawer sheets. |
| <kbd>ENTER</kbd> | <kbd>return</kbd> | **Confirm / Select** | Runs the primary confirm action on active confirm dialogs, or executes the highlighted Command Palette item. |
| <kbd>SPACE</kbd> | <kbd>space</kbd> | **Toggle Video Playback** | Pauses or plays video recordings in the full-screen media lightbox without scrolling the viewport. |

> [!NOTE]
> **Preserved Multiline Line Breaks:**  
> When typing inside multiline text inputs (`<textarea>`, `<ion-textarea>`, or editable rich text), pressing <kbd>ENTER</kbd> inserts a natural line break without triggering dialog submission or navigation.

---

## 2. 3D Physical Boxed Keys on Custom Tooltips

Navigation items, quick actions, and dialog controls display custom speech-bubble tooltips enhanced with authentic 3D physical `<kbd>` keycaps (modeled after native macOS / linear tactile mechanical switch keycaps):

- **Automatic Platform Detection:** Automatically displays `Ctrl + 1` on Windows & Linux, and converts to `⌘ 1` on macOS.
- **Physical Key Styling:** Renders keycaps with raised beveled borders, tactile drop shadows, and responsive light/dark mode contrast.
- **Elimination of Native Tooltips:** All native browser `title="..."` attributes across the application (dropdowns, date filters, photo previews, export actions) are replaced with the custom `[appTooltip]` directive to eliminate black delayed native tooltips.

---

## 3. Quick Search & Command Palette (Apple Spotlight Style)

Pressing <kbd>Ctrl</kbd> + <kbd>F</kbd> (or <kbd>⌘</kbd> + <kbd>F</kbd> / <kbd>⌘</kbd> + <kbd>K</kbd>) activates the centered frosted-glass command palette.

### Capabilities
1. **Fuzzy Search Across Panels:** Type "map", "broadcast", "kyc", "analytics", "logs", "citizens", or "settings" to jump immediately to that section.
2. **Execute Quick Actions:** Type "dark" to toggle Dark Mode, "sidebar" to toggle the menu, "tour" to start the walkthrough, or "refresh" to reload real-time data feeds.
3. **Barangay Map Jumps:** Type any San Isidro barangay name (e.g. *Poblacion*, *Alua*, *Calaba*, *Malapit*, *Mangga*, *San Roque*, *Santo Cristo*, *Tabon*) to filter and zoom the live incident map directly to that community.
4. **Full Keyboard Navigation:**
   - <kbd>↑</kbd> and <kbd>↓</kbd> arrow keys to navigate the highlighted result.
   - <kbd>ENTER</kbd> to execute the highlighted action.
   - <kbd>ESC</kbd> or clicking outside the card to dismiss the palette.

---

## 4. Fluid MacOS Accordion Animations in Broadcast Panel

The Alert Broadcast Center features hardware-accelerated CSS Grid stretching animations modeled after native macOS Big Sur / Sonoma applications:

1. **New Announcement Composer:**
   - Clicking **"New Announcement"** or pressing <kbd>Ctrl</kbd> + <kbd>N</kbd> gracefully stretches the card vertically from `0fr` to `1fr` using Apple's fluid cubic-bezier curve `(0.16, 1, 0.3, 1)`.
   - Smooth 180° chevron rotation indicates expanded/collapsed state.
2. **Accordion Broadcast Feeds:**
   - **Active Broadcasts**, **Scheduled Broadcasts**, and **Past / Archived Broadcasts** expand and collapse with fluid vertical stretching rather than abrupt cuts.
   - Interior contents animate with subtle vertical translations (`-4px` to `0px`) and fade transitions.

---

## 5. Workstation Security & Hidden Browser Panel Suppression

To maintain an authentic native desktop workstation experience and prevent accidental interruptions during emergency operations, the following browser hotkeys and hidden webview panels are explicitly intercepted and suppressed:

| Key Binding | Native Browser / Webview Behavior | Workstation Mitigation / Handler |
| :--- | :--- | :--- |
| <kbd>Ctrl</kbd> / <kbd>⌘</kbd> + <kbd>P</kbd> | Opens modal system print preview dialog (freezes UI) | **Blocked** (Prevented via `preventDefault()`; official reports use dedicated in-app PDF export) |
| <kbd>Ctrl</kbd> / <kbd>⌘</kbd> + <kbd>S</kbd> | Opens "Save Webpage as HTML" dialog | **Blocked** (Prevented via `preventDefault()`) |
| <kbd>Ctrl</kbd> / <kbd>⌘</kbd> + <kbd>O</kbd> | Opens browser local file explorer dialog | **Blocked** (Prevented via `preventDefault()`) |
| <kbd>Ctrl</kbd> / <kbd>⌘</kbd> + <kbd>H</kbd> | Opens browser history panel | **Blocked** (Prevented via `preventDefault()`) |
| <kbd>Ctrl</kbd> / <kbd>⌘</kbd> + <kbd>J</kbd> | Opens browser downloads drawer | **Blocked** (Prevented via `preventDefault()`) |
| <kbd>F7</kbd> | Displays "Turn on Caret Browsing?" confirmation dialog | **Blocked** (Prevents confusing text caret from appearing in the UI) |
| <kbd>F3</kbd> | Opens browser native find-in-page bar | **Blocked** (Rerouted to the custom Command Palette <kbd>Ctrl</kbd>+<kbd>F</kbd>) |
| <kbd>F12</kbd> / <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>I</kbd> | Opens Developer Tools & Console | **Blocked** in production builds to prevent tampering |
| <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>J</kbd> / <kbd>C</kbd> | Opens DevTools Console / Inspector | **Blocked** in production builds |
| <kbd>Ctrl</kbd> / <kbd>⌘</kbd> + <kbd>U</kbd> | Opens browser "View Page Source" tab | **Blocked** in production builds |
| Context Menu (Right Click) | Opens browser context menu ("Inspect", "Save As", etc.) | **Disabled** globally on desktop workstations |
