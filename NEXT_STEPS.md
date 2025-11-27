# Next Steps - MTR Maintenance Tracking

**Last Updated:** December 2024

## 🎯 Priority 1: Critical Missing Features

### 1. **Automated Notifications** ⚠️ HIGH PRIORITY
**Status:** Functions exist but not triggered automatically

**What's Done:**
- ✅ Novu SDK integration configured
- ✅ Two notification functions implemented (`notifyTonightSchedule`, `notifyMissedCommittedDate`)
- ✅ Workflows created in Novu (`tonight-schedule`, `missed-committed-date`)
- ✅ Chinese-language templates configured

**What's Missing:**
- [ ] **Scheduled job/cron** to trigger "Tonight Schedule" notifications daily
  - Should run daily (e.g., at 6 PM HKT) to notify engineers of tonight's planned units
  - Query schedules for today's date
  - Group by assigned engineers
  - Send notification to each engineer with their units
- [ ] **Automated trigger** for "Missed Committed Date" notifications
  - Should run daily (e.g., at 7 AM HKT) to check yesterday's schedules
  - Find schedules with status `PLANNED`/`IN_PROGRESS`/`RESCHEDULED` that are now past
  - Mark as `MISSED` and send notification to assigned engineers
- [ ] **Testing** of notification delivery (email, SMS, in-app)

**Implementation Notes:**
- Can use Vercel Cron Jobs or a separate service
- Functions are in `lib/novu.ts`
- Need to create API endpoint or scheduled function to trigger them

---

### 2. **Maintenance Visit Classification** ⚠️ HIGH PRIORITY
**Status:** Schema exists but auto-classification not implemented

**What's Done:**
- ✅ `VisitClassification` enum defined (COMMITTED_DATE, ON_TIME, LATE, OVERDUE, NOT_COMPLETED)
- ✅ `classification` field exists in `MaintenanceVisit` model

**What's Missing:**
- [ ] **Auto-classification logic** when visit is created/updated
  - Compare `actualStartDate` with `r0PlannedDate` (committed date)
  - Compare with `dueDate` (R0 + 14 days)
  - Apply ±3-5 day tolerance window
  - Set classification automatically:
    - `COMMITTED_DATE`: Completed on exact committed date
    - `ON_TIME`: Completed within ±3-5 days of committed date
    - `LATE`: Completed after tolerance but before due date
    - `OVERDUE`: Completed after due date
    - `NOT_COMPLETED`: No completion date set
- [ ] **Update classification** when schedule status changes
- [ ] **Display classification** in UI (schedule cards, reports)

**Implementation Notes:**
- Add logic to `/api/schedules/[id]/validate` endpoint
- Create helper function in `lib/` for classification calculation
- Update when `MaintenanceVisit` is created/updated

---

## 🎯 Priority 2: Compliance & Reporting

### 3. **Compliance Dashboard** 📊 MEDIUM PRIORITY
**Status:** Not implemented

**What's Missing:**
- [ ] **Overdue Units Per Engineer View** (US14)
  - List engineers sorted by number of overdue units
  - Show units past their due date (`dueDate < today`)
  - Filter by zone, date range
- [ ] **Engineer Performance Metrics** (US15)
  - Calculate % of late visits over last 6 months
  - Show visit classification breakdown
  - Identify chronic reliability issues
- [ ] **Compliance Summary**
  - Total units serviced on committed date
  - Total units serviced within tolerance
  - Total overdue units
  - Compliance rate percentage

**Implementation Notes:**
- Create new page `/app/compliance/page.tsx`
- Add API endpoints for metrics calculation
- Use existing schedule/visit data

---

### 4. **Audit History Export** 📄 MEDIUM PRIORITY
**Status:** Not implemented

**What's Missing:**
- [ ] **Export functionality** (US16)
  - Export complete unit-by-unit history
  - Include: committed date, actual completion, status, classification
  - Format: CSV or PDF
  - Filter by date range, zone, engineer, status
- [ ] **Export button** in compliance dashboard
- [ ] **Scheduled exports** (optional: weekly/monthly)

**Implementation Notes:**
- Use libraries like `csv-writer` or `pdfkit`
- Create API endpoint `/api/export/audit-history`
- Add export button to compliance page

---

## 🎯 Priority 3: Enhancements & Polish

### 5. **Performance Optimization** ⚡ LOW PRIORITY
**Status:** Basic implementation done, can be optimized

**What's Missing:**
- [ ] **Query optimization**
  - Add database indexes for common queries
  - Optimize schedule fetching with proper includes
  - Cache frequently accessed data
- [ ] **Bulk operations**
  - Optimize bulk validation
  - Batch database operations
- [ ] **Loading states**
  - Add loading indicators for all async operations
  - Improve user feedback during long operations

---

### 6. **UI/UX Improvements** 🎨 LOW PRIORITY
**Status:** Functional but can be enhanced

**What's Missing:**
- [ ] **Better error handling**
  - User-friendly error messages
  - Error boundaries for React components
  - Retry mechanisms
- [ ] **Mobile responsiveness**
  - Optimize calendar view for mobile
  - Touch-friendly drag-and-drop
  - Responsive tables
- [ ] **Accessibility**
  - Keyboard navigation
  - Screen reader support
  - ARIA labels

---

## 🎯 Priority 4: Future Features (When Available)

### 7. **EAMS Integration** 🔗 FUTURE
**Status:** Waiting for EAMS API availability

**What's Missing:**
- [ ] EAMS API integration (when available)
- [ ] Automatic work order sync from EAMS
- [ ] PM form submission tracking
- [ ] Two-way sync (EAMS ↔ MTR Tool)

**Note:** According to PRD, bulk work order download may be available starting Jan 1, 2026

---

### 8. **Advanced Features** 🚀 FUTURE
**Status:** Nice-to-have enhancements

**What's Missing:**
- [ ] **Risk Detection & Early Warnings**
  - Identify units approaching due date
  - Alert supervisors of potential issues
- [ ] **Automated Rescheduling Suggestions**
  - Suggest optimal reschedule dates based on availability
  - Consider engineer workload
- [ ] **MTR Approval Workflow**
  - Formal approval process for reschedules
  - Track approval status
  - Notify MTR when reschedule requested

---

## 📋 Implementation Checklist

### Immediate (This Week)
- [ ] Set up scheduled job for "Tonight Schedule" notifications
- [ ] Set up scheduled job for "Missed Committed Date" notifications
- [ ] Implement auto-classification logic for maintenance visits
- [ ] Test notification delivery end-to-end

### Short-term (This Month)
- [ ] Build compliance dashboard page
- [ ] Implement overdue units per engineer view
- [ ] Calculate and display engineer performance metrics
- [ ] Add audit history export functionality

### Medium-term (Next Quarter)
- [ ] Performance optimization
- [ ] UI/UX improvements
- [ ] Mobile responsiveness
- [ ] Enhanced error handling

### Long-term (Future)
- [ ] EAMS integration (when API available)
- [ ] Advanced analytics
- [ ] Risk detection features
- [ ] Automated rescheduling suggestions

---

## 🔧 Technical Debt

### Code Quality
- [ ] Add unit tests for critical functions
- [ ] Add integration tests for API endpoints
- [ ] Improve error handling consistency
- [ ] Add TypeScript strict mode

### Documentation
- [ ] API documentation (OpenAPI/Swagger)
- [ ] Component documentation (Storybook)
- [ ] Deployment guide
- [ ] Troubleshooting guide

---

## 📊 Success Metrics

### To Measure:
- [ ] Notification delivery rate
- [ ] Classification accuracy
- [ ] Compliance rate (on-time vs late)
- [ ] User adoption rate
- [ ] System performance (response times)

---

## 🎯 Summary

**Critical Path:**
1. **Notifications** - Must be automated to meet PRD requirements
2. **Visit Classification** - Required for compliance tracking
3. **Compliance Reporting** - Needed for MTR transparency

**Estimated Effort:**
- **Priority 1:** 2-3 days (notifications + classification)
- **Priority 2:** 3-5 days (compliance dashboard + export)
- **Priority 3:** 5-7 days (optimization + polish)
- **Priority 4:** TBD (depends on EAMS availability)

**Current State:** Core functionality is complete. The system is functional for daily operations but needs automated notifications and compliance reporting to fully meet PRD requirements.
