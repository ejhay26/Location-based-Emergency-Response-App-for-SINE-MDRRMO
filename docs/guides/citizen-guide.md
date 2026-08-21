# Citizen User Guide

Step-by-step instructions on registering, logging in, and using the SINE MDRRMO Emergency Response App as a resident of San Isidro, Nueva Ecija.

---

## 1. Registering an Account

Registration consists of three guided steps:

### Step 1: Personal Details & Dual-Sided ID Verification
- **Personal Information:** First name, last name, mobile phone number, birthdate.
- **Valid Government ID Type:** Choose from Philippine National ID (PhilID), Driver's License, Voter's ID, UMID, Postal ID, PWD ID, Senior Citizen ID, Student ID, or Barangay ID.
- **Front of ID Photo:** The app opens the camera for a live photo of the **Front** of your ID, with an integrated crop tool.
- **Back of ID Photo:** Take a live photo of the **Back** of your ID and crop.
- **Live Selfie with ID:** Take a live photo holding your valid ID next to your face.

---

### Step 2: Account Details & Security
- **Resident Barangay:** Select your home barangay in San Isidro.
- **Username & Email:** Live availability check ensures your handle is unique.
- **Password:** Strong password checklist (minimum 8 characters, uppercase, lowercase, number, special symbol).
- **Verification Channel:** Choose whether to receive your 4-digit code via **Email OTP** or **SMS OTP (PhilSMS)**.
- **Terms & Privacy:** Agree to data privacy and emergency reporting terms.

---

### Step 3: Enter Verification Code
- Enter the 4-digit code sent to your email or mobile number.
- On Android phones, the app automatically detects the incoming SMS and presents a one-tap consent dialog to auto-fill the code.

---

## 2. What Happens Next: Pending Verification & Onboarding

1. **Pending Verification Screen:**  
   Once your code is verified, your account is submitted to MDRRMO staff for identity review. You will see the Pending Verification screen, which automatically updates via real-time WebSockets the instant an admin approves your application.
2. **Account Setup Wizard:**  
   On your very first login after approval, the app guides you through an onboarding setup:
   - Uploading a profile avatar.
   - Setting up your **"Golden Minute"** medical profile.
   - Adding the **1-Tap Emergency SOS Widget** to your home screen.

---

## 3. Logging In & Account Recovery

### Login Methods
- **Password Login:** Enter your username/email and password.
- **Passwordless OTP Login:** Tap "Login with OTP instead", enter your registered email or phone number, and enter the 4-digit code received.

### Forgot Password
1. Tap **Forgot Password?** on the login screen.
2. Choose Email or Phone recovery and receive a 4-digit OTP.
3. Verify the OTP and immediately enter a new strong password.

---

## 4. Sending an Emergency SOS

The large red **SOS** button is located prominently on the Home screen:

```
[Tap Red SOS Button]
        │
        ├─ 1. GPS Coordinates captured automatically
        ├─ 2. Live Camera activates (Capture photo or up to 10s video)
        ├─ 3. Select Incident Category (Fire, Flood, Medical, Crime, Others)
        ├─ 4. Enter brief description
        │
        ▼
[Submit SOS] ──▶ Instant Real-Time Alert to MDRRMO Command Center
```

### Offline SOS Queueing
If you have no cellular signal or internet connection during a disaster:
- The app automatically saves your SOS report, GPS position, and media proof to your device's local **IndexedDB storage**.
- The moment your device reconnects to a mobile network or Wi-Fi, the report is automatically synced and transmitted to the command center.

---

## 5. Home Screen Quick-Report Widget

On Android 8.0+ devices:
1. Open **Settings** or tap the widget banner on the Home screen.
2. Tap **Add Emergency Widget**.
3. Accept the prompt to pin the SINE MDRRMO 1-Tap SOS widget directly to your phone's home screen.
4. Tapping this widget immediately opens the app directly into emergency reporting mode via deep link (`sinemdrrmo://report`).

---

## 6. Managing Your "Golden Minute" Medical Profile

From the **Profile** tab, you can configure critical emergency health information:
- **Blood Type:** (e.g. O+, A+, B+, AB-)
- **Allergies:** (e.g. Penicillin, Shellfish, Latex)
- **Medical Conditions:** (e.g. Hypertension, Asthma, Diabetes)
- **PWD Status & Special Assistance:** (e.g. Wheelchair user, Hearing impaired)

> This information is attached automatically whenever you submit an SOS, allowing dispatchers and paramedics to arrive prepared with the right equipment and medication.

---

## 7. Reporting a Public Road Hazard

For non-emergency community hazards (flooded streets, fallen trees, downed power lines, road obstructions):
1. Navigate to the **Report** tab and choose **Road Hazard**.
2. Take a photo/video of the obstruction.
3. Select the hazard category and submit.
4. The hazard appears as a cautionary icon on the MDRRMO map, helping responders and fellow citizens avoid impassable routes.

---

## 8. App Settings & Customization

- **Appearance:** Toggle Dark Theme or Reduce Animations for faster rendering.
- **Location:** Enable or disable automatic continuous background location fetching.
- **Map View:** Choose between **Street View** and **Satellite Imagery** as the default map layer.
- **Notifications:** Independently toggle dispatch updates and municipal broadcast alert notifications.
- **Media:** Enable "Save Captured Media to Device" to retain a copy of SOS photos in your device gallery.

---

## 9. Help Center & Direct Hotlines

The **Help** tab provides:
- **Direct Dial Hotlines:** One-tap calling to MDRRMO Globe and Smart emergency numbers.
- **Interactive Tour:** Step-by-step feature walkthroughs by chapter.
- **Searchable FAQs:** Quick answers regarding privacy, response times, and account security.
- **Feedback Form:** Direct line to submit bugs, questions, or suggestions to municipal administrators.
