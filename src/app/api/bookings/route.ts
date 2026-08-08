import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { AppError, fail, ok } from "@/lib/http";
import { createBookingSchema } from "@/modules/bookings/schemas";
import { bookingSlotStarts, validateBookingTimes } from "@/modules/bookings/rules";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const data = createBookingSchema.parse(await req.json());
    const startAt = new Date(data.startAt);
    const endAt = new Date(data.endAt);

    validateBookingTimes(startAt, endAt);

    const room = await prisma.room.findUnique({ where: { id: data.roomId }, select: { id: true } });
    if (!room) throw new AppError("ROOM_NOT_FOUND", "Кімнату не знайдено.", 404);

    const conflict = await prisma.booking.findFirst({
      where: {
        roomId: data.roomId,
        cancelledAt: null,
        startAt: { lt: endAt },
        endAt: { gt: startAt },
      },
      select: { id: true },
    });
    if (conflict) throw new AppError("BOOKING_CONFLICT", "Цей часовий слот уже зайнятий.", 409);

    try {
      const booking = await prisma.booking.create({
        data: {
          title: data.title,
          roomId: data.roomId,
          userId: user.id,
          startAt,
          endAt,
          slotClaims: {
            create: bookingSlotStarts(startAt, endAt).map((slotStart) => ({
              roomId: data.roomId,
              startAt: slotStart,
            })),
          },
        },
        include: { user: { select: { id: true, name: true } } },
      });

      return ok({ booking }, 201);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new AppError("BOOKING_CONFLICT", "Цей часовий слот щойно зайняв інший користувач.", 409);
      }
      throw error;
    }
  } catch (error) {
    return fail(error);
  }
}
