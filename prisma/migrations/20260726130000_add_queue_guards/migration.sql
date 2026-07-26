-- DB-level queue guards for live walk-in tickets.
-- Prisma cannot model PostgreSQL partial unique indexes in schema.prisma, so
-- these invariants intentionally live in SQL migrations.

CREATE UNIQUE INDEX "Appointment_one_in_service_walk_in_per_staff"
ON "Appointment"("barberShopId", "staffMemberId")
WHERE "source" = 'WALK_IN'
  AND "queueStatus" = 'IN_SERVICE'
  AND "deletedAt" IS NULL
  AND "staffMemberId" IS NOT NULL;

CREATE UNIQUE INDEX "Appointment_active_walk_in_queue_position_per_staff"
ON "Appointment"("barberShopId", "staffMemberId", "queuePosition")
WHERE "source" = 'WALK_IN'
  AND "queueStatus" IN ('WAITING', 'CALLED', 'IN_SERVICE')
  AND "deletedAt" IS NULL
  AND "staffMemberId" IS NOT NULL
  AND "queuePosition" IS NOT NULL;
