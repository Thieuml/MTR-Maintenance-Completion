# Looker Look IDs Reference

This document describes all Looker Look IDs used in the MTR Maintenance Tracking system and their purposes.

## Required Looks (Currently Configured)

### Engineers Look
- **Look ID**: `160` (configurable via `LOOKER_ENGINEERS_LOOK_ID`)
- **Purpose**: Sync active engineers from Looker (filtered on HK)
- **Used For**: 
  - Engineer assignment to schedules
  - Sending notifications
  - Compliance tracking per engineer
- **Sync Frequency**: Daily (automatic)
- **Expected Fields**:
  - `engineer_name` or `name` - Engineer's full name
  - `country_code` or `country` - Country code (HK)
  - `active` - Boolean indicating if engineer is active
  - `sectors` or `sector_ids` - Array of sector IDs (optional)
- **API Function**: `fetchEngineersFromLooker()`

### MTR Devices Look
- **Look ID**: `167` (configurable via `LOOKER_DEVICES_LOOK_ID`)
- **Purpose**: Get list of all MTR lifts and escalators
- **Used For**: 
  - Equipment master data
  - Schedule creation
  - Zone assignment
  - Equipment filtering
- **Sync Frequency**: Initial sync + periodic updates (when new equipment added)
- **Expected Fields**:
  - `device_id` - Device ID from Looker
  - `equipment_number` - Equipment number (e.g., "HOK-E25")
  - `building_id` - Building ID
  - `building_name` - Building name
  - `full_address` - Full address
  - `device_location` - Device location
  - `device_type` - Equipment type (ELEVATOR, ESCALATOR)
- **API Function**: `fetchMTRDevicesFromLooker()`

### Maintenance Visits Look (Recent)
- **Look ID**: `168` (configurable via `LOOKER_VISITS_LOOK_ID`)
- **Purpose**: Get maintenance visits from last 3 months
- **Used For**: 
  - Initial data import
  - Completion tracking
  - Compliance analysis
  - Auto-classifying maintenance results
- **Sync Frequency**: Daily (to track new completions)
- **Expected Fields**:
  - `device_id` - Device ID
  - `completed_date` - When maintenance was completed
  - `done_by_engineer` - Engineer who performed the work
  - `task_type` - Task type (REGULAR)
  - `end_status` - Completion status
  - `global_comment` - Comments/notes
  - `pdf_report` - PM form PDF reference
- **API Function**: `fetchMaintenanceVisitsFromLooker()`

## Additional Looks (To Be Configured)

### Historical Maintenance Visits Look
- **Look ID**: `LOOKER_VISITS_HISTORICAL_LOOK_ID` (to be determined)
- **Purpose**: Get historical maintenance visits for compliance reporting (6+ months)
- **Used For**: 
  - **US15**: Engineer late visit percentage over 6 months
  - **US16**: Full audit history export
  - Compliance trend analysis
  - Behavior insights per engineer
- **Sync Frequency**: On-demand (for reporting)
- **Expected Fields**:
  - `device_id` - Device ID
  - `completed_date` - When maintenance was completed
  - `done_by_engineer` - Engineer who performed the work
  - `task_type` - Task type
  - `end_status` - Completion status
  - `planned_date` - Originally planned date
  - `deviation_days` - Days deviation from planned date
- **Note**: May use same Look as 168 with extended date range filter applied programmatically
- **API Function**: `fetchHistoricalMaintenanceVisitsFromLooker()`

### Work Orders (OR Numbers) Look
- **Look ID**: `LOOKER_WORK_ORDERS_LOOK_ID` (to be determined)
- **Purpose**: Bulk import of work order numbers (OR numbers) from EAMS system
- **Used For**: 
  - Pre-populating schedules with OR numbers for the year
  - Validating OR numbers before maintenance visits
  - Linking schedules to EAMS work orders
- **Sync Frequency**: Monthly or yearly bulk import (as mentioned: may download for entire year starting 1-Jan-26)
- **Expected Fields**:
  - `work_order_number` - OR number (e.g., "5000355448")
  - `equipment_id` - Equipment/device ID
  - `planned_date` - Planned maintenance date
  - `due_date` - Due date (R0 + 14 days)
  - `status` - Work order status
  - `zone_code` - Zone code (MTR-01 to MTR-06)
- **Note**: Currently downloaded manually from EAMS monthly. This Look would automate the process.
- **API Function**: `fetchWorkOrdersFromLooker()`

### Engineer Certifications Look
- **Look ID**: `LOOKER_ENGINEER_CERTIFICATIONS_LOOK_ID` (to be determined)
- **Purpose**: Track engineer certifications (CP & RW certificates required for MTR sites)
- **Used For**: 
  - Validating engineer assignments (fixed engineer must have CP & RW certs)
  - Filtering available engineers for MTR zones
  - Compliance validation
- **Sync Frequency**: Periodic sync (when certifications are updated)
- **Expected Fields**:
  - `engineer_id` - Engineer ID
  - `engineer_name` - Engineer name
  - `cp_certificate` - CP certificate status/ID
  - `rw_certificate` - RW certificate status/ID
  - `certificate_expiry_date` - When certificates expire
  - `certificate_status` - Active/Expired/Pending
- **Note**: May be part of engineers Look (160) if certification data is included there
- **API Function**: `fetchEngineerCertificationsFromLooker()`

### Equipment Status Look
- **Look ID**: `LOOKER_EQUIPMENT_STATUS_LOOK_ID` (to be determined)
- **Purpose**: Get current status of equipment (active, inactive, under maintenance, etc.)
- **Used For**: 
  - Filtering active equipment for scheduling
  - Identifying equipment that shouldn't be scheduled
  - Status-based reporting
- **Sync Frequency**: Daily sync
- **Expected Fields**:
  - `device_id` - Device ID
  - `equipment_number` - Equipment number
  - `status` - Current status (ACTIVE, INACTIVE, MAINTENANCE, etc.)
  - `status_reason` - Reason for status
  - `status_updated_date` - When status was last updated
  - `maintenance_window` - Available maintenance window
- **API Function**: `fetchEquipmentStatusFromLooker()`

### Buildings/Locations Look
- **Look ID**: `LOOKER_BUILDINGS_LOOK_ID` (to be determined)
- **Purpose**: Get detailed building and location information
- **Used For**: 
  - Zone assignment
  - Location-based filtering
  - Reporting by location
  - Address validation
- **Sync Frequency**: Initial sync + periodic updates
- **Expected Fields**:
  - `building_id` - Building ID
  - `building_name` - Building name
  - `full_address` - Full address
  - `zone_code` - Zone code (MTR-01 to MTR-06)
  - `station_name` - Station name
  - `coordinates` - GPS coordinates (optional)
- **Note**: May be part of devices Look (167) if location data is included there
- **API Function**: `fetchBuildingsFromLooker()`

### Contract Information Look
- **Look ID**: `LOOKER_CONTRACT_INFO_LOOK_ID` (to be determined)
- **Purpose**: Get contract details, service windows, special requirements
- **Used For**: 
  - Validating maintenance windows (23:00-05:00)
  - Contract compliance tracking
  - Special equipment requirements
  - Service level agreement monitoring
- **Sync Frequency**: Initial sync + updates when contract changes
- **Expected Fields**:
  - `contract_id` - Contract ID
  - `account_name` - Account name (MTR Corporation Limited)
  - `service_window_start` - Service window start time (23:00)
  - `service_window_end` - Service window end time (05:00)
  - `maintenance_frequency_days` - Maintenance frequency (14 days)
  - `special_requirements` - Special requirements or notes
- **API Function**: `fetchContractInfoFromLooker()`

## Environment Variables

All Look IDs can be configured via environment variables:

```bash
# Required (currently configured)
LOOKER_ENGINEERS_LOOK_ID=160
LOOKER_DEVICES_LOOK_ID=167
LOOKER_VISITS_LOOK_ID=168

# Optional (to be configured)
LOOKER_VISITS_HISTORICAL_LOOK_ID=
LOOKER_WORK_ORDERS_LOOK_ID=
LOOKER_ENGINEER_CERTIFICATIONS_LOOK_ID=
LOOKER_EQUIPMENT_STATUS_LOOK_ID=
LOOKER_BUILDINGS_LOOK_ID=
LOOKER_CONTRACT_INFO_LOOK_ID=
```

## Usage Notes

1. **Look ID Discovery**: To find Look IDs in Looker:
   - Go to the Look in Looker dashboard
   - Check the URL: `https://your-instance.looker.com/looks/123` → Look ID is `123`
   - Or check Look settings → Look ID field

2. **Combining Looks**: Some data may be available in existing Looks:
   - Certifications might be in Engineers Look (160)
   - Building data might be in Devices Look (167)
   - Historical data can use Visits Look (168) with date filters

3. **Date Range Filters**: For historical data, you can:
   - Use the same Look with programmatic date filters
   - Create a separate Look with extended date range
   - Use query parameters to filter results

4. **Fallback Values**: All Look IDs have defaults in code:
   - Engineers: 160
   - Devices: 167
   - Visits: 168
   - Others: Will need to be configured

5. **Testing**: Test each Look ID individually:
   ```bash
   # Test connection
   curl http://localhost:3000/api/looker/test
   
   # Test specific Look
   curl http://localhost:3000/api/looker/test?lookId=160
   ```

## Implementation Status

- ✅ Engineers Look (160) - Implemented
- ✅ Devices Look (167) - Implemented
- ✅ Visits Look (168) - Implemented
- ⏳ Historical Visits Look - To be implemented
- ⏳ Work Orders Look - To be implemented
- ⏳ Certifications Look - To be implemented
- ⏳ Equipment Status Look - To be implemented
- ⏳ Buildings Look - To be implemented
- ⏳ Contract Info Look - To be implemented

