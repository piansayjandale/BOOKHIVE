# BookHive Login Setup Guide

## Quick Start (Development Mode - No Docker Required)

The login system now supports **fallback development mode** when PostgreSQL is not available. You can immediately log in with these credentials:

### Test Accounts

**ADMIN Account:**
- Email: `yana.palmares@stiwnu.edu.ph`
- Password: `BookHiveAdmin!2026`

**LIBRARIAN Account:**
- Email: `joseph.tan@stiwnu.edu.ph`
- Password: `BookHiveLibrarian!2026`

### Running the Application

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the development server:**
   ```bash
   npm run dev
   ```

3. **Open in browser:**
   ```
   http://localhost:3000/login
   ```

4. **Log in with the credentials above**

The system will work in fallback development mode without requiring Docker or PostgreSQL to be running.

---

## Production Setup (With Database)

If you want to use the full system with PostgreSQL:

### Prerequisites
- Docker and Docker Compose installed
- PostgreSQL 16+

### Setup Steps

1. **Create environment file:**
   Create `.env.local` in the root directory:
   ```
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/bookhive
   NODE_ENV=development
   ```

2. **Start PostgreSQL with Docker:**
   ```bash
   docker-compose up -d postgres
   ```

3. **Seed the database:**
   ```bash
   npm run db:seed
   ```

   This will create the required tables and insert the test users with hashed passwords.

4. **Start the application:**
   ```bash
   npm run dev
   ```

5. **Log in with the same credentials**

---

## How It Works

### Authentication Flow

1. **Login Page** (`/login`):
   - User enters email and password
   - Form is submitted to `/api/auth/login`

2. **API Route** (`/frontend/src/app/api/auth/login/route.ts`):
   - Validates input with Zod schema
   - Tries to authenticate against PostgreSQL database
   - **Fallback**: If database is unavailable, uses development credentials
   - Creates session token and sets secure cookie
   - Returns redirect path based on user role

3. **Role-Based Routing**:
   - Admin users → `/admin`
   - Librarian users → `/librarian`
   - Student users → `/dashboard`

### Development Mode Features

- ✅ Works without Docker
- ✅ Works without PostgreSQL
- ✅ Built-in fallback credentials
- ✅ Full session management
- ✅ Role-based routing

### Production Mode Features

- ✅ PostgreSQL authentication
- ✅ Bcrypt password hashing
- ✅ Secure session tokens
- ✅ Full audit logging
- ✅ Real user management

---

## Environment Variables

### Required
- `DATABASE_URL`: PostgreSQL connection string (optional for dev mode)
- `NODE_ENV`: Set to `development` for fallback mode

### Example `.env.local`
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/bookhive
NODE_ENV=development
```

---

## Troubleshooting

### "Invalid credentials" error
1. Check the exact email and password in the test accounts above
2. Make sure you're not adding extra spaces
3. Password is case-sensitive

### Database connection fails
- The system will automatically fall back to development mode
- Check your PostgreSQL is running if you want database mode
- Check `.env.local` has the correct `DATABASE_URL`

### "Admin PostgreSQL is not configured"
- This is expected in development mode without PostgreSQL
- The system will use fallback credentials

---

## Next Steps

1. ✅ Update login page design (DONE)
2. ✅ Add password visibility toggle (DONE)
3. ✅ Set up fallback authentication (DONE)
4. 📝 Customize dashboard layouts for each role
5. 📝 Implement book search functionality
6. 📝 Set up transaction workflows

