-- CreateTable
CREATE TABLE "StaffServiceCommission" (
    "id" TEXT NOT NULL,
    "staffMemberId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "barberShopId" TEXT NOT NULL,
    "commissionMode" "CommissionMode" NOT NULL DEFAULT 'NONE',
    "commissionValue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffServiceCommission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffServiceCommission_staffMemberId_serviceId_key" ON "StaffServiceCommission"("staffMemberId", "serviceId");

-- CreateIndex
CREATE INDEX "StaffServiceCommission_barberShopId_serviceId_idx" ON "StaffServiceCommission"("barberShopId", "serviceId");

-- CreateIndex
CREATE INDEX "StaffServiceCommission_serviceId_idx" ON "StaffServiceCommission"("serviceId");

-- AddForeignKey
ALTER TABLE "StaffServiceCommission" ADD CONSTRAINT "StaffServiceCommission_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffServiceCommission" ADD CONSTRAINT "StaffServiceCommission_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
