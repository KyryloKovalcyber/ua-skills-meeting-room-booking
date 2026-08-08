import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";
import { AppError, fail, ok } from "@/lib/http";

const schema = z.object({
  email: z.string().trim().toLowerCase().email("Некоректний email."),
  password: z.string().min(1, "Введіть пароль.").max(72, "Максимум 72 символи."),
});

export async function POST(req: Request) {
  try {
    const data = schema.parse(await req.json());
    const user = await prisma.user.findUnique({ where: { email: data.email } });

    if (!user || !(await bcrypt.compare(data.password, user.passwordHash))) {
      throw new AppError("INVALID_CREDENTIALS", "Неправильний email або пароль.", 401);
    }

    await createSession(user.id);
    return ok({ user: { id: user.id, name: user.name, email: user.email, emailVerified: Boolean(user.emailVerifiedAt) } });
  } catch (error) {
    return fail(error);
  }
}
