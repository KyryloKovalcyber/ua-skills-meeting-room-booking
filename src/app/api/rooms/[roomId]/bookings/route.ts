import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppError, fail, ok } from "@/lib/http";

export async function GET(req: Request, { params }: { params: Promise<{ roomId: string }> }) {
  try {
    await requireUser();
    const { roomId } = await params;
    const query = new URL(req.url).searchParams;
    const from = new Date(query.get("from") ?? "");
    const to = new Date(query.get("to") ?? "");

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) {
      throw new AppError("INVALID_RANGE", "Некоректний діапазон розкладу.", 422);
    }
    if (to.getTime() - from.getTime() > 15 * 86_400_000) {
      throw new AppError("INVALID_RANGE", "Запитаний діапазон надто великий.", 422);
    }

    const room = await prisma.room.findUnique({ where: { id: roomId }, select: { id: true } });
    if (!room) throw new AppError("ROOM_NOT_FOUND", "Кімнату не знайдено.", 404);

    const bookings = await prisma.booking.findMany({
      where: {
        roomId,
        cancelledAt: null,
        startAt: { lt: to },
        endAt: { gt: from },
      },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { startAt: "asc" },
    });

    return ok({ bookings });
  } catch (error) {
    return fail(error);
  }
}
