# Local Environment Installation Guide

Follow this continuous, step-by-step guide to run the SINE MDRRMO Emergency Response App on your local machine. Ensure you have Composer, Node.js, PHP, and MariaDB (PHP and MariaDB are usually provided by XAMPP) installed before proceeding.

This works on both Windows and Linux Environments.
Note that on Linux, you will have to install MariaDB/MySQL server and PHP separately.
Installing XAMPP on Windows already provides the needed MariaDB and PHP server.

Additionally, you will need to install several PHP extensions on **Linux** (the installation process depends on which distribution you are using):
* php-mbstring
* php-curl
* php-zip
* php-intl
* php-xml

On **Windows**, these can be configured by going into the XAMPP `php` folder and editing the `php.ini` file. Locate the Dynamic Extensions and scroll down until you find the list. Uncomment the extensions by removing the `;` semi-colon before them:
* `extension=mbstring`
* `extension=curl`
* `extension=zip`
* `extension=intl`

*(Note: It is recommended to install XAMPP before installing Composer on Windows, as the Composer installer will auto-detect and point to the XAMPP PHP folder).*

---

### Complete System Setup

1. **Start your Database Server:** Turn on your local MariaDB/MySQL server (via XAMPP, Laragon, or native).

2. **Import the Database:** Create an empty database named `emergencydb`. Navigate to the `database` folder in your terminal and import the schema:
   ```bash
   source emergencydb.sql
   ```

3. **Configure the Backend Environment**: Open a terminal, navigate to the backend folder, and duplicate the environment file:
```bash
Linux/macOS: cp .env.example .env

Windows: copy .env.example .env
```

Then install Composer dependencies inside the backend folder:
```bash
composer install
```
*(If errors occur regarding versions, use the ignore flag: composer install --ignore-platform-reqs)*


4. **Set Database Credentials**: Open that new .env file in the backend folder and update the database section to match your local setup:
```bash
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=emergencydb
DB_USERNAME=your_username_here 
DB_PASSWORD=your_password_here
```

*(Recommendation: Create a dedicated database user instead of using root):*
- How to create new user?:
```bash
CREATE USER 'new_user'@'localhost' IDENTIFIED BY 'secure_password';
```
- Then add privilege to emergencydb:
```bash
GRANT ALL PRIVILEGES ON emergency.* TO 'new_user'@'localhost';
```
- Finally, we have to reload the GRANT Table so the privileges take effect immediately:
```bash
FLUSH PRIVILEGES;
```

5. **Generate the App Key**: While still in the backend folder terminal, generate Laravel's encryption key:

```Bash
php artisan key:generate
```

6. **Link Local Storage (CRITICAL FOR IMAGES)**: Create the symbolic link so the SINE MDRRMO app can publicly serve the SOS Camera uploads and Profile Pictures:

```Bash
php artisan storage:link
```

7. **Start the API Backend: Boot up the Laravel server**:
```bash
php artisan serve
```

8. **Install Frontend Dependencies**: Open a new, second terminal window and navigate to the frontend folder. (If a node_modules folder already exists, delete it first). Then run:

```Bash
npm install
```
9. **Install Ionic**: Install ionic/cli on your computer using npm:

```bash
npm install -g @ionic/cli
```

10. **Start the Ionic Frontend**: Once dependencies are installed, boot up the mobile/web interface:

```Bash
ionic serve
```

**Check if both Laravel and Ionic is accessible**:
<br>
Laravel Backend API running on : localhost:8000
<br>
Ionic Frontend UI running on : localhost:8100