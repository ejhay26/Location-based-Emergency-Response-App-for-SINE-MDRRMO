import the database into your mysql or mariadb server
that is in the database folder.

For the frontend,
go to the frontend folder and delete the node_modules, and then perform "npm install" on the command line of where the project is.

for the backend,
locate the backend folder and copy the .env.example into .env filename and configure the line that contains user and password to access your database server.

Generate the application key:
(This populates the APP_KEY in the new .env file, which Laravel needs for encryption)
command :  php artisan key:generate
