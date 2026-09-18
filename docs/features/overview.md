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

- **Linked Asset Dropdowns:** The dispatch system prevents mismatched unit assignments by linking responder teams (Fire, Police, Rescue, RHU) to their specific assigned vehicles (e.g. selecting BFP only reveals fire trucks and water tenders).
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
- **Rich Media & Drag-and-Drop Composer:** Desktop composer supports drag-and-drop file uploads and up to **4 attached images or MP4 videos** with thumbnail previews.
- **Collapsible Composer Card:** The announcement composer features a collapsible layout with a quick toggle button (`"Create Broadcast"`), maximizing screen real estate on desktop and mobile while seamlessly preserving composer form inputs across tab switching.
- **Three Delivery Modes:**
  - **Post Immediately:** Pushes alerts immediately to citizen devices.
  - **Schedule for Later:** Queues announcements for automated future release at a specified date and time (`scheduled_at`), protected by past-time validation guards.
  - **Save as Draft:** Stores the announcement in a reviewable draft state without sending notifications or sounding public alarms.
- **Drafts Management & Reviewal:** A dedicated **Saved Drafts** section displays all unreleased announcements. Dispatchers can click **Review / Edit** to load any draft back into the composer for editing and publishing, or click **Discard** to remove it.
- **Active, Scheduled & Archived Management:** Operators monitor active running alerts, inspect queued scheduled announcements, and audit historical broadcasts.
- **Client-Side Filtering:** Citizens only receive push notifications and UI banners that apply to their home barangay or the entire municipality. Drafts are never delivered to citizen devices.

---

## 9. Native Desktop Application (Tauri v2)

- **Rust-Powered Native Architecture:** Packaged via **Tauri v2** for Windows, macOS, and Linux with a 10–15 MB distribution size and ultra-low RAM footprint (~30–50 MB).
- **Custom Frameless Titlebar:** Theme-aware window minimize, maximize, and close controls integrated seamlessly with the application header.
- **Continuous Background Awareness:** Native OS desktop notifications and audio cues whenever a new emergency or hazard is logged.
- **Multi-Device Concurrent Sessions:** Administrative and dispatcher accounts maintain independent, concurrent sessions between native desktop workstations and mobile devices without premature session termination.

---

## 10. Mobile-Responsive Admin & Dispatcher Interface

- **Dedicated Mobile Navigation Bar:** Bottom navigation bar featuring 1-tap switching between **Incident Map**, **Alert Broadcast**, and **Mobile Admin Menu**.
- **Interactive Draggable Bottom Sheet:** Incident queue operates with a mobile-native draggable handle supporting `peek`, `half`, and `expanded` heights.
- **Touch-Friendly Filter Card:** Floating mobile filter overlay with alert type pills (All, SOS, Hazards), calendar date range pickers, and multi-select barangay chips.
- **Mobile Admin Drawer Menu:** Off-canvas drawer granting access to Personnel, ID Verifications, Citizens, Analytics, Log Archive, and Settings.

---

## 11. Interactive Guided Tour & Tutorial System

- **Viewport-Adaptive Tour Engine:** Tour steps dynamically adapt between desktop and mobile layouts (e.g., highlighting mobile bottom sheets, drawer buttons, and floating controls).
- **Step-by-Step Composer Expansion:** The Alert Broadcast procedure guide includes an interactive step prompting operators to open the collapsible composer card before customizing announcement text and attachments.
- **Interactive Focus & Triage Card Previews:** Tour steps automatically center the map (`flyTo`), pulse markers, and trigger triage popup cards.
- **Mock Demo Data Fallbacks:** In empty or offline testing environments, demo incident cards and broadcast records appear during walkthroughs to provide a complete training experience.

---

## 12. Advanced Search & Unified Date-Range Filtering

All administrative panels share two modular components:
1. **`DateRangeFilterComponent`:** A unified calendar popover supporting Single Day, Multi-Day, and Custom Date Range filtering.
2. **`FilterSummaryBarComponent`:** A persistent active-filter chip bar indicating current query parameters with one-click reset capabilities.

---

## 13. Multi-Channel OTP & Android SMS Retriever

- **Multi-Channel Delivery:** Citizens can receive authentication codes via **Email** or **PhilSMS**.
- **One-Tap Android Auto-Fill:** On Android devices, the native SMS User Consent API (`@capawesome/capacitor-android-sms-retriever`) reads the 6-digit code without requiring full SMS reading permissions.

---

## 14. Physics-Engineered UI & Motion Architecture

- **Rigid Metallic Dialog Pop Animation:** Re-engineered dialog, modal, and alert popup animations utilizing rigid uniform-scale expansion (`0.88` to `1.028` overshoot to `1.0`) with locked aspect ratios, replacing elastic jelly distortions with snappy, professional feedback.
- **Physics-Driven OTP Input:** Features micro-scale bounce on digit entry, in-flight verifying pulse, emerald cascade wave upon 6th digit completion, animated SVG checkmark overlay, and horizontal physics shake on incorrect codes.
- **Unified 250ms Cross-Dissolve Dark Mode:** Clean, synchronized theme transitions across all platforms (Android, iOS, Windows, macOS, Linux) eliminating visual tearing.
- **Skeleton Shimmer Loading States:** Replaces static loading text with responsive placeholder shimmer animations across metrics, queues, and verification cards.
- **Performance-Capped Radar Ripples:** High-visibility map radar pulses restricted strictly to active, pending emergencies (<10 minutes old) with an automatic 8-cycle cutoff to safeguard client GPU resources.

