# Performance Optimization Plan

## Identified Issues

### 1. Database Query Optimization
- **Issue**: `/api/admin/work-orders` fetches ALL schedules without pagination
- **Impact**: Large payload size, slow response times
- **Solution**: Add pagination and limit default results

### 2. Missing Database Indexes
- **Issue**: Missing index on `status` field (frequently queried)
- **Impact**: Slow queries when filtering by status
- **Solution**: Add composite indexes for common query patterns

### 3. React Component Optimization
- **Issue**: Some components may re-render unnecessarily
- **Impact**: Slower UI interactions
- **Solution**: Add React.memo, useMemo, useCallback where appropriate

### 4. API Response Size
- **Issue**: Large includes in API responses
- **Impact**: Slow network transfer, high memory usage
- **Solution**: Optimize select statements, add pagination

## Optimization Tasks

### Phase 2.1: Database Indexes ✅
- Add index on `status` field
- Add composite index on `[status, r1PlannedDate]`
- Add index on `workOrderNumber` (already unique, but ensure index exists)

### Phase 2.2: API Pagination
- Add pagination to `/api/admin/work-orders`
- Add pagination to `/api/schedules` (if needed)
- Limit default page size

### Phase 2.3: React Memoization
- Memoize expensive computations
- Add React.memo to pure components
- Use useCallback for event handlers

### Phase 2.4: Query Optimization
- Review and optimize select statements
- Reduce unnecessary includes
- Add query result caching where appropriate

