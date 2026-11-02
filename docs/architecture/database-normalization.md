# Database Normalization Architecture & Formal Decomposition

This document provides the formal Database Normalization reference for the **SINE MDRRMO Emergency Response System** (`emergencydb`). It details the progression from Unnormalized Form (UNF) through First (1NF), Second (2NF), Third (3NF), and Boyce-Codd Normal Form (BCNF), documenting functional dependencies, anomaly mitigation, and architectural decisions regarding controlled denormalization for real-time spatial operations.

---

## 1. Normalization Objectives & Scope

In life-critical emergency dispatch and citizen incident reporting, data integrity, atomicity, and consistent state updates are vital. The database is designed to eliminate:

1. **Insertion Anomalies**: Inability to record vital entity records (e.g., adding a barangay or registering a citizen) without dummy emergency filings.
2. **Update Anomalies**: Inconsistent data states resulting from redundant records (e.g., updating a citizen's contact phone number across multiple historical dispatch logs).
3. **Deletion Anomalies**: Unintended data loss where purging transactional history (e.g., archiving resolved incidents) deletes master identity or medical profiles.

---

## 2. Universal Relation & Unnormalized Form (UNF)

If the municipal emergency response data were consolidated into a single flat unnormalized structure, the universal schema would resemble:

```text
R_UNF = {
    user_id, email, password, role, first_name, last_name, phone, birthdate,
    barangay_name, blood_type, allergies, medical_conditions, pwd_status,
    id_type, id_number, id_front_url, id_back_url, selfie_url, verification_status,
    request_id, incident_name, description, proof_files, latitude, longitude, request_status, request_time,
    dispatch_id, agency, dispatch_notes, dispatch_time, arrival_time
}
```

### Critical Flaws of UNF
- **Massive Redundancy**: Every emergency report submitted by a citizen duplicates user credentials, names, medical allergies, and verification documents.
- **Repeating Groups**: A citizen filing multiple SOS calls creates multi-valued repeating groups across the tuple.
- **Anomalies**: Deleting the only emergency record for a citizen erases their registered account and life-saving medical profile.

---

## 3. First Normal Form (1NF)

### 1NF Criteria
A relation is in **1NF** if and only if:
1. All attributes contain only atomic (indivisible) values.
2. There are no repeating groups or multi-valued attributes.
3. Each record is uniquely identified by a primary key.

### Decomposition into 1NF
Repeating groups and multi-valued records are separated into independent relation candidates with defined atomic domains:

- Multi-valued demographic fields, multiple incident filings, and multiple dispatch logs are decoupled into independent relations.
- Atomic scalar types are strictly enforced (e.g., `birthdate` is stored as an ISO `DATE`, coordinates as scalar `DECIMAL(10,8)` and `DECIMAL(11,8)`).
- Composite keys in junction relations uniquely identify row instances.

---

## 4. Second Normal Form (2NF)

### 2NF Criteria
A relation is in **2NF** if and only if:
1. It is already in **1NF**.
2. No non-prime attribute is functionally dependent on a proper subset of any candidate key (i.e., **no partial functional dependencies**).

### Analysis & Resolution of Partial Dependencies

In relations governed by composite candidate keys, non-prime attributes must depend on the *entire* key, not a portion of it.

#### Case Study: Emergency Dispatch Protocols

Consider a composite dispatch relation before decomposition:

```text
DISPATCH_COMPOSITE( [PK] request_id, [PK] agency, incident_name, citizen_name, dispatch_time, arrival_time )
```

- **Candidate Key**: `{ request_id, agency }`
- **Partial Functional Dependency**:
  ```text
  request_id -> { incident_name, citizen_name }
  ```
  *Issue*: `incident_name` and `citizen_name` depend strictly on `request_id`, not on the responding `agency`.

- **2NF Decomposition**:
  1. `EMERGENCY_REQUESTS( [PK] request_id, incident_type_id, user_id, description, latitude, longitude, status, request_time )`
  2. `DISPATCH( [PK] dispatch_id, [FK] request_id, agency, notes, dispatch_time, arrival_time, status )`

In the decomposed 2NF model, every non-prime attribute depends on the full primary key.

---

## 5. Third Normal Form (3NF)

### 3NF Criteria
A relation is in **3NF** if and only if:
1. It is already in **2NF**.
2. No non-prime attribute is transitively dependent on the primary key (i.e., **no transitive dependencies** `X -> Y -> Z` where `X` is a superkey and `Y` is not).

### Transitive Dependency Elimination

#### 1. Citizen Identity, Verification, and Medical Profiles

- **Initial State**:
  ```text
  USERS_MONOLITH( [PK] user_id, email, password, role, first_name, last_name, phone, barangay_id, blood_type, allergies, valid_id_type, verification_status )
  ```

- **Transitive Chains**:
  - Medical health disclosures depend on the citizen's personal record, not their authentication credentials.
  - Document verification undergoes independent verification lifecycles (pending, approved, rejected) and re-submission audits.

- **3NF Decomposition**:
  1. **`users`**: Master IAM authentication, roles, strike counters, and account lifecycle state.
     - Functional Dependency: `user_id -> { email, password, role, account_status, false_alarm_strikes }`
  2. **`user_profiles`**: Citizen and responder demographic identity.
     - Functional Dependency: `profile_id -> { user_id, first_name, last_name, username, phone, birthdate, barangay_id }`
  3. **`user_verifications`**: Government identity documents and reviewer audit trails.
     - Functional Dependency: `verification_id -> { user_id, valid_id_type, valid_id_number, valid_id_proof, verification_status, reviewed_by }`
  4. **`user_medical_profiles`**: Golden-hour paramedic medical records.
     - Functional Dependency: `profile_id -> { user_id, blood_type, allergies, medical_conditions, pwd_status }`

#### 2. Geographic Barangay Resolution

- **Initial State**:
  ```text
  EMERGENCY_REQUESTS( [PK] request_id, ..., barangay_id, barangay_name, municipality, province )
  ```
- **Transitive Dependency**:
  ```text
  request_id -> barangay_id -> { barangay_name, municipality, province }
  ```
- **3NF Decomposition**:
  - `barangays( [PK] barangay_id, barangay_name )`
  - `emergency_requests` contains foreign key `barangay_id` referencing `barangays`.

#### 3. Incident Type Categorization

- **Initial State**:
  ```text
  EMERGENCY_REQUESTS( [PK] request_id, ..., incident_type_id, incident_name, default_severity )
  ```
- **Transitive Dependency**:
  ```text
  request_id -> incident_type_id -> { incident_name, default_severity }
  ```
- **3NF Decomposition**:
  - `incident_types( [PK] incident_type_id, incident_name )`
  - `emergency_requests` contains foreign key `incident_type_id` referencing `incident_types`.

---

## 6. Boyce-Codd Normal Form (BCNF)

### BCNF Criteria
A relation is in **BCNF** if and only if for every non-trivial functional dependency `X -> Y`, **`X` is a superkey**.

### Verification Across Core Schema

1. **`users`**:
   - `FD_1: user_id -> { email, password, role, account_status }` (Superkey: `user_id`)
   - `FD_2: email -> user_id` (`email` is unique candidate key)
   - *Verdict*: Satisfies BCNF.

2. **`user_settings`**:
   - Primary Key: `id`
   - Candidate Key: `{ user_id, key }`
   - `FD: { user_id, key } -> { value, updated_at }`
   - *Verdict*: The determinant `{ user_id, key }` is a candidate key. Satisfies BCNF.

3. **`broadcast_barangays`**:
   - Composite Primary Key: `{ broadcast_id, barangay_id }`
   - No non-prime attributes exist.
   - *Verdict*: Pure binary associative decomposition. Satisfies BCNF.

---

## 7. Dependency Preservation & Lossless Join Decomposition

All schema decompositions in `emergencydb` adhere to two fundamental mathematical guarantees:

1. **Lossless Join Guarantee**:
   For any decomposed relation pair `(R_1, R_2)`, the natural join yields the exact original relation without spurious tuples:
   ```text
   (R_1 ∩ R_2 -> R_1)  OR  (R_1 ∩ R_2 -> R_2)
   ```
   - Example: `users ∩ user_profiles = { user_id }`, which is the primary key of `users`.

2. **Dependency Preservation**:
   Every functional dependency present in the universal relation can be enforced directly through primary keys, unique constraints, and foreign key constraints on individual decomposed tables without computing cross-table relational joins.

---

## 8. Controlled Denormalization for Mission-Critical GIS Operations

While the relational model strictly satisfies 3NF and BCNF, selective, controlled denormalization is intentionally maintained for high-throughput emergency response workflows:

| Table | Attribute | Denormalization Decision | Justification |
|---|---|---|---|
| `emergency_requests` | `latitude`, `longitude` | Stored directly as scalar decimals rather than foreign key to an address ledger | Real-time map viewport bounding-box queries (`O(1)` spatial B-Tree lookup) and sub-second Leaflet radar updates during active disaster response. |
| `emergency_requests` | `proof_files` | Stored as structured JSON text array rather than a 1:N `emergency_proofs` table | Guarantees atomic, single-payload transaction ingestion when mobile citizen clients upload emergency evidence from offline queue synchronizers. |
| `broadcasts` | `media_files` | Stored as structured JSON text array of media paths | Eliminates multi-table joins when broadcasting urgent advisory alerts to thousands of concurrent citizen clients. |

---

## 9. Summary Normalization Matrix

| Table Name | Normal Form Achieved | Primary Key | Candidate / Alternate Keys | Transitive Dependencies Removed |
|---|---|---|---|---|
| `users` | **BCNF** | `user_id` | `email` | Demographics, ID proofs, medical records |
| `user_profiles` | **BCNF** | `profile_id` | `user_id`, `username` | Barangay name, administrative roles |
| `user_verifications` | **BCNF** | `verification_id` | `(user_id, valid_id_number)` | Admin reviewer profiles |
| `user_medical_profiles`| **BCNF** | `profile_id` | `user_id` | User login credentials |
| `barangays` | **BCNF** | `barangay_id` | `barangay_name` | Incident filings |
| `incident_types` | **BCNF** | `incident_type_id` | `incident_name` | Incident filings |
| `emergency_requests` | **3NF** | `request_id` | — | Citizen name, barangay name, agency dispatch details |
| `hazards` | **3NF** | `hazard_id` | — | Citizen name, barangay name |
| `dispatch` | **BCNF** | `dispatch_id` | — | Incident description, reporter details |
| `broadcasts` | **BCNF** | `broadcast_id` | — | Barangay names |
| `broadcast_barangays` | **BCNF** | `(broadcast_id, barangay_id)`| — | Pure associative entity |
| `user_settings` | **BCNF** | `id` | `(user_id, key)` | User credentials |
