# Dispatcher User Guide

How to monitor emergencies, review incoming alerts, dispatch responder teams, and broadcast public advisories using the SINE MDRRMO Operations Dashboard.

---

## 1. Launching & Logging In

1. Open the **SINE MDRRMO Operations Dashboard** on your workstation or mobile browser.
2. Sign in using the dispatcher credentials provided by your Administrator.
3. Upon login, the application connects to **Laravel Reverb WebSockets** for live incident streaming and real-time updates.

---

## 2. Dispatcher Navigation Overview

Dispatchers have access to primary operational panels:
- **Incident Map:** Live interactive map tracking active SOS emergencies and public road hazards.
- **Public Hazards:** Direct overview of active road blockages, fallen trees, and flooded streets.
- **Log Archive:** Searchable historical record of resolved incidents and false alarm moderation.
- **Analytics:** Statistical incident trends, charts, and barangay volume breakdown.
- **Alert Broadcast:** Town-wide and barangay-specific emergency announcement composer with media attachments.
- **Help & Procedures:** Step-by-step interactive walkthroughs for all primary dashboard functions.

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

Hazard reports (e.g. fallen trees, downed electrical wires, flooded streets) appear as orange markers on the Incident Map:
1. Click the hazard marker or list item to inspect photo proof and citizen description.
2. Coordinate with DPWH or municipal maintenance teams to clear the obstruction.
3. Tap **Resolve** once cleared to remove the marker from the active monitoring map.

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
5. **Attach Media:** Optionally attach up to **4 images or weather tracking charts**.
6. **Delivery Mode:**
   - **Post Immediately:** Sends the push notification right away.
   - **Schedule for Later:** Pick a future date and time for automated release. The system prevents picking past dates.
7. **Active Announcements:** Currently running broadcasts appear below the composer. Click **Stop** when the advisory has ended.

---

## 8. Desktop Notifications & Mobile Responsive View

- **Sound & Desktop Alerts:** When running the dashboard, audio cues and notifications sound for incoming SOS calls even when minimized.
- **Mobile Support:** On tablets and mobile phones, dispatchers can use the slide-out navigation drawer while keeping full access to the live map and incident queue.
