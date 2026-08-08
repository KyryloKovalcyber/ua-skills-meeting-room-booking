import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { DateTime } from "luxon";
import { AppError } from "@/lib/errors";

const { requireUserMock } = vi.hoisted(() => ({
  requireUserMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireUser: requireUserMock,
}));

import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/bookings/route";
import { DELETE } from "@/app/api/bookings/[bookingId]/route";

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

let owner: { id: string; name: string; email: string };
let otherUser: { id: string; name: string; email: string };
let room: { id: string };

function officeTime(daysAhead: number, hour: number, minute = 0) {
  return DateTime.now()
    .setZone("Europe/Kyiv")
    .plus({ days: daysAhead })
    .startOf("day")
    .set({ hour, minute })
    .toUTC()
    .toJSDate();
}

function createRequest(
  title: string,
  startAt: Date,
  endAt: Date,
) {
  return new Request("http://localhost/api/bookings", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      title,
      roomId: room.id,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
    }),
  });
}

async function createBooking(
  title: string,
  startAt: Date,
  endAt: Date,
) {
  requireUserMock.mockResolvedValue(owner);

  return POST(createRequest(title, startAt, endAt));
}

beforeAll(async () => {
  owner = await prisma.user.create({
    data: {
      name: "Integration Owner",
      email: `integration-owner-${suffix}@example.com`,
      passwordHash: "integration-test-only",
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  otherUser = await prisma.user.create({
    data: {
      name: "Integration Other",
      email: `integration-other-${suffix}@example.com`,
      passwordHash: "integration-test-only",
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  room = await prisma.room.create({
    data: {
      name: `Integration Room ${suffix}`,
      floor: 99,
      capacity: 20,
    },
    select: {
      id: true,
    },
  });
});

afterAll(async () => {
  if (room?.id) {
    await prisma.room.deleteMany({
      where: { id: room.id },
    });
  }

  await prisma.user.deleteMany({
    where: {
      email: {
        in: [
          `integration-owner-${suffix}@example.com`,
          `integration-other-${suffix}@example.com`,
        ],
      },
    },
  });

  await prisma.$disconnect();
});

describe("booking API integration", () => {
  it("creates a booking and its slot claims", async () => {
    const startAt = officeTime(3, 10);
    const endAt = officeTime(3, 11);

    const response = await createBooking(
      "Integration booking",
      startAt,
      endAt,
    );

    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body.booking.title).toBe("Integration booking");
    expect(body.booking.user.id).toBe(owner.id);

    const saved = await prisma.booking.findUnique({
      where: { id: body.booking.id },
      include: { slotClaims: true },
    });

    expect(saved).not.toBeNull();
    expect(saved?.roomId).toBe(room.id);
    expect(saved?.userId).toBe(owner.id);
    expect(saved?.slotClaims).toHaveLength(2);
  });

  it("rejects an overlapping booking with 409", async () => {
    const firstStart = officeTime(4, 12);
    const firstEnd = officeTime(4, 13);

    const firstResponse = await createBooking(
      "Existing booking",
      firstStart,
      firstEnd,
    );

    expect(firstResponse.status).toBe(201);

    requireUserMock.mockResolvedValue(otherUser);

    const overlapResponse = await POST(
      createRequest(
        "Overlapping booking",
        officeTime(4, 12, 30),
        officeTime(4, 13, 30),
      ),
    );

    expect(overlapResponse.status).toBe(409);

    const body = await overlapResponse.json();
    expect(body.error.code).toBe("BOOKING_CONFLICT");
  });

  it("rejects a booking that is not aligned to a 30-minute slot", async () => {
    const response = await createBooking(
      "Invalid slot",
      officeTime(5, 14, 15),
      officeTime(5, 15, 15),
    );

    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error.code).toBe("INVALID_SLOT");
  });

  it("forbids cancelling another user's booking", async () => {
    const response = await createBooking(
      "Protected booking",
      officeTime(6, 15),
      officeTime(6, 16),
    );

    const body = await response.json();
    const bookingId = body.booking.id;

    requireUserMock.mockResolvedValue(otherUser);

    const deleteResponse = await DELETE(
      new Request(`http://localhost/api/bookings/${bookingId}`, {
        method: "DELETE",
      }),
      {
        params: Promise.resolve({ bookingId }),
      },
    );

    expect(deleteResponse.status).toBe(403);

    const saved = await prisma.booking.findUnique({
      where: { id: bookingId },
    });

    expect(saved?.cancelledAt).toBeNull();
  });

  it("cancels an owned booking and releases its slot claims", async () => {
    const response = await createBooking(
      "Cancelable booking",
      officeTime(7, 16),
      officeTime(7, 17),
    );

    const body = await response.json();
    const bookingId = body.booking.id;

    requireUserMock.mockResolvedValue(owner);

    const deleteResponse = await DELETE(
      new Request(`http://localhost/api/bookings/${bookingId}`, {
        method: "DELETE",
      }),
      {
        params: Promise.resolve({ bookingId }),
      },
    );

    expect(deleteResponse.status).toBe(200);

    const saved = await prisma.booking.findUnique({
      where: { id: bookingId },
    });

    expect(saved?.cancelledAt).toBeInstanceOf(Date);

    const slotCount = await prisma.bookingSlot.count({
      where: { bookingId },
    });

    expect(slotCount).toBe(0);
  });

  it("returns 401 when the user is not authenticated", async () => {
    requireUserMock.mockRejectedValueOnce(
      new AppError(
        "UNAUTHORIZED",
        "Потрібно увійти в систему.",
        401,
      ),
    );

    const response = await POST(
      createRequest(
        "Unauthorized booking",
        officeTime(8, 10),
        officeTime(8, 11),
      ),
    );

    expect(response.status).toBe(401);

    const body = await response.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });
});