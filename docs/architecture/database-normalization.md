# Database Normalization: SINE MDRRMO Emergency Response System

This document presents the step-by-step relational database normalization process for the **SINE MDRRMO Emergency Response System** (`emergencydb`). It traces the transformation of the system's data from an Unnormalized Form (UNF) through First Normal Form (1NF), Second Normal Form (2NF), Third Normal Form (3NF), and Boyce-Codd Normal Form (BCNF).

---

## 1. Unnormalized Form (UNF)

In an unnormalized structure, all municipal emergency response data, citizen personal details, medical history, incident reports, and dispatch logs are stored in a single flat ledger.

### 1.1 UNF Universal Table Representation

| user_id | email | full_name | phone | barangay | blood_type | allergies | id_type | id_number | request_id | incident_type | lat | lng | req_time | dispatch_id | agency | dispatch_time | arrival_time |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 101 | juan@sine.gov.ph | Juan Dela Cruz | 09171234567 | Tabon | O+ | Penicillin, Dust | PhilSys | 1234-5678-9012 | 5001, 5004 | Flood, Medical | 15.2612, 15.2620 | 120.9105, 120.9110 | 10:30, 14:15 | 801, 804 | Rescue Team A, Ambulance | 10:35, 14:20 | 10:48, 14:32 |
| 102 | maria@sine.gov.ph | Maria Santos | 09189876543 | Alua | AB- | None | Driver's | D02-19-123456 | 5002 | Vehicular Accident | 15.2750 | 120.9230 | 11:00 | 802 | PNP, BFP | 11:05 | 11:18 |
| 103 | pedro@sine.gov.ph | Pedro Reyes | 09205551234 | Malapit | B+ | Aspirin | PhilSys | 9876-5432-1098 | (null) | (null) | (null) | (null) | (null) | (null) | (null) | (null) | (null) |

### 1.2 Anomalies Present in UNF

1. **Insertion Anomaly**:
   - A new barangay (e.g., *Poblacion*) cannot be recorded unless an emergency or citizen is registered in it.
   - A newly registered citizen (e.g., Pedro Reyes, `user_id = 103`) has null values for all emergency and dispatch attributes.
2. **Update Anomaly**:
   - If Juan Dela Cruz updates his mobile phone number, every row where Juan has filed an emergency must be updated. Any missed row results in data inconsistency during critical dispatch calls.
3. **Deletion Anomaly**:
   - If the vehicular incident `request_id = 5002` is resolved and purged from the emergency log, Maria Santos's citizen account, valid government ID verification, and medical profile are deleted from the system.

---

## 2. Conversion to First Normal Form (1NF)

### 2.1 1NF Requirements
- Remove repeating groups and multi-valued attributes (e.g., comma-separated `request_id`, `incident_type`, `agency`, `allergies`).
- Ensure all attribute values are atomic.
- Define a primary key that uniquely identifies each tuple.

### 2.2 1NF Flattened Relation

Repeating groups are split into discrete rows. The composite primary key is defined as:
`{ user_id, request_id, dispatch_id }` (with surrogate null-handling for inactive accounts).

| user_id [PK] | email | first_name | last_name | phone | barangay | blood_type | allergies | valid_id_type | valid_id_number | request_id [PK] | incident_type | latitude | longitude | req_time | dispatch_id [PK] | agency | dispatch_time | arrival_time |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 101 | juan@sine.gov.ph | Juan | Dela Cruz | 09171234567 | Tabon | O+ | Penicillin | PhilSys | 1234-5678-9012 | 5001 | Flood | 15.261240 | 120.910510 | 10:30:00 | 801 | Rescue Team A | 10:35:00 | 10:48:00 |
| 101 | juan@sine.gov.ph | Juan | Dela Cruz | 09171234567 | Tabon | O+ | Dust | PhilSys | 1234-5678-9012 | 5001 | Flood | 15.261240 | 120.910510 | 10:30:00 | 801 | Rescue Team A | 10:35:00 | 10:48:00 |
| 101 | juan@sine.gov.ph | Juan | Dela Cruz | 09171234567 | Tabon | O+ | Penicillin | PhilSys | 1234-5678-9012 | 5004 | Medical | 15.262000 | 120.911000 | 14:15:00 | 804 | Ambulance | 14:20:00 | 14:32:00 |
| 102 | maria@sine.gov.ph | Maria | Santos | 09189876543 | Alua | AB- | None | Driver's | D02-19-123456 | 5002 | Vehicular Accident | 15.275000 | 120.923000 | 11:00:00 | 802 | PNP | 11:05:00 | 11:18:00 |
| 102 | maria@sine.gov.ph | Maria | Santos | 09189876543 | Alua | AB- | None | Driver's | D02-19-123456 | 5002 | Vehicular Accident | 15.275000 | 120.923000 | 11:00:00 | 803 | BFP | 11:05:00 | 11:22:00 |

### 2.3 1NF Relation Schema
```text
R_1NF( user_id [PK], request_id [PK], dispatch_id [PK], email, first_name, last_name, 
       phone, barangay, blood_type, allergies, valid_id_type, valid_id_number, 
       incident_type, latitude, longitude, req_time, agency, dispatch_time, arrival_time )
```

---

## 3. Conversion to Second Normal Form (2NF)

### 3.1 2NF Requirements
- The relation must be in 1NF.
- Eliminate all **Partial Functional Dependencies**: Every non-key attribute must depend on the *entire* primary key, not just a subset of the composite key `{ user_id, request_id, dispatch_id }`.

### 3.2 Identification of Partial Dependencies in 1NF

- **Dependency 1 (Depends only on `user_id`)**:
  ```text
  user_id -> { email, first_name, last_name, phone, barangay, blood_type, allergies, valid_id_type, valid_id_number }
  ```
  *(Citizen profile and ID data depend solely on user_id, not on the emergency or dispatch incident.)*

- **Dependency 2 (Depends only on `request_id`)**:
  ```text
  request_id -> { user_id, incident_type, latitude, longitude, req_time }
  ```
  *(Emergency report details depend solely on the incident request_id, not on the responding agency dispatch.)*

- **Dependency 3 (Depends on `dispatch_id`)**:
  ```text
  dispatch_id -> { request_id, agency, dispatch_time, arrival_time }
  ```
  *(Dispatch deployment logs depend on dispatch_id.)*

### 3.3 2NF Decomposition Result

#### Table 1: `USERS_2NF`
```text
USERS_2NF( user_id [PK], email, first_name, last_name, phone, barangay, 
           blood_type, allergies, valid_id_type, valid_id_number )
```

#### Table 2: `EMERGENCY_REQUESTS_2NF`
```text
EMERGENCY_REQUESTS_2NF( request_id [PK], user_id [FK], incident_type, 
                        latitude, longitude, req_time )
```

#### Table 3: `DISPATCH_2NF`
```text
DISPATCH_2NF( dispatch_id [PK], request_id [FK], agency, 
              dispatch_time, arrival_time )
```

---

## 4. Conversion to Third Normal Form (3NF)

### 4.1 3NF Requirements
- The relation must be in 2NF.
- Eliminate all **Transitive Dependencies**: Non-key attributes must not depend on other non-key attributes (`X -> Y -> Z`).

### 4.2 Identification of Transitive Dependencies

#### A. Transitive Dependencies in `USERS_2NF`:
1. **Demographics vs. Authentication**:
   - `user_id -> username, first_name, last_name, phone, birthdate, barangay_id`
   - Authentication credentials (`email`, `password_hash`, `role`, `account_status`) must be separated from profile demographics.
2. **Identity Document Verification**:
   - Verification documents have their own review lifecycle (`pending`, `approved`, `rejected`) and reviewer audits (`reviewed_by`, `reviewed_at`). They do not describe the user core credentials.
3. **Medical Health Profile**:
   - `user_id -> profile_id -> { blood_type, allergies, medical_conditions, pwd_status }`
   - Paramedic medical records are governed by medical privacy laws and belong to their own domain.
4. **Barangay Geography**:
   - `user_id -> barangay_id -> barangay_name`
   - `barangay_name` is transitively dependent on `user_id` through `barangay_id`.

#### B. Transitive Dependencies in `EMERGENCY_REQUESTS_2NF`:
1. **Incident Classification**:
   - `request_id -> incident_type_id -> incident_name`
   - `incident_name` is transitively dependent on `request_id` through `incident_type_id`.
2. **Barangay Location**:
   - `request_id -> barangay_id -> barangay_name`
   - The geographic barangay of the emergency is determined by `barangay_id`.

### 4.3 3NF Decomposition Result

Decomposing the relations to remove transitive dependencies yields the following normalized entities:

#### 1. `users` (Core IAM & Authentication)
```text
users( user_id [PK], email [UK], password, role, account_status, false_alarm_strikes, created_at, updated_at )
```

#### 2. `user_profiles` (Citizen & Personnel Demographics)
```text
user_profiles( profile_id [PK], user_id [FK, UK], first_name, last_name, username [UK], phone, birthdate, profile_picture, barangay_id [FK], setup_completed )
```

#### 3. `user_verifications` (KYC Government ID Audits)
```text
user_verifications( verification_id [PK], user_id [FK], valid_id_type, valid_id_number, valid_id_expiry, valid_id_proof, valid_id_proof_back, selfie_with_id_proof, verification_status, rejection_reason, reviewed_by [FK], reviewed_at )
```

#### 4. `user_medical_profiles` (Emergency Paramedic Records)
```text
user_medical_profiles( profile_id [PK], user_id [FK, UK], blood_type, allergies, medical_conditions, pwd_status, created_at, updated_at )
```

#### 5. `barangays` (Municipal Geographic Reference)
```text
barangays( barangay_id [PK], barangay_name )
```

#### 6. `incident_types` (Emergency Classification)
```text
incident_types( incident_type_id [PK], incident_name )
```

#### 7. `emergency_requests` (Incident Filings)
```text
emergency_requests( request_id [PK], user_id [FK], incident_type_id [FK], barangay_id [FK], description, proof_files, latitude, longitude, status, is_false_alarm, request_time )
```

#### 8. `hazards` (Public Safety Hazard Reports)
```text
hazards( hazard_id [PK], user_id [FK], barangay_id [FK], hazard_type, description, proof_files, latitude, longitude, status, created_at )
```

#### 9. `dispatch` (Responder Deployment Logs)
```text
dispatch( dispatch_id [PK], request_id [FK], agency, notes, dispatch_time, arrival_time, status )
```

#### 10. `broadcasts` (MDRRMO Public Advisories)
```text
broadcasts( broadcast_id [PK], title, message, media_files, is_active, is_draft, scheduled_at, created_at )
```

#### 11. `broadcast_barangays` (Targeted Broadcast Junction)
```text
broadcast_barangays( broadcast_id [PK, FK], barangay_id [PK, FK] )
```

#### 12. `user_settings` (Client Preferences)
```text
user_settings( id [PK], user_id [FK], key, value, updated_at )
```

---

## 5. Boyce-Codd Normal Form (BCNF) Verification

### 5.1 BCNF Rule
A relation is in **BCNF** if and only if for every functional dependency `X -> Y`, the determinant **`X` is a superkey**.

### 5.2 Table-by-Table Verification

| Relation | Candidate Keys | Functional Dependencies | Determinant Status | Satisfies BCNF? |
| :--- | :--- | :--- | :--- | :--- |
| `users` | `user_id`, `email` | `user_id -> { email, password, role, account_status }`<br>`email -> { user_id }` | Both `user_id` and `email` are candidate keys | **Yes** |
| `user_profiles` | `profile_id`, `user_id`, `username` | `profile_id -> { ... }`<br>`user_id -> { ... }`<br>`username -> { ... }` | All determinants are candidate keys | **Yes** |
| `user_verifications` | `verification_id` | `verification_id -> { user_id, valid_id_number, verification_status, ... }` | `verification_id` is candidate key | **Yes** |
| `user_medical_profiles` | `profile_id`, `user_id` | `profile_id -> { user_id, blood_type, allergies, ... }`<br>`user_id -> { profile_id, ... }` | All determinants are candidate keys | **Yes** |
| `barangays` | `barangay_id`, `barangay_name` | `barangay_id -> barangay_name`<br>`barangay_name -> barangay_id` | Both determinants are candidate keys | **Yes** |
| `incident_types` | `incident_type_id`, `incident_name` | `incident_type_id -> incident_name`<br>`incident_name -> incident_type_id` | Both determinants are candidate keys | **Yes** |
| `dispatch` | `dispatch_id` | `dispatch_id -> { request_id, agency, dispatch_time, arrival_time, status }` | `dispatch_id` is candidate key | **Yes** |
| `broadcast_barangays` | `{ broadcast_id, barangay_id }` | No non-trivial dependencies beyond candidate key | Composite key is primary key | **Yes** |
| `user_settings` | `id`, `{ user_id, key }` | `id -> { user_id, key, value }`<br>`{ user_id, key } -> { value, updated_at }` | Both are candidate keys | **Yes** |
| `emergency_requests` | `request_id` | `request_id -> { user_id, incident_type_id, barangay_id, lat, lng, status }` | `request_id` is candidate key | **Yes** |

---

## 6. Controlled Denormalization Justification

While the schema satisfies 3NF and BCNF, controlled denormalization is purposefully adopted for mission-critical emergency dispatch performance:

1. **Direct GPS Coordinates on Emergency Requests & Hazards**:
   - Instead of linking each incident to an address lookup table or street centerline relation, `latitude` (`DECIMAL(10,8)`) and `longitude` (`DECIMAL(11,8)`) are embedded directly in `emergency_requests` and `hazards`.
   - *Justification*: Enables sub-millisecond bounding-box B-Tree index scans (`WHERE latitude BETWEEN ... AND longitude BETWEEN ...`) for real-time radar mapping and dispatcher screen refreshes without expensive relational joins.
2. **Structured JSON Arrays for Media Proofs (`proof_files`)**:
   - Mobile citizen incident uploads store image/video file path arrays directly in a `longtext` JSON column rather than a dedicated 1:N `incident_attachments` table.
   - *Justification*: Guarantees single-transaction atomic ingestion during offline-to-online queue synchronization when citizens re-establish intermittent 4G/LTE connectivity.
