# Administrator User Guide

Comprehensive guide for **Master Administrators** managing user accounts, citizen identity verifications, staff dispatchers, system feedback, and global emergency response settings across both Desktop and Mobile Command Centers.

---

## 1. Administrator Capabilities

Master Admin accounts hold full system abilities (`['admin', 'dispatcher', 'citizen']`). In addition to all operational dispatch tools (Live Incident & Hazard Map, Log Archive, Analytics, Alert Broadcast), Admins have access to four dedicated management panels and the Admin Settings suite.

---

## 2. Live Incident & Hazard Map (Desktop & Mobile)

The **Incident Map** serves as the central operational hub:
- **Emergency SOS Alerts:** Live GPS pins with golden-minute medical info, caller phone, and attached photo/video proof.
- **Public Hazards:** Orange caution markers for reported road blockages, flooded streets, fallen trees, and downed electrical lines.
- **Desktop CAD Split View:** Resizable split-pane layout showing the full-width map on the left and the active incidents queue on the right with custom divider dragging.
- **Mobile Bottom Sheet:** Interactive draggable drawer at the bottom of mobile screens supporting **Peek** (170px for quick glance), **Half** (50% screen for queue browsing), and **Full** expansion.
- **Mobile Filter Drawer:** Tap the floating **Filter** button to filter by alert type pills (All, Emergency SOS, Hazards), date range, and target barangays.

---

## 3. Mobile Admin Interface & Menu Drawer

On smartphones and tablets, the Admin Command Center transitions to an app-like layout:
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
1. **Front of Valid ID:** High-resolution image of the government document.
2. **Back of Valid ID:** High-resolution image of the reverse side.
3. **Live Selfie with ID:** Live photograph showing the applicant holding the ID next to their face.
4. **Account Details:** Full name, phone number, birthdate, home barangay, and ID type.

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

## 7. Public Advisories & Scheduled Broadcasts

Admins and dispatchers can compose town-wide or barangay-scoped push advisories:
- **Desktop Drag-and-Drop:** Drag photos or MP4 videos directly onto the composer to attach up to 4 media files.
- **Immediate Push:** Sends notifications instantly to citizen devices.
- **Schedule for Later:** Choose a future date and time to queue automated announcements with past-time guards.
- **Active, Scheduled & Past Sections:** View running broadcasts, monitor queued scheduled alerts, and review archived advisories.

---

## 8. Dashboard Settings & Guided Operations Tours

- **Dark Theme:** Toggle between High-Contrast Dark Mode and Clean Light Mode with circular ripple animations.
- **Reduce Animations:** Minimize UI transition effects for maximum performance on lower-spec workstations.
- **Emergency Audio & Push Alerts:** Enable or mute real-time sound cues and push alerts for incoming SOS calls.
- **Default Map Style:** Set the default tile layer for the Incident Map (**Street View** vs. **Satellite Imagery**).
- **Interactive Guided Tours:** Step-by-step walkthroughs for dispatch, broadcasts, archiving, and staff management with viewport-adaptive mobile steps and mock demo fallbacks.
- **Session Logout:** Safely terminate the administrative session and clear local credentials.
