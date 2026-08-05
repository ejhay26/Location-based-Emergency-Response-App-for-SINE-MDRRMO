# Admin Guide

How to use the Admin/Dispatcher Dashboard from a **Master Admin** account. This covers everything admin-only — for the shared dispatch/map/broadcast/analytics workflow every staff account can use, see the [Dispatcher Guide](./dispatcher-guide.md) first.

## What Admins Can See That Dispatchers Can't

Four extra sidebar sections: **ID Verifications**, **Feedback**, **Dispatchers**, **Citizens** — on top of everything in the [Dispatcher Guide](./dispatcher-guide.md) (Incident Map, Public Hazards, Log Archive, Analytics, Alert Broadcast).

## ID Verifications

Every new citizen registration lands here first, marked pending, until you act on it. For each pending registration you'll see:
- The applicant's submitted ID photo
- Their selfie holding that ID
- Their registration details

Two actions:
- **Approve** — the account becomes active immediately; the citizen can now log in. Their Pending Verification screen picks this up automatically within its next check-in.
- **Deny** — **this permanently deletes the account**, including the uploaded ID and selfie files. There's no "rejected but recoverable" state — if someone's denied by mistake, they'll need to register again from scratch.

See [Feature Breakdown — Registration & ID Verification](../features/overview.md#registration--id-verification) for the full technical flow, including what a citizen sees on their end while waiting.

## Citizens Panel

A searchable, filterable list of every registered citizen (not just pending ones — this is the full roster).

- **Search** by name/username/email
- **Filter by barangay**
- **Filter by date range** (registration date), using the same shared date-range filter used elsewhere in the dashboard
- Status badge per citizen: **Active**, **Pending** (still awaiting ID verification), or **Suspended**

Actions available per citizen:
- **Suspend** — locks the account out (`account_status` → `banned`). Use this for a citizen who's active but abusing the system (e.g. repeated confirmed false alarms), as opposed to denial, which is only for registrations that were never approved in the first place.
- **Reactivate** — lifts a suspension, returning the account to active.

<details>
<summary><b>Suspend vs. Deny \u2014 which one do I use?</b></summary>

- **Deny** only applies to a still-pending registration (someone who hasn't been approved yet) and deletes the account outright.
- **Suspend** only applies to an already-active citizen and just locks them out — reversible with Reactivate.

There's no in-between "suspend a pending applicant" action; if their ID looks fraudulent, deny it. If a previously-approved citizen turns out to be a problem, suspend them.

</details>

## Dispatchers Panel

Manage staff accounts here — this is also how new dispatchers get set up, since they can't self-register the way citizens do.

- **Add Dispatcher** — create a new dispatcher account (name, contact info, login credentials).
- **Edit** — update an existing dispatcher's details.
- **Remove** — deactivate a dispatcher account.

## Feedback

Everything citizens submit from their Help tab shows up here — sender name, username, timestamp, a category badge (General / Bug / Suggestion / Other), and the message itself.

- **Export JSON** — download the full feedback list for offline review or reporting.
- **Clear All** — wipes the feedback list. There's no per-item delete or undo, so export first if you want to keep a record.

## Everything Else

Incident Map, Log Archive, Analytics, and Alert Broadcast work identically for admin and dispatcher accounts — see the [Dispatcher Guide](./dispatcher-guide.md) for those.
