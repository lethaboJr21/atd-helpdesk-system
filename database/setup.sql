-- Run as postgres superuser:
-- psql -U postgres -f database/setup.sql

-- 1. Create the application user
CREATE USER atd_user WITH PASSWORD 'your_strong_password_here';

-- 2. Create the database owned by that user
CREATE DATABASE atd_helpdesk OWNER atd_user ENCODING 'UTF8';

-- 3. Grant privileges
GRANT ALL PRIVILEGES ON DATABASE atd_helpdesk TO atd_user;

-- After connecting to the atd_helpdesk database, run:
-- \c atd_helpdesk
GRANT ALL ON SCHEMA public TO atd_user;
