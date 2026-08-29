# Dispatcher User Guide

How to monitor emergencies, review incoming alerts, dispatch responder teams, and broadcast public advisories using the SINE MDRRMO Operations Dashboard on Desktop and Mobile.

---

## 1. Launching & Logging In

1. Open the **SINE MDRRMO Operations Dashboard** on your desktop workstation (Tauri Desktop App) or mobile device.
2. Sign in using the dispatcher credentials provided by your Administrator.
3. Upon login, the application connects to **Laravel Reverb WebSockets** for live incident streaming and real-time updates.

---

## 2. Dispatcher Navigation Overview

- **Desktop CAD Layout:** Full multi-panel workspace featuring an interactive map with resizable active queues, quick filter strips, and sidebar access.
- **Mobile Dispatch Layout:** Optimized bottom navigation bar (`Incident Map`, `Alert Broadcast`, `Menu`) with an interactive slide-up bottom sheet for managing calls in the field.

---

## 3. Incident Map: Active Emergency & Hazard Workflow

The **Incident Map** is the primary operational dashboard:

```
[Incoming SOS or Hazard Alert]
        │ (Instant Pin Drop via WebSocket + Sound & Desktop Alert)
        ▼
[Click Pin / Open Alert Card]
        ├─ Review live photo or 10-second video evidence
        ├─ Inspect "Golden Minute" Medical Data (Blood type, Allergies, Conditions, PWD)
        ├─ Check citizen phone number and false-alarm strike count
        ├─ Interactive Map Sync (Clicking card smoothly pans/zooms map to pin)
        │
        ▼
[Tap "Dispatch" Button]
        ├─ Step 1: Select Responder Unit (BFP, PNP, Rescue, RHU)
        ├─ Step 2: Select Matching Vehicle (Ambulance, Fire Truck, Patrol Car)
        │
        ▼
[Confirm Dispatch] ──▶ Status becomes "En Route" (Citizen notified via Push Alert)
        │
        ▼ (Incident Resolved on Scene)
[Tap "Resolve"]    ──▶ Confirmation dialog with animated loading spinner
        │
        ▼
Status becomes "Resolved" & moved to Log Archive
```

---

## 4. Managing Public Road Hazards

Hazard reports (e.g. fallen trees, downed electrical wires, flooded streets) appear as yellow/orange markers on the Incident Map:
1. Click the hazard marker or list item to inspect photo proof and citizen description.
2. Coordinate with DPWH or municipal maintenance teams to clear the obstruction.
3. Tap **Resolve** once cleared to remove the marker from active monitoring.

---

## 5. Log Archive & False Alarm Moderation

The **Log Archive** stores all completed, resolved, and cancelled emergency records.

### Features
- **Keyword Search:** Search by citizen name, username, phone number, or description.
- **Date Range Filter:** Filter by Single Day, Multi-Day, or a custom Date Range using the calendar selector.
- **Download Certified PDF:** Export filtered records into a formatted situation summary for council briefings.
- **Mark False Alarm:**  
  If field responders confirm that a reported emergency was fraudulent or malicious:
  1. Open the incident in Log Archive.
  2. Tap **Mark False Alarm**.
  3. This increments the reporting citizen's strike counter. When a citizen reaches **3 strikes**, their account is automatically banned from filing further requests.

---

## 6. Real-Time Analytics Dashboard

The **Analytics** panel presents interactive visualizations filterable by **7-day**, **30-day**, or **90-day** rolling windows:
- **Daily Incident Trends:** Line/Bar chart breakdown by type (Fire, Flood, Medical, Crime, Others).
- **Incident Category Distribution:** Doughnut chart of incident types.
- **Barangay Volume Breakdown:** Identifies geographic areas with the highest emergency frequency.
- **Hazard Analytics:** Track flood frequency, road blockages, and power line hazards over time.

---

## 7. Public Advisories & Scheduled Broadcasts

Dispatchers can transmit critical public safety announcements directly to citizens' mobile phones:
1. Navigate to **Alert Broadcast**.
2. Enter an optional **Headline** (e.g. *"Heavy Rainfall Warning"*).
3. Type the detailed advisory message.
4. **Select Audience:**
   - Leave on **All Barangays** for a municipal-wide broadcast.
   - Or select specific **Barangays** (e.g. *Tabon*, *Pulo*) for localized alerts.
5. **Attach Media & Drag-and-Drop:** Drag or select up to **4 photos or MP4 videos** for instant visual preview.
6. **Delivery Mode:**
   - **Post Immediately:** Sends the push notification right away.
   - **Schedule for Later:** Pick a future date and time for automated release with past-time guards.
7. **Active & Scheduled Announcements:** Monitor live broadcasts and scheduled queues directly below the composer.

---

## 8. Interactive Operations Walkthroughs (Help & Procedures)

Dispatchers can launch spotlight guided tours from the **Help** panel:
- **Incident Map Tour:** Step-by-step guidance on live map controls, filters, queue browsing, and pin focus.
- **Alert Broadcast Tour:** Walkthrough of headline writing, media attachments, barangay targeting, and scheduling.
- **Archive Tour:** Guide on searching historical reports, false alarm tagging, and PDF export.
- **Adaptive Mobile Steps:** Walkthrough automatically adjusts to highlight mobile sheets and drawer elements when opened on a smartphone.
