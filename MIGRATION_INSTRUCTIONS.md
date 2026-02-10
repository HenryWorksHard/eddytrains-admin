# Database Migration: Multi-Trainer Support

## Quick Steps

1. Go to Supabase Dashboard: https://supabase.com/dashboard/project/gwynpezohzwhueeimjao
2. Click "SQL Editor" in the left sidebar
3. Copy and paste the contents of `supabase/migrations/20260210_multi_trainer.sql`
4. Click "Run"

## What This Migration Does

### New Tables
- `organization_members` - Links trainers to organizations with roles (owner/admin/trainer)
- `organization_invites` - Pending invitations for trainers

### Updated Tables
- `profiles` - Added `is_super_admin` (boolean) and `trainer_id` (for client assignment)
- `organizations` - Added `max_trainers` limit

### Automatic Data Migration
- Existing organization owners are automatically added to `organization_members` as 'owner'
- Louis (cmpdcollective@gmail.com) is set as super admin

## After Running Migration

The app will support:
- **Super Admin (Louis)**: See all companies, create new ones, manage everything
- **Company Owner**: Manage their trainers, company settings, billing
- **Company Admin**: Manage trainers and clients (no billing)
- **Trainer**: Manage only their assigned clients
- **Client**: View their workouts

## Verify Migration

Run this SQL to verify:
```sql
-- Check organization_members table exists
SELECT COUNT(*) FROM organization_members;

-- Check is_super_admin column exists
SELECT id, email, is_super_admin FROM profiles LIMIT 5;

-- Check Louis is super admin
SELECT * FROM profiles WHERE email = 'cmpdcollective@gmail.com';
```
