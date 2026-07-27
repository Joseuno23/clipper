-- Prevent a client from having more than one active walk-in ticket per barber shop.
-- Prisma cannot model PostgreSQL partial unique indexes in schema.prisma, so
-- this invariant intentionally lives in SQL migrations.

CREATE UNIQUE INDEX "Appointment_active_walk_in_per_client"
ON "Appointment"("barberShopId", "clientId")
WHERE "source" = 'WALK_IN'
  AND "queueStatus" IN ('WAITING', 'CALLED', 'IN_SERVICE')
  AND "deletedAt" IS NULL
  AND "clientId" IS NOT NULL;
