# Feature Breakdown & Technical Highlights

A comprehensive, in-depth breakdown of all core features and technical implementations in the SINE MDRRMO Emergency Response System.

---

## 1. Real-Time WebSocket Infrastructure (Laravel Reverb)

The platform utilizes **Laravel Reverb** as its primary real-time synchronization engine.
- **Sub-Second Updates:** Incoming SOS requests, unit dispatches, hazard reports, and alert broadcasts appear instantaneously on connected citizen and dispatcher screens without polling.
- **Dedicated Channels:** `emergencies`, `hazards`, `broadcasts`, and `users` stream lightweight trigger events; clients re-fetch authenticated REST endpoints upon receipt to prevent leaking sensitive data over public socket payloads.

---

## 2. Offline-First Emergency Queueing & Synchronization

To maintain functionality during cell tower congestion or signal outages:
- **IndexedDB Local Store (`OfflineQueueService`):** When network connectivity is lost, SOS submissions and hazard reports (including base64 photo/video proof files) are persisted to IndexedDB rather than failing.
- **Automated Sync Engine:** The app monitors connectivity transitions via `NetworkService`. As soon as the device re-establishes a valid connection to the backend, queued reports are automatically dispatched in chronological order.

---

## 3. Anti-Prank Multi-Point SOS Verification

1. **Mandatory Live Camera Capture:** The app enforces real-time camera activation for photos or videos (up to 10 seconds), explicitly blocking uploads from the device gallery to prevent pre-recorded or falsified submissions.
2. **Authoritative Geofencing:** Device GPS coordinates are locked at submission and validated on the backend against official PSA boundary polygons (`BarangayResolver`).
3. **3-Strike Penalty System:** Confirmed false alarms accumulate strikes against the citizen's account; reaching 3 strikes triggers automated account revocation (`banned`).

---

## 4. Verified Philippine ID Capture & 3NF Normalized Identity Pipeline

1. **6 Verifiable Philippine Government IDs:** Enforces structured capture of PhilSys / ePhilID (16-digit PCN), LTO Driver's License, DFA Passport, UMID / SSS, Postal ID, and PRC Professional License with auto-hyphenation and expiration tracking.
2. **Dual-Sided Proof & Live Selfie:** Mandatory camera capture of both the **Front** and **Back** of the ID card plus a live selfie holding the ID next to the applicant.
3. **3NF Normalized Verification Entity (`user_verifications`):** Submissions are decoupled from the core `users` table into a dedicated verification ledger, preserving full audit history upon rejection and keeping administrative/dispatcher accounts free of null fields.
4. **Isolated Emergency Medical Records (`user_medical_profiles`):** "Golden Minute" health data (blood type, allergies, conditions, PWD status) is stored in an isolated table for rapid paramedic lookup and enhanced medical data privacy.
5. **Admin Review & 1-Tap Portal Verification:** Officers inspect dual-sided photos, use 1-tap ID number copying, and verify authenticity directly through official government portals (PhilSys eVerify, LTO LTMS, DFA, PRC LERIS).
6. **Automated Welcome Pipeline:** Approval triggers real-time socket events, an automated Welcome email, and an FCM push notification.

---

## 5. Home Screen Emergency Widget & Deep Linking

1. **Native Android 8+ Widget Pinning (`WidgetPinService`):** Citizens can pin a dedicated 1-Tap Emergency SOS widget directly to their device home screen.
2. **Custom Scheme Deep Linking (`DeepLinkService`):** Tapping the home screen widget invokes the app via `sinemdrrmo://report`, bypassing standard navigation and routing the citizen directly to the SOS camera interface.

---

## 6. Smart Unit & Fleet Dispatching

- **Linked Asset Dropdowns:** The Command Center prevents mismatched unit assignments by linking responder teams (Fire, Police, Rescue, RHU) to their specific assigned vehicles (e.g. selecting BFP only reveals fire trucks and water tenders).
- **Incident Lifecycle Tracking:** Dispatches transition incidents through `Pending` → `Dispatched` (`En Route`) → `Resolved` (`Completed`), sending push notifications to reporting citizens at each milestone.

---

## 7. "Golden Minute" Medical Profile

Citizens can save critical medical parameters ahead of time:
- Blood Type (A+, B+, O+, AB+, etc.)
- Specific Allergies (medications, food, environmental)
- Existing Medical Conditions (Asthma, Hypertension, Diabetes, Heart condition)
- PWD ID / Special Mobility Assistance Requirements

When an SOS is transmitted, this medical record is attached automatically to the dispatcher's incident card, allowing emergency personnel to prepare appropriate medical gear before reaching the scene.

---

## 8. Barangay-Targeted Rich Media Broadcast Alerts

- **Granular Audience Targeting:** Dispatchers can broadcast alerts either **Town-wide** (all residents) or scoped to one or more specific **Barangays**.
- **Rich Media & Titles:** Broadcasts support titles and up to **4 attached images or videos** (e.g., typhoon tracking maps, evacuation center directions).
- **Immediate & Scheduled Delivery:** Dispatchers can send broadcasts immediately or schedule them for a future release date and time, protected by automated past-time guards.
- **Active Announcements Management:** Operators can monitor all active alerts, view how long they have been broadcast, and stop them with one click.
- **Client-Side Filtering:** Citizens only receive push notifications and UI banners that apply to their home barangay or the entire municipality.

---

## 9. Desktop Notifications for Dispatchers (Electron)

- **Continuous Background Awareness:** Built specifically for the Electron desktop dashboard, `DesktopNotificationsService` emits native OS notifications with audio cues whenever a new emergency or hazard is logged, even if the dispatcher is currently reviewing Analytics or the Log Archive.

---

## 10. Advanced Search & Unified Date-Range Filtering

All administrative panels (Citizens, Dispatchers, Verifications, Log Archive, and Analytics) share two modular components:
1. **`DateRangeFilterComponent`:** A unified calendar popover supporting Single Day, Multi-Day, and Custom Date Range filtering with responsive sizing that prevents day/number crushing.
2. **`FilterSummaryBarComponent`:** A persistent active-filter chip bar indicating current query parameters with one-click reset capabilities.

---

## 11. Multi-Channel OTP & Android SMS Retriever

- **Multi-Channel Delivery:** Citizens can receive authentication codes via **Email** or **PhilSMS**.
- **One-Tap Android Auto-Fill:** On Android devices, the native SMS User Consent API (`@capawesome/capacitor-android-sms-retriever`) reads the 6-digit code without requiring full SMS reading permissions.

---

## 12. Interactive Guided Tour & Tutorial System

- **First-Run Onboarding Tour:** A multi-step animated overlay (`TourOverlayComponent`) highlighting primary app actions for first-time users.
- **Help & Operations Guides:** Interactive procedural walkthroughs on the Admin and Dispatcher dashboards that spotlight live controls, animate seamlessly, and auto-manage navigation across desktop and mobile drawer views.
- **Citizen Help Center:** A dedicated Help tab containing emergency hotlines (Globe and Smart with direct-dial links), interactive chapter tutorials, FAQs, and a direct feedback portal.
