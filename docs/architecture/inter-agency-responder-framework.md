# Inter-Agency Responder Framework & Operational Boundaries

This architectural specification defines the operational scope, administrative prerequisites, and future multi-state lifecycle design for field responder integration within the SINE-MDRRMO platform of San Isidro, Nueva Ecija.

---

## 1. Operational Scope & Current Clean Protocol Dispatch

The SINE-MDRRMO platform operates under the municipal jurisdiction of the Local Government Unit (LGU) of San Isidro, Nueva Ecija. The current production system implements a **Clean Protocol Dispatch** workflow tailored to municipal command protocols:

1. **Protocol Dispatch Authorization:**
   When an emergency SOS is submitted by a verified resident, municipal dispatchers triage the incident on the live operations console. Upon authorization, the dispatcher selects the target responding agency:
   - **MDRRMO Rescue Team** (LGU Emergency Medical & Disaster Rescue)
   - **San Isidro BFP** (Bureau of Fire Protection - Fire Suppression)
   - **San Isidro PNP** (Philippine National Police - Law Enforcement & Security)
   - **Rural Health Unit (RHU)** (Municipal Health Office - Medical Support)

2. **Protocol & Tactical Notes:**
   Dispatchers record operational coordination details directly in the dispatch record (e.g., VHF base radio frequency, deployed squad leader, preliminary triage directives).

3. **Status Lifecycle Synchronization:**
   Upon dispatch authorization, the incident lifecycle advances from `Pending` to `Dispatched`. Real-time WebSocket broadcasts immediately update all connected operations consoles, and push notifications are delivered to the reporting citizen stating that the assigned agency is en route.

4. **Incident Resolution & Archival:**
   Once on-scene operations are concluded, dispatchers mark the incident as `Resolved`. The active dispatch record is finalized with completion timestamps, and the incident moves to the searchable Log Archive.

---

## 2. Administrative & Legal Prerequisites for Direct Fleet Integration

Direct field responder mobile integration—including per-vehicle tablets, live telemetry streaming, and automated responder mobile logins—involves inter-agency governance boundaries that extend beyond single-agency LGU software:

1. **Inter-Agency Memoranda of Agreement (MOA):**
   - The Bureau of Fire Protection (BFP) operates under the Department of the Interior and Local Government (DILG) national command.
   - The Philippine National Police (PNP) operates under the National Police Commission (NAPOLCOM) and PNP National Headquarters.
   - Deploying mandatory mobile applications or operational tracking on national agency personnel and government vehicles requires formal tripartite or quadpartite MOAs establishing jurisdiction, data-sharing protocols, and command-and-control hierarchy.

2. **Fleet Asset Ownership & Maintenance:**
   - National agency vehicles (fire engines, police patrol cars) are inventoried under national property accounting codes, whereas rescue ambulances and watercraft are LGU assets.
   - Maintenance status (e.g., out-of-service, preventive maintenance, pump overhaul) is governed by internal agency logbooks and cannot be unilaterally assumed or simulated by municipal dispatchers without verified telemetry feeds.

3. **Data Privacy & Operational Security:**
   - Real-time GPS broadcasting of law enforcement units (PNP) introduces tactical security risks during active criminal operations.
   - Secure field hardware deployment requires dedicated mobile device management (MDM), ruggedized vehicle docks, and secondary radio fallbacks rather than consumer smartphone deployments.

---

## 3. Phase 2 Architectural Specification: Multi-State Responder Lifecycles

When administrative agreements and dedicated vehicle hardware are formalized, the system architecture will expand to support dedicated responder roles and complex multi-state operational lifecycles:

### 3.1 Hierarchical Vehicle & Operator Model
- **Vehicle Unit Account:** Each response vehicle possesses a durable hardware identity (e.g., vehicle unit identifier paired with an installed tablet).
- **Crew Manifest:** Field personnel authenticate to the vehicle session, recording the team leader and crew members on duty without fragmenting telemetry streams into multiple competing GPS signals.
- **Single Stream Leader:** Only the primary vehicle tablet streams telemetry to the dispatch map, maintaining clean map visualization and bandwidth efficiency.

### 3.2 Granular Operational State Lifecycles

In real-world emergency management, responders do not transition instantaneously from arrival to availability. Each agency exhibits distinct intermediate operational states:

#### Fire Suppression Lifecycle (BFP)
1. `Dispatched` - Unit acknowledged dispatch order and en route.
2. `Arrived On Scene` - Fire suppression apparatus stationed at coordinates; perimeter established.
3. `Water Supply Active / Working Fire` - Crew actively engaging fire; apparatus tied to hydrant or relay tanker. Unit is unavailable for redirection.
4. `Fire Under Control` - Spread arrested; salvage and overhaul phase initiated.
5. `Fire Out` - Overhaul completed; equipment stowed.
6. `Returning to Quarters / Replenishing` - Unit refilling water tanks at hydrant or refilling breathing apparatus; unit unavailable until fully restocked.
7. `In Quarters / Available` - Unit restored to active readiness.

#### Medical & Ambulance Transit Lifecycle (MDRRMO Rescue / RHU)
1. `Dispatched` - Ambulance crew en route to scene.
2. `Arrived On Scene` - Paramedics conducting on-site patient assessment and stabilization.
3. `Patient Loaded / In Transit to Hospital` - Unit en route to receiving medical facility (e.g., San Isidro RHU, Provincial Hospital, or Cabanatuan medical centers). Unit coordinates with receiving emergency department.
4. `Arrived at Hospital / Transfer of Care` - Patient handed over to emergency room triage staff; endorsed medical documentation.
5. `Ambulance Decontamination & Restock` - Vehicle sanitization, linen replenishment, and medical consumable restocking.
6. `Available for Dispatch` - Vehicle ready for immediate emergency reassignment.

#### Dedicated Out-of-Service States
- `Scheduled Maintenance` - Routine engine, pump, or hydraulic maintenance.
- `Mechanical Breakdown / Out of Service` - Unscheduled repair status.
- `Self-Dispatched / Mutual Aid` - Unit responding to external mutual-aid call outside San Isidro territorial boundary.

---

## 4. Summary

The current architecture provides a resilient, clean, and legally unencumbered foundation for municipal dispatching. The exclusion of mock fleet entities ensures data integrity across all operational reports while preserving a clean path for Phase 2 inter-agency fleet expansion upon execution of the necessary inter-agency agreements.
