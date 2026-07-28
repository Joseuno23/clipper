ALTER TABLE "Sale" ADD COLUMN "businessDate" TIMESTAMP(3);

UPDATE "Sale" AS sale
SET "businessDate" = (
  SELECT
    ((COALESCE(appointment."startAt", sale."createdAt") AT TIME ZONE 'UTC') AT TIME ZONE shop."timezone")::date::timestamp
    + INTERVAL '12 hours'
  FROM "BarberShop" AS shop
  LEFT JOIN "Appointment" AS appointment ON appointment."id" = sale."appointmentId"
  WHERE shop."id" = sale."barberShopId"
);

ALTER TABLE "Sale" ALTER COLUMN "businessDate" SET NOT NULL;

CREATE INDEX "Sale_barberShopId_businessDate_idx" ON "Sale"("barberShopId", "businessDate");
