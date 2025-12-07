-- AddColumn: completionDate to Schedule table
ALTER TABLE "Schedule" ADD COLUMN "completionDate" TIMESTAMP(3);

-- CreateIndex: Add index for analytics queries
CREATE INDEX "Schedule_status_completionDate_idx" ON "Schedule"("status", "completionDate");

-- Backfill completionDate for existing COMPLETED items
-- Set completionDate = r1PlannedDate (or updatedAt if r1PlannedDate is null)
UPDATE "Schedule"
SET "completionDate" = COALESCE("r1PlannedDate", "updatedAt")
WHERE "status" = 'COMPLETED' AND "completionDate" IS NULL;


