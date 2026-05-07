# Local Environment Installation Guide

Follow this continuous, step-by-step guide to run the SINE MDRRMO Emergency Response App on your local machine. Ensure you have Composer, Node.js, PHP, and MariaDB (PHP and MariaDB is usually provided by Xampp) installed before proceeding.

This works on both Windows and Linux Environment.
Note that on Linux, You will have to install MariaDB/MySQL server and PHP separately.
Installing Xampp on Windows already provides the needed MariaDB/Server and PHP server.
Additionally, you will need to install several PHP extensions on **Linux** with the installation process depends on what distribution you are using:
* php-mbstring
* php-curl
* php-zip
* php-intl
* php-xml

On **Windows**, these can be configured by going into xampp's php folder and edit the php.ini.
Locate the Dynamic Extensions and scroll down a bit until you find the list of extensions.
uncomment some of the extensions by removing the ";" semi-colon before them.
make sure these extensions are uncommented:
* extension=mbstring
* extension=curl
* extension=zip
* extension=intl

- It is recommended that you install xampp before installing composer on Windows, as the Composer installer will detect and point into xampp php folder.
- After configuring your php extensions on your Linux or Windows Computer, you can then install Composer.

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
DB_USERNAME=your_username_here 
DB_PASSWORD=your_password_here
```
It is recommended that you don't use the root account, and instead, create a new user account on your MariaDB/mysql server that is only able to access the database of this project.
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
6. **Start the API Backend: Boot up the Laravel server**:
```bash
php artisan serve
```
7. **Install Frontend Dependencies**: Open a new, second terminal window and navigate to the frontend folder. (If a node_modules folder already exists, delete it first). Then run:

```Bash
npm install
```
8. **Install Ionic**: Install ionic/cli on your computer using npm:
```bash
npm install -g @ionic/cli
```
the "-g" flag is for installing it globally.

9. **Start the Ionic Frontend**: Once dependencies are installed, boot up the mobile/web interface:

```Bash
ionic serve
```

**Check if both Laravel and Ionic is accessible**:
Laravel/Backend : localhost:8000
Ionic/Frontend : localhost:8100