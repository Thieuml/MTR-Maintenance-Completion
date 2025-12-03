# Database Setup Guide

## ✅ Recommended: Separate Database

**Best Practice**: Use a **separate database** for MTR Maintenance Tracking project.

**Benefits**:
- ✅ Clean separation of projects
- ✅ No schema conflicts
- ✅ Independent migrations
- ✅ Easier to manage and backup
- ✅ Can scale independently
- ✅ Safer - changes to one project don't affect the other

## Setting Up a New Database

### Option 1: Neon (Recommended - Same as shiftproto)

1. Go to [Neon Console](https://console.neon.tech)
2. Create a new project: "MTR Maintenance Tracking"
3. Copy the connection string
4. Update `.env.local` with the new `DATABASE_URL`

### Option 2: Supabase

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Create a new project: "MTR Maintenance Tracking"
3. Go to Settings → Database
4. Copy the connection string
5. Update `.env.local` with the new `DATABASE_URL`

### Option 3: Any PostgreSQL Database

You can use any PostgreSQL database provider:
- Neon
- Supabase
- Railway
- Render
- AWS RDS
- Self-hosted PostgreSQL

## Quick Setup Steps

### 1. Create New Database

Get your database connection string (format):
```
postgresql://user:password@host:5432/database?sslmode=require
```

### 2. Update .env.local

Edit `.env.local` and update `DATABASE_URL`:
```bash
DATABASE_URL="postgresql://your-new-database-connection-string"
```

### 3. Push Schema

```bash
npm run db:push
```

This will create all MTR tables in the new database.

### 4. Seed Data

```bash
npm run db:seed
```

This will create:
- MTR Zones (MTR-01 to MTR-06)
- Certified Engineers (6 engineers with CP & RW certs)

### 5. Verify

```bash
npm run db:studio
```

This opens Prisma Studio where you can view your database.

## Current Status

✅ Environment variables configured  
✅ `.env.local` file created  
⏳ **Need to create new database and update DATABASE_URL**  
⏳ Then run `npm run db:push` and `npm run db:seed`

## Why Separate Databases?

1. **Isolation**: Each project has its own data
2. **Safety**: Schema changes in one project don't affect the other
3. **Clarity**: Clear separation of concerns
4. **Flexibility**: Can use different database versions/configurations
5. **Backup**: Independent backup strategies
6. **Performance**: Can optimize each database independently

---

**Next Step**: Create a new database and update `DATABASE_URL` in `.env.local`
