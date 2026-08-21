# Dispatcher User Guide

How to monitor, dispatch, and coordinate emergency responses using the SINE MDRRMO Command Center desktop application.

---

## 1. Launching & Logging In

1. Launch the **SINE MDRRMO Command Center** desktop application on your workstation.
2. Sign in using the dispatcher credentials provided by your System Administrator.
3. Upon login, the application establishes an active **Laravel Reverb WebSocket connection** for sub-second incident streaming.

---

## 2. Dispatcher Sidebar Overview

Dispatchers have access to five primary command panels:
- **Incident Map:** Live interactive map tracking active SOS emergencies and public road hazards.
- **Public Hazards:** Overview of active road blockages, fallen trees, and flooded streets.
- **Log Archive:** Searchable historical record of resolved incidents and false alarm moderation.
- **Analytics:** Statistical incident trends, charts, and barangay volume distribution.
- **Alert Broadcast:** Municipal emergency banner push system with rich media support.

---

## 3. Incident Map: Active Emergency Workflow

The **Incident Map** is the primary operational dashboard:

```
[Incoming SOS Alert]
        │ (Instant Pin Drop via WebSocket + Desktop Notification)
        ▼
[Click Pin / Open Incident Card]
        ├─ Review live photo or 10-second video evidence
        ├─ Inspect "Golden Minute" Medical Data (Blood type, Allergies, Conditions, PWD)
        ├─ Check citizen false-alarm strike count
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
[Tap "Resolve"]    ──▶ Status becomes "Resolved" & moved to Log Archive
```

---

## 4. Managing Public Road Hazards

Hazard reports (e.g. fallen trees, downed electrical wires, flooded streets) appear as cautionary orange markers on the Incident Map:
1. Click the hazard marker to inspect photo proof and citizen description.
2. Coordinate with DPWH or municipal maintenance teams to clear the obstruction.
3. Tap **Acknowledge / Resolve** once cleared to remove the marker from the active monitoring map.

---

## 5. Log Archive & False Alarm Moderation

The **Log Archive** stores all completed, resolved, and cancelled emergency records.

### Features
- **Keyword Search:** Search by citizen name, username, phone number, or description.
- **Unified Date-Range Filter:** Filter by Single Day, Multi-Day, or a custom Date Range using the shared calendar selector.
- **Mark False Alarm:**  
  If field responders confirm that a reported emergency was fraudulent or malicious:
  1. Open the incident in Log Archive.
  2. Tap **Mark False Alarm**.
  3. This increments the reporting citizen's strike counter. When a citizen reaches **3 strikes**, their account is automatically banned from filing further requests.

---

## 6. Real-Time Analytics Dashboard

The **Analytics** panel presents interactive Chart.js visualizations filterable by **7-day**, **30-day**, or **90-day** rolling windows:
- **Daily Incident Trends:** Line/Bar chart breakdown by type (Fire, Flood, Medical, Crime, Others).
- **Incident Category Distribution:** Doughnut chart of incident types.
- **Barangay Volume Breakdown:** Identifies geographic areas with the highest emergency frequency.
- **Hazard Analytics:** Track flood frequency, road blockages, and power line hazards over time.
- **Interactive Filtering:** Clicking any chart segment automatically filters the underlying incident list to inspect matching records.

---

## 7. Pushing Alert Broadcasts

Dispatchers can transmit critical public safety banners directly to citizens' mobile apps:
1. Navigate to **Alert Broadcast**.
2. Enter an optional **Title** (e.g. *"Heavy Rainfall Warning"*).
3. Type the detailed emergency message.
4. **Select Audience:**
   - Leave empty / tap **All** for a **Town-Wide** broadcast.
   - Or select specific **Barangays** (e.g. *Tabon*, *Pulo*) for localized alerts.
5. **Attach Media:** Optionally attach up to **4 images or weather tracking charts**.
6. Tap **Send Broadcast**.
7. Active broadcasts appear on the panel and can be dismissed individually once the hazard subsides.

---

## 8. Desktop Notifications

When the desktop app is running, native OS notifications and audio alerts sound for any new SOS or hazard submission, even when viewing other panels or when the window is minimized.
