# SINE-MDRRMO Legacy Backend (Laravel Edition)

This directory contains the initial PHP / Laravel implementation of the SINE-MDRRMO Emergency Response System backend.

## Purpose & Historical Context

This backend served as the baseline API and WebSocket implementation during the initial phases of the project:
* **Framework**: Laravel 11/12 with PHP 8.4
* **Containers**: Nginx, PHP-FPM, Redis, and Laravel Reverb packaged via Podman/Docker
* **Authentication**: Laravel Sanctum with SHA-256 hashed bearer tokens
* **Broadcasting**: Laravel Reverb WebSocket daemon on port 6001 / 80

## Current Status & Reinstatement

The production environment has transitioned to the high-performance Go Fiber native micro-daemon located in `backend/` for optimal memory efficiency and resilience on cloud VPS infrastructure.

This codebase is preserved in the repository for:
1. **Fallback & Reinstatement**: In the event that testing or benchmarking against the PHP implementation is required, this directory can be spun up immediately.
2. **Schema Reference**: Contains Eloquent migrations and historical seeds for reference.

### How to Run Locally / In Podman

```bash
# 1. Navigate to directory
cd old-backend

# 2. Configure environment
cp .env.example .env

# 3. Start containers via Podman / Docker Compose
podman-compose up -d

# 4. Run migrations & storage link
podman exec -it mdrrmo_backend php artisan migrate --seed
podman exec -it mdrrmo_backend php artisan storage:link
```
