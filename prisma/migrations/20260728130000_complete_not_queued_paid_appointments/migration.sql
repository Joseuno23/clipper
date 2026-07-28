UPDATE "Appointment" AS appointment
SET
  "status" = 'COMPLETED',
  "queueStatus" = 'SERVED',
  "queuePosition" = NULL,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE
  appointment."deletedAt" IS NULL
  AND appointment."status" IN ('SCHEDULED', 'CONFIRMED', 'CHECKED_IN')
  AND appointment."queueStatus" = 'NOT_QUEUED'
  AND EXISTS (
    SELECT 1
    FROM "Sale" AS sale
    WHERE
      sale."appointmentId" = appointment."id"
      AND sale."deletedAt" IS NULL
      AND sale."status" = 'COMPLETED'
  );
