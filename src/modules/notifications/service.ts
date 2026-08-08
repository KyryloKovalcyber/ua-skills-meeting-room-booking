import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";

const TYPE = "BOOKING_END_SOON";

export async function ensureDueNotifications(userId: string, now = new Date()) {
  const threshold = new Date(now.getTime() + env.NOTIFY_BEFORE_MINUTES * 60_000);

  const candidates = await prisma.booking.findMany({
    where: {
      userId,
      cancelledAt: null,
      startAt: { lte: now },
      endAt: {
        gt: now,
        lte: threshold,
      },
    },
    include: {
      room: { select: { id: true, name: true } },
    },
  });

  for (const current of candidates) {
    const next = await prisma.booking.findFirst({
      where: {
        roomId: current.roomId,
        cancelledAt: null,
        startAt: current.endAt,
        id: { not: current.id },
      },
      select: { id: true, title: true },
    });

    if (!next) continue;

    try {
      await prisma.notification.create({
        data: {
          userId,
          currentBookingId: current.id,
          nextBookingId: next.id,
          type: TYPE,
          message: `Бронювання «${current.title}» скоро завершується. Наступний слот у кімнаті «${current.room.name}» уже зайнятий.`,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        continue;
      }
      throw error;
    }
  }
}
