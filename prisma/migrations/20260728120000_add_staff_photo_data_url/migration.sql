-- Add optional constrained local staff photo storage. Binary/blob storage is intentionally out of scope for this slice.
ALTER TABLE "StaffMember"
  ADD COLUMN "photoDataUrl" TEXT
  CHECK (
    "photoDataUrl" IS NULL
    OR (
      char_length("photoDataUrl") <= 524288
      AND "photoDataUrl" ~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$'
    )
  );
