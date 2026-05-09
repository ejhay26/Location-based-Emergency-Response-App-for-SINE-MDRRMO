# Location-Based Emergency Response App for San Isidro, Nueva Ecija MDRRMO

## Overview
This Capstone project is a full-stack, location-based emergency response system designed specifically for the Municipal Disaster Risk Reduction and Management Office (MDRRMO) of San Isidro, Nueva Ecija. 

The system provides a seamless bridge between citizens experiencing emergencies and the local response teams, ensuring rapid deployment, anti-prank verification, and accurate live location tracking.

## Technology Stack
* **Frontend Mobile/Web App:** Ionic 8, Angular 17 (Standalone Components)
* **Native Device Plugins:** Capacitor (Geolocation, Camera)
* **Backend API:** Laravel 11 (PHP)
* **Database:** MariaDB / MySQL
* **Mapping Engine:** Leaflet.js with custom GeoJSON Boundary Masking
* **Styling:** Ionic Native UI Components, SCSS

## System Architecture
The platform is divided into robust, role-based interfaces:
1. **Citizen Portal:** Allows residents to register, manage their profile, and trigger an immediate SOS alert with live GPS and photographic evidence.
2. **Command Center (Admin Dashboard):** A secure portal for MDRRMO Dispatchers and Master Admins to view incoming emergencies on a real-time auto-polling map, assign specific responder units, and archive resolved incidents.

## Core Features
* **Role-Based Access Control (RBAC):** Distinct dashboards and routing protections for Citizens, Dispatchers, and Master Admins.
* **Interactive Live Map:** Leaflet-powered map utilizing Ray-Casting mathematical algorithms and GeoJSON masks to strictly lock the camera and SOS pins within the San Isidro municipality borders.
* **One-Tap SOS & Anti-Prank System:** Native GPS coordinate extraction combined with a forced live-camera photo requirement to deter fake emergency spam.
* **Real-Time Dispatch Polling:** The command center silently polls the Laravel API in the background, automatically dropping interactive red pins on the map the second an emergency occurs.
* **Dynamic Asset Dispatching:** Cascading relational dropdowns that allow dispatchers to assign specific units (e.g., Fire Department, RHU) and link them to their designated vehicles.
* **Secure Profile Management:** End-to-end encrypted password updating (with strict regex security enforcement) and Base64 profile avatar uploading.
* **Interactive Analytics Dashboard:** Built-in Chart.js data visualization allowing admins to filter emergencies by dynamic timeframes (7, 30, or 90 days). Includes interactive Line/Bar trend graphs and Doughnut charts that automatically filter the emergency history list when clicked.
* **"Golden Minute" Medical Profile:** Allows citizens to optionally save vital health data (blood type, allergies, conditions, PWD status) that is instantly attached to their SOS dispatch, allowing responders to prepare specialized gear before arriving.
* **Crowdsourced Hazard Mapping:** Empowers residents to report road hazards (e.g., floods, fallen trees) with photo evidence and GPS validation. These drop warning pins on the command center map to aid dispatchers in safe vehicle routing.
* **Public Broadcast System:** Enables the MDRRMO Master Admin to push critical, real-time alert marquees directly to the top of all citizen dashboards (e.g., severe weather warnings).
* **Stateless Account Recovery:** Highly secure, OTP-based email verification flow allowing citizens to reset forgotten passwords without requiring persistent server sessions.

## Future Scope & Recommendations (Version 2.0)
While the core emergency dispatch engine is fully operational, the following features are slated for future development:
1. **Offline Resiliency (Typhoon-Proofing):** Utilizing Ionic Local Storage to queue SOS requests during internet outages, automatically firing them to the server when mobile data is restored.
2. **Push Notifications:** Integrating Firebase Cloud Messaging (FCM) to push free, real-time alert banners to citizens when responders are en route.

## Setup & Installation
For instructions on how to set up the database, backend, and frontend environments locally, please refer to the [Installation Guide](./installation.md).