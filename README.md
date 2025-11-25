# MTR Maintenance Tracking

A Next.js application for managing lift and escalator maintenance schedules for MTR (Hong Kong metro operator).

## Overview

This tool replaces the Excel-based maintenance scheduling system for MTR equipment. It ensures on-time maintenance completion for every MTR unit, with adherence measured against strict 14-day cycles and operational tolerance windows.

## Key Features

- **14-Day Cycle Tracking**: Visual calendar showing all committed maintenance dates
- **Compliance Monitoring**: Track committed dates vs actual completion with ±3-5 day tolerance
- **Chinese Notifications**: Automated reminders for engineers in Chinese
- **Rescheduling Management**: Track and manage rescheduling requests with MTR approval workflow
- **Looker Integration**: Automatic sync of engineers, devices, and maintenance visits
- **Compliance Reporting**: Generate audit reports for MTR

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

Open [http://localhost:3000](http://localhost:3000) to see the app.

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
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   └── page.tsx           # Home page
├── lib/                    # Shared utilities
│   ├── looker.ts         # Looker integration
│   ├── novu.ts           # Novu integration
│   └── prisma.ts         # Prisma client
├── prisma/
│   └── schema.prisma     # Database schema
└── scripts/               # Utility scripts
```

## API Endpoints

- `GET /api/health` - Health check endpoint

More API endpoints will be added as features are developed.

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

