CREATE UNIQUE INDEX "Sale_one_active_linked_sale_per_appointment"
ON "Sale"("barberShopId", "appointmentId")
WHERE "appointmentId" IS NOT NULL AND "deletedAt" IS NULL;
