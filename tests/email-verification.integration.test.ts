import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { issueEmailVerificationToken, verifyEmailToken } from "@/lib/verification";

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const email = `verification-${suffix}@example.com`;
let userId = "";

afterAll(async () => {
  if (userId) await prisma.user.deleteMany({ where: { id: userId } });
});

describe("email verification", () => {
  it("stores only a hash and verifies a one-time token", async () => {
    const user = await prisma.user.create({
      data: {
        name: "Verification User",
        email,
        passwordHash: "test-only",
      },
    });
    userId = user.id;

    const issued = await issueEmailVerificationToken(user.id, user.email);
    expect(issued.token).not.toBe(issued.tokenHash);

    const stored = await prisma.emailVerificationToken.findUnique({
      where: { tokenHash: issued.tokenHash },
    });
    expect(stored).not.toBeNull();
    expect(stored?.tokenHash).not.toContain(issued.token);

    await verifyEmailToken(issued.token);

    const verified = await prisma.user.findUnique({ where: { id: user.id } });
    expect(verified?.emailVerifiedAt).toBeInstanceOf(Date);

    await expect(verifyEmailToken(issued.token)).rejects.toMatchObject({
      code: "INVALID_VERIFICATION_TOKEN",
    });
  });

  it("rejects an expired token", async () => {
    const issued = await issueEmailVerificationToken(userId, email);
    await prisma.emailVerificationToken.update({
      where: { tokenHash: issued.tokenHash },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });

    await expect(verifyEmailToken(issued.token)).rejects.toMatchObject({
      code: "INVALID_VERIFICATION_TOKEN",
    });
  });
});
