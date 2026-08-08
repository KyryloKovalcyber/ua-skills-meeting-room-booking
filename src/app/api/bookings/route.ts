import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { AppError, fail, ok } from "@/lib/http";
import { createBookingSchema } from "@/modules/bookings/schemas";
import {
  bookingSlotStarts,
  buildWeeklyOccurrences,
  validateBookingTimes,
} from "@/modules/bookings/rules";

export async function POST(req: Request) {
  try {
    const user = await requireUser();

    if (!user.emailVerifiedAt) {
      throw new AppError(
        "EMAIL_NOT_VERIFIED",
        "Підтвердіть email перед створенням бронювання.",
        403,
      );
    }

    const data = createBookingSchema.parse(await req.json());
    const occurrences = buildWeeklyOccurrences(
      new Date(data.startAt),
      new Date(data.endAt),
      data.recurrenceCount,
    );

    for (const occurrence of occurrences) {
      validateBookingTimes(occurrence.startAt, occurrence.endAt);
    }

    const room = await prisma.room.findUnique({
      where: { id: data.roomId },
      select: { id: true },
    });
    if (!room) throw new AppError("ROOM_NOT_FOUND", "Кімнату не знайдено.", 404);

    const conflict = await prisma.booking.findFirst({
      where: {
        roomId: data.roomId,
        cancelledAt: null,
        OR: occurrences.map(({ startAt, endAt }) => ({
          startAt: { lt: endAt },
          endAt: { gt: startAt },
        })),
      },
      select: { id: true },
    });

    if (conflict) {
      throw new AppError(
        "BOOKING_CONFLICT",
        data.recurrenceCount > 1
          ? "Один із повторів серії конфліктує з наявним бронюванням."
          : "Цей часовий слот уже зайнятий.",
        409,
      );
    }

    const seriesId = data.recurrenceCount > 1 ? crypto.randomUUID() : null;

    try {
      if (occurrences.length === 1) {
        const occurrence = occurrences[0];
        const booking = await prisma.booking.create({
          data: {
            title: data.title,
            roomId: data.roomId,
            userId: user.id,
            startAt: occurrence.startAt,
            endAt: occurrence.endAt,
            slotClaims: {
              create: bookingSlotStarts(occurrence.startAt, occurrence.endAt).map((slotStart) => ({
                roomId: data.roomId,
                startAt: slotStart,
              })),
            },
          },
          include: {
            user: { select: { id: true, name: true } },
          },
        });

        return ok({ booking, bookings: [booking], recurrenceCount: 1, seriesId: null }, 201);
      }

      const bookings = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const created = [];

        for (const occurrence of occurrences) {
          const booking = await tx.booking.create({
            data: {
              title: data.title,
              roomId: data.roomId,
              userId: user.id,
              startAt: occurrence.startAt,
              endAt: occurrence.endAt,
              seriesId,
              slotClaims: {
                create: bookingSlotStarts(occurrence.startAt, occurrence.endAt).map((slotStart) => ({
                  roomId: data.roomId,
                  startAt: slotStart,
                })),
              },
            },
            include: {
              user: { select: { id: true, name: true } },
            },
          });

          created.push(booking);
        }

        return created;
      });

      return ok(
        {
          booking: bookings[0],
          bookings,
          recurrenceCount: bookings.length,
          seriesId,
        },
        201,
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === "P2002" || error.code === "P2034" || error.code === "P1008")
      ) {
        throw new AppError(
          "BOOKING_CONFLICT",
          "Цей часовий слот щойно зайняв інший користувач.",
          409,
        );
      }
      throw error;
    }
  } catch (error) {
    return fail(error);
  }
}
