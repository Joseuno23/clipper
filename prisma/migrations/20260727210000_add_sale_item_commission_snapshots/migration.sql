-- Snapshot the staff/service commission on completed service sale items so
-- historical liquidation reports no longer depend on mutable current config.
ALTER TABLE "SaleItem"
ADD COLUMN "commissionModeSnapshot" "CommissionMode",
ADD COLUMN "commissionValueSnapshot" DECIMAL(12,2),
ADD COLUMN "commissionTotalSnapshot" DECIMAL(12,2);

-- Best-effort historical backfill: uses the current StaffServiceCommission row.
-- Exact past commission configuration cannot be reconstructed when config changed
-- before this migration.
UPDATE "SaleItem" AS item
SET
  "commissionModeSnapshot" = COALESCE((
    SELECT config."commissionMode"
    FROM "StaffServiceCommission" AS config
    WHERE config."barberShopId" = sale."barberShopId"
      AND config."staffMemberId" = sale."staffMemberId"
      AND config."serviceId" = item."serviceId"
    LIMIT 1
  ), 'NONE'::"CommissionMode"),
  "commissionValueSnapshot" = COALESCE((
    SELECT config."commissionValue"
    FROM "StaffServiceCommission" AS config
    WHERE config."barberShopId" = sale."barberShopId"
      AND config."staffMemberId" = sale."staffMemberId"
      AND config."serviceId" = item."serviceId"
    LIMIT 1
  ), 0),
  "commissionTotalSnapshot" = CASE
    WHEN (
      SELECT config."commissionMode"
      FROM "StaffServiceCommission" AS config
      WHERE config."barberShopId" = sale."barberShopId"
        AND config."staffMemberId" = sale."staffMemberId"
        AND config."serviceId" = item."serviceId"
      LIMIT 1
    ) = 'PERCENTAGE_BPS' THEN ROUND((item."total" * COALESCE((
      SELECT config."commissionValue"
      FROM "StaffServiceCommission" AS config
      WHERE config."barberShopId" = sale."barberShopId"
        AND config."staffMemberId" = sale."staffMemberId"
        AND config."serviceId" = item."serviceId"
      LIMIT 1
    ), 0)) / 10000, 2)
    WHEN (
      SELECT config."commissionMode"
      FROM "StaffServiceCommission" AS config
      WHERE config."barberShopId" = sale."barberShopId"
        AND config."staffMemberId" = sale."staffMemberId"
        AND config."serviceId" = item."serviceId"
      LIMIT 1
    ) = 'FIXED_AMOUNT' THEN ROUND((COALESCE((
      SELECT config."commissionValue"
      FROM "StaffServiceCommission" AS config
      WHERE config."barberShopId" = sale."barberShopId"
        AND config."staffMemberId" = sale."staffMemberId"
        AND config."serviceId" = item."serviceId"
      LIMIT 1
    ), 0) * item."quantity"), 2)
    ELSE 0
  END
FROM "Sale" AS sale
WHERE item."saleId" = sale."id"
  AND sale."status" = 'COMPLETED'
  AND item."kind" = 'SERVICE'
  AND item."serviceId" IS NOT NULL
  AND sale."staffMemberId" IS NOT NULL;
