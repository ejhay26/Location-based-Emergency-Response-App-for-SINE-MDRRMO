# Citizen User Guide

Step-by-step instructions on registering, logging in, and using the SINE MDRRMO Emergency Response App as a resident of San Isidro, Nueva Ecija.

---

## 1. Registering an Account

Registration consists of four guided, streamlined steps:

### Step 1: Personal Details & Residence
- **Personal Information:** First name, last name, normalized Philippine mobile number (`639...`), and dynamic 3-part birthdate (Month, Day, Year).
- **Resident Barangay:** Select your home barangay in San Isidro (Alua, Calaba, Malapit, Mangga, Poblacion, Pulo, San Roque, Santo Cristo, Tabon).

---

### Step 2: Account Credentials & Security
- **Smart Username Suggestions:** Live availability check with intelligent name-based suggestion chips generated from your name and barangay.
- **Email Address:** Real-time email uniqueness verification.
- **Password Security:** 5-point security checklist (minimum 8 characters, uppercase, lowercase, number, special symbol) with live match indicator (turns green upon confirmation).

---

### Step 3: Philippine Government ID Verification & Legal Agreement
- **6 Verified Philippine Government ID Types:**
  1. **Philippine National ID (PhilSys / ePhilID):** 16-digit PCN format (`XXXX-XXXX-XXXX-XXXX`).
  2. **Driver's License (LTO):** LTO License number (`X00-00-000000`) and expiration date.
  3. **Philippine Passport (DFA):** DFA Passport number and expiration date.
  4. **UMID / SSS ID:** Common Reference Number (`0000-0000000-0`).
  5. **Postal ID (PhilPost):** PRN number and card expiration date.
  6. **PRC ID / Professional License:** Regulated profession, 7-digit registration number, and expiry date.
- **Front & Back Photo Capture:** Live camera photo of both the Front and Back of your valid ID card.
- **Live Selfie with ID:** Live selfie holding your ID next to your chest or face.
- **Preferred Verification Channel:** Choose whether to receive your 6-digit code via **Email OTP** or **SMS OTP (PhilSMS)**.
- **Terms & Privacy Modal:** Review and accept the Terms of Service (emergency scope, 3-strike false alarm policy) and Privacy Policy (Data Privacy Act RA 10173).

---

### Step 4: Verification Code (OTP)
- **Enter Verification Code:** Enter the 6-digit code sent to your chosen channel.
- On Android devices, the app automatically listens for the incoming PhilSMS code and presents a 1-tap autofill dialog.

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
- **Passwordless OTP Login:** Tap "Login with OTP instead", enter your registered email or phone number, and enter the 6-digit code received.

### Forgot Password
1. Tap **Forgot Password?** on the login screen.
2. Choose Email or Phone recovery and receive a 6-digit OTP.
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
[Submit SOS] ──▶ Instant Real-Time Alert to MDRRMO Dispatchers
```

### Offline SOS Queueing
If you have no cellular signal or internet connection during a disaster:
- The app automatically saves your SOS report, GPS position, and media proof to your device's local **IndexedDB storage**.
- The moment your device reconnects to a mobile network or Wi-Fi, the report is automatically synced and transmitted to the dispatch office.

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
- **Reporting & Media:**
  - **Photo Crop Editor:** Toggle whether to open the crop editor after capturing an image or attach photos immediately for high-speed reporting.
  - **Video Trim Editor:** Toggle whether to manually select video clip segments or automatically trim the first 10 seconds in the background.
  - **Save Captured Media to Device:** Option to automatically save captured incident photos/videos to your phone's camera roll.

---

## 9. Help Center & Direct Hotlines

The **Help** tab provides:
- **Direct Dial Hotlines:** One-tap calling to MDRRMO Globe and Smart emergency numbers.
- **Interactive Tour:** Step-by-step feature walkthroughs by chapter.
- **Searchable FAQs:** Quick answers regarding privacy, response times, and account security.
- **Feedback Form:** Direct line to submit bugs, questions, or suggestions to municipal administrators.
