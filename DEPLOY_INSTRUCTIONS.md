# Deployment Instructions

## Current Deployment Status

**Important**: The current build command includes a one-time fix:
```json
"buildCommand": "prisma migrate resolve --rolled-back 20251130000000_status_flow_refactor && prisma migrate deploy && npm run build"
```

### After Successful Deployment

Once the current deployment succeeds, **immediately** update `vercel.json` to remove the resolve command:

```json
{
  "buildCommand": "prisma migrate deploy && npm run build",
  ...
}
```

Then commit and push:
```bash
git add vercel.json
git commit -m "chore: Remove one-time migration resolve command"
git push origin main
```

### Why This Is Important

The `prisma migrate resolve --rolled-back` command should only run ONCE. If left in place:
- It will fail on subsequent deployments (migration is no longer marked as failed)
- It adds unnecessary overhead to every build

### What to Watch For

1. **First deployment** (current): Should succeed and apply all migrations
2. **Second deployment** (after removing resolve): Should be clean and fast
3. **Monitor**: Check Vercel logs to confirm migrations apply successfully

## Migration History

- `20251130000000_status_flow_refactor` - Status flow refactor (fixed to be idempotent)
- `20251201150000_make_r1_planned_date_nullable` - Make r1PlannedDate nullable
- `20251202160000_add_nextauth_models` - Add NextAuth models
- `20251207000000_add_completion_date` - Add completion date tracking
- `20251207100000_add_analytics_indexes` - Add analytics indexes

All migrations are now safe and idempotent.

