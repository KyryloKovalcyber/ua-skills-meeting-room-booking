import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";
import { issueEmailVerificationToken } from "@/lib/verification";
import { AppError, fail, ok } from "@/lib/http";

const schema = z.object({
  name: z.string().trim().min(1, "Введіть ім’я.").max(80, "Максимум 80 символів."),
  email: z.string().trim().toLowerCase().email("Некоректний email."),
  password: z.string().min(8, "Мінімум 8 символів.").max(72, "Максимум 72 символи."),
});

export async function POST(req: Request) {
  try {
    const data = schema.parse(await req.json());

    try {
      const user = await prisma.user.create({
        data: {
          name: data.name,
          email: data.email,
          passwordHash: await bcrypt.hash(data.password, 12),
        },
      });

      await issueEmailVerificationToken(user.id, user.email);
      await createSession(user.id);

      return ok(
        {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            emailVerified: false,
          },
          verificationRequired: true,
        },
        201,
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new AppError(
          "EMAIL_EXISTS",
          "Користувач із таким email уже існує.",
          409,
          { email: "Цей email уже використовується." },
        );
      }
      throw error;
    }
  } catch (error) {
    return fail(error);
  }
}
