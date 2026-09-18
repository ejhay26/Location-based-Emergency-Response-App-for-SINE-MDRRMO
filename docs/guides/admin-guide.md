# Administrator User Guide

Comprehensive guide for **Master Administrators** managing user accounts, citizen identity verifications, staff dispatchers, system feedback, and global emergency response settings across Desktop and Mobile interfaces.

---

## 1. Administrator Capabilities

Master Admin accounts hold full system abilities (`['admin', 'dispatcher', 'citizen']`). In addition to all operational dispatch tools (Live Incident & Hazard Map, Log Archive, Analytics, Alert Broadcast), Admins have access to four dedicated management panels and the Admin Settings suite.

---

## 2. Live Incident & Hazard Map (Desktop & Mobile)

The **Incident Map** serves as the central operational hub:
- **Emergency SOS Alerts:** Live GPS pins with golden-minute medical info, caller phone, and attached photo/video proof.
- **Public Hazards:** Orange caution markers for reported road blockages, flooded streets, fallen trees, and downed electrical lines.
- **Desktop Split View:** Resizable split-pane layout showing the full-width map on the left and the active incidents queue on the right with custom divider dragging.
- **Mobile Bottom Sheet:** Interactive draggable drawer at the bottom of mobile screens supporting **Peek** (170px for quick glance), **Half** (50% screen for queue browsing), and **Full** expansion.
- **Mobile Filter Drawer:** Tap the floating **Filter** button to filter by alert type pills (All, Emergency SOS, Hazards), date range, and target barangays.

---

## 3. Mobile Admin Interface & Menu Drawer

On smartphones and tablets, the administrative dashboard transitions to an app-like layout:
- **Bottom Navigation Bar:** Switch directly between **Incident Map**, **Alert Broadcast**, and **Menu**.
- **Mobile Menu Drawer:** Tap **Menu** to access:
  - **Personnel Management** (Staff accounts and dispatchers)
  - **ID Verifications** (Citizen review queue)
  - **Citizens Directory** (Resident list and moderation)
  - **Analytics & Trends** (Rolling incident charts)
  - **Log Archive** (Searchable incident history)
  - **System Settings & Preferences** (Themes, audio cues, map defaults)
  - **Help & Operations Guides** (Interactive guided tours)

---

## 4. Citizen ID Verifications Panel

Every newly registered citizen remains in an `unverified` status until reviewed by an administrator:

### Reviewing an Application
For each applicant in the verification queue, the admin can inspect:
1. **Front of Valid ID:** High-resolution image of the government document with 1-tap copy of the ID number.
2. **Back of Valid ID:** High-resolution image of the reverse side.
3. **Live Selfie with ID:** Live photograph showing the applicant holding the ID next to their face.
4. **Account Details:** Full name, phone number, birthdate, home barangay, and ID type.
5. **Direct Verification Links:** Quick access to official government verification portals (PhilSys eVerify, LTO LTMS, DFA, PRC LERIS).

### Verification Actions
- **Approve User:**  
  - Activates the account (`account_status = 'active'`).
  - Broadcasts `UserVerified` (`approved`) via WebSockets to instantly unlock the citizen's pending screen.
  - Automatically dispatches a Welcome Email and FCM Push Notification.
- **Reject User:**  
  - Permanently deletes the registration and unlinks uploaded ID files.
  - Leaves zero residual personal data in the database.

---

## 5. Citizens Management Panel

The **Citizens** panel is a full directory of all registered residents across San Isidro:
- **Global Search:** Search by name, username, email, or mobile phone number.
- **Barangay Filter:** Filter residents by any of the 9 official barangays.
- **Unified Date-Range Filter:** Filter by registration date using Single-Day, Multi-Day, or Custom Date Range.
- **Status Badges:** `Active`, `Pending`, or `Suspended`.
- **Account Moderation:** Suspend abusive accounts (`banned`) or reinstate access with recorded reasons.

---

## 6. Dispatchers Management Panel

Dispatchers cannot self-register; they are created and managed directly by administrators:
- **Add Dispatcher:** Create a new staff account with Name, Mobile Number, Username, Email, Password, and Assigned Barangay.
- **Edit Dispatcher:** Update contact details or change assigned information.
- **Deactivate Dispatcher:** Revoke staff access and invalidate all active session tokens.

---

## 7. Public Advisories, Scheduled Broadcasts & Drafts

Admins and dispatchers can compose town-wide or barangay-scoped push advisories:
- **Collapsible Announcement Composer:** Maximize panel space by collapsing or expanding the composer via the `"New Announcement"` toggle button while keeping current drafts preserved.
- **Desktop Drag-and-Drop:** Drag photos or MP4 videos directly onto the composer to attach up to 4 media files.
- **Immediate Push:** Sends notifications instantly to citizen devices.
- **Schedule for Later:** Choose a future date and time to queue automated announcements with past-time guards.
- **Save as Draft:** Stores the advisory in the **Saved Drafts** queue for operational review without alerting citizens.
- **Drafts Management & Reviewal:** Supervisors and operators can review pending drafts, click **Review / Edit** to reload them into the composer, edit details, and publish or schedule them.
- **Active, Scheduled, Drafts & Past Sections:** View running broadcasts, monitor queued scheduled alerts, inspect unreleased drafts, and review archived advisories.

---

## 8. Dashboard Settings & Guided Operations Tours

- **Dark Theme:** Toggle between High-Contrast Dark Mode and Clean Light Mode with a seamless 250ms cross-dissolve transition across desktop and mobile.
- **Reduce Animations:** Minimize UI transition effects for maximum performance on lower-spec workstations.
- **Emergency Audio & Push Alerts:** Enable or mute real-time sound cues and push alerts for incoming SOS calls.
- **Default Map Style:** Set the default tile layer for the Incident Map (**Street View** vs. **Satellite Imagery**).
- **Interactive Guided Tours:** Step-by-step walkthroughs for dispatch, broadcasts, archiving, and staff management with viewport-adaptive mobile steps, interactive element tracking (including expanding the broadcast composer), and mock demo fallbacks.
- **Concurrent Device Sessions:** Admin accounts support simultaneous logins across the native desktop workstation (Tauri) and mobile devices without expiring active sessions.
- **Session Logout:** Safely terminate the administrative session and clear local credentials.

---

## 9. Desktop Keyboard Shortcuts & Quick Search

For fast incident response on administrative workstations, global hotkeys and a custom command palette are available:
- <kbd>Ctrl</kbd> + <kbd>,</kbd> (<kbd>⌘</kbd> + <kbd>,</kbd> on macOS): Jump directly to Settings.
- <kbd>F1</kbd> (<kbd>⌘</kbd> + <kbd>?</kbd> on macOS): Open Help & Guided Tours.
- <kbd>Ctrl</kbd> + <kbd>F</kbd> / <kbd>Ctrl</kbd> + <kbd>K</kbd>: Open Apple Spotlight-style **Quick Search & Command Palette** to search panels, trigger actions, or zoom to barangays.
- <kbd>Ctrl</kbd> + <kbd>1</kbd> – <kbd>4</kbd>: Direct switch between Incident Map, Broadcast Center, ID Verifications, and Analytics.
- <kbd>Ctrl</kbd> + <kbd>B</kbd>: Toggle sidebar collapse/expand.
- <kbd>Ctrl</kbd> + <kbd>D</kbd>: Toggle dark/light theme.
- <kbd>Ctrl</kbd> + <kbd>N</kbd>: Open Alert Broadcast and stretch open the Announcement Composer.
- <kbd>ESC</kbd>: Dismiss active confirmation dialogs, lightboxes, or the search palette.
- <kbd>ENTER</kbd>: Confirm active dialogs or execute highlighted command palette items (multiline textareas preserve standard Enter newlines).

For the complete keybinding table and usage guide, refer to the [Desktop Shortcuts Guide](file:///docs/guides/desktop-shortcuts.md).

