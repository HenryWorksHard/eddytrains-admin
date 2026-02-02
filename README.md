# EddyTrains Admin Portal

Admin dashboard for managing fitness clients, programs, and schedules.

## Setup

### 1. Database Setup (One-time)

1. Go to [Supabase SQL Editor](https://supabase.com/dashboard/project/gwynpezohzwhueeimjao/sql/new)
2. Copy and paste the contents of `../eddytrains-backend/setup.sql`
3. Click "Run" to create all tables

### 2. Create Admin Account

1. Go to [Supabase Auth](https://supabase.com/dashboard/project/gwynpezohzwhueeimjao/auth/users)
2. Click "Add user" → "Create new user"
3. Email: `cmpdcollective@gmail.com`
4. Password: `Eddyandlouis@2025`
5. After creating, go to SQL Editor and run:
   ```sql
   UPDATE public.profiles SET role = 'admin' WHERE email = 'cmpdcollective@gmail.com';
   ```

### 3. Run Locally

```bash
npm install
npm run dev
```

Open http://localhost:3000

### 4. Deploy to Vercel

```bash
vercel
```

## Environment Variables

Set these in Vercel:
- `NEXT_PUBLIC_SUPABASE_URL`: https://gwynpezohzwhueeimjao.supabase.co
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: (in .env.local)

## Features

- **Dashboard**: Overview of users, programs, stats
- **Users**: Add/manage clients, set permissions
- **Programs**: Create/edit fitness programs
- **Schedules**: Create weekly workout schedules

## Admin Login

- Email: cmpdcollective@gmail.com
- Password: Eddyandlouis@2025
