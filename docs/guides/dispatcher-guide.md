# Dispatcher Guide

How to use the Admin/Dispatcher Dashboard from a **dispatcher** account. This is the Electron desktop app — see [System Requirements](../setup/system-requirements.md) if you're setting up a new machine. For what a Master Admin can additionally do, see the [Admin Guide](./admin-guide.md).

## Logging In

Same login screen style as the citizen app — email/username + password, or OTP. Dispatcher accounts are created by an admin (dispatchers can't self-register), so if you don't have credentials yet, ask your MDRRMO admin to set one up from the Dispatchers panel.

## What You Can See

The sidebar has five sections for a dispatcher account:
- **Incident Map**
- **Public Hazards**
- **Log Archive**
- **Analytics**
- **Alert Broadcast**

(ID Verifications, Feedback, Dispatchers, and Citizens are admin-only — see the [Admin Guide](./admin-guide.md) if you need those.)

Dark Mode toggle and Logout are at the bottom of the sidebar.

## Incident Map — Your Main Screen

This is a live map (toggle between **Street** and **Satellite** view) showing active emergencies and hazards, refreshed automatically in the background — no manual refresh needed.

### Dispatching a Responder

1. From the **Active Emergencies** list (or by clicking a pin on the map), open an incident.
2. Tap **Dispatch**.
3. **Step 1:** pick the responder unit (Fire, Police, Rescue, or RHU).
4. **Step 2:** pick the specific vehicle assigned to that responder — the list only shows vehicles that belong to whichever unit you picked in Step 1, so you can't accidentally assign a fire truck to a medical call.
5. Tap **Confirm Dispatch**.

### Resolving an Emergency

Once handled, tap **Resolve** on that incident. This moves it out of the active list and into the [Log Archive](#log-archive).

### Handling Hazards

Hazard reports (flooded roads, fallen trees, etc.) show up in a separate **Active Hazards** list on the same map. Tap **Acknowledge** once it's been dealt with (cleared, repaired, or otherwise no longer a routing concern).

## Log Archive

Resolved emergencies and hazards live here, not on the live map. You can:
- **Search** by keyword
- **Filter by date range** — single day, several specific days, or a start/end range, using the shared date-range filter (a summary bar shows exactly which filters are active)
- **Mark False Alarm** on a resolved emergency, if it turns out the report wasn't genuine

<details>
<summary><b>Why false alarms are marked here and not on the live map</b></summary>

You only find out a report was fake *after* looking into it — which usually means after it's already been resolved one way or another. Marking it false here increments that citizen's false-alarm count, which can eventually lead to account moderation (handled by an admin).

</details>

## Analytics

Charts of emergency trends — filterable by the same date-range filter used elsewhere, plus quick 7/30/90-day presets. Clicking a chart segment (e.g. a specific day's bar, or an incident-type slice) filters the underlying incident list to match, so you can go from "there's a spike here" straight to "here's what happened."

## Alert Broadcast

Send an alert banner that citizens see on their dashboard.

1. Write your message.
2. Choose the audience:
   - Leave barangay selection empty (or tap **All**) for a **town-wide** alert.
   - Or select one or more specific barangays to target just those residents.
3. Send.

You can have multiple broadcasts active at once — e.g. a town-wide weather advisory alongside a barangay-specific flood warning. Each one is cleared independently from the same panel once it's no longer relevant. Citizens only see alerts that apply to them (town-wide, plus their own barangay); as a dispatcher, you see everything active regardless of scope.

## A Note on What You Can't Do

Dispatcher accounts are intentionally scoped — no citizen ID approvals, no managing other dispatcher accounts, no viewing citizen feedback. If you need any of that, it's an admin-only action; see the [Admin Guide](./admin-guide.md).
