# Database Normalization Reference: SINE MDRRMO Emergency Response System (`emergencydb`)

This document demonstrates the formal database normalization process for the **SINE MDRRMO Emergency Response System**. It traces the relational schema from an **Unnormalized Form (UNF)** through **First Normal Form (1NF)**, **Second Normal Form (2NF)**, **Third Normal Form (3NF)**, and **Boyce-Codd Normal Form (BCNF)** using the actual municipal database schema and operational data.

---

## 1. Unnormalized Form (UNF)

All citizen demographics, medical records, government ID verifications, emergency SOS requests, hazard reports, dispatch deployments, and municipal geographic data are merged into a single universal relation.

### 1.1 Universal Relation Schema
```text
R_UNF( user_id, email, password, role, first_name, last_name, phone_number, birthdate,
       barangay_name, blood_type, allergies, medical_conditions, pwd_status,
       id_type, id_number, id_front_path, id_back_path, selfie_path, verification_status,
       request_id, incident_name, description, proof_files, latitude, longitude,
       request_status, is_false_alarm, request_time,
       dispatch_id, agency, notes, dispatched_at, arrived_at, dispatch_status )
```

### 1.2 UNF Universal Table with Operational Data
The table below illustrates multi-valued fields and repeating groups (e.g., a citizen filing multiple emergency requests, multi-agency dispatches, multiple allergies):

| user_id | email | first_name | last_name | phone_number | barangay_name | blood_type | allergies | id_type | id_number | request_id | incident_name | latitude | longitude | request_time | dispatch_id | agency | dispatched_at | arrived_at |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **101** | juan@gmail.com | Juan | Dela Cruz | 09171234567 | Tabon | O+ | Penicillin, Dust | PhilSys | 1234-5678-9012 | 5001, 5004 | Flood, Medical | 15.261240, 15.262000 | 120.910510, 120.911000 | 10:30, 14:15 | 801, 804 | Rescue A, Ambulance | 10:35, 14:20 | 10:48, 14:32 |
| **102** | maria@yahoo.com | Maria | Santos | 09189876543 | Alua | AB- | None | Driver's | D02-19-123456 | 5002 | Vehicular Accident | 15.275000 | 120.923000 | 11:00 | 802, 803 | PNP, BFP | 11:05, 11:06 | 11:18, 11:22 |
| **103** | pedro@sine.gov.ph | Pedro | Reyes | 09205551234 | Malapit | B+ | Aspirin | PhilSys | 9876-5432-1098 | *NULL* | *NULL* | *NULL* | *NULL* | *NULL* | *NULL* | *NULL* | *NULL* | *NULL* |

### 1.3 Concrete Anomalies in UNF

1. **Insertion Anomaly**:
   - A new municipal barangay (e.g., `San Roque`) cannot be registered in the system unless a citizen registers or an emergency is filed from that location.
   - Registering a citizen who has not yet filed an emergency (e.g., Pedro Reyes, `user_id = 103`) forces all emergency and dispatch fields to store dummy `NULL` values.

2. **Update Anomaly**:
   - If Juan Dela Cruz updates his contact phone number from `09171234567` to `09179998888`, every emergency row filed by Juan must be updated. If any record is missed, dispatchers will call an outdated number during an SOS crisis.

3. **Deletion Anomaly**:
   - When the resolved emergency `request_id = 5002` is archived or purged from transactional storage, Maria Santos's citizen account, government ID verification, and medical allergy records are permanently deleted.

---

## 2. First Normal Form (1NF)

To reach 1NF, all multi-valued attributes and repeating groups are eliminated, ensuring every column contains atomic (indivisible) values. A composite primary key is defined to uniquely identify each row.

### 2.1 Composite Primary Key
The composite primary key is:
```text
PK = { user_id, request_id, dispatch_id }
```
*(For citizens without emergency requests, surrogate incident identifiers `0` are used to prevent null primary key violations).*

### 2.2 1NF Relation Schema
```text
R_1NF( user_id [PK], request_id [PK], dispatch_id [PK], email, first_name, last_name,
       phone_number, barangay_name, blood_type, allergy_item, id_type, id_number,
       verification_status, incident_name, latitude, longitude, request_status,
       request_time, agency, dispatched_at, arrived_at, dispatch_status )
```

### 2.3 1NF Atomic Table Data

| user_id [PK] | request_id [PK] | dispatch_id [PK] | email | first_name | last_name | phone_number | barangay_name | blood_type | allergy_item | id_type | id_number | incident_name | latitude | longitude | agency | dispatched_at | arrived_at |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **101** | **5001** | **801** | juan@gmail.com | Juan | Dela Cruz | 09171234567 | Tabon | O+ | Penicillin | PhilSys | 1234-5678-9012 | Flood | 15.261240 | 120.910510 | Rescue A | 10:35:00 | 10:48:00 |
| **101** | **5001** | **801** | juan@gmail.com | Juan | Dela Cruz | 09171234567 | Tabon | O+ | Dust | PhilSys | 1234-5678-9012 | Flood | 15.261240 | 120.910510 | Rescue A | 10:35:00 | 10:48:00 |
| **101** | **5004** | **804** | juan@gmail.com | Juan | Dela Cruz | 09171234567 | Tabon | O+ | Penicillin | PhilSys | 1234-5678-9012 | Medical | 15.262000 | 120.911000 | Ambulance | 14:20:00 | 14:32:00 |
| **102** | **5002** | **802** | maria@yahoo.com | Maria | Santos | 09189876543 | Alua | AB- | None | Driver's | D02-19-123456 | Vehicular | 15.275000 | 120.923000 | PNP | 11:05:00 | 11:18:00 |
| **102** | **5002** | **803** | maria@yahoo.com | Maria | Santos | 09189876543 | Alua | AB- | None | Driver's | D02-19-123456 | Vehicular | 15.275000 | 120.923000 | BFP | 11:06:00 | 11:22:00 |

### 2.4 Flaws in 1NF (Partial Functional Dependencies)
Notice the extensive data duplication: Juan Dela Cruz's email, name, phone, barangay, and ID number are repeated across multiple rows because they depend only on `user_id`, not on `request_id` or `dispatch_id`. This violates 2NF.

---

## 3. Second Normal Form (2NF)

To reach 2NF, all **Partial Functional Dependencies** are removed. Every non-key attribute must depend on the **entire** composite primary key, not a proper subset of it.

### 3.1 Identification of Functional Dependencies

1. **Partial Dependency on `user_id`**:
   ```text
   FD1: user_id -> email, password, role, first_name, last_name, phone_number,
                   birthdate, barangay_name, blood_type, allergy_item,
                   id_type, id_number, verification_status
   ```
   *(Citizen identity and medical data depend solely on user_id).*

2. **Partial Dependency on `request_id`**:
   ```text
   FD2: request_id -> user_id, incident_name, description, proof_files,
                      latitude, longitude, request_status, is_false_alarm, request_time
   ```
   *(Emergency SOS reports depend solely on request_id).*

3. **Full Dependency on `dispatch_id`**:
   ```text
   FD3: dispatch_id -> request_id, agency, notes, dispatched_at, arrived_at, dispatch_status
   ```
   *(Responder unit deployment depends solely on dispatch_id).*

### 3.2 2NF Decomposition

The relation is decomposed into three separate relations where every non-key attribute depends on the full primary key:

#### 1. `USERS_2NF`
- **Primary Key**: `user_id`
- **Schema**:
  ```text
  USERS_2NF( user_id [PK], email, first_name, last_name, phone_number,
             barangay_name, blood_type, allergy_item, id_type, id_number, verification_status )
  ```

| user_id [PK] | email | first_name | last_name | phone_number | barangay_name | blood_type | allergy_item | id_type | id_number | verification_status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **101** | juan@gmail.com | Juan | Dela Cruz | 09171234567 | Tabon | O+ | Penicillin | PhilSys | 1234-5678-9012 | verified |
| **102** | maria@yahoo.com | Maria | Santos | 09189876543 | Alua | AB- | None | Driver's | D02-19-123456 | verified |
| **103** | pedro@sine.gov.ph | Pedro | Reyes | 09205551234 | Malapit | B+ | Aspirin | PhilSys | 9876-5432-1098 | pending |

#### 2. `EMERGENCY_REQUESTS_2NF`
- **Primary Key**: `request_id`
- **Foreign Key**: `user_id` references `USERS_2NF(user_id)`
- **Schema**:
  ```text
  EMERGENCY_REQUESTS_2NF( request_id [PK], user_id [FK], incident_name,
                          latitude, longitude, request_status, is_false_alarm, request_time )
  ```

| request_id [PK] | user_id [FK] | incident_name | latitude | longitude | request_status | is_false_alarm | request_time |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **5001** | 101 | Flood | 15.261240 | 120.910510 | resolved | 0 | 2026-08-20 10:30:00 |
| **5002** | 102 | Vehicular Accident | 15.275000 | 120.923000 | in_progress | 0 | 2026-08-20 11:00:00 |
| **5004** | 101 | Medical | 15.262000 | 120.911000 | resolved | 0 | 2026-08-21 14:15:00 |

#### 3. `DISPATCH_2NF`
- **Primary Key**: `dispatch_id`
- **Foreign Key**: `request_id` references `EMERGENCY_REQUESTS_2NF(request_id)`
- **Schema**:
  ```text
  DISPATCH_2NF( dispatch_id [PK], request_id [FK], agency,
                dispatched_at, arrived_at, dispatch_status )
  ```

| dispatch_id [PK] | request_id [FK] | agency | dispatched_at | arrived_at | dispatch_status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **801** | 5001 | Rescue Team A | 2026-08-20 10:35:00 | 2026-08-20 10:48:00 | completed |
| **802** | 5002 | PNP | 2026-08-20 11:05:00 | 2026-08-20 11:18:00 | on_scene |
| **803** | 5002 | BFP | 2026-08-20 11:06:00 | 2026-08-20 11:22:00 | on_scene |
| **804** | 5004 | Ambulance Unit 1 | 2026-08-21 14:20:00 | 2026-08-21 14:32:00 | completed |

---

## 4. Third Normal Form (3NF)

To reach 3NF, all **Transitive Dependencies** are removed. No non-key attribute may depend on another non-key attribute (`X -> Y -> Z` where `X` is a primary key and `Y` is a non-key attribute).

### 4.1 Identification of Transitive Dependencies in 2NF

1. **Transitive Dependency in `USERS_2NF`**:
   - `user_id -> barangay_id -> barangay_name`: Barangay names depend on `barangay_id`, not directly on `user_id`.
   - `user_id -> id_number -> verification_status`: Government identity verification lifecycle is independent of user authentication.
   - `user_id -> { blood_type, allergies, medical_conditions, pwd_status }`: Citizen medical data is a distinct profile domain.
   - `user_id -> { email, password, role }` vs. `{ first_name, last_name, phone_number, birthdate }`: Authentication credentials belong to core security, while demographics belong to citizen profiles.

2. **Transitive Dependency in `EMERGENCY_REQUESTS_2NF`**:
   - `request_id -> incident_type_id -> incident_name`: Incident names depend on `incident_type_id`, not directly on `request_id`.
   - `request_id -> barangay_id -> barangay_name`: Incident locations are geographically bound by `barangay_id`.

### 4.2 3NF Decomposed Entities with Concrete Data

#### 1. `barangays` (Reference Lookup)
```text
barangays( barangay_id [PK], barangay_name )
```
| barangay_id [PK] | barangay_name |
| :--- | :--- |
| **1** | Alua |
| **2** | Calaba |
| **3** | Malapit |
| **4** | Mangga |
| **5** | Poblacion |
| **6** | Pulo |
| **7** | San Roque |
| **8** | Santo Cristo |
| **9** | Tabon |

#### 2. `incident_types` (Reference Lookup)
```text
incident_types( incident_type_id [PK], incident_name )
```
| incident_type_id [PK] | incident_name |
| :--- | :--- |
| **1** | Flood |
| **2** | Fire |
| **3** | Vehicular Accident |
| **4** | Medical |
| **5** | Earthquake |

#### 3. `users` (Core IAM & Authentication)
```text
users( user_id [PK], email [UK], password, role, is_active, strikes, created_at, updated_at )
```
| user_id [PK] | email [UK] | password (hash) | role | is_active | strikes | created_at |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **101** | juan@gmail.com | $2y$10$e8Q... | citizen | 1 | 0 | 2026-01-10 08:00:00 |
| **102** | maria@yahoo.com | $2y$10$w9Z... | citizen | 1 | 0 | 2026-02-14 09:30:00 |
| **103** | pedro@sine.gov.ph | $2y$10$k1M... | dispatcher | 1 | 0 | 2026-03-01 10:15:00 |

#### 4. `user_profiles` (Citizen Demographics)
```text
user_profiles( profile_id [PK], user_id [FK, UK], first_name, last_name, username [UK], phone_number, birthdate, barangay_id [FK], profile_photo )
```
| profile_id [PK] | user_id [FK, UK] | first_name | last_name | username [UK] | phone_number | birthdate | barangay_id [FK] |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | 101 | Juan | Dela Cruz | juandc | 09171234567 | 1990-05-12 | 9 |
| **2** | 102 | Maria | Santos | marias | 09189876543 | 1995-11-23 | 1 |
| **3** | 103 | Pedro | Reyes | pedror | 09205551234 | 1988-08-04 | 3 |

#### 5. `user_medical_profiles` (Paramedic Health Records)
```text
user_medical_profiles( medical_profile_id [PK], user_id [FK, UK], blood_type, allergies, medical_conditions, pwd_status )
```
| medical_profile_id [PK] | user_id [FK, UK] | blood_type | allergies | medical_conditions | pwd_status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | 101 | O+ | Penicillin, Dust | Asthma | 0 |
| **2** | 102 | AB- | None | None | 0 |
| **3** | 103 | B+ | Aspirin | Hypertension | 0 |

#### 6. `user_verifications` (Government KYC Identity Audits)
```text
user_verifications( verification_id [PK], user_id [FK], id_type, id_number, id_front_path, id_back_path, selfie_path, verification_status, rejection_reason, reviewed_by [FK], reviewed_at )
```
| verification_id [PK] | user_id [FK] | id_type | id_number | verification_status | reviewed_by [FK] | reviewed_at |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | 101 | PhilSys | 1234-5678-9012 | verified | 103 | 2026-01-11 09:00:00 |
| **2** | 102 | Driver's License | D02-19-123456 | verified | 103 | 2026-02-15 11:20:00 |
| **3** | 103 | MDRRMO Badge | EMP-2026-088 | verified | 1 | 2026-03-01 10:30:00 |

#### 7. `emergency_requests` (Incident Filings)
```text
emergency_requests( request_id [PK], user_id [FK], incident_type_id [FK], barangay_id [FK], description, proof_files, latitude, longitude, status, is_false_alarm, created_at )
```
| request_id [PK] | user_id [FK] | incident_type_id [FK] | barangay_id [FK] | description | latitude | longitude | status | is_false_alarm | created_at |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **5001** | 101 | 1 | 9 | Floodwaters rising near riverbank | 15.261240 | 120.910510 | resolved | 0 | 2026-08-20 10:30:00 |
| **5002** | 102 | 3 | 1 | Two-motorcycle collision on highway | 15.275000 | 120.923000 | in_progress | 0 | 2026-08-20 11:00:00 |
| **5004** | 101 | 4 | 9 | Senior citizen experiencing chest pains | 15.262000 | 120.911000 | resolved | 0 | 2026-08-21 14:15:00 |

#### 8. `dispatch` (Responder Deployment Logs)
```text
dispatch( dispatch_id [PK], request_id [FK], agency, notes, dispatched_at, arrived_at, resolved_at, status )
```
| dispatch_id [PK] | request_id [FK] | agency | notes | dispatched_at | arrived_at | status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **801** | 5001 | Rescue Team A | Deployed rubber boat 02 | 2026-08-20 10:35:00 | 2026-08-20 10:48:00 | completed |
| **802** | 5002 | PNP | Traffic cordoned off | 2026-08-20 11:05:00 | 2026-08-20 11:18:00 | on_scene |
| **803** | 5002 | BFP | Extrication gear deployed | 2026-08-20 11:06:00 | 2026-08-20 11:22:00 | on_scene |
| **804** | 5004 | Ambulance Unit 1 | Patient stabilized | 2026-08-21 14:20:00 | 2026-08-21 14:32:00 | completed |

#### 9. `hazards` (Community Hazard Reports)
```text
hazards( hazard_id [PK], user_id [FK], barangay_id [FK], hazard_type, description, proof_files, latitude, longitude, status, created_at )
```
| hazard_id [PK] | user_id [FK] | barangay_id [FK] | hazard_type | description | latitude | longitude | status | created_at |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | 101 | 9 | Fallen Tree | High voltage powerline blocked | 15.263500 | 120.912400 | active | 2026-08-22 08:00:00 |

#### 10. `broadcasts` (Public Advisories)
```text
broadcasts( broadcast_id [PK], title, message, media_files, is_active, scheduled_at, created_at )
```
| broadcast_id [PK] | title | message | is_active | created_at |
| :--- | :--- | :--- | :--- | :--- |
| **17** | Weather Advisory | Tropical Depression signal #1 declared | 1 | 2026-08-21 18:40:06 |

#### 11. `broadcast_barangays` (Targeted Broadcast Junction)
```text
broadcast_barangays( broadcast_id [PK, FK], barangay_id [PK, FK] )
```
| broadcast_id [PK, FK] | barangay_id [PK, FK] |
| :--- | :--- |
| **17** | 1 |
| **17** | 9 |

#### 12. `user_settings` (Client Preferences)
```text
user_settings( setting_id [PK], user_id [FK], setting_key, setting_value, updated_at )
```
| setting_id [PK] | user_id [FK] | setting_key | setting_value | updated_at |
| :--- | :--- | :--- | :--- | :--- |
| **1** | 101 | dark_mode | true | 2026-08-20 18:00:00 |
| **2** | 101 | high_contrast | false | 2026-08-20 18:00:00 |
| **3** | 102 | push_notifications | true | 2026-08-21 09:00:00 |

---

## 5. Boyce-Codd Normal Form (BCNF) Verification

A relation is in **Boyce-Codd Normal Form (BCNF)** if and only if for every non-trivial functional dependency `X -> Y`, the determinant **`X` is a superkey** (candidate key).

### 5.1 Verification Matrix

| Table Name | Candidate Keys | Functional Dependency (`X -> Y`) | Determinant `X` Status | Satisfies BCNF? |
| :--- | :--- | :--- | :--- | :--- |
| `users` | `user_id`, `email` | `user_id -> { email, password, role, is_active, strikes }`<br>`email -> { user_id, password, role }` | Both `user_id` and `email` are Candidate Keys | **Yes** |
| `user_profiles` | `profile_id`, `user_id`, `username` | `profile_id -> { user_id, first_name, last_name, phone_number, ... }`<br>`user_id -> { profile_id, ... }`<br>`username -> { profile_id, ... }` | All determinants are Candidate Keys | **Yes** |
| `user_medical_profiles` | `medical_profile_id`, `user_id` | `medical_profile_id -> { user_id, blood_type, allergies, ... }`<br>`user_id -> { medical_profile_id, ... }` | All determinants are Candidate Keys | **Yes** |
| `user_verifications` | `verification_id` | `verification_id -> { user_id, id_type, id_number, verification_status, ... }` | `verification_id` is Primary Key | **Yes** |
| `barangays` | `barangay_id`, `barangay_name` | `barangay_id -> barangay_name`<br>`barangay_name -> barangay_id` | Both determinants are Candidate Keys | **Yes** |
| `incident_types` | `incident_type_id`, `incident_name` | `incident_type_id -> incident_name`<br>`incident_name -> incident_type_id` | Both determinants are Candidate Keys | **Yes** |
| `emergency_requests` | `request_id` | `request_id -> { user_id, incident_type_id, barangay_id, lat, lng, status, ... }` | `request_id` is Primary Key | **Yes** |
| `dispatch` | `dispatch_id` | `dispatch_id -> { request_id, agency, notes, dispatched_at, arrived_at, status }` | `dispatch_id` is Primary Key | **Yes** |
| `hazards` | `hazard_id` | `hazard_id -> { user_id, barangay_id, hazard_type, lat, lng, status, ... }` | `hazard_id` is Primary Key | **Yes** |
| `broadcasts` | `broadcast_id` | `broadcast_id -> { title, message, media_files, is_active, ... }` | `broadcast_id` is Primary Key | **Yes** |
| `broadcast_barangays` | `{ broadcast_id, barangay_id }` | `{ broadcast_id, barangay_id } -> NULL` (all attributes are prime) | Composite Key is Primary Key | **Yes** |
| `user_settings` | `setting_id`, `{ user_id, setting_key }` | `setting_id -> { user_id, setting_key, setting_value, updated_at }`<br>`{ user_id, setting_key } -> { setting_id, setting_value, updated_at }` | Both determinants are Candidate Keys | **Yes** |

**Conclusion**: Since every determinant in all twelve decomposed relations is a superkey, the schema strictly satisfies **Boyce-Codd Normal Form (BCNF)**.

---

## 6. Mathematical Verification: Lossless Join & Dependency Preservation

### 6.1 Lossless Join Verification
A decomposition of relation `R` into `R1` and `R2` is guaranteed to be **lossless** if and only if the intersection of their attribute sets forms a superkey of at least one of the decomposed relations:
```text
(R1 ∩ R2) -> R1   OR   (R1 ∩ R2) -> R2
```

- **Example: Decomposition of `USERS_2NF` and `EMERGENCY_REQUESTS_2NF`**:
  - `USERS_2NF ∩ EMERGENCY_REQUESTS_2NF = { user_id }`
  - In `USERS_2NF`, `{ user_id }` is the Primary Key (`user_id -> USERS_2NF`).
  - Therefore, the natural inner join `USERS_2NF ⨝ EMERGENCY_REQUESTS_2NF` produces no spurious tuples. The decomposition is strictly **lossless**.

- **Example: Decomposition of `emergency_requests` and `dispatch`**:
  - `emergency_requests ∩ dispatch = { request_id }`
  - In `emergency_requests`, `{ request_id }` is the Primary Key (`request_id -> emergency_requests`).
  - Therefore, joining incident reports with responder dispatch logs preserves the original relation without data distortion.

### 6.2 Dependency Preservation
A decomposition is **dependency preserving** if the union of functional dependencies in the decomposed relations (`F1 ∪ F2 ∪ ... ∪ Fn`) logically implies all functional dependencies in the original relation `F`:
```text
(F1 ∪ F2 ∪ ... ∪ Fn)+ = F+
```
Every operational dependency (`user_id -> profile`, `request_id -> incident details`, `dispatch_id -> responder notes`, `barangay_id -> barangay_name`) is directly enforced by the primary and unique keys of the individual decomposed tables. Foreign key constraints maintain referential integrity without cross-table dependency violations.

---

## 7. Controlled Denormalization Justifications

In high-concurrency municipal emergency response systems, real-time spatial queries and offline queue synchronization require targeted architectural optimizations:

1. **Direct GPS Coordinate Attributes on Incident Records**:
   - `latitude` (`DECIMAL(10,8)`) and `longitude` (`DECIMAL(11,8)`) are maintained directly in `emergency_requests` and `hazards` rather than normalized into a separate spatial point lookup entity.
   - **Performance Justification**: Allows spatial composite B-Tree index scans (`(latitude, longitude)`) during dispatch map viewport clustering. This eliminates multi-table join latency during high-volume disaster filings.

2. **JSON Serialization for Incident Attachments (`proof_files`)**:
   - Multiple emergency photo and video proof paths are serialized into a `longtext` JSON column (`proof_files`) instead of a separate 1:N junction table.
   - **Resilience Justification**: Enables atomic single-query ingestion during intermittent 4G/LTE mobile connectivity. When a citizen submits a distress SOS in an area with degraded cellular coverage, the incident and its accompanying evidence are committed in a single atomic database transaction.
