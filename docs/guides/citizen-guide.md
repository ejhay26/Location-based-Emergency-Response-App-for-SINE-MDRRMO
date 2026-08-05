# Citizen Guide

How to register, log in, and use the app as a resident of San Isidro. For what's happening behind the scenes, see [Feature Breakdown](../features/overview.md) and [API — Auth](../api/auth.md).

## Registering an Account

Registration is 3 steps:

<details>
<summary><b>Step 1 — Personal details + ID verification</b></summary>

- First name, last name, phone number, birthdate
- Valid ID type (Philippine National ID, Driver's License, Voter's ID, UMID, Postal ID, PWD ID, Senior Citizen ID, Student/School ID, Barangay ID, or Other)
- A live photo of that ID — the app opens your camera directly, not your gallery, then lets you crop it
- A live selfie holding that ID next to your face — same live-capture + crop process

This ID + selfie pair is what MDRRMO staff review to confirm you're a real resident before your account is approved.

</details>

<details>
<summary><b>Step 2 — Account details</b></summary>

- Barangay
- Username (checked for availability as you type — if it's taken, you'll get suggested alternatives)
- Email address (also checked live)
- Password + confirm password, with a live checklist: minimum 8 characters, an uppercase letter, a lowercase letter, a digit, and a special symbol (`@$!%*#?&`)
- How you want to verify your account: **Email OTP** or **SMS OTP**
- Agree to the Terms and Conditions / Privacy Policy checkbox

</details>

<details>
<summary><b>Step 3 — Verify your code</b></summary>

A 4-digit code is sent to whichever channel you picked (email or SMS). Enter it and tap **Verify Email** (or the SMS equivalent).

</details>

## What Happens Right After Verifying

This is the part that's easy to misunderstand, so it's worth being explicit: **verifying your code doesn't log you in.** Your account exists, but MDRRMO staff still need to review your submitted ID before you can actually use the app.

You'll land on a **Pending Verification** screen that:
- Explains you're waiting on admin review
- Checks in automatically every 20–30 seconds — no need to keep refreshing
- Shows a **Logout** button if you want to leave and come back later
- Updates itself the moment your account is approved, with a button to continue to Login

If your submitted ID is rejected instead of approved, the registration is removed rather than banned — you'll see a message explaining that, with the option to register again.

If you close the app and come back later (or try to log in directly), attempting to log in on a still-pending account routes you to this same screen instead of just showing an error.

## Logging In

Two ways in, both from the main login screen:

- **Email or username + password** — the standard path.
- **Login with OTP instead** — no password needed. Choose email or your registered phone number, get a 4-digit code, and it logs you in once verified.

<details>
<summary><b>Forgot your password?</b></summary>

From the login screen, tap **Forgot Password?**:
1. Choose how to receive your recovery code — registered email or registered phone number.
2. Enter that email/phone, get a 4-digit OTP.
3. Enter the OTP plus a new password (same strength checklist as registration: 8+ characters, uppercase, lowercase, digit, symbol).
4. Confirm — you're set to log in with the new password.

</details>

## Sending an SOS

The main red button on Home. Tapping it:
1. Grabs your GPS location automatically.
2. Requires a live camera photo or a short video (10 seconds or less) as proof — not something picked from your gallery. This is intentional; it's what keeps the system from being spammed with fake reports.
3. Lets you pick the incident type (Fire, Flood, Medical, Crime, Others) and add a description.
4. Submits — MDRRMO's dispatch dashboard sees it immediately.

Once submitted, you can track it from the **Status** tab, and cancel it from there if it's no longer an emergency (e.g. you called it in by phone instead, or it resolved itself).

<details>
<summary><b>"Golden Minute" medical profile — optional but recommended</b></summary>

From **Profile**, you can save your blood type, allergies, medical conditions, and PWD status ahead of time. If you ever send an SOS, this gets attached automatically, so responders know what to expect before they even arrive. It's entirely optional and can be added, edited, or left blank at any time.

</details>

## Reporting a Hazard

Not every emergency, but not nothing either — flooded streets, fallen trees, broken roads. From the **Report** section, choose "Hazard" instead of SOS, add a photo/video and description, and it shows up on the dispatch team's map so they can route around it.

## Checking Your Reports (Status tab)

Shows your SOS and hazard history, filterable by **All / This Week / This Month**. Active requests can be cancelled from here.

## Your Profile

- Update your profile photo
- Edit your medical/"Golden Minute" profile
- Change your password (see below — it's not a simple form, on purpose)
- See your **false alarm strikes**, if any — confirmed false SOS reports count against your account

<details>
<summary><b>Changing your password while logged in</b></summary>

Even though you're already logged in, changing your password still requires a fresh OTP check:
1. Tap **Change Password**.
2. Choose where to send the verification code — your email or phone.
3. Enter the 4-digit code.
4. Set a new password (same strength checklist as everywhere else).

This extra step exists so that someone with access to your unlocked phone can't quietly change your password without also having access to your email/SMS.

</details>

## Settings

Grouped into a few sections:
- **Appearance** — Dark Mode, Reduce Animations
- **Location** — Auto-fetch Location (on by default; if off, location is only grabbed when you explicitly tap "Use My Location" instead of continuously while the app is open)
- **Map** — Default map style for the Report page (Street or Satellite)
- **Notifications** — Emergency Dispatch Alerts, Broadcast Alerts (each can be turned off independently)
- **Reporting** — Save Captured Media to Device (off by default — when on, photos/videos you take for a report are also saved to your phone's gallery, not just submitted)

## Help & Support

The **Help** tab has:
- MDRRMO's emergency hotlines (Globe and Smart numbers), office address, and hours — tap either number to call directly
- An **interactive tutorial** — either a full walkthrough of every feature, or jump to a specific chapter
- A searchable FAQ
- A feedback form (categorized as General / Bug / Suggestion / Other) that goes straight to MDRRMO admin

## Getting Notified

If you allow push notifications (prompted from the Profile page), you'll get alerts for:
- Emergency dispatch updates on your own SOS
- Broadcast alerts relevant to you — town-wide ones, plus anything targeted specifically at your barangay

Notifications stop coming to that device once you log out.
