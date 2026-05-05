# Local Environment Installation Guide

Follow this continuous, step-by-step guide to run the SINE MDRRMO Emergency Response App on your local machine. Ensure you have PHP, Composer, Node.js, and MariaDB installed before proceeding.

### Complete System Setup

1. **Start your Database Server:** Turn on your local MariaDB/MySQL server (via XAMPP, Laragon, or native).
2. **Import the Database:** Create an empty database named `emergencydb`. Navigate to the `database` folder in your terminal and import the schema:
   ```bash
   source emergencydb.sql
3. **Configure the Backend Environment**: Open a terminal, navigate to the backend folder, and duplicate the environment file:
```bash
Linux/macOS: cp .env.example .env

Windows: copy .env.example .env
```
4. **Set Database Credentials**: Open that new .env file in the backend folder and update the database section to match your local setup:
```bash
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=emergencydb
DB_USERNAME=root
DB_PASSWORD=your_password_here
```
5. **Generate the App Key**: While still in the backend folder terminal, generate Laravel's encryption key:

```Bash
php artisan key:generate
```
6. **Start the API Backend: Boot up the Laravel server**:
```bash
php artisan serve
```
7. **Install Frontend Dependencies**: Open a new, second terminal window and navigate to the frontend folder. (If a node_modules folder already exists, delete it first). Then run:

```Bash
npm install
```
8. **Start the Ionic Frontend**: Once dependencies are installed, boot up the mobile/web interface:

```Bash
ionic serve
```