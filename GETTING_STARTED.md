# Getting Started - MTR Maintenance Tracking

## 🚀 Local Development URL

**Development Server**: http://localhost:3000

Start the dev server:
```bash
npm run dev
```

Then open your browser to: **http://localhost:3000**

## ✅ What's Been Completed

### Foundation Setup
- ✅ Project structure (Next.js 14, TypeScript, Prisma, Tailwind)
- ✅ Database schema designed and created
- ✅ Separate database configured (not shared with shiftproto)
- ✅ Database seeded with:
  - 6 MTR Zones (MTR-01 to MTR-06)
  - 6 Certified Engineers (with CP & RW certificates)

### Integrations Ready
- ✅ Looker integration utilities (engineers, devices, visits)
- ✅ Novu integration utilities (Chinese notifications)
- ✅ HKT timezone utilities
- ✅ Dummy OR number generation utilities

### Documentation
- ✅ PRD document
- ✅ Setup guides
- ✅ Technical decisions documented
- ✅ Implementation roadmap

## 📋 Next Steps

### Immediate Next Steps (Phase 1)

#### 1. Add Looker & Novu Credentials
Edit `.env.local` and add:
```bash
LOOKER_API_BASE_URL=https://your-instance.looker.com
LOOKER_CLIENT_ID=your_client_id
LOOKER_CLIENT_SECRET=your_client_secret
NOVU_API_KEY=your_novu_api_key
```

#### 2. Set Up Novu Workflows
```bash
npm run setup:novu
```

#### 3. Start Development Server
```bash
npm run dev
```

Visit: **http://localhost:3000**

### Phase 1: Data Sync (Priority: High)

**Goal**: Sync data from Looker into the database

**Tasks**:
1. **Create `/api/sync/engineers` endpoint**
   - Fetch engineers from Looker (Look ID 160)
   - Create/update engineers in database
   - Handle deactivation

2. **Create `/api/sync/devices` endpoint**
   - Fetch MTR devices from Looker (Look ID 167)
   - Create/update equipment
   - Assign to zones

3. **Create `/api/sync/visits` endpoint**
   - Fetch maintenance visits (Look ID 168)
   - Create MaintenanceVisit records
   - Auto-classify visits

**Files to create**:
- `app/api/sync/engineers/route.ts`
- `app/api/sync/devices/route.ts`
- `app/api/sync/visits/route.ts`

### Phase 2: Schedule Management API

**Goal**: Manage maintenance schedules (14-day cycles)

**Tasks**:
1. Create `/api/schedules` endpoint (GET, POST)
2. Create `/api/schedules/[id]` endpoint (GET, PUT, DELETE)
3. Create `/api/schedules/bulk-create` endpoint
4. Implement 14-day cycle validation

### Phase 3: Engineer Assignment

**Goal**: Assign engineers to schedules (2-man teams)

**Tasks**:
1. Create `/api/schedules/[id]/assign` endpoint
2. Create `/api/schedules/[id]/unassign` endpoint
3. Create `/api/engineers` endpoint
4. Validate certifications (CP & RW for fixed engineer)

### Phase 4: Calendar & Schedule UI

**Goal**: Visual 14-day calendar for all MTR units

**Tasks**:
1. Create `/schedule` page
2. Create calendar component
3. Add zone filtering
4. Display schedules with status colors

## 🛠️ Useful Commands

### Database
```bash
npm run db:generate    # Generate Prisma Client
npm run db:push        # Push schema to database
npm run db:seed        # Seed database
npm run db:studio      # Open Prisma Studio (view database)
```

### Development
```bash
npm run dev            # Start dev server (http://localhost:3000)
npm run build          # Build for production
npm run lint           # Run ESLint
```

### Notifications
```bash
npm run setup:novu     # Set up Novu workflows
npm run test:novu      # Test Novu notifications
```

## 📁 Project Structure

```
MTR-Maintenance-Tracking/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   └── health/       # Health check endpoint
│   ├── page.tsx          # Home page
│   └── layout.tsx        # Root layout
├── lib/                   # Shared utilities
│   ├── looker.ts         # Looker integration
│   ├── novu.ts           # Novu integration
│   ├── prisma.ts         # Prisma client
│   └── utils/            # Utility functions
│       ├── or-numbers.ts # OR number generation
│       └── timezone.ts   # HKT timezone utilities
├── prisma/
│   ├── schema.prisma     # Database schema
│   └── seed.ts           # Seed script
└── scripts/              # Utility scripts
```

## 🔍 Testing Your Setup

### 1. Check Database
```bash
npm run db:studio
```
Opens Prisma Studio - you should see:
- Zone table (6 zones)
- Engineer table (6 engineers)

### 2. Check API Health
```bash
curl http://localhost:3000/api/health
```
Should return: `{"status":"ok","timestamp":"..."}`

### 3. View Home Page
Open: http://localhost:3000
Should see: "MTR Maintenance Tracking" homepage

## 📚 Documentation

- **PRD**: `PRD.md` - Product requirements
- **Setup**: `SETUP.md` - Detailed setup guide
- **Next Steps**: `NEXT_STEPS.md` - Implementation roadmap
- **Decisions**: `DECISIONS.md` - Technical decisions
- **Database**: `DATABASE_SETUP.md` - Database setup guide
- **Looker**: `LOOKER_LOOKS.md` - Looker Look IDs reference

## 🎯 Quick Start Checklist

- [x] Database created and configured
- [x] Schema created
- [x] Data seeded
- [ ] Add Looker credentials to `.env.local`
- [ ] Add Novu API key to `.env.local`
- [ ] Run `npm run setup:novu`
- [ ] Run `npm run dev`
- [ ] Visit http://localhost:3000
- [ ] Start building Phase 1 features

---

**Ready to start?** Begin with Phase 1: Data Sync endpoints!

