# Database Normalization Architecture & Tabular Decomposition

This document provides the formal database normalization reference for the **SINE MDRRMO Emergency Response System** (`emergencydb`, Version `0.93.4`). It presents the step-by-step mathematical and relational progression from **Unnormalized Form (UNF)** through **First Normal Form (1NF)**, **Second Normal Form (2NF)**, **Third Normal Form (3NF)**, and **Boyce-Codd Normal Form (BCNF)**.

All normal forms are demonstrated with explicit relational tables, operational municipal data records, primary and foreign key designations, and anomaly resolution analyses suitable for academic capstone defense and technical review.

---

## 1. Normalization Objectives & Anomaly Mitigation

Relational normalization systematically eliminates data redundancy while safeguarding data integrity across life-critical emergency dispatch and citizen reporting workflows.

```text
+---------------------+     Remove Repeating Groups      +---------------------+
|                     |     and Non-Atomic Values        |                     |
|  Unnormalized Form  | -------------------------------> |  First Normal Form  |
|        (UNF)        |                                  |        (1NF)        |
+---------------------+                                  +---------------------+
                                                                    |
                                    Remove Partial                  |
                                    Dependencies                    v
+---------------------+     Remove Transitive            +---------------------+
|                     |     Dependencies                 |                     |
|  Third Normal Form  | <------------------------------- | Second Normal Form  |
|        (3NF)        |                                  |        (2NF)        |
+---------------------+                                  +---------------------+
           |
           | Ensure Every Determinant is a Superkey
           v
+---------------------+
|  Boyce-Codd Normal  | (Strict BCNF Verification)
|     Form (BCNF)     |
+---------------------+
```

### The Three Critical Relational Anomalies Resolved

1. **Insertion Anomaly**:
   - *Problem in Unnormalized Data*: A new municipal barangay (e.g., `San Roque`) cannot be registered in the database without inventing a dummy citizen or a fake emergency report. Similarly, a newly registered citizen cannot exist without immediately filing an emergency.
   - *Resolution*: Entities (`barangays`, `users`, `emergency_requests`) exist independently in their own relations.

2. **Update Anomaly**:
   - *Problem in Unnormalized Data*: If a citizen updates their emergency contact telephone number, the update must be repeated across every incident and dispatch row ever logged for that user. If a single row is missed, first responders receive conflicting phone numbers during life-threatening crises.
   - *Resolution*: Citizen demographic data is stored once in `user_profiles`, referenced by foreign keys.

3. **Deletion Anomaly**:
   - *Problem in Unnormalized Data*: When an old or resolved emergency incident (e.g., `request_id = 5002`) is archived or purged from transactional storage, the citizen's user account, identity verification documents, and medical allergy records are inadvertently erased.
   - *Resolution*: Historical transactional records (`emergency_requests`, `dispatch`) reference independent entity records without cascading deletions to master user tables.

---

## 2. Unnormalized Form (UNF)

In an unnormalized architecture, all municipal entities—citizen identity credentials, government KYC verifications, health/medical profiles, emergency SOS reports, and responder dispatch logs—are pooled into a single flat universal relation.

### 2.1 Universal Relation Schema
```text
R_UNF( user_id, email, password, role, first_name, last_name, phone_number, birthdate,
       barangay_name, blood_type, allergies, medical_conditions, pwd_status,
       id_type, id_number, id_front_path, id_back_path, selfie_path, verification_status,
       request_id, incident_name, description, proof_files, latitude, longitude,
       request_status, is_false_alarm, request_time,
       dispatch_id, agency, notes, dispatched_at, arrived_at, dispatch_status )
```

### 2.2 UNF Universal Table (Operational Municipal Data)

The table below illustrates multi-valued non-atomic cells (e.g., multiple phone numbers, allergies) and repeating groups (e.g., multiple emergency filings and multi-agency dispatches combined into single tuples):

| user_id | email | first_name | last_name | phone_number | barangay_name | blood_type | allergies | id_type | id_number | request_id | incident_name | latitude | longitude | request_time | dispatch_id | agency | dispatched_at | arrived_at |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **101** | juan@gmail.com | Juan | Dela Cruz | 09171234567 | Tabon | O+ | Penicillin, Dust | PhilSys | 1234-5678-9012 | 5001, 5004 | Flood, Medical | 15.261240, 15.262000 | 120.910510, 120.911000 | 10:30, 14:15 | 801, 804 | Rescue Team A, Ambulance | 10:35, 14:20 | 10:48, 14:32 |
| **102** | maria@yahoo.com | Maria | Santos | 09189876543 | Alua | AB- | *None* | Driver's | D02-19-123456 | 5002 | Vehicular Accident | 15.275000 | 120.923000 | 11:00 | 802, 803 | PNP, BFP | 11:05, 11:06 | 11:18, 11:22 |
| **103** | pedro@sine.gov.ph | Pedro | Reyes | 09205551234 | Malapit | B+ | Aspirin | PhilSys | 9876-5432-1098 | *NULL* | *NULL* | *NULL* | *NULL* | *NULL* | *NULL* | *NULL* | *NULL* | *NULL* |
| **104** | elena@gmail.com | Elena | Ramos | 09192223344 | San Roque | A+ | Pollen | PhilSys | 4567-8901-2345 | 5003 | Fire Emergency | 15.281000 | 120.934000 | 12:15 | 805 | BFP | 12:18 | 12:29 |

### 2.3 UNF Structural Defects
1. **Repeating Groups**: A citizen filing several emergency SOS requests forces multiple sets of incident and dispatch fields into single cells or duplicate rows.
2. **Non-Atomic Values**: Attributes such as `allergies` contain composite values (`"Penicillin, Dust"`), violating the core requirement of relational atomicity.
3. **Data Redundancy**: Master citizen demographics (name, credentials, blood type) are duplicated across every emergency incident logged.

---

## 3. First Normal Form (1NF)

### 3.1 1NF Criteria
A relation is in **First Normal Form (1NF)** if and only if:
1. Every attribute contains only **atomic (indivisible)** values (no arrays, lists, or comma-separated strings).
2. There are **no repeating groups** of columns or rows.
3. Each row is uniquely identifiable by a defined **Primary Key**.

### 3.2 1NF Transformation
- All multi-valued fields (e.g., multiple allergies, multiple emergency filings) are unnested into individual distinct rows.
- A **Composite Primary Key** is established to uniquely identify each tuple:
  ```text
  Composite Primary Key = { user_id, request_id, dispatch_id, allergy_item }
  ```
- For citizens without emergency requests (e.g., registered citizens awaiting verification), default sentinel identifiers (`request_id = 0`, `dispatch_id = 0`) prevent null values in the primary key.

### 3.3 1NF Relation Schema
```text
R_1NF( user_id [PK], request_id [PK], dispatch_id [PK], allergy_item [PK],
       email, first_name, last_name, phone_number, barangay_name, blood_type,
       id_type, id_number, verification_status, incident_name, latitude,
       longitude, request_status, request_time, agency, dispatched_at,
       arrived_at, dispatch_status )
```

### 3.4 1NF Relational Table

| user_id [PK] | request_id [PK] | dispatch_id [PK] | allergy_item [PK] | email | first_name | last_name | phone_number | barangay_name | blood_type | id_type | id_number | incident_name | latitude | longitude | agency | dispatched_at | arrived_at |
| :---: | :---: | :---: | :--- | :--- | :--- | :--- | :--- | :--- | :---: | :--- | :--- | :--- | :---: | :---: | :--- | :---: | :---: |
| **101** | **5001** | **801** | Penicillin | juan@gmail.com | Juan | Dela Cruz | 09171234567 | Tabon | O+ | PhilSys | 1234-5678-9012 | Flood | 15.261240 | 120.910510 | Rescue Team A | 10:35:00 | 10:48:00 |
| **101** | **5001** | **801** | Dust | juan@gmail.com | Juan | Dela Cruz | 09171234567 | Tabon | O+ | PhilSys | 1234-5678-9012 | Flood | 15.261240 | 120.910510 | Rescue Team A | 10:35:00 | 10:48:00 |
| **101** | **5004** | **804** | Penicillin | juan@gmail.com | Juan | Dela Cruz | 09171234567 | Tabon | O+ | PhilSys | 1234-5678-9012 | Medical | 15.262000 | 120.911000 | Ambulance | 14:20:00 | 14:32:00 |
| **101** | **5004** | **804** | Dust | juan@gmail.com | Juan | Dela Cruz | 09171234567 | Tabon | O+ | PhilSys | 1234-5678-9012 | Medical | 15.262000 | 120.911000 | Ambulance | 14:20:00 | 14:32:00 |
| **102** | **5002** | **802** | None | maria@yahoo.com | Maria | Santos | 09189876543 | Alua | AB- | Driver's | D02-19-123456 | Vehicular | 15.275000 | 120.923000 | PNP | 11:05:00 | 11:18:00 |
| **102** | **5002** | **803** | None | maria@yahoo.com | Maria | Santos | 09189876543 | Alua | AB- | Driver's | D02-19-123456 | Vehicular | 15.275000 | 120.923000 | BFP | 11:06:00 | 11:22:00 |
| **103** | **0** | **0** | Aspirin | pedro@sine.gov.ph | Pedro | Reyes | 09205551234 | Malapit | B+ | PhilSys | 9876-5432-1098 | None | 0.000000 | 0.000000 | None | 00:00:00 | 00:00:00 |
| **104** | **5003** | **805** | Pollen | elena@gmail.com | Elena | Ramos | 09192223344 | San Roque | A+ | PhilSys | 4567-8901-2345 | Fire | 15.281000 | 120.934000 | BFP | 12:18:00 | 12:29:00 |

### 3.5 Why 1NF is Insufficient (Partial Functional Dependencies)
In `R_1NF`, non-prime attributes depend on only **part** of the composite primary key rather than the entire key:
- `user_id -> email, first_name, last_name, phone_number, barangay_name, blood_type, id_type, id_number` (depends solely on `user_id`).
- `request_id -> incident_name, latitude, longitude, request_status, request_time` (depends solely on `request_id`).
- `dispatch_id -> agency, dispatched_at, arrived_at, dispatch_status` (depends solely on `dispatch_id`).

Because of these **Partial Dependencies**, Juan Dela Cruz's personal information is repeated four separate times. This directly violates Second Normal Form (2NF).

---

## 4. Second Normal Form (2NF)

### 4.1 2NF Criteria
A relation is in **Second Normal Form (2NF)** if and only if:
1. It is already in **1NF**.
2. It contains **no partial functional dependencies**: every non-prime attribute is fully functionally dependent on the entire primary key.

### 4.2 2NF Decomposition
To eliminate partial dependencies, the relation is decomposed into independent functional entities governed by their respective primary keys:
1. **User Entity** (attributes depending strictly on `user_id`).
2. **Emergency Request Entity** (attributes depending strictly on `request_id`).
3. **Dispatch Deployment Entity** (attributes depending strictly on `dispatch_id`).
4. **Allergies Junction Entity** (attributes depending on `{ user_id, allergy_item }`).

---

### 4.3 2NF Decomposed Tables

#### Table 1: `USERS_2NF`
- **Primary Key**: `user_id`
- **Functional Dependency**: `user_id -> email, first_name, last_name, phone_number, barangay_name, blood_type, id_type, id_number, verification_status`

| user_id [PK] | email | first_name | last_name | phone_number | barangay_name | blood_type | id_type | id_number | verification_status |
| :---: | :--- | :--- | :--- | :--- | :--- | :---: | :--- | :--- | :--- |
| **101** | juan@gmail.com | Juan | Dela Cruz | 09171234567 | Tabon | O+ | PhilSys | 1234-5678-9012 | verified |
| **102** | maria@yahoo.com | Maria | Santos | 09189876543 | Alua | AB- | Driver's | D02-19-123456 | verified |
| **103** | pedro@sine.gov.ph | Pedro | Reyes | 09205551234 | Malapit | B+ | PhilSys | 9876-5432-1098 | verified |
| **104** | elena@gmail.com | Elena | Ramos | 09192223344 | San Roque | A+ | PhilSys | 4567-8901-2345 | pending |

---

#### Table 2: `USER_ALLERGIES_2NF`
- **Composite Primary Key**: `{ user_id, allergy_item }`
- **Foreign Key**: `user_id` references `USERS_2NF(user_id)`

| user_id [PK, FK] | allergy_item [PK] |
| :---: | :--- |
| **101** | Penicillin |
| **101** | Dust |
| **103** | Aspirin |
| **104** | Pollen |

---

#### Table 3: `EMERGENCY_REQUESTS_2NF`
- **Primary Key**: `request_id`
- **Foreign Key**: `user_id` references `USERS_2NF(user_id)`
- **Functional Dependency**: `request_id -> user_id, incident_name, latitude, longitude, request_status, request_time`

| request_id [PK] | user_id [FK] | incident_name | latitude | longitude | request_status | request_time |
| :---: | :---: | :--- | :---: | :---: | :--- | :--- |
| **5001** | 101 | Flood | 15.261240 | 120.910510 | resolved | 2026-08-20 10:30:00 |
| **5002** | 102 | Vehicular Accident | 15.275000 | 120.923000 | in_progress | 2026-08-20 11:00:00 |
| **5003** | 104 | Fire Emergency | 15.281000 | 120.934000 | on_scene | 2026-08-20 12:15:00 |
| **5004** | 101 | Medical Emergency | 15.262000 | 120.911000 | resolved | 2026-08-21 14:15:00 |

---

#### Table 4: `DISPATCH_2NF`
- **Primary Key**: `dispatch_id`
- **Foreign Key**: `request_id` references `EMERGENCY_REQUESTS_2NF(request_id)`
- **Functional Dependency**: `dispatch_id -> request_id, agency, dispatched_at, arrived_at, dispatch_status`

| dispatch_id [PK] | request_id [FK] | agency | dispatched_at | arrived_at | dispatch_status |
| :---: | :---: | :--- | :--- | :--- | :--- |
| **801** | 5001 | Rescue Team A | 2026-08-20 10:35:00 | 2026-08-20 10:48:00 | completed |
| **802** | 5002 | PNP | 2026-08-20 11:05:00 | 2026-08-20 11:18:00 | on_scene |
| **803** | 5002 | BFP | 2026-08-20 11:06:00 | 2026-08-20 11:22:00 | on_scene |
| **804** | 5004 | Ambulance Unit 1 | 2026-08-21 14:20:00 | 2026-08-21 14:32:00 | completed |
| **805** | 5003 | BFP Engine 4 | 2026-08-20 12:18:00 | 2026-08-20 12:29:00 | on_scene |

---

### 4.4 Why 2NF is Insufficient (Transitive Functional Dependencies)
While 2NF completely resolves partial dependencies, it still permits **Transitive Dependencies** (`X -> Y` and `Y -> Z`, therefore `X -> Z` where `Y` is not a candidate key):
- In `USERS_2NF`:
  - `user_id -> barangay_name`: Barangay names depend on municipal geographic definitions (`barangay_id -> barangay_name`), not on individual citizens.
  - `user_id -> id_number -> verification_status`: Government identity verification audits are an independent regulatory lifecycle.
  - `user_id -> blood_type, medical_conditions`: Health and paramedic information belongs to a specialized medical domain.
- In `EMERGENCY_REQUESTS_2NF`:
  - `request_id -> incident_name`: Incident descriptions depend on standardized emergency classifications (`incident_type_id -> incident_name`).

These transitive dependencies cause update and insertion anomalies. Decomposing to **Third Normal Form (3NF)** eliminates them entirely.

---

## 5. Third Normal Form (3NF)

### 5.1 3NF Criteria
A relation is in **Third Normal Form (3NF)** if and only if:
1. It is already in **2NF**.
2. It contains **no transitive dependencies**: no non-prime attribute is transitively dependent on any candidate key.
*(Formally, for every functional dependency `X -> A`, either `X` is a superkey, or `A` is a prime attribute).*

---

### 5.2 3NF Relational Tables with Live Production Schema

#### Entity 1: `barangays` (Municipal Geographic Lookup)
Eliminates duplicate municipal names and establishes spatial boundary keys.
- **Primary Key**: `barangay_id`

| barangay_id [PK] | barangay_name |
| :---: | :--- |
| **1** | Alua |
| **2** | Calaba |
| **3** | Malapit |
| **4** | Mangga |
| **5** | Poblacion |
| **6** | Pulo |
| **7** | San Roque |
| **8** | Santo Cristo |
| **9** | Tabon |

---

#### Entity 2: `incident_types` (Standardized Incident Classifications)
Eliminates repeating incident names across emergency reports.
- **Primary Key**: `incident_type_id`

| incident_type_id [PK] | incident_name |
| :---: | :--- |
| **1** | Flood |
| **2** | Fire |
| **3** | Vehicular Accident |
| **4** | Medical Emergency |
| **5** | Earthquake |

---

#### Entity 3: `users` (Core IAM & Account Credentials)
Maintains strict separation between authentication credentials and citizen profiles.
- **Primary Key**: `user_id`
- **Unique Key**: `email`

| user_id [PK] | email [UK] | password (bcrypt hash) | role | is_active | strikes | created_at |
| :---: | :--- | :--- | :--- | :---: | :---: | :--- |
| **101** | juan@gmail.com | `$2y$10$e8Q9...` | citizen | 1 | 0 | 2026-01-10 08:00:00 |
| **102** | maria@yahoo.com | `$2y$10$w9Z1...` | citizen | 1 | 0 | 2026-02-14 09:30:00 |
| **103** | pedro@sine.gov.ph | `$2y$10$k1M4...` | dispatcher | 1 | 0 | 2026-03-01 10:15:00 |
| **104** | elena@gmail.com | `$2y$10$p3T8...` | citizen | 1 | 0 | 2026-04-12 11:20:00 |

---

#### Entity 4: `user_profiles` (Citizen Demographics & Contact Records)
Contains citizen personal identity information linked by foreign key.
- **Primary Key**: `profile_id`
- **Foreign Keys**: `user_id` references `users(user_id)`, `barangay_id` references `barangays(barangay_id)`
- **Unique Key**: `username`

| profile_id [PK] | user_id [FK, UK] | first_name | last_name | username [UK] | phone_number | birthdate | barangay_id [FK] | setup_completed |
| :---: | :---: | :--- | :--- | :--- | :--- | :--- | :---: | :---: |
| **1** | 101 | Juan | Dela Cruz | juandc | 09171234567 | 1990-05-12 | 9 | 1 |
| **2** | 102 | Maria | Santos | marias | 09189876543 | 1995-11-23 | 1 | 1 |
| **3** | 103 | Pedro | Reyes | pedror | 09205551234 | 1988-08-04 | 3 | 1 |
| **4** | 104 | Elena | Ramos | elenar | 09192223344 | 1998-03-17 | 7 | 1 |

---

#### Entity 5: `user_medical_profiles` (Paramedic Health Records)
Isolates sensitive medical and allergy records, accessible by first responders during medical dispatches.
- **Primary Key**: `medical_profile_id`
- **Foreign Key**: `user_id` references `users(user_id)`

| medical_profile_id [PK] | user_id [FK, UK] | blood_type | allergies | medical_conditions | pwd_status |
| :---: | :---: | :---: | :--- | :--- | :---: |
| **1** | 101 | O+ | Penicillin, Dust | Asthma | 0 |
| **2** | 102 | AB- | *None* | *None* | 0 |
| **3** | 103 | B+ | Aspirin | Hypertension | 0 |
| **4** | 104 | A+ | Pollen | *None* | 0 |

---

#### Entity 6: `user_verifications` (Government KYC Identity Audits)
Decouples government ID audit lifecycles from citizen accounts.
- **Primary Key**: `verification_id`
- **Foreign Keys**: `user_id` references `users(user_id)`, `reviewed_by` references `users(user_id)`

| verification_id [PK] | user_id [FK] | id_type | id_number | verification_status | reviewed_by [FK] | reviewed_at |
| :---: | :---: | :--- | :--- | :--- | :---: | :--- |
| **1** | 101 | PhilSys | 1234-5678-9012 | verified | 103 | 2026-01-11 09:00:00 |
| **2** | 102 | Driver's License | D02-19-123456 | verified | 103 | 2026-02-15 11:20:00 |
| **3** | 103 | MDRRMO Staff | EMP-2026-088 | verified | 103 | 2026-03-01 10:30:00 |
| **4** | 104 | PhilSys | 4567-8901-2345 | pending | *NULL* | *NULL* |

---

#### Entity 7: `emergency_requests` (Incident SOS Filings)
Maintains pure incident transaction data. References standardized lookup entities.
- **Primary Key**: `request_id`
- **Foreign Keys**: `user_id` references `users(user_id)`, `incident_type_id` references `incident_types(incident_type_id)`, `barangay_id` references `barangays(barangay_id)`

| request_id [PK] | user_id [FK] | incident_type_id [FK] | barangay_id [FK] | description | latitude | longitude | status | is_false_alarm | created_at |
| :---: | :---: | :---: | :---: | :--- | :---: | :---: | :--- | :---: | :--- |
| **5001** | 101 | 1 | 9 | Floodwaters rising near riverbank | 15.261240 | 120.910510 | resolved | 0 | 2026-08-20 10:30:00 |
| **5002** | 102 | 3 | 1 | Two-motorcycle collision on highway | 15.275000 | 120.923000 | in_progress | 0 | 2026-08-20 11:00:00 |
| **5003** | 104 | 2 | 7 | Residential kitchen fire | 15.281000 | 120.934000 | on_scene | 0 | 2026-08-20 12:15:00 |
| **5004** | 101 | 4 | 9 | Senior citizen experiencing chest pains | 15.262000 | 120.911000 | resolved | 0 | 2026-08-21 14:15:00 |

---

#### Entity 8: `dispatch` (First Responder Deployment Logs)
Tracks multi-agency response operations per incident without redundancy.
- **Primary Key**: `dispatch_id`
- **Foreign Key**: `request_id` references `emergency_requests(request_id)`

| dispatch_id [PK] | request_id [FK] | agency | notes | dispatched_at | arrived_at | status |
| :---: | :---: | :--- | :--- | :--- | :--- | :--- |
| **801** | 5001 | Rescue Team A | Deployed rubber boat 02 | 2026-08-20 10:35:00 | 2026-08-20 10:48:00 | completed |
| **802** | 5002 | PNP | Traffic cordoned off | 2026-08-20 11:05:00 | 2026-08-20 11:18:00 | on_scene |
| **803** | 5002 | BFP | Extrication gear deployed | 2026-08-20 11:06:00 | 2026-08-20 11:22:00 | on_scene |
| **804** | 5004 | Ambulance Unit 1 | Patient vitals stabilized | 2026-08-21 14:20:00 | 2026-08-21 14:32:00 | completed |
| **805** | 5003 | BFP Engine 4 | 2 water hose lines active | 2026-08-20 12:18:00 | 2026-08-20 12:29:00 | on_scene |

---

#### Entity 9: `hazards` (Community Hazard Reports)
- **Primary Key**: `hazard_id`
- **Foreign Keys**: `user_id` references `users(user_id)`, `barangay_id` references `barangays(barangay_id)`

| hazard_id [PK] | user_id [FK] | barangay_id [FK] | hazard_type | description | latitude | longitude | status | created_at |
| :---: | :---: | :---: | :--- | :--- | :---: | :---: | :--- | :--- |
| **1** | 101 | 9 | Fallen Tree | High voltage powerline blocked | 15.263500 | 120.912400 | active | 2026-08-22 08:00:00 |
| **2** | 102 | 1 | Road Obstruction | Flooded culvert overflowing | 15.276200 | 120.924100 | resolved | 2026-08-22 09:15:00 |

---

#### Entity 10: `broadcasts` (Public Alert Advisories)
- **Primary Key**: `broadcast_id`

| broadcast_id [PK] | title | message | is_active | created_at |
| :---: | :--- | :--- | :---: | :--- |
| **17** | Weather Advisory | Tropical Cyclone Wind Signal #1 declared | 1 | 2026-08-21 18:40:06 |
| **18** | Evacuation Advisory | Low-lying areas in Tabon proceed to gym | 1 | 2026-08-21 20:00:00 |

---

#### Entity 11: `broadcast_barangays` (Targeted Broadcast Junction)
- **Composite Primary Key**: `{ broadcast_id, barangay_id }`
- **Foreign Keys**: `broadcast_id` references `broadcasts(broadcast_id)`, `barangay_id` references `barangays(barangay_id)`

| broadcast_id [PK, FK] | barangay_id [PK, FK] |
| :---: | :---: |
| **17** | 1 |
| **17** | 9 |
| **18** | 9 |

---

#### Entity 12: `user_settings` (Application User Preferences)
- **Primary Key**: `setting_id`
- **Foreign Key**: `user_id` references `users(user_id)`

| setting_id [PK] | user_id [FK] | setting_key | setting_value | updated_at |
| :---: | :---: | :--- | :--- | :--- |
| **1** | 101 | dark_mode | true | 2026-08-20 18:00:00 |
| **2** | 101 | haptic_feedback | true | 2026-08-20 18:00:00 |
| **3** | 102 | push_notifications | true | 2026-08-21 09:00:00 |

---

## 6. Boyce-Codd Normal Form (BCNF) Verification

A relation is in **Boyce-Codd Normal Form (BCNF)** if and only if for every non-trivial functional dependency `X -> Y`, the determinant `X` is a **superkey** (candidate key).

### 6.1 BCNF Compliance Matrix

| Table Name | Candidate Keys | Functional Dependencies (`X -> Y`) | Determinant `X` Status | Satisfies BCNF? |
| :--- | :--- | :--- | :--- | :---: |
| `users` | `user_id`, `email` | `user_id -> { email, password, role, is_active, strikes }`<br/>`email -> { user_id, password, role, is_active }` | Both determinants are Candidate Keys | **Yes** |
| `user_profiles` | `profile_id`, `user_id`, `username` | `profile_id -> { user_id, first_name, last_name, phone_number, ... }`<br/>`user_id -> { profile_id, ... }`<br/>`username -> { profile_id, ... }` | All determinants are Candidate Keys | **Yes** |
| `user_medical_profiles` | `medical_profile_id`, `user_id` | `medical_profile_id -> { user_id, blood_type, allergies, ... }`<br/>`user_id -> { medical_profile_id, ... }` | All determinants are Candidate Keys | **Yes** |
| `user_verifications` | `verification_id` | `verification_id -> { user_id, id_type, id_number, verification_status, ... }` | `verification_id` is Primary Key | **Yes** |
| `barangays` | `barangay_id`, `barangay_name` | `barangay_id -> barangay_name`<br/>`barangay_name -> barangay_id` | Both determinants are Candidate Keys | **Yes** |
| `incident_types` | `incident_type_id`, `incident_name` | `incident_type_id -> incident_name`<br/>`incident_name -> incident_type_id` | Both determinants are Candidate Keys | **Yes** |
| `emergency_requests` | `request_id` | `request_id -> { user_id, incident_type_id, barangay_id, lat, lng, status, ... }` | `request_id` is Primary Key | **Yes** |
| `dispatch` | `dispatch_id` | `dispatch_id -> { request_id, agency, notes, dispatched_at, arrived_at, status }` | `dispatch_id` is Primary Key | **Yes** |
| `hazards` | `hazard_id` | `hazard_id -> { user_id, barangay_id, hazard_type, lat, lng, status, ... }` | `hazard_id` is Primary Key | **Yes** |
| `broadcasts` | `broadcast_id` | `broadcast_id -> { title, message, is_active, ... }` | `broadcast_id` is Primary Key | **Yes** |
| `broadcast_barangays` | `{ broadcast_id, barangay_id }` | `{ broadcast_id, barangay_id } -> NULL` (all attributes are prime) | Composite Key is Primary Key | **Yes** |
| `user_settings` | `setting_id`, `{ user_id, setting_key }` | `setting_id -> { user_id, setting_key, setting_value, updated_at }`<br/>`{ user_id, setting_key } -> { setting_id, setting_value, updated_at }` | Both determinants are Candidate Keys | **Yes** |

**Conclusion**: Since every determinant across all twelve decomposed relations is a candidate key, the schema satisfies **Boyce-Codd Normal Form (BCNF)**.

---

## 7. Normalization Progression Summary Matrix (Presentation Slide Reference)

This comparison matrix summarizes the normalization stages for presentation decks:

| Normal Form | Relational Rule / Condition | Tables Created | Anomalies Resolved | Presentation Defense Takeaway |
| :--- | :--- | :--- | :--- | :--- |
| **UNF** | Single flat universal relation. | 1 Universal Table | None (Massive redundancy, repeating groups). | Highlights initial chaotic data state before relational engineering. |
| **1NF** | Atomic scalar values; no repeating groups; composite primary key defined. | 1 Atomic Table | Eliminates multi-valued strings and arrays. | Establishes tabular atomicity, but suffers from partial dependencies. |
| **2NF** | In 1NF; eliminate partial functional dependencies (non-keys depend on entire key). | 4 Decomposed Tables (`USERS`, `REQUESTS`, `DISPATCH`, `ALLERGIES`) | Eliminates user demographic duplication across multiple incident filings. | Decouples citizens from transactional incident and dispatch records. |
| **3NF** | In 2NF; eliminate transitive functional dependencies (`X -> Y -> Z`). | 12 Fully Normalized Tables | Eliminates lookup duplication (`barangays`, `incident_types`, `verifications`). | Establishes production schema with referential integrity and foreign keys. |
| **BCNF** | Every determinant `X` in non-trivial `X -> Y` must be a superkey. | 12 BCNF Relations | Prevents hidden candidate key anomalies. | Mathematical proof of strict relational correctness. |

---

## 8. Controlled Denormalization for Real-Time Dispatch

In life-critical emergency operations, sub-second query latency and offline data preservation warrant selective, controlled denormalization:

1. **Direct GPS Coordinates on Incident Tables (`emergency_requests`, `hazards`)**:
   - `latitude` (`DECIMAL(10,8)`) and `longitude` (`DECIMAL(11,8)`) are embedded directly in incident rows rather than normalized into an external spatial points table.
   - *Performance Justification*: Enables direct composite B-Tree index scans (`(latitude, longitude)`) during real-time dispatcher map clustering without multi-table join latency.

2. **JSON Serialization for Incident Attachments (`proof_files`)**:
   - Multiple emergency photo and video proof URLs are stored in a `longtext` JSON column rather than a 1:N attachment junction table.
   - *Reliability Justification*: Enables atomic single-query ingestion during intermittent 4G/LTE mobile connectivity. When a citizen in distress files an SOS in degraded coverage, the incident and evidence URLs commit in a single atomic database transaction.
