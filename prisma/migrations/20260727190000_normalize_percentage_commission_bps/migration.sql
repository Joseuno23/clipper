-- Normalize percentage commissions accidentally entered as human percentages.
-- PERCENTAGE_BPS stores basis points, so values like 30 mean 30 bps (0.30%).
-- Existing UI accepted/displayed human percent values, therefore 30 must become 3000 bps.
UPDATE "StaffServiceCommission"
SET "commissionValue" = "commissionValue" * 100,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "commissionMode" = 'PERCENTAGE_BPS'
  AND "commissionValue" > 0
  AND "commissionValue" <= 100;

UPDATE "StaffMember"
SET "commissionValue" = "commissionValue" * 100,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "commissionMode" = 'PERCENTAGE_BPS'
  AND "commissionValue" > 0
  AND "commissionValue" <= 100;
