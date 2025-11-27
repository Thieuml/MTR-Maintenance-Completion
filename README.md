# MTR Maintenance Tracking

A Next.js application for managing lift and escalator maintenance schedules for MTR (Hong Kong metro operator).

## Overview

This tool replaces the Excel-based maintenance scheduling system for MTR equipment. It ensures on-time maintenance completion for every MTR unit, with adherence measured against strict 14-day cycles and operational tolerance windows.

## Key Features

- **14-Day Cycle Tracking**: Visual calendar showing all committed maintenance dates
- **Drag-and-Drop Rescheduling**: Intuitive interface to move maintenance slots between days/times
- **Work Order Management**: CSV upload with automatic slot distribution and validation
- **Completion Tracking**: Mark maintenance as completed or flag for rescheduling
- **Work Order Tracking**: Comprehensive view with tabs for validation, rescheduling, and completed work orders
- **Admin Panel**: Manage devices, zone mappings, 23:00 slot eligibility, and engineer assignments
- **Looker Integration**: Automatic sync of engineers, devices, and maintenance visits
- **Compliance Monitoring**: Track committed dates vs actual completion with ±3-5 day tolerance
- **Chinese Notifications**: Automated reminders for engineers (Novu workflows configured)

## Tech Stack

- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **Prisma** (PostgreSQL)
- **Looker SDK** (for data integration)
- **Novu** (for notifications)

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL database (e.g., Neon, Supabase, or RDS)
- Looker API credentials
- Novu account and API key

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` and add:
- `DATABASE_URL` - PostgreSQL connection string
- `LOOKER_API_BASE_URL` - Your Looker instance URL
- `LOOKER_CLIENT_ID` - Looker API client ID
- `LOOKER_CLIENT_SECRET` - Looker API client secret
- `NOVU_API_KEY` - Novu API secret key
- `NOVU_API_HOSTNAME` - (Optional) Novu API hostname (e.g., https://eu.api.novu.co)

3. Set up the database:
```bash
# Generate Prisma Client
npm run db:generate

# Push schema to database
npm run db:push

# (Optional) Seed with initial data
npm run db:seed
```

4. Set up Novu workflows:
```bash
npm run setup:novu
```

5. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3004](http://localhost:3004) to see the app (port configured to 3004).

## Looker Integration

The application integrates with Looker to sync:

- **Engineers** (Look ID 160): Active engineers filtered on HK
- **MTR Devices** (Look ID 167): List of all MTR equipment
- **Maintenance Visits** (Look ID 168): Last 3 months of maintenance visits

Configure Look IDs via environment variables:
- `LOOKER_ENGINEERS_LOOK_ID` (default: 160)
- `LOOKER_DEVICES_LOOK_ID` (default: 167)
- `LOOKER_VISITS_LOOK_ID` (default: 168)

## Novu Notifications

The application sends Chinese-language notifications to engineers:

1. **Tonight Schedule**: Daily reminder of planned maintenance units for tonight
2. **Missed Committed Date**: Alert when a committed date is missed

Workflows are created automatically via `npm run setup:novu`. Customize templates in the Novu dashboard.

## Database Schema

### Core Models

- **Zone**: MTR zones (MTR-01 to MTR-06)
- **Equipment**: Lifts and escalators
- **Engineer**: Engineers synced from Looker
- **Schedule**: 14-day maintenance schedules
- **MaintenanceVisit**: Actual execution records
- **Reschedule**: Rescheduling requests and approvals

## Project Structure

```
MTR-Maintenance-Tracking/
├── app/                           # Next.js App Router pages
│   ├── api/                      # API routes
│   │   ├── admin/                # Admin endpoints
│   │   ├── engineers/            # Engineer endpoints
│   │   ├── schedules/            # Schedule endpoints
│   │   ├── sync/                 # Looker sync endpoints
│   │   └── zones/                # Zone endpoints
│   ├── admin/                    # Admin panel page
│   ├── schedule/                 # Schedule calendar page
│   ├── work-order-tracking/      # Work order tracking page
│   ├── reschedule/               # Rescheduling page
│   └── validation/               # Completion validation page
├── components/                    # React components
│   ├── admin/                    # Admin components
│   ├── ScheduleCalendar.tsx      # Main calendar component
│   ├── ScheduleCard.tsx          # Schedule card component
│   └── Navigation.tsx            # Sidebar navigation
├── lib/                           # Shared utilities
│   ├── looker.ts                 # Looker integration
│   ├── novu.ts                   # Novu integration
│   ├── prisma.ts                 # Prisma client
│   └── hooks.ts                  # React hooks (useSchedule, etc.)
├── prisma/
│   └── schema.prisma            # Database schema
└── scripts/                      # Utility scripts
    ├── init-device-mappings.ts   # Initialize device mappings
    └── normalize-equipment-numbers.ts  # Normalize equipment names
```

## API Endpoints

### Health & Sync
- `GET /api/health` - Health check endpoint
- `POST /api/sync/engineers` - Sync engineers from Looker
- `POST /api/sync/devices` - Sync devices from Looker
- `POST /api/sync/visits` - Sync maintenance visits from Looker

### Schedules
- `GET /api/schedules` - List schedules with optional filters (zone, date range, status)
- `POST /api/schedules` - Create a new schedule
- `GET /api/schedules/[id]` - Get a specific schedule
- `POST /api/schedules/[id]/move` - Move or swap schedules (drag-and-drop)
- `POST /api/schedules/[id]/assign` - Assign engineers to a schedule
- `POST /api/schedules/[id]/unassign` - Unassign engineers from a schedule
- `POST /api/schedules/[id]/validate` - Validate maintenance completion (completed/to_reschedule)
- `POST /api/schedules/bulk-create` - Bulk create schedules

### Engineers
- `GET /api/engineers` - List engineers
- `GET /api/engineers/[id]/workload` - Get engineer workload statistics

### Zones
- `GET /api/zones` - List all zones

### Admin
- `GET /api/admin/equipment` - List all equipment (from Looker and database)
- `POST /api/admin/equipment` - Create or update equipment
- `GET /api/admin/equipment/[id]` - Get specific equipment
- `GET /api/admin/equipment-2300` - Get all 23:00-eligible equipment
- `GET /api/admin/equipment-mapping` - List equipment zone mappings
- `POST /api/admin/equipment-mapping` - Create or update equipment mapping
- `GET /api/admin/equipment-mapping/[equipmentId]` - Get equipment mapping
- `GET /api/admin/work-orders` - List work orders with filters
- `POST /api/admin/work-orders/upload` - Upload work orders from CSV
- `GET /api/admin/zone-engineers` - List zone-engineer assignments
- `POST /api/admin/zone-engineers` - Create zone-engineer assignment

## Development

### Database Commands

```bash
npm run db:generate  # Generate Prisma Client
npm run db:push      # Push schema changes (dev only)
npm run db:migrate   # Create and apply migrations
npm run db:seed      # Seed database
npm run db:studio    # Open Prisma Studio
```

### Testing

```bash
npm run lint         # Run ESLint
```

## Deployment

The application can be deployed to Vercel:

1. Push code to GitHub
2. Import project in Vercel
3. Set environment variables in Vercel dashboard
4. Deploy

## License

Private - WeMaintain Internal Use

