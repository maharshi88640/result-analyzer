
# Authentication Credentials - Updated

## How to Access the System

Since this is a secure system, **there are no default username and password**. You need to create an account first.

### Step 1: Register a New Account
1. Go to the login page
2. Click **"Don't have an account? Create one"** link at the bottom
3. Fill in the registration form:
   - **Username**: Choose a unique username (e.g., "testuser")
   - **Email**: Your email address
   - **Password**: Choose a secure password
4. Click **"Create account"** button

### Step 2: Login with Your Credentials
After successful registration:
1. Click **"Already have an account? Sign in"** link
2. Enter your login credentials:
   - **Email**: The email you registered with
   - **Password**: The password you set
3. Click **"Sign in"** button

### Example Registration
```
Username: testuser
Email: test@example.com
Password: password123
```



### Recent Fixes Applied
✅ **Fixed Authentication Bug**: Backend now accepts email for login (was expecting username)
✅ **Added Registration UI**: Users can now see and use the account creation interface
✅ **Fixed Form Submission**: Registration properly sends username, email, and password
✅ **Fixed API Endpoints**: Frontend now calls correct `/signup` and `/login` endpoints (removed `/api` prefix)
✅ **Fixed 404 Errors**: Resolved authentication endpoint routing issues

### Important Notes
- The system uses **email** for login (not username)
- Passwords are securely hashed
- Tokens expire after 7 days
- Each user has their own isolated data

### Database Structure
- Users are stored in MongoDB collection `users`
- Each user can upload multiple Excel files
- File combining works across files uploaded by the same user

## File Combining Features

Once logged in, you can:
1. Upload multiple Excel files
2. Select files to combine
3. View combined data in tables showing:
   - Name (common field)
   - SEM (semester)
   - SPI (SGPA)
   - CGPA
   - SPI Result
   - MapNo (mapping number)
   - Source file information

