# Administrator User Guide

Comprehensive guide for **Master Administrators** managing user accounts, citizen identity verifications, staff dispatchers, system feedback, and global command center settings.

---

## 1. Administrator Capabilities

Master Admin accounts hold full system abilities (`['admin', 'dispatcher', 'citizen']`). In addition to all operational dispatch tools (Incident Map, Hazards, Log Archive, Analytics, Alert Broadcast), Admins have access to four dedicated management panels and the Admin Settings suite.

---

## 2. Citizen ID Verifications Panel

Every newly registered citizen remains in an `unverified` status until reviewed by an administrator:

### Reviewing an Application
For each applicant in the verification queue, the admin can inspect:
1. **Front of Valid ID:** High-resolution cropped image of the government document.
2. **Back of Valid ID:** High-resolution cropped image of the reverse side.
3. **Live Selfie with ID:** Live photograph showing the applicant holding the ID next to their face.
4. **Account Details:** Full name, phone number, birthdate, home barangay, and ID type.

### Verification Actions
- **Approve User:**  
  - Activates the account (`account_status = 'active'`).
  - Broadcasts `UserVerified` (`approved`) via WebSockets to instantly unlock the citizen's pending screen.
  - Automatically dispatches a Welcome Email and FCM Push Notification.
- **Reject User:**  
  - **Permanently deletes** the registration and unlinks all uploaded ID and selfie files from storage.
  - Leaves zero residual personal data in the database.

---

## 3. Citizens Management Panel

The **Citizens** panel is a full directory of all registered residents across San Isidro.

### Tools & Filters
- **Global Search:** Search by name, username, email, or mobile phone number.
- **Barangay Filter:** Filter residents by any of the 9 official barangays.
- **Unified Date-Range Filter:** Filter by registration date using Single-Day, Multi-Day, or Custom Date Range.
- **Status Badges:** `Active`, `Pending`, or `Suspended`.

### Moderation Actions
- **Suspend Citizen:** Locks an abusive account (`account_status = 'banned'`), revokes all active session tokens, and records an administrative ban reason.
- **Reactivate Citizen:** Restores access for a previously suspended citizen (`account_status = 'active'`).

---

## 4. Dispatchers Management Panel

Dispatchers cannot self-register; they are created and managed directly by administrators:
- **Add Dispatcher:** Create a new staff account with Name, Mobile Number, Username, Email, Password, and Assigned Barangay.
- **Edit Dispatcher:** Update contact details or change assigned information.
- **Deactivate Dispatcher:** Revoke staff access and invalidate all active session tokens.

---

## 5. Citizen Feedback Portal

All feedback submitted by citizens from the mobile app's Help tab is routed to this panel:
- **Details Displayed:** Sender name, username, email, submission timestamp, category badge (*General*, *Bug*, *Suggestion*, *Other*), and message content.
- **Export JSON:** Download the entire feedback database as a timestamped JSON file (`feedback_export_YYYY-MM-DD_HHMMSS.json`) for reporting and review.
- **Clear All:** Safely purges all feedback records once processed.

---

## 6. Command Center Settings Panel

Administrators and dispatchers can customize their command center interface:
- **Dark Theme:** Toggle between High-Contrast Dark Mode and Clean Light Mode.
- **Reduce Animations:** Minimize UI transition effects for maximum performance on lower-spec workstations.
- **Emergency Audio & Push Alerts:** Enable or mute real-time sound cues and push alerts for incoming SOS calls.
- **Default Map Style:** Set the default tile layer for the Incident Map (**Street View** vs. **Satellite Imagery**).
- **Session Logout:** Safely terminate the administrative session and clear local credentials.
