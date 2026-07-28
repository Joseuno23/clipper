import { z } from "zod";

import { ApiError } from "../../src/server/api/errors";
import { getAuthContext } from "../../src/server/api/auth";
import { createApiHandler } from "../../src/server/api/handler";
import { parseJsonBody } from "../../src/server/api/request";
import { parseWithSchema } from "../../src/server/api/validation";
import {
  hashPassword,
  verifyPassword,
} from "../../src/server/domain/auth/password";
import { settingsRepository } from "../../src/server/repositories/settingsRepository";

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(12),
  })
  .strict();

export default createApiHandler({
  methods: ["PATCH"],
  async handle(request) {
    const context = await getAuthContext(request);
    const input = parseWithSchema(passwordSchema, parseJsonBody(request));
    const currentHash = await settingsRepository.findUserPasswordHash(
      context.user.id,
    );

    if (!currentHash) {
      throw new ApiError({
        code: "UNAUTHENTICATED",
        message: "Authentication is no longer valid.",
      });
    }

    const currentMatches = await verifyPassword(
      input.currentPassword,
      currentHash,
    );

    if (!currentMatches) {
      throw new ApiError({
        code: "BAD_REQUEST",
        message: "Current password is incorrect.",
      });
    }

    await settingsRepository.updateUserPassword({
      userId: context.user.id,
      passwordHash: await hashPassword(input.newPassword),
    });

    return { updated: true };
  },
});
