# API Usage Guide

Quick reference for using the MTR Maintenance Tracking API endpoints.

## Sync Endpoints

### Test Connections (GET)

```bash
# Test engineers sync connection
curl http://localhost:3000/api/sync/engineers

# Test devices sync connection
curl http://localhost:3000/api/sync/devices

# Test visits sync connection
curl http://localhost:3000/api/sync/visits
```

### Sync Data (POST)

#### Dry Run (Test Without Saving)

```bash
# Test engineers sync (dry run)
curl -X POST http://localhost:3000/api/sync/engineers \
  -H "Content-Type: application/json" \
  -d '{"dryRun": true}'

# Test devices sync (dry run)
curl -X POST http://localhost:3000/api/sync/devices \
  -H "Content-Type: application/json" \
  -d '{"dryRun": true}'

# Test visits sync (dry run)
curl -X POST http://localhost:3000/api/sync/visits \
  -H "Content-Type: application/json" \
  -d '{"dryRun": true}'
```

#### Actual Sync

```bash
# Sync engineers from Looker
curl -X POST http://localhost:3000/api/sync/engineers \
  -H "Content-Type: application/json" \
  -d '{}'

# Sync devices from Looker
curl -X POST http://localhost:3000/api/sync/devices \
  -H "Content-Type: application/json" \
  -d '{}'

# Sync visits from Looker
curl -X POST http://localhost:3000/api/sync/visits \
  -H "Content-Type: application/json" \
  -d '{}'
```

#### Sync with Options

```bash
# Sync engineers and deactivate missing ones
curl -X POST http://localhost:3000/api/sync/engineers \
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

3. **Proceed to Phase 2**: Schedule Management API

