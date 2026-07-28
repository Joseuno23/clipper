// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../api/errors";

const prisma = vi.hoisted(() => ({
  sale: {
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findFirstOrThrow: vi.fn(),
    update: vi.fn(),
  },
  saleItem: {
    create: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
    createMany: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
  },
  salePayment: {
    create: vi.fn(),
  },
  appointment: {
    aggregate: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  service: {
    findFirst: vi.fn(),
  },
  product: {
    findFirst: vi.fn(),
  },
  staffServiceCommission: {
    findMany: vi.fn(),
  },
  $executeRawUnsafe: vi.fn(),
  $transaction: vi.fn(async (callback) => callback(prisma)),
}));

vi.mock("../db/client", () => ({ prisma }));

import { PaymentMethod } from "../../generated/prisma/enums";
import { saleRepository, syncDraftSaleServices } from "./saleRepository";

const now = new Date("2026-07-27T10:00:00.000Z");

function decimal(value: string) {
  return { toString: () => value };
}

function sale(overrides = {}) {
  return {
    id: "sale_1",
    appointmentId: null,
    clientId: null,
    staffMemberId: null,
    saleNumber: "V-1",
    status: "DRAFT",
    subtotal: decimal("0.00"),
    discountTotal: decimal("0.00"),
    taxTotal: decimal("0.00"),
    total: decimal("0.00"),
    businessDate: now,
    completedAt: null,
    cancellationReason: null,
    createdAt: now,
    updatedAt: now,
    client: null,
    staffMember: null,
    appointment: null,
    items: [],
    payments: [],
    ...overrides,
  };
}

describe("saleRepository", () => {
  beforeEach(() => {
    prisma.sale.create.mockReset().mockResolvedValue(sale());
    prisma.sale.findMany.mockReset().mockResolvedValue([sale()]);
    prisma.sale.findFirst.mockReset().mockResolvedValue(sale());
    prisma.sale.findFirstOrThrow.mockReset().mockResolvedValue(sale());
    prisma.sale.update.mockReset().mockResolvedValue(sale());
    prisma.saleItem.create.mockReset().mockResolvedValue({ id: "item_1" });
    prisma.saleItem.update.mockReset().mockResolvedValue({ id: "item_1" });
    prisma.saleItem.deleteMany.mockReset().mockResolvedValue({ count: 1 });
    prisma.saleItem.createMany.mockReset().mockResolvedValue({ count: 1 });
    prisma.saleItem.findMany.mockReset().mockResolvedValue([]);
    prisma.saleItem.updateMany.mockReset().mockResolvedValue({ count: 0 });
    prisma.salePayment.create
      .mockReset()
      .mockResolvedValue({ id: "payment_1" });
    prisma.appointment.aggregate
      .mockReset()
      .mockResolvedValue({ _max: { queuePosition: 1 } });
    prisma.appointment.findFirst.mockReset().mockResolvedValue(null);
    prisma.appointment.findMany.mockReset().mockResolvedValue([]);
    prisma.appointment.update.mockReset().mockResolvedValue({ id: "appt_1" });
    prisma.service.findFirst.mockReset().mockResolvedValue({
      id: "service_1",
      name: "Classic Cut",
      price: decimal("1500.00"),
    });
    prisma.product.findFirst.mockReset().mockResolvedValue({
      id: "product_1",
      name: "Pomade",
      price: decimal("2500.00"),
    });
    prisma.staffServiceCommission.findMany.mockReset().mockResolvedValue([]);
    prisma.$transaction
      .mockReset()
      .mockImplementation(async (callback) => callback(prisma));
    prisma.$executeRawUnsafe.mockReset().mockResolvedValue(undefined);
  });

  it("lists sales within status/day bounds using explicit limit and offset", async () => {
    await saleRepository.list({
      barberShopId: "shop_1",
      status: "cancelled",
      date: "2026-07-27",
      limit: 25,
      offset: 50,
    });

    expect(prisma.sale.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          barberShopId: "shop_1",
          status: "CANCELLED",
          businessDate: {
            gte: new Date("2026-07-27T12:00:00.000Z"),
            lt: new Date("2026-07-28T12:00:00.000Z"),
          },
        }),
        take: 25,
        skip: 50,
      }),
    );
  });

  it("supports a manual product-only sale through completion with server-computed payment amount", async () => {
    prisma.sale.findFirst.mockResolvedValueOnce(
      sale({ items: [{ id: "item_1" }] }),
    );
    prisma.saleItem.findMany.mockResolvedValueOnce([
      {
        quantity: 2,
        unitPrice: decimal("2500.00"),
        discountAmount: decimal("0.00"),
      },
    ]);
    prisma.sale.findFirstOrThrow.mockResolvedValueOnce(
      sale({ total: decimal("5000.00") }),
    );

    await saleRepository.addProductItem({
      barberShopId: "shop_1",
      saleId: "sale_1",
      productId: "product_1",
      quantity: 2,
    });

    expect(prisma.saleItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        saleId: "sale_1",
        barberShopId: "shop_1",
        kind: "PRODUCT",
        productId: "product_1",
        quantity: 2,
        unitPrice: "2500.00",
        total: "5000.00",
      }),
    });
    expect(prisma.sale.update).toHaveBeenCalledWith({
      where: { id: "sale_1" },
      data: expect.objectContaining({ subtotal: "5000.00", total: "5000.00" }),
    });

    prisma.sale.findFirst.mockResolvedValueOnce(
      sale({ items: [{ id: "item_1" }] }),
    );
    prisma.saleItem.findMany.mockResolvedValueOnce([
      {
        quantity: 2,
        unitPrice: decimal("2500.00"),
        discountAmount: decimal("0.00"),
      },
    ]);
    prisma.sale.findFirstOrThrow.mockResolvedValueOnce(
      sale({ total: decimal("5000.00") }),
    );

    await saleRepository.complete({
      barberShopId: "shop_1",
      saleId: "sale_1",
      method: PaymentMethod.TRANSFER,
      reference: null,
      paidAt: now,
    });

    expect(prisma.salePayment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        saleId: "sale_1",
        barberShopId: "shop_1",
        method: "TRANSFER",
        amount: "5000.00",
      }),
    });
    expect(prisma.sale.update).toHaveBeenLastCalledWith({
      where: { id: "sale_1" },
      data: { status: "COMPLETED", completedAt: now },
    });
    expect(prisma.appointment.findFirst).not.toHaveBeenCalled();
  });

  it("snapshots service commissions at sale completion", async () => {
    prisma.sale.findFirst.mockResolvedValueOnce(
      sale({
        staffMemberId: "staff_1",
        items: [{ id: "item_1", kind: "SERVICE", serviceId: "service_1" }],
      }),
    );
    prisma.saleItem.findMany.mockResolvedValueOnce([
      {
        quantity: 1,
        unitPrice: decimal("15000.00"),
        discountAmount: decimal("0.00"),
      },
    ]);
    prisma.sale.findFirstOrThrow
      .mockResolvedValueOnce(sale({ total: decimal("15000.00") }))
      .mockResolvedValueOnce({
        id: "sale_1",
        staffMemberId: "staff_1",
        items: [
          {
            id: "item_1",
            serviceId: "service_1",
            quantity: 1,
            total: decimal("15000.00"),
          },
        ],
      })
      .mockResolvedValueOnce(sale({ completedAt: now }));
    prisma.staffServiceCommission.findMany.mockResolvedValueOnce([
      {
        serviceId: "service_1",
        commissionMode: "PERCENTAGE_BPS",
        commissionValue: decimal("3000"),
      },
    ]);

    await saleRepository.complete({
      barberShopId: "shop_1",
      saleId: "sale_1",
      method: PaymentMethod.TRANSFER,
      reference: null,
      paidAt: now,
    });

    expect(prisma.saleItem.update).toHaveBeenCalledWith({
      where: { id: "item_1" },
      data: {
        commissionModeSnapshot: "PERCENTAGE_BPS",
        commissionValueSnapshot: "3000.00",
        commissionTotalSnapshot: "4500.00",
      },
    });
  });

  it("filters sale lists by operational business date, not creation timestamp", async () => {
    await saleRepository.list({
      barberShopId: "shop_1",
      status: "open",
      date: "2026-08-03",
      limit: 25,
      offset: 0,
    });

    expect(prisma.sale.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "DRAFT",
          businessDate: {
            gte: new Date("2026-08-03T12:00:00.000Z"),
            lt: new Date("2026-08-04T12:00:00.000Z"),
          },
        }),
      }),
    );
  });

  it("does not snapshot staff commission on product items", async () => {
    prisma.sale.findFirst.mockResolvedValueOnce(
      sale({
        staffMemberId: "staff_1",
        items: [{ id: "item_1", kind: "PRODUCT", productId: "product_1" }],
      }),
    );
    prisma.saleItem.findMany.mockResolvedValueOnce([
      {
        quantity: 2,
        unitPrice: decimal("2500.00"),
        discountAmount: decimal("0.00"),
      },
    ]);
    prisma.sale.findFirstOrThrow
      .mockResolvedValueOnce(sale({ total: decimal("5000.00") }))
      .mockResolvedValueOnce({
        id: "sale_1",
        staffMemberId: "staff_1",
        items: [],
      })
      .mockResolvedValueOnce(sale({ completedAt: now }));

    await saleRepository.complete({
      barberShopId: "shop_1",
      saleId: "sale_1",
      method: PaymentMethod.TRANSFER,
      reference: null,
      paidAt: now,
    });

    expect(prisma.saleItem.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          commissionTotalSnapshot: expect.any(String),
        }),
      }),
    );
  });

  it("completes a linked in-service queue ticket and promotes the next waiting ticket", async () => {
    prisma.sale.findFirst.mockResolvedValueOnce(
      sale({
        appointmentId: "appt_1",
        staffMemberId: "staff_1",
        items: [{ id: "item_1" }],
      }),
    );
    prisma.saleItem.findMany.mockResolvedValueOnce([
      {
        quantity: 1,
        unitPrice: decimal("20000.00"),
        discountAmount: decimal("0.00"),
      },
    ]);
    prisma.sale.findFirstOrThrow
      .mockResolvedValueOnce(sale({ total: decimal("20000.00") }))
      .mockResolvedValueOnce(sale({ appointmentId: "appt_1" }));
    prisma.appointment.findFirst.mockResolvedValueOnce({
      id: "appt_1",
      staffMemberId: "staff_1",
      queueStatus: "IN_SERVICE",
      queuePosition: 1,
    });
    prisma.appointment.findMany
      .mockResolvedValueOnce([
        { id: "appt_2", queuePosition: 2, queuedAt: now },
      ])
      .mockResolvedValueOnce([
        { id: "appt_3", queuePosition: 3, queuedAt: now },
      ]);

    await saleRepository.complete({
      barberShopId: "shop_1",
      saleId: "sale_1",
      method: PaymentMethod.TRANSFER,
      reference: null,
      paidAt: now,
    });

    expect(prisma.appointment.update).toHaveBeenCalledWith({
      where: { id: "appt_1" },
      data: {
        queueStatus: "SERVED",
        status: "COMPLETED",
        queuePosition: null,
      },
    });
    expect(prisma.appointment.update).toHaveBeenCalledWith({
      where: { id: "appt_2" },
      data: {
        queueStatus: "IN_SERVICE",
        status: "IN_SERVICE",
        queuePosition: 1,
      },
    });
    expect(prisma.appointment.update).toHaveBeenCalledWith({
      where: { id: "appt_3" },
      data: { queuePosition: 2 },
    });
  });

  it("completes a linked waiting queue ticket without promoting another ticket", async () => {
    prisma.sale.findFirst.mockResolvedValueOnce(
      sale({
        appointmentId: "appt_2",
        staffMemberId: "staff_1",
        items: [{ id: "item_1" }],
      }),
    );
    prisma.saleItem.findMany.mockResolvedValueOnce([
      {
        quantity: 1,
        unitPrice: decimal("20000.00"),
        discountAmount: decimal("0.00"),
      },
    ]);
    prisma.sale.findFirstOrThrow
      .mockResolvedValueOnce(sale({ total: decimal("20000.00") }))
      .mockResolvedValueOnce(sale({ appointmentId: "appt_2" }));
    prisma.appointment.findFirst.mockResolvedValueOnce({
      id: "appt_2",
      staffMemberId: "staff_1",
      queueStatus: "WAITING",
      queuePosition: 2,
    });
    prisma.appointment.findMany.mockResolvedValueOnce([
      { id: "appt_3", queuePosition: 3, queuedAt: now },
    ]);

    await saleRepository.complete({
      barberShopId: "shop_1",
      saleId: "sale_1",
      method: PaymentMethod.TRANSFER,
      reference: null,
      paidAt: now,
    });

    expect(prisma.appointment.update).toHaveBeenCalledWith({
      where: { id: "appt_2" },
      data: {
        queueStatus: "SERVED",
        status: "COMPLETED",
        queuePosition: null,
      },
    });
    expect(prisma.appointment.update).not.toHaveBeenCalledWith({
      where: { id: expect.any(String) },
      data: expect.objectContaining({ queueStatus: "IN_SERVICE" }),
    });
    expect(prisma.appointment.update).toHaveBeenCalledWith({
      where: { id: "appt_3" },
      data: { queuePosition: 2 },
    });
  });

  it("recalculates draft totals from persisted items after adding and removing sale items", async () => {
    prisma.saleItem.findMany.mockResolvedValueOnce([
      {
        quantity: 1,
        unitPrice: decimal("1500.00"),
        discountAmount: decimal("0.00"),
      },
      {
        quantity: 2,
        unitPrice: decimal("2500.00"),
        discountAmount: decimal("500.00"),
      },
    ]);

    await saleRepository.addServiceItem({
      barberShopId: "shop_1",
      saleId: "sale_1",
      serviceId: "service_1",
      quantity: 1,
    });

    expect(prisma.sale.update).toHaveBeenCalledWith({
      where: { id: "sale_1" },
      data: {
        subtotal: "6500.00",
        discountTotal: "500.00",
        taxTotal: "0",
        total: "6000.00",
      },
    });

    prisma.saleItem.findMany.mockResolvedValueOnce([
      {
        quantity: 1,
        unitPrice: decimal("1500.00"),
        discountAmount: decimal("0.00"),
      },
    ]);

    await saleRepository.removeItem({
      barberShopId: "shop_1",
      saleId: "sale_1",
      itemId: "item_2",
    });

    expect(prisma.saleItem.deleteMany).toHaveBeenCalledWith({
      where: { id: "item_2", saleId: "sale_1", barberShopId: "shop_1" },
    });
    expect(prisma.sale.update).toHaveBeenLastCalledWith({
      where: { id: "sale_1" },
      data: {
        subtotal: "1500.00",
        discountTotal: "0.00",
        taxTotal: "0",
        total: "1500.00",
      },
    });
  });

  it("increments an existing product line instead of creating a duplicate", async () => {
    prisma.sale.findFirst.mockResolvedValueOnce(
      sale({
        items: [
          {
            id: "item_1",
            kind: "PRODUCT",
            productId: "product_1",
            quantity: 2,
            unitPrice: decimal("2500.00"),
          },
        ],
      }),
    );
    prisma.saleItem.findMany.mockResolvedValueOnce([
      {
        quantity: 5,
        unitPrice: decimal("2500.00"),
        discountAmount: decimal("0.00"),
      },
    ]);

    await saleRepository.addProductItem({
      barberShopId: "shop_1",
      saleId: "sale_1",
      productId: "product_1",
      quantity: 3,
    });

    expect(prisma.saleItem.create).not.toHaveBeenCalled();
    expect(prisma.saleItem.update).toHaveBeenCalledWith({
      where: { id: "item_1" },
      data: { quantity: 5, total: "12500.00" },
    });
    expect(prisma.sale.update).toHaveBeenCalledWith({
      where: { id: "sale_1" },
      data: expect.objectContaining({
        subtotal: "12500.00",
        total: "12500.00",
      }),
    });
  });

  it("updates product item quantity and recalculates totals", async () => {
    prisma.sale.findFirst.mockResolvedValueOnce(
      sale({
        items: [
          {
            id: "item_1",
            kind: "PRODUCT",
            productId: "product_1",
            quantity: 2,
            unitPrice: decimal("2500.00"),
          },
        ],
      }),
    );
    prisma.saleItem.findMany.mockResolvedValueOnce([
      {
        quantity: 4,
        unitPrice: decimal("2500.00"),
        discountAmount: decimal("0.00"),
      },
    ]);

    await saleRepository.updateItemQuantity({
      barberShopId: "shop_1",
      saleId: "sale_1",
      itemId: "item_1",
      quantity: 4,
    });

    expect(prisma.saleItem.update).toHaveBeenCalledWith({
      where: { id: "item_1" },
      data: { quantity: 4, total: "10000.00" },
    });
    expect(prisma.sale.update).toHaveBeenCalledWith({
      where: { id: "sale_1" },
      data: expect.objectContaining({
        subtotal: "10000.00",
        total: "10000.00",
      }),
    });
  });

  it("rejects service item quantities other than one before persistence", async () => {
    await expect(
      saleRepository.addServiceItem({
        barberShopId: "shop_1",
        saleId: "sale_1",
        serviceId: "service_1",
        quantity: 5,
      }),
    ).rejects.toThrow(
      new ApiError({
        code: "BAD_REQUEST",
        message: "Service sale items must have quantity 1.",
      }),
    );

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.saleItem.create).not.toHaveBeenCalled();
  });

  it("rejects quantity updates for service sale items", async () => {
    prisma.sale.findFirst.mockResolvedValueOnce(
      sale({
        items: [
          {
            id: "item_1",
            kind: "SERVICE",
            serviceId: "service_1",
            quantity: 1,
            unitPrice: decimal("1500.00"),
          },
        ],
      }),
    );

    await expect(
      saleRepository.updateItemQuantity({
        barberShopId: "shop_1",
        saleId: "sale_1",
        itemId: "item_1",
        quantity: 2,
      }),
    ).rejects.toThrow(
      new ApiError({
        code: "BAD_REQUEST",
        message: "Only product item quantities can be edited.",
      }),
    );

    expect(prisma.saleItem.update).not.toHaveBeenCalled();
  });

  it("rejects edits to completed sales", async () => {
    prisma.sale.findFirst.mockResolvedValueOnce(sale({ status: "COMPLETED" }));

    await expect(
      saleRepository.removeItem({
        barberShopId: "shop_1",
        saleId: "sale_1",
        itemId: "item_1",
      }),
    ).rejects.toThrow(
      new ApiError({
        code: "BAD_REQUEST",
        message: "Only draft sales can be edited.",
      }),
    );

    expect(prisma.saleItem.deleteMany).not.toHaveBeenCalled();

    prisma.sale.findFirst.mockResolvedValueOnce(sale({ status: "COMPLETED" }));

    await expect(
      saleRepository.updateItemQuantity({
        barberShopId: "shop_1",
        saleId: "sale_1",
        itemId: "item_1",
        quantity: 2,
      }),
    ).rejects.toThrow(
      new ApiError({
        code: "BAD_REQUEST",
        message: "Only draft sales can be edited.",
      }),
    );

    expect(prisma.saleItem.update).not.toHaveBeenCalled();
  });

  it("cancels a linked in-service queue ticket and promotes the next waiting ticket", async () => {
    prisma.sale.findFirst.mockResolvedValueOnce(
      sale({
        appointmentId: "appt_1",
        status: "DRAFT",
      }),
    );
    prisma.appointment.findFirst.mockResolvedValueOnce({
      id: "appt_1",
      staffMemberId: "staff_1",
      queueStatus: "IN_SERVICE",
      queuePosition: 1,
    });
    prisma.appointment.findMany
      .mockResolvedValueOnce([
        { id: "appt_2", queuePosition: 2, queuedAt: now },
      ])
      .mockResolvedValueOnce([
        { id: "appt_3", queuePosition: 3, queuedAt: now },
      ]);

    await saleRepository.cancel({
      barberShopId: "shop_1",
      saleId: "sale_1",
      reason: "Cliente canceló",
    });

    expect(prisma.sale.update).toHaveBeenCalledWith({
      where: { id: "sale_1" },
      data: { status: "CANCELLED", cancellationReason: "Cliente canceló" },
    });
    expect(prisma.appointment.update).toHaveBeenCalledWith({
      where: { id: "appt_1" },
      data: {
        queueStatus: "LEFT",
        status: "CANCELLED",
        queuePosition: null,
        cancellationReason: "Cliente canceló",
      },
    });
    expect(prisma.appointment.update).toHaveBeenCalledWith({
      where: { id: "appt_2" },
      data: {
        queueStatus: "IN_SERVICE",
        status: "IN_SERVICE",
        queuePosition: 1,
      },
    });
    expect(prisma.appointment.update).toHaveBeenCalledWith({
      where: { id: "appt_3" },
      data: { queuePosition: 2 },
    });
  });

  it("cancels a linked waiting queue ticket and renumbers waiting positions", async () => {
    prisma.sale.findFirst.mockResolvedValueOnce(
      sale({ appointmentId: "appt_2", status: "DRAFT" }),
    );
    prisma.appointment.findFirst.mockResolvedValueOnce({
      id: "appt_2",
      staffMemberId: "staff_1",
      queueStatus: "WAITING",
      queuePosition: 2,
    });
    prisma.appointment.findMany.mockResolvedValueOnce([
      { id: "appt_3", queuePosition: 3, queuedAt: now },
    ]);

    await saleRepository.cancel({
      barberShopId: "shop_1",
      saleId: "sale_1",
      reason: "No puede esperar",
    });

    expect(prisma.appointment.update).toHaveBeenCalledWith({
      where: { id: "appt_2" },
      data: {
        queueStatus: "LEFT",
        status: "CANCELLED",
        queuePosition: null,
        cancellationReason: "No puede esperar",
      },
    });
    expect(prisma.appointment.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ queueStatus: "IN_SERVICE" }),
      }),
    );
    expect(prisma.appointment.update).toHaveBeenCalledWith({
      where: { id: "appt_3" },
      data: { queuePosition: 2 },
    });
  });

  it("rejects cancelling completed sales", async () => {
    prisma.sale.findFirst.mockResolvedValueOnce(sale({ status: "COMPLETED" }));

    await expect(
      saleRepository.cancel({
        barberShopId: "shop_1",
        saleId: "sale_1",
        reason: "Error operativo",
      }),
    ).rejects.toThrow(
      new ApiError({
        code: "BAD_REQUEST",
        message: "Completed sales cannot be cancelled.",
      }),
    );

    expect(prisma.sale.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "CANCELLED" }),
      }),
    );
  });
});

describe("syncDraftSaleServices", () => {
  beforeEach(() => {
    prisma.sale.findFirst.mockReset();
    prisma.saleItem.deleteMany.mockReset().mockResolvedValue({ count: 0 });
    prisma.saleItem.createMany.mockReset().mockResolvedValue({ count: 0 });
    prisma.saleItem.findMany.mockReset().mockResolvedValue([]);
    prisma.sale.update.mockReset().mockResolvedValue(sale());
  });

  it("does not mutate sale services when the linked appointment sale is completed", async () => {
    prisma.sale.findFirst.mockResolvedValueOnce(null);

    const transaction = prisma as unknown as Parameters<
      typeof syncDraftSaleServices
    >[0];

    await syncDraftSaleServices(transaction, {
      barberShopId: "shop_1",
      appointmentId: "appt_1",
      services: [
        { id: "service_2", name: "Beard Trim", price: decimal("900.00") },
      ],
    });

    expect(prisma.sale.findFirst).toHaveBeenCalledWith({
      where: {
        barberShopId: "shop_1",
        appointmentId: "appt_1",
        deletedAt: null,
        status: "DRAFT",
      },
      select: { id: true },
    });
    expect(prisma.saleItem.deleteMany).not.toHaveBeenCalled();
    expect(prisma.saleItem.createMany).not.toHaveBeenCalled();
    expect(prisma.sale.update).not.toHaveBeenCalled();
  });
});
