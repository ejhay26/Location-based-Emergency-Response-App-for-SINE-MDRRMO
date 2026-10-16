# Data Flow Diagrams (DFD)

This document provides the formal Data Flow Diagrams (Context Diagram Level 0 and System Decomposition Level 1) for the **SINE MDRRMO Location-Based Emergency Response System**, designed for inclusion in **Chapter 3 (System Methodology & Architecture)** of the capstone manuscript.

---

## 1. System Context and Entities

The system facilitates emergency response operations across the Municipality of San Isidro, Nueva Ecija. Data flows between the system boundary and five external entities:

1. **Citizen / Resident:** Initiates account registration, provides identity verification documents, submits emergency SOS alerts with camera and GPS evidence, logs non-emergency road hazards, and receives safety advisories.
2. **Municipal Dispatcher:** Monitors live incoming incidents on the operations desk, assigns response agencies and protocol directives, clears road hazards, and issues town-wide or barangay-scoped broadcasts.
3. **Master Administrator:** Reviews citizen government ID verifications, manages staff credentials, enforces disciplinary strikes, reviews feedback, and oversees disaster recovery backups.
4. **Inter-Agency Response Teams (BFP, PNP, Rescue, RHU):** Receives incident dispatch authorization, conducts on-scene mitigation, and coordinates incident clearance with dispatchers.
5. **External Cloud Services:**
   - **PhilSMS API:** Transactional SMS gateway delivering one-time passwords (OTP).
   - **Resend Mailer:** Transactional email gateway for email OTP and account verification notices.
   - **Firebase Cloud Messaging (FCM v1):** Push notifications for backgrounded mobile devices.
   - **Philippine Statistics Authority (PSA) GeoJSON:** Boundary definitions for ray-casting municipal territory validation.

---

## 2. DFD Level 0: Context Diagram

The Context Diagram establishes the overall boundary of the system (**0.0**) and diagrams all primary input and output data flows with external entities.

```mermaid
flowchart LR
    Citizen["Citizen / Resident"]
    Dispatcher["Municipal Dispatcher"]
    Admin["Master Administrator"]
    Responders["Inter-Agency Response Teams<br/>(BFP, PNP, Rescue, RHU)"]
    CloudServices["External Cloud Gateways<br/>(PhilSMS, Resend, FCM, PSA GeoJSON)"]

    System["0.0<br/>SINE MDRRMO Location-Based<br/>Emergency Response System"]

    Citizen -->|"Registration Info, Valid IDs, Selfie, OTP"| System
    Citizen -->|"Emergency SOS, Live Proof, GPS, Offline Queue"| System
    Citizen -->|"Road Hazard Reports, Feedback, Medical Profile"| System
    System -->|"Verification Status, OTP Codes, Push Notifications"| Citizen
    System -->|"Targeted Broadcast Advisories, Incident Status Updates"| Citizen

    Dispatcher -->|"Dispatch Assignment (Unit & Vehicle), Resolve Action"| System
    Dispatcher -->|"Hazard Clearance, False Alarm Tagging"| System
    Dispatcher -->|"Broadcast Advisory, Scheduled Alerts, Saved Drafts"| System
    System -->|"Live Incident Queue, Real-Time Map Pins, Sirens"| Dispatcher
    System -->|"Golden Minute Medical Profile, Analytics, Archive Logs"| Dispatcher

    Admin -->|"ID Verification Approval/Rejection, Disciplinary Strikes"| System
    Admin -->|"Staff Dispatcher Provisioning, System Settings, DR Backups"| System
    System -->|"Pending Applicant Queue, Citizen Directory, Audit Logs"| Admin
    System -->|"Database Snapshots, Gap Salvage Reports"| Admin

    System -->|"Incident Dispatch Authorization & Protocol Details"| Responders
    Responders -->|"Incident Mitigation & Scene Clearance Feedback"| System

    System -->|"SMS OTP Payload, Welcome Email, FCM Push Data"| CloudServices
    CloudServices -->|"SMS/Email Delivery Status, PSA Boundary Data"| System
```

---

## 3. Data Stores Inventory

Data stores correspond to the normalized database tables in MariaDB (`emergencydb`) and server storage:

| Data Store ID | Data Store Name | Primary Tables / Files | Description |
| :--- | :--- | :--- | :--- |
| **D1** | Users, Profiles & KYC Verifications | `users`, `user_profiles`, `user_verifications` | Stores credentials, demographic data, and dual-sided valid ID proof files. |
| **D2** | Golden Minute Medical Profiles | `user_medical_profiles` | Stores emergency health data (blood type, allergies, conditions, PWD status). |
| **D3** | PSA Boundaries & Barangays | `barangays`, `san-isidro-barangays.geojson` | Reference geographic data for San Isidro's 9 official barangays. |
| **D4** | Emergency Requests & Media Proof | `emergency_requests`, `/storage/emergencies/` | SOS records, camera photos/videos, timestamps, status, and coordinates. |
| **D5** | Public Road Hazards | `hazards`, `/storage/hazards/` | Citizen hazard reports with photo evidence and clearance state. |
| **D6** | Inter-Agency Protocol Dispatches | `dispatch` | Municipal dispatch records, authorized response agencies, action notes, and deployment timestamps. |
| **D7** | Broadcast Advisories & Drafts | `broadcasts`, `broadcast_barangays` | Public alert records, draft composer entries, schedules, and media files. |
| **D8** | Audit Trails, Strikes & Backups | `false_alarm_strikes`, `feedback`, `backups/` | Disciplinary strike logs, community bug reports, and compressed database snapshots. |

---

## 4. DFD Level 1: System Decomposition Diagram

The Level 1 diagram decomposes the system into seven core functional processes and maps the exact data exchange between processes, entities, and data stores.

```mermaid
flowchart TD
    E1["Citizen"]
    E2["Municipal Dispatcher"]
    E3["Master Administrator"]
    E4["Inter-Agency Response Teams<br/>(BFP, PNP, Rescue, RHU)"]
    E5["Cloud Services<br/>(PhilSMS, Resend, FCM)"]

    D1[("D1: Users, Profiles & KYC Verifications")]
    D2[("D2: Golden Minute Medical Profiles")]
    D3[("D3: PSA Boundaries & Barangays")]
    D4[("D4: Emergency Requests & Media Proof")]
    D5[("D5: Public Road Hazards")]
    D6[("D6: Inter-Agency Protocol Dispatches")]
    D7[("D7: Broadcast Advisories & Drafts")]
    D8[("D8: Audit Trails, Strikes & Backups")]

    P1["1.0<br/>Account Registration,<br/>KYC & Authentication"]
    E1 -->|"Demographics, Valid ID, Selfie"| P1
    P1 -->|"Dispatch OTP Request"| E5
    E5 -->|"Delivery Confirmation"| P1
    P1 -->|"Write Pending Account & IDs"| D1
    E1 -->|"Configure Medical Info"| P1
    P1 -->|"Write Health Data"| D2
    E3 -->|"Inspect & Approve/Reject KYC"| P1
    P1 -->|"Update Account Status (Active/Banned)"| D1

    P2["2.0<br/>Authoritative Geofencing<br/>& Boundary Resolution"]
    D3 -->|"PSA Barangay Polygon Boundaries"| P2

    P3["3.0<br/>Emergency SOS Reporting<br/>& Offline Queue Sync"]
    E1 -->|"GPS, Live Camera Proof, Incident Type"| P3
    P3 -->|"Query Coordinates"| P2
    P2 -->|"Authoritative Barangay ID"| P3
    P3 -->|"Insert SOS Record & Storage Proof"| D4
    P3 -->|"Fetch Pre-Hospital Medical Data"| D2
    D2 -->|"Blood Type, Allergies, PWD"| P3
    P3 -->|"Broadcast Event via WebSockets"| E2

    P4["4.0<br/>Inter-Agency Protocol Dispatching<br/>& Status Lifecycle"]
    D4 -->|"Active Emergency Queue"| P4
    D6 -->|"Configured Response Agencies"| P4
    E2 -->|"Assign Responding Agency & Notes"| P4
    P4 -->|"Persist Dispatch Record"| D6
    P4 -->|"Update Status to Dispatched"| D4
    P4 -->|"Push Alert (Help Dispatched)"| E1
    P4 -->|"Coordination & Protocol Deployment"| E4
    E4 -->|"Incident Mitigation & Scene Clearance"| P4
    E2 -->|"Resolve Incident"| P4
    P4 -->|"Mark Dispatch Completed"| D6
    P4 -->|"Archive Resolved Request"| D4

    P5["5.0<br/>Road Hazard Reporting<br/>& Clearance"]
    E1 -->|"Hazard Description, Proof, GPS"| P5
    P5 -->|"Validate Barangay"| P2
    P5 -->|"Store Hazard Report"| D5
    D5 -->|"Active Hazard Layer"| E2
    E2 -->|"Mark Hazard Resolved"| P5
    P5 -->|"Update Hazard Status"| D5

    P6["6.0<br/>Public Advisory Broadcast<br/>& Delivery Scheduling"]
    E2 -->|"Advisory Message, Media, Schedule, Draft"| P6
    P6 -->|"Save Draft / Store Broadcast"| D7
    D7 -->|"Targeted Barangay Scope"| P6
    P6 -->|"Push Notification & App Banner"| E1
    P6 -->|"Dispatch Push via FCM"| E5

    P7["7.0<br/>Strike Moderation, Analytics<br/>& Disaster Recovery"]
    E2 -->|"Tag Confirmed False Alarm"| P7
    P7 -->|"Increment Strikes (3 = Auto-Ban)"| D1
    P7 -->|"Record Disciplinary Entry"| D8
    D4 -->|"Query Historical Metrics"| P7
    D5 -->|"Query Hazard Trends"| P7
    P7 -->|"Render Analytics Visualizations"| E2
    E3 -->|"Trigger Backup / Restore / Salvage"| P7
    P7 -->|"Create Snapshot / Safety Backup"| D8
    P7 -->|"Scan Delta Gap & Re-Notify"| E5
```

---

## 5. Detailed Functional Process Descriptions

### 1.0 Account Registration, KYC & Authentication
- **Function:** Handles resident onboarding, credential verification, dual-sided government ID capture, live selfie verification, multi-channel OTP delivery (PhilSMS/Resend), and role-based session management.
- **Inbound Data:** Registrant personal data, normalized phone number, password, government ID number, photos of ID (front and back), live selfie holding the ID, 6-digit OTP code, and administrator review actions.
- **Outbound Data:** Session bearer tokens, verification state changes, Welcome notifications, and SMS/Email OTP requests.
- **Data Stores:** Reads and writes to `D1` (User Accounts) and `D2` (Medical Profiles).

### 2.0 Authoritative Geofencing & Boundary Resolution
- **Function:** Executes server-side ray-casting point-in-polygon calculations against official PSA GeoJSON boundary coordinates to assign an authoritative barangay to every incoming coordinate.
- **Inbound Data:** Raw latitude and longitude coordinates submitted by citizen mobile devices.
- **Outbound Data:** Authoritative barangay identifier or out-of-bounds rejection error.
- **Data Stores:** Reads from `D3` (PSA Boundaries & Barangays).

### 3.0 Emergency SOS Reporting & Offline Queue Sync
- **Function:** Receives emergency alerts from citizens. In low-connectivity situations, the client stores reports locally in IndexedDB and dispatches them chronologically upon network restoration. It associates incoming coordinates with authoritative boundaries and attaches the citizen's medical profile.
- **Inbound Data:** GPS coordinates, incident category (Medical, Fire, Flood, Crime, Others), incident description, and live camera evidence (photos or 10-second video).
- **Outbound Data:** Real-time WebSocket incident events transmitted to dispatcher consoles, sound alert triggers, and emergency records.
- **Data Stores:** Writes to `D4` (Emergency Requests); reads from `D2` (Medical Profiles) and `D3` (Boundaries).

### 4.0 Inter-Agency Protocol Dispatching & Status Lifecycle
- **Function:** Enables dispatchers to assign appropriate response agencies (MDRRMO Rescue Team, San Isidro BFP, San Isidro PNP, RHU) and protocol action notes to active incidents. Manages the incident lifecycle (`Pending` -> `Dispatched` -> `Resolved`).
- **Inbound Data:** Dispatcher agency selection, coordination notes, and on-scene resolution confirmation.
- **Outbound Data:** Push notifications sent to citizens (`Dispatched`, `Resolved`), dispatch protocol records, and updated live map marker states.
- **Data Stores:** Reads and writes to `D4` (Emergency Requests) and `D6` (Inter-Agency Protocol Dispatches).

### 5.0 Road Hazard Reporting & Clearance
- **Function:** Ingests crowd-sourced reports of road obstructions, fallen trees, downed power lines, and flooded roads to assist municipal safety awareness and route planning.
- **Inbound Data:** Hazard category, photo/video proof, location coordinates, and dispatcher clearance confirmation.
- **Outbound Data:** Active hazard markers on dispatcher maps and citizen community hazard feeds.
- **Data Stores:** Reads and writes to `D5` (Public Road Hazards); reads from `D3` (Boundaries).

### 6.0 Public Advisory Broadcast & Delivery Scheduling
- **Function:** Manages the creation, draft review, scheduling, and transmission of municipal emergency broadcasts. Supports town-wide broadcasts or scoped deliveries targeting specific barangays.
- **Inbound Data:** Announcement headline, body text, up to 4 attached images or videos, target barangays, delivery schedule timestamp (`scheduled_at`), and draft status flag.
- **Outbound Data:** Push notifications via Firebase Cloud Messaging, active alert banners on citizen home dashboards, and scheduled release queues.
- **Data Stores:** Reads and writes to `D7` (Broadcast Advisories & Drafts).

### 7.0 Strike Moderation, Analytics & Disaster Recovery
- **Function:** Enforces the 3-strike disciplinary policy for verified false alarms, generates aggregated operational charts (incident volume, response distribution, hazard frequency), and executes automated database backup snapshots and delta gap salvaging.
- **Inbound Data:** Dispatcher false alarm confirmation, administrative date range queries, backup CLI commands (`create`, `restore`, `salvage`, `notify`).
- **Outbound Data:** Automated citizen account suspensions (strike 3), Chart.js data visualizations, downloadable certified situation summary PDFs, compressed `.sql.gz` archives, and recovery gap SMS/email notifications.
- **Data Stores:** Reads and writes to `D1` (User Accounts), `D4` (Emergency Requests), `D5` (Hazards), and `D8` (Audit & Backups).
