# Database Normalization Architecture & Formal Decomposition

This document provides the formal Database Normalization reference for the **SINE MDRRMO Emergency Response System** (`emergencydb`). It details the progression from Unnormalized Form (UNF) through First (1NF), Second (2NF), Third (3NF), and Boyce-Codd Normal Form (BCNF), documenting functional dependencies, anomaly mitigation, and architectural decisions regarding controlled denormalization for real-time spatial operations.

---

## 1. Normalization Objectives & Scope

In life-critical emergency dispatch and citizen incident reporting, data integrity, atomicity, and consistent state updates are vital. The database is designed to eliminate:
1. **Insertion Anomalies**: Inability to record vital entity records (e.g., adding a barangay or registering a citizen) without dummy emergency filings.
2. **Update Anomalies**: Inconsistent data states resulting from redundant records (e.g., updating a citizen's contact phone number in multiple dispatch logs).
3. **Deletion Anomalies**: Unintended data loss where purging transactional history (e.g., archiving resolved incidents) deletes master identity or medical profiles.

---

## 2. Universal Relation & Unnormalized Form (UNF)

If the municipal emergency response data were consolidated into a single flat unnormalized structure, the universal schema would resemble:

$$\begin{aligned}
R_{\text{UNF}} = \{ & \text{user\_id}, \text{email}, \text{password}, \text{role}, \text{first\_name}, \text{last\_name}, \text{phone}, \text{birthdate}, \\
& \text{barangay\_name}, \text{blood\_type}, \text{allergies}, \text{medical\_conditions}, \text{pwd\_status}, \\
& \text{id\_type}, \text{id\_number}, \text{id\_front\_url}, \text{id\_back\_url}, \text{selfie\_url}, \text{verification\_status}, \\
& \text{request\_id}, \text{incident\_name}, \text{description}, \text{proof\_files}, \text{lat}, \text{lng}, \text{request\_status}, \text{request\_time}, \\
& \text{dispatch\_id}, \text{agency}, \text{dispatch\_notes}, \text{dispatch\_time}, \text{arrival\_time} \}
\end{aligned}$$

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
Repeating groups and multi-valued records are separated into independent relation candidates with defined atomic domains.

- Multi-valued demographic fields, multiple incident filings, and multiple dispatch logs are decoupled.
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
Consider a composite table containing dispatch logs:
$$\text{Rel}( \underline{\text{request\_id}}, \underline{\text{agency}}, \text{incident\_name}, \text{citizen\_name}, \text{dispatch\_time}, \text{arrival\_time} )$$

- **Candidate Key**: $\{\text{request\_id}, \text{agency}\}$
- **Partial Functional Dependency**:
  $$\text{request\_id} \to \text{incident\_name}, \text{citizen\_name}$$
  *Issue*: `incident\_name` and `citizen\_name` depend only on `request\_id`, not on the responding `agency`.
- **2NF Decomposition**:
  1. `EMERGENCY_REQUESTS` ($\underline{\text{request\_id}}$, $\text{incident\_type\_id}$, $\text{user\_id}$, $\text{description}$, $\text{latitude}$, $\text{longitude}$, $\text{status}$, $\text{request\_time}$)
  2. `DISPATCH` ($\underline{\text{dispatch\_id}}$, $\text{request\_id}$, $\text{agency}$, $\text{notes}$, $\text{dispatch\_time}$, $\text{arrival\_time}$, $\text{status}$)

In the decomposed 2NF model, every non-prime attribute depends on the full primary key.

---

## 5. Third Normal Form (3NF)

### 3NF Criteria
A relation is in **3NF** if and only if:
1. It is already in **2NF**.
2. No non-prime attribute is transitively dependent on the primary key (i.e., **no transitive dependencies** $X \to Y \to Z$ where $X$ is a superkey and $Y$ is not).

### Transitive Dependency Elimination

#### 1. Citizen Identity, Verification, and Medical Profiles
- **Initial State**:
  $$\text{USERS}( \underline{\text{user\_id}}, \text{email}, \text{password}, \text{role}, \text{first\_name}, \text{phone}, \text{barangay\_id}, \text{blood\_type}, \text{allergies}, \text{valid\_id\_type}, \text{verification\_status} )$$
- **Transitive Chains**:
  - Medical health disclosures depend on citizen status, not administrative authentication.
  - Document verification undergoes independent state lifecycles (pending, approved, rejected) and re-submission audits.
- **3NF Decomposition**:
  1. **`users`**: Master IAM authentication, roles, strike counters, and account lifecycle state.
     $$\text{FD}: \text{user\_id} \to \{\text{email}, \text{password}, \text{role}, \text{account\_status}, \text{false\_alarm\_strikes}\}$$
  2. **`user_profiles`**: Citizen and responder demographic identity.
     $$\text{FD}: \text{profile\_id} \to \{\text{user\_id}, \text{first\_name}, \text{last\_name}, \text{username}, \text{phone}, \text{birthdate}, \text{barangay\_id}\}$$
  3. **`user_verifications`**: Government identity documents and reviewer audit trails.
     $$\text{FD}: \text{verification\_id} \to \{\text{user\_id}, \text{valid\_id\_type}, \text{valid\_id\_number}, \text{valid\_id\_proof}, \text{verification\_status}, \text{reviewed\_by}\}$$
  4. **`user_medical_profiles`**: Golden-hour paramedic medical records.
     $$\text{FD}: \text{profile\_id} \to \{\text{user\_id}, \text{blood\_type}, \text{allergies}, \text{medical\_conditions}, \text{pwd\_status}\}$$

#### 2. Geographic Barangay Resolution
- **Initial State**:
  $$\text{EMERGENCY\_REQUESTS}( \dots, \text{barangay\_id}, \text{barangay\_name}, \text{municipality}, \text{province} )$$
- **Transitive Dependency**:
  $$\text{request\_id} \to \text{barangay\_id} \to \text{barangay\_name}$$
- **3NF Decomposition**:
  - `barangays` ($\underline{\text{barangay\_id}}$, $\text{barangay\_name}$)
  - `emergency_requests` contains foreign key `barangay_id` referencing `barangays`.

#### 3. Incident Type Categorization
- **Initial State**:
  $$\text{EMERGENCY\_REQUESTS}( \dots, \text{incident\_type\_id}, \text{incident\_name}, \text{default\_severity} )$$
- **Transitive Dependency**:
  $$\text{request\_id} \to \text{incident\_type\_id} \to \text{incident\_name}$$
- **3NF Decomposition**:
  - `incident_types` ($\underline{\text{incident\_type\_id}}$, $\text{incident\_name}$)
  - `emergency_requests` references `incident_type_id`.

---

## 6. Boyce-Codd Normal Form (BCNF)

### BCNF Criteria
A relation is in **BCNF** if and only if for every non-trivial functional dependency $X \to Y$, **$X$ is a superkey**.

### Verification Across Core Schema
1. **`users`**:
   - $FD_1: \text{user\_id} \to \text{email}, \text{password}, \text{role}, \text{account\_status}$ (Superkey: $\text{user\_id}$)
   - $FD_2: \text{email} \to \text{user\_id}$ ($\text{email}$ is unique candidate key)
   - *Verdict*: Satisfies BCNF.

2. **`user_settings`**:
   - Primary Key: `id`
   - Candidate Key: $(\text{user\_id}, \text{key})$
   - $FD: \{\text{user\_id}, \text{key}\} \to \text{value}, \text{updated\_at}$
   - *Verdict*: The determinant $\{\text{user\_id}, \text{key}\}$ is a candidate key. Satisfies BCNF.

3. **`broadcast_barangays`**:
   - Composite Primary Key: $(\text{broadcast\_id}, \text{barangay\_id})$
   - No non-prime attributes exist.
   - *Verdict*: Pure binary decomposition. Satisfies BCNF.

---

## 7. Dependency Preservation & Lossless Join Decomposition

All schema decompositions in `emergencydb` adhere to two mathematical guarantees:

1. **Lossless Join Guarantee**:
   For any decomposed relation $R \to (R_1, R_2)$, the natural join yields the exact original relation without spurious tuples:
   $$R_1 \cap R_2 \to R_1 \quad \text{or} \quad R_1 \cap R_2 \to R_2$$
   - Example: $\text{users} \cap \text{user\_profiles} = \{\text{user\_id}\}$, which is the primary key of `users`.

2. **Dependency Preservation**:
   Every functional dependency present in the universal relation can be enforced directly through keys and foreign key constraints on individual decomposed tables without computing costly relational joins.

---

## 8. Controlled Denormalization for Mission-Critical GIS Operations

While the relational model strictly satisfies 3NF and BCNF, selective, controlled denormalization is intentionally maintained for high-throughput emergency response workflows:

| Table | Attribute | Denormalization Decision | Justification |
|---|---|---|---|
| `emergency_requests` | `latitude`, `longitude` | Stored directly as scalar decimals rather than foreign key to an address ledger | Real-time map viewport bounding-box queries ($O(1)$ spatial B-Tree lookup) and sub-second Leaflet radar updates during active disaster response. |
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
