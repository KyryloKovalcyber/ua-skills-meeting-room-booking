import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { AppError, fail, ok } from "@/lib/http";

export async function DELETE(_: Request, { params }: { params: Promise<{ bookingId: string }> }) {
  try {
    const user = await requireUser();
    const { bookingId } = await params;
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });

    if (!booking || booking.cancelledAt) {
      throw new AppError("BOOKING_NOT_FOUND", "Бронювання не знайдено.", 404);
    }
    if (booking.userId !== user.id) {
      throw new AppError("FORBIDDEN", "Чуже бронювання скасувати не можна.", 403);
    }

    await prisma.$transaction([
      prisma.bookingSlot.deleteMany({ where: { bookingId } }),
      prisma.booking.update({ where: { id: bookingId }, data: { cancelledAt: new Date() } }),
    ]);

    return ok({ success: true });
  } catch (error) {
    return fail(error);
  }
}
