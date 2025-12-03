# API Usage Guide

Quick reference for using the MTR Maintenance Tracking API endpoints.

**Base URL**: http://localhost:3004

## Sync Endpoints

### Test Connections (GET)

```bash
# Test engineers sync connection
curl http://localhost:3004/api/sync/engineers

# Test devices sync connection
curl http://localhost:3004/api/sync/devices

# Test visits sync connection
curl http://localhost:3004/api/sync/visits
```

### Sync Data (POST)

#### Dry Run (Test Without Saving)

```bash
# Test engineers sync (dry run)
curl -X POST http://localhost:3004/api/sync/engineers \
  -H "Content-Type: application/json" \
  -d '{"dryRun": true}'

# Test devices sync (dry run)
curl -X POST http://localhost:3004/api/sync/devices \
  -H "Content-Type: application/json" \
  -d '{"dryRun": true}'

# Test visits sync (dry run)
curl -X POST http://localhost:3004/api/sync/visits \
  -H "Content-Type: application/json" \
  -d '{"dryRun": true}'
```

#### Actual Sync

```bash
# Sync engineers from Looker
curl -X POST http://localhost:3004/api/sync/engineers \
  -H "Content-Type: application/json" \
  -d '{}'

# Sync devices from Looker
curl -X POST http://localhost:3004/api/sync/devices \
  -H "Content-Type: application/json" \
  -d '{}'

# Sync visits from Looker
curl -X POST http://localhost:3004/api/sync/visits \
  -H "Content-Type: application/json" \
  -d '{}'
```

#### Sync with Options

```bash
# Sync engineers and deactivate missing ones
curl -X POST http://localhost:3004/api/sync/engineers \
  -H "Content-Type: application/json" \
  -d '{"deactivateMissing": true}'
```

## Using the Test Script

For easier testing, use the provided script:

```bash
bash scripts/test-sync.sh
```

## Expected Responses

### Success Response

```json
{
  "success": true,
  "results": {
    "created": 5,
    "updated": 20,
    "deactivated": 0,
    "errors": []
  },
  "engineersProcessed": 25,
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

### Dry Run Response

```json
{
  "success": true,
  "dryRun": true,
  "engineersFound": 25,
  "engineers": [...],
  "message": "Dry run - no changes made"
}
```

### Error Response

```json
{
  "success": false,
  "error": "Error message here"
}
```

## Schedule Management Endpoints

### List Schedules (GET)

```bash
# Get all schedules
curl http://localhost:3004/api/schedules

# Filter by zone
curl "http://localhost:3004/api/schedules?zoneId=zone-id"

# Filter by date range
curl "http://localhost:3004/api/schedules?from=2025-01-01&to=2025-01-31"

# Filter by status
curl "http://localhost:3004/api/schedules?status=PLANNED"

# Combine filters
curl "http://localhost:3004/api/schedules?zoneId=zone-id&from=2025-01-01&to=2025-01-31&status=PLANNED"
```

### Create Schedule (POST)

```bash
curl -X POST http://localhost:3004/api/schedules \
  -H "Content-Type: application/json" \
  -d '{
    "equipmentId": "equipment-id",
    "zoneId": "zone-id",
    "r0PlannedDate": "2025-11-02T23:00:00Z",
    "r1PlannedDate": "2025-11-02T23:00:00Z",
    "batch": "A",
    "timeSlot": "SLOT_2300",
    "fixedEngineerId": "engineer-id",
    "workOrderNumber": "5000355448"
  }'
```

### Get Single Schedule (GET)

```bash
curl http://localhost:3004/api/schedules/schedule-id
```

### Update Schedule (PUT)

```bash
curl -X PUT http://localhost:3004/api/schedules/schedule-id \
  -H "Content-Type: application/json" \
  -d '{
    "r1PlannedDate": "2025-11-03T23:00:00Z",
    "status": "IN_PROGRESS"
  }'
```

### Delete Schedule (DELETE)

```bash
curl -X DELETE http://localhost:3004/api/schedules/schedule-id
```

### Bulk Create Schedules (POST)

```bash
curl -X POST http://localhost:3004/api/schedules/bulk-create \
  -H "Content-Type: application/json" \
  -d '{
    "equipmentIds": ["equipment-id-1", "equipment-id-2"],
    "startDate": "2025-11-01T00:00:00Z",
    "endDate": "2025-12-31T00:00:00Z",
    "defaultTimeSlot": "SLOT_0130"
  }'
```

## Next Steps

After syncing data:

1. **Verify in Database**:
   ```bash
   npm run db:studio
   ```

2. **Check Sync Results**:
   - Engineers should appear in Engineer table
   - Devices should appear in Equipment table
   - Visits should appear in MaintenanceVisit table

3. **Create Schedules**:
   - Use bulk-create to generate schedules for equipment
   - Or create individual schedules via POST /api/schedules

## Engineer Assignment Endpoints

### List Engineers (GET)

```bash
# Get all engineers
curl http://localhost:3004/api/engineers

# Filter by active status
curl "http://localhost:3004/api/engineers?active=true"

# Filter engineers with certificates (CP & RW)
curl "http://localhost:3004/api/engineers?hasCertificates=true"

# Search by name
curl "http://localhost:3004/api/engineers?search=Yip"

# Filter by zone (engineers with schedules in that zone)
curl "http://localhost:3004/api/engineers?zoneId=zone-id"
```

### Get Engineer Workload (GET)

```bash
curl "http://localhost:3004/api/engineers/engineer-id/workload?from=2025-01-01T00:00:00Z&to=2025-12-31T00:00:00Z"
```

### Assign Engineer to Schedule (POST)

```bash
# Assign as fixed engineer (must have CP & RW certs)
curl -X POST http://localhost:3004/api/schedules/schedule-id/assign \
  -H "Content-Type: application/json" \
  -d '{
    "engineerId": "engineer-id",
    "role": "fixed"
  }'

# Assign as rotating engineer
curl -X POST http://localhost:3004/api/schedules/schedule-id/assign \
  -H "Content-Type: application/json" \
  -d '{
    "engineerId": "engineer-id",
    "role": "rotating"
  }'
```

### Unassign Engineer from Schedule (POST)

```bash
# Unassign all engineers
curl -X POST http://localhost:3004/api/schedules/schedule-id/unassign \
  -H "Content-Type: application/json" \
  -d '{"role": "all"}'

# Unassign fixed engineer only
curl -X POST http://localhost:3004/api/schedules/schedule-id/unassign \
  -H "Content-Type: application/json" \
  -d '{"role": "fixed"}'

# Unassign rotating engineer only
curl -X POST http://localhost:3004/api/schedules/schedule-id/unassign \
  -H "Content-Type: application/json" \
  -d '{"role": "rotating"}'
```

## Next Steps

After syncing data:

1. **Verify in Database**:
   ```bash
   npm run db:studio
   ```

2. **Check Sync Results**:
   - Engineers should appear in Engineer table
   - Devices should appear in Equipment table
   - Visits should appear in MaintenanceVisit table

3. **Create Schedules**:
   - Use bulk-create to generate schedules for equipment
   - Or create individual schedules via POST /api/schedules

4. **Assign Engineers**:
   - Assign fixed engineers (must have CP & RW certs)
   - Assign rotating engineers
   - Check availability before assignment

5. **Proceed to Phase 4**: Calendar & Schedule UI

