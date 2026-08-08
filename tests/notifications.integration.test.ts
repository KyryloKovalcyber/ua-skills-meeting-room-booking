import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { ensureDueNotifications } from "@/modules/notifications/service";

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
let userId = "";
let roomId = "";

beforeAll(async () => {
  const user = await prisma.user.create({
    data: {
      name: "Notification User",
      email: `notifications-${suffix}@example.com`,
      passwordHash: "test-only",
      emailVerifiedAt: new Date(),
    },
  });
  userId = user.id;

  const room = await prisma.room.create({
    data: {
      name: `Notification Room ${suffix}`,
      floor: 98,
      capacity: 5,
    },
  });
  roomId = room.id;
});

afterAll(async () => {
  await prisma.room.deleteMany({ where: { id: roomId } });
  await prisma.user.deleteMany({ where: { id: userId } });
});

describe("end-of-booking notifications", () => {
  it("creates exactly one notification when the next slot is occupied", async () => {
    const now = new Date("2030-01-15T10:00:00.000Z");
    const endAt = new Date(now.getTime() + 5 * 60_000);

    const current = await prisma.booking.create({
      data: {
        title: "Current",
        roomId,
        userId,
        startAt: new Date(now.getTime() - 25 * 60_000),
        endAt,
      },
    });

    await prisma.booking.create({
      data: {
        title: "Next",
        roomId,
        userId,
        startAt: endAt,
        endAt: new Date(endAt.getTime() + 30 * 60_000),
      },
    });

    await ensureDueNotifications(userId, now);
    await ensureDueNotifications(userId, now);

    const notifications = await prisma.notification.findMany({
      where: { currentBookingId: current.id },
    });
    expect(notifications).toHaveLength(1);
  });

  it("does not notify when the next booking was cancelled", async () => {
    const now = new Date("2030-01-16T10:00:00.000Z");
    const endAt = new Date(now.getTime() + 5 * 60_000);

    const current = await prisma.booking.create({
      data: {
        title: "Current with cancelled neighbour",
        roomId,
        userId,
        startAt: new Date(now.getTime() - 25 * 60_000),
        endAt,
      },
    });

    await prisma.booking.create({
      data: {
        title: "Cancelled next",
        roomId,
        userId,
        startAt: endAt,
        endAt: new Date(endAt.getTime() + 30 * 60_000),
        cancelledAt: new Date(now.getTime() - 60_000),
      },
    });

    await ensureDueNotifications(userId, now);
    expect(await prisma.notification.count({ where: { currentBookingId: current.id } })).toBe(0);
  });

  it("does not notify when the current booking was cancelled", async () => {
    const now = new Date("2030-01-17T10:00:00.000Z");
    const endAt = new Date(now.getTime() + 5 * 60_000);

    const current = await prisma.booking.create({
      data: {
        title: "Cancelled current",
        roomId,
        userId,
        startAt: new Date(now.getTime() - 25 * 60_000),
        endAt,
        cancelledAt: new Date(now.getTime() - 60_000),
      },
    });

    await prisma.booking.create({
      data: {
        title: "Next after cancelled current",
        roomId,
        userId,
        startAt: endAt,
        endAt: new Date(endAt.getTime() + 30 * 60_000),
      },
    });

    await ensureDueNotifications(userId, now);
    expect(await prisma.notification.count({ where: { currentBookingId: current.id } })).toBe(0);
  });
});
