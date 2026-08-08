import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppError, fail, ok } from "@/lib/http";

export async function PATCH(
  _: Request,
  { params }: { params: Promise<{ notificationId: string }> },
) {
  try {
    const user = await requireUser();
    const { notificationId } = await params;

    const result = await prisma.notification.updateMany({
      where: { id: notificationId, userId: user.id },
      data: { readAt: new Date() },
    });

    if (result.count === 0) {
      throw new AppError("NOTIFICATION_NOT_FOUND", "Сповіщення не знайдено.", 404);
    }

    return ok({ success: true });
  } catch (error) {
    return fail(error);
  }
}
