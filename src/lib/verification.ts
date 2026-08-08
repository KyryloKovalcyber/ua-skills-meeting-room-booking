import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";

const hash = (value: string) => crypto.createHash("sha256").update(value).digest("hex");

export async function issueEmailVerificationToken(userId: string, email: string) {
  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hash(token);
  const expiresAt = new Date(Date.now() + env.EMAIL_VERIFICATION_TTL_MINUTES * 60_000);

  await prisma.$transaction([
    prisma.emailVerificationToken.deleteMany({
      where: { userId, usedAt: null },
    }),
    prisma.emailVerificationToken.create({
      data: { userId, tokenHash, expiresAt },
    }),
  ]);

  const link = new URL("/api/auth/verify", env.APP_URL);
  link.searchParams.set("token", token);

  if (process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "test") {
    console.info(`[email-verification] ${email}: ${link.toString()}`);
  }

  return { token, tokenHash, expiresAt, link: link.toString() };
}

export async function verifyEmailToken(token: string, now = new Date()) {
  if (!token) {
    throw new AppError(
      "INVALID_VERIFICATION_TOKEN",
      "Посилання підтвердження недійсне або прострочене.",
      400,
    );
  }

  const record = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash: hash(token) },
  });

  if (!record || record.usedAt || record.expiresAt <= now) {
    throw new AppError(
      "INVALID_VERIFICATION_TOKEN",
      "Посилання підтвердження недійсне або прострочене.",
      400,
    );
  }

  const verifiedAt = now;

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { emailVerifiedAt: verifiedAt },
    }),
    prisma.emailVerificationToken.update({
      where: { id: record.id },
      data: { usedAt: verifiedAt },
    }),
  ]);

  return record.userId;
}
