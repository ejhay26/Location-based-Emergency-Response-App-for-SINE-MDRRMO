# Location-Based Emergency Response App for SINE MDRRMO

## Overview
This Capstone project is a full-stack, location-based emergency response system designed specifically for the Municipal Disaster Risk Reduction and Management Office (MDRRMO) of San Isidro, Nueva Ecija. 

The system provides a seamless bridge between citizens experiencing emergencies and the local response teams, ensuring rapid deployment and accurate location tracking.

## Technology Stack
* **Frontend Mobile/Web App:** Ionic 8, Angular 17 (Standalone Components)
* **Backend API:** Laravel 11 (PHP)
* **Database:** MariaDB / MySQL
* **Styling:** Ionic Native UI Components, SCSS

## System Architecture
The platform is divided into two primary interfaces:
1. **Citizen Portal:** Allows residents of San Isidro to register, log in, and trigger an immediate SOS alert.
2. **Admin Dashboard:** A secure portal for MDRRMO dispatchers to view incoming emergencies, track exact coordinates, and update request statuses.

## Features
* Secure Citizen Registration & Authentication (Role-based access control)
* Dynamic Barangay filtering strictly mapped to San Isidro's 9 official barangays.
* JWT/Session-based API communication between the Ionic frontend and Laravel backend.
* **[WIP]** One-Tap SOS functionality with automatic GPS coordinate extraction.

## Setup & Installation
For instructions on how to set up the database, backend, and frontend environments locally, please refer to the [Installation Guide](./installation/installation.md).