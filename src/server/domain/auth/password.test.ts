// @vitest-environment node
import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "./password";

describe("password utilities", () => {
  it("hashes and verifies passwords with the seed-compatible bcryptjs package", async () => {
    const passwordHash = await hashPassword("dev-admin-password-123", 4);

    await expect(
      verifyPassword("dev-admin-password-123", passwordHash),
    ).resolves.toBe(true);
    await expect(verifyPassword("wrong-password", passwordHash)).resolves.toBe(
      false,
    );
  });
});
