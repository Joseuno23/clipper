-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INVITED', 'SUSPENDED', 'DISABLED');

-- CreateEnum
CREATE TYPE "BarberShopMemberRole" AS ENUM ('OWNER', 'ADMIN', 'MANAGER', 'STAFF');

-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('BARBER', 'STYLIST', 'COLORIST', 'ASSISTANT', 'MANAGER');

-- CreateEnum
CREATE TYPE "CommissionMode" AS ENUM ('NONE', 'PERCENTAGE_BPS', 'FIXED_AMOUNT');

-- CreateEnum
CREATE TYPE "InventoryMovementType" AS ENUM ('INITIAL', 'PURCHASE', 'SALE', 'ADJUSTMENT', 'RETURN', 'LOSS');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED', 'CONFIRMED', 'CHECKED_IN', 'IN_SERVICE', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "AppointmentSource" AS ENUM ('WALK_IN', 'PHONE', 'ONLINE', 'STAFF');

-- CreateEnum
CREATE TYPE "QueueStatus" AS ENUM ('NOT_QUEUED', 'WAITING', 'CALLED', 'IN_SERVICE', 'SERVED', 'LEFT');

-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('DRAFT', 'COMPLETED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "SaleItemKind" AS ENUM ('SERVICE', 'PRODUCT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'TRANSFER', 'WALLET', 'OTHER');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'CANCEL', 'COMPLETE', 'ADJUST');

-- CreateTable
CREATE TABLE "BarberShop" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "appointmentChangeLimitSeconds" INTEGER NOT NULL DEFAULT 86400,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "BarberShop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'INVITED',
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BarberShopMember" (
    "id" TEXT NOT NULL,
    "barberShopId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "BarberShopMemberRole" NOT NULL DEFAULT 'STAFF',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BarberShopMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "barberShopId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "normalizedEmail" TEXT,
    "phone" TEXT,
    "normalizedPhone" TEXT,
    "documentNumber" TEXT,
    "normalizedDocument" TEXT,
    "notes" TEXT,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffMember" (
    "id" TEXT NOT NULL,
    "barberShopId" TEXT NOT NULL,
    "userId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "email" TEXT,
    "normalizedEmail" TEXT,
    "phone" TEXT,
    "normalizedPhone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "commissionMode" "CommissionMode" NOT NULL DEFAULT 'NONE',
    "commissionValue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "workingDays" INTEGER[],
    "restDays" TIMESTAMP(3)[],
    "specialties" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "StaffMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffMemberRole" (
    "id" TEXT NOT NULL,
    "staffMemberId" TEXT NOT NULL,
    "barberShopId" TEXT NOT NULL,
    "role" "StaffRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffMemberRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "barberShopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "durationMinutes" INTEGER NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceAllowedRole" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "barberShopId" TEXT NOT NULL,
    "role" "StaffRole" NOT NULL,
    "staffMemberId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceAllowedRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "barberShopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "barcode" TEXT,
    "description" TEXT,
    "price" DECIMAL(12,2) NOT NULL,
    "cost" DECIMAL(12,2),
    "currentStock" INTEGER NOT NULL DEFAULT 0,
    "lowStockAt" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryMovement" (
    "id" TEXT NOT NULL,
    "barberShopId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "saleItemId" TEXT,
    "type" "InventoryMovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" TEXT,
    "note" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "barberShopId" TEXT NOT NULL,
    "clientId" TEXT,
    "staffMemberId" TEXT,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "source" "AppointmentSource" NOT NULL DEFAULT 'STAFF',
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "checkedInAt" TIMESTAMP(3),
    "queuedAt" TIMESTAMP(3),
    "queuePosition" INTEGER,
    "queueStatus" "QueueStatus" NOT NULL DEFAULT 'NOT_QUEUED',
    "notes" TEXT,
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentService" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "serviceId" TEXT,
    "barberShopId" TEXT NOT NULL,
    "serviceNameSnapshot" TEXT NOT NULL,
    "servicePriceSnapshot" DECIMAL(12,2) NOT NULL,
    "serviceDurationSnapshot" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppointmentService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL,
    "barberShopId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "clientId" TEXT,
    "staffMemberId" TEXT,
    "saleNumber" TEXT NOT NULL,
    "status" "SaleStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "discountTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleItem" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "barberShopId" TEXT NOT NULL,
    "kind" "SaleItemKind" NOT NULL,
    "serviceId" TEXT,
    "productId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaleItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalePayment" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "barberShopId" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reference" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalePayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "barberShopId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" "AuditAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "message" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BarberShop_slug_key" ON "BarberShop"("slug");

-- CreateIndex
CREATE INDEX "BarberShop_isActive_idx" ON "BarberShop"("isActive");

-- CreateIndex
CREATE INDEX "BarberShop_deletedAt_idx" ON "BarberShop"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");

-- CreateIndex
CREATE INDEX "BarberShopMember_barberShopId_role_idx" ON "BarberShopMember"("barberShopId", "role");

-- CreateIndex
CREATE INDEX "BarberShopMember_userId_idx" ON "BarberShopMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BarberShopMember_barberShopId_userId_key" ON "BarberShopMember"("barberShopId", "userId");

-- CreateIndex
CREATE INDEX "Client_barberShopId_isBlocked_idx" ON "Client"("barberShopId", "isBlocked");

-- CreateIndex
CREATE INDEX "Client_barberShopId_deletedAt_idx" ON "Client"("barberShopId", "deletedAt");

-- CreateIndex
CREATE INDEX "Client_barberShopId_lastName_firstName_idx" ON "Client"("barberShopId", "lastName", "firstName");

-- CreateIndex
CREATE UNIQUE INDEX "Client_barberShopId_normalizedEmail_key" ON "Client"("barberShopId", "normalizedEmail");

-- CreateIndex
CREATE UNIQUE INDEX "Client_barberShopId_normalizedPhone_key" ON "Client"("barberShopId", "normalizedPhone");

-- CreateIndex
CREATE UNIQUE INDEX "Client_barberShopId_normalizedDocument_key" ON "Client"("barberShopId", "normalizedDocument");

-- CreateIndex
CREATE INDEX "StaffMember_barberShopId_isActive_idx" ON "StaffMember"("barberShopId", "isActive");

-- CreateIndex
CREATE INDEX "StaffMember_barberShopId_deletedAt_idx" ON "StaffMember"("barberShopId", "deletedAt");

-- CreateIndex
CREATE INDEX "StaffMember_userId_idx" ON "StaffMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffMember_barberShopId_userId_key" ON "StaffMember"("barberShopId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffMember_barberShopId_normalizedEmail_key" ON "StaffMember"("barberShopId", "normalizedEmail");

-- CreateIndex
CREATE UNIQUE INDEX "StaffMember_barberShopId_normalizedPhone_key" ON "StaffMember"("barberShopId", "normalizedPhone");

-- CreateIndex
CREATE INDEX "StaffMemberRole_barberShopId_role_idx" ON "StaffMemberRole"("barberShopId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "StaffMemberRole_staffMemberId_role_key" ON "StaffMemberRole"("staffMemberId", "role");

-- CreateIndex
CREATE INDEX "Service_barberShopId_isActive_idx" ON "Service"("barberShopId", "isActive");

-- CreateIndex
CREATE INDEX "Service_barberShopId_deletedAt_idx" ON "Service"("barberShopId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Service_barberShopId_name_key" ON "Service"("barberShopId", "name");

-- CreateIndex
CREATE INDEX "ServiceAllowedRole_barberShopId_role_idx" ON "ServiceAllowedRole"("barberShopId", "role");

-- CreateIndex
CREATE INDEX "ServiceAllowedRole_staffMemberId_idx" ON "ServiceAllowedRole"("staffMemberId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceAllowedRole_serviceId_role_key" ON "ServiceAllowedRole"("serviceId", "role");

-- CreateIndex
CREATE INDEX "Product_barberShopId_isActive_idx" ON "Product"("barberShopId", "isActive");

-- CreateIndex
CREATE INDEX "Product_barberShopId_deletedAt_idx" ON "Product"("barberShopId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Product_barberShopId_name_key" ON "Product"("barberShopId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Product_barberShopId_sku_key" ON "Product"("barberShopId", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "Product_barberShopId_barcode_key" ON "Product"("barberShopId", "barcode");

-- CreateIndex
CREATE INDEX "InventoryMovement_barberShopId_occurredAt_idx" ON "InventoryMovement"("barberShopId", "occurredAt");

-- CreateIndex
CREATE INDEX "InventoryMovement_barberShopId_type_idx" ON "InventoryMovement"("barberShopId", "type");

-- CreateIndex
CREATE INDEX "InventoryMovement_productId_occurredAt_idx" ON "InventoryMovement"("productId", "occurredAt");

-- CreateIndex
CREATE INDEX "InventoryMovement_saleItemId_idx" ON "InventoryMovement"("saleItemId");

-- CreateIndex
CREATE INDEX "Appointment_barberShopId_status_idx" ON "Appointment"("barberShopId", "status");

-- CreateIndex
CREATE INDEX "Appointment_barberShopId_startAt_idx" ON "Appointment"("barberShopId", "startAt");

-- CreateIndex
CREATE INDEX "Appointment_barberShopId_status_startAt_idx" ON "Appointment"("barberShopId", "status", "startAt");

-- CreateIndex
CREATE INDEX "Appointment_barberShopId_queueStatus_queuedAt_idx" ON "Appointment"("barberShopId", "queueStatus", "queuedAt");

-- CreateIndex
CREATE INDEX "Appointment_clientId_idx" ON "Appointment"("clientId");

-- CreateIndex
CREATE INDEX "Appointment_staffMemberId_startAt_idx" ON "Appointment"("staffMemberId", "startAt");

-- CreateIndex
CREATE INDEX "AppointmentService_barberShopId_appointmentId_idx" ON "AppointmentService"("barberShopId", "appointmentId");

-- CreateIndex
CREATE INDEX "AppointmentService_serviceId_idx" ON "AppointmentService"("serviceId");

-- CreateIndex
CREATE INDEX "Sale_barberShopId_status_idx" ON "Sale"("barberShopId", "status");

-- CreateIndex
CREATE INDEX "Sale_barberShopId_createdAt_idx" ON "Sale"("barberShopId", "createdAt");

-- CreateIndex
CREATE INDEX "Sale_appointmentId_idx" ON "Sale"("appointmentId");

-- CreateIndex
CREATE INDEX "Sale_clientId_idx" ON "Sale"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_barberShopId_saleNumber_key" ON "Sale"("barberShopId", "saleNumber");

-- CreateIndex
CREATE INDEX "SaleItem_barberShopId_kind_idx" ON "SaleItem"("barberShopId", "kind");

-- CreateIndex
CREATE INDEX "SaleItem_saleId_idx" ON "SaleItem"("saleId");

-- CreateIndex
CREATE INDEX "SaleItem_serviceId_idx" ON "SaleItem"("serviceId");

-- CreateIndex
CREATE INDEX "SaleItem_productId_idx" ON "SaleItem"("productId");

-- CreateIndex
CREATE INDEX "SalePayment_barberShopId_method_idx" ON "SalePayment"("barberShopId", "method");

-- CreateIndex
CREATE INDEX "SalePayment_barberShopId_paidAt_idx" ON "SalePayment"("barberShopId", "paidAt");

-- CreateIndex
CREATE INDEX "SalePayment_saleId_idx" ON "SalePayment"("saleId");

-- CreateIndex
CREATE INDEX "AuditLog_barberShopId_createdAt_idx" ON "AuditLog"("barberShopId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_barberShopId_entityType_entityId_idx" ON "AuditLog"("barberShopId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_idx" ON "AuditLog"("actorUserId");

-- AddForeignKey
ALTER TABLE "BarberShopMember" ADD CONSTRAINT "BarberShopMember_barberShopId_fkey" FOREIGN KEY ("barberShopId") REFERENCES "BarberShop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BarberShopMember" ADD CONSTRAINT "BarberShopMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_barberShopId_fkey" FOREIGN KEY ("barberShopId") REFERENCES "BarberShop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffMember" ADD CONSTRAINT "StaffMember_barberShopId_fkey" FOREIGN KEY ("barberShopId") REFERENCES "BarberShop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffMember" ADD CONSTRAINT "StaffMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffMemberRole" ADD CONSTRAINT "StaffMemberRole_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_barberShopId_fkey" FOREIGN KEY ("barberShopId") REFERENCES "BarberShop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceAllowedRole" ADD CONSTRAINT "ServiceAllowedRole_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceAllowedRole" ADD CONSTRAINT "ServiceAllowedRole_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_barberShopId_fkey" FOREIGN KEY ("barberShopId") REFERENCES "BarberShop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_barberShopId_fkey" FOREIGN KEY ("barberShopId") REFERENCES "BarberShop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_saleItemId_fkey" FOREIGN KEY ("saleItemId") REFERENCES "SaleItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_barberShopId_fkey" FOREIGN KEY ("barberShopId") REFERENCES "BarberShop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentService" ADD CONSTRAINT "AppointmentService_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentService" ADD CONSTRAINT "AppointmentService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_barberShopId_fkey" FOREIGN KEY ("barberShopId") REFERENCES "BarberShop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalePayment" ADD CONSTRAINT "SalePayment_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_barberShopId_fkey" FOREIGN KEY ("barberShopId") REFERENCES "BarberShop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
