import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/http";
import { ensureDueNotifications } from "@/modules/notifications/service";

export async function GET() {
  try {
    const user = await requireUser();
    await ensureDueNotifications(user.id);

    const notifications = await prisma.notification.findMany({
      where: { userId: user.id, readAt: null },
      orderBy: { createdAt: "asc" },
      take: 20,
    });

    return ok({ notifications });
  } catch (error) {
    return fail(error);
  }
}
