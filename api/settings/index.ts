import { z } from "zod";

import { getAuthContext, requireAdminCapable } from "../../src/server/api/auth";
import { createApiHandler } from "../../src/server/api/handler";
import { parseJsonBody } from "../../src/server/api/request";
import { parseWithSchema } from "../../src/server/api/validation";
import { settingsRepository } from "../../src/server/repositories/settingsRepository";

const patchSchema = z
  .object({
    shopName: z.string().trim().min(1).optional(),
    displayName: z.string().trim().min(1).optional(),
  })
  .strict()
  .refine(
    (value) => value.shopName !== undefined || value.displayName !== undefined,
    {
      message: "At least one setting must be provided.",
    },
  );

export default createApiHandler({
  methods: ["GET", "PATCH"],
  async handle(request, _response, { method }) {
    const context = await getAuthContext(request);

    if (method === "GET") {
      return settingsFromContext(context);
    }

    const input = parseWithSchema(patchSchema, parseJsonBody(request));

    if (input.shopName !== undefined) {
      requireAdminCapable(context);
      await settingsRepository.updateShopName({
        barberShopId: context.tenant.barberShopId,
        name: input.shopName,
      });
      context.tenant.name = input.shopName;
    }

    if (input.displayName !== undefined) {
      await settingsRepository.updateUserDisplayName({
        userId: context.user.id,
        displayName: input.displayName,
      });
      context.user.displayName = input.displayName;
    }

    return settingsFromContext(context);
  },
});

function settingsFromContext(
  context: Awaited<ReturnType<typeof getAuthContext>>,
) {
  return {
    shop: {
      name: context.tenant.name ?? "",
      slug: context.tenant.slug,
    },
    user: {
      displayName: context.user.displayName,
      email: context.user.email,
    },
  };
}
