import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { AppError, fail, ok } from "@/lib/http";

export async function DELETE(req: Request, { params }: { params: Promise<{ bookingId: string }> }) {
  try {
    const user = await requireUser();
    const { bookingId } = await params;
    const requestedScope = new URL(req.url).searchParams.get("scope") === "series" ? "series" : "single";

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });

    if (!booking || booking.cancelledAt) {
      throw new AppError("BOOKING_NOT_FOUND", "Бронювання не знайдено.", 404);
    }
    if (booking.userId !== user.id) {
      throw new AppError("FORBIDDEN", "Чуже бронювання скасувати не можна.", 403);
    }

    const effectiveScope = requestedScope === "series" && booking.seriesId ? "series" : "single";
    const targets: Array<{ id: string }> = effectiveScope === "series"
      ? await prisma.booking.findMany({
          where: {
            seriesId: booking.seriesId,
            userId: user.id,
            cancelledAt: null,
            endAt: { gt: new Date() },
          },
          select: { id: true },
        })
      : [{ id: booking.id }];

    const ids = targets.map((item) => item.id);
    if (ids.length === 0) {
      throw new AppError("BOOKING_NOT_FOUND", "Активних бронювань серії не знайдено.", 404);
    }

    const cancelledAt = new Date();

    await prisma.$transaction([
      prisma.bookingSlot.deleteMany({ where: { bookingId: { in: ids } } }),
      prisma.notification.deleteMany({
        where: {
          OR: [
            { currentBookingId: { in: ids } },
            { nextBookingId: { in: ids } },
          ],
        },
      }),
      prisma.booking.updateMany({
        where: { id: { in: ids }, userId: user.id, cancelledAt: null },
        data: { cancelledAt },
      }),
    ]);

    return ok({
      success: true,
      scope: effectiveScope,
      cancelledCount: ids.length,
    });
  } catch (error) {
    return fail(error);
  }
}
