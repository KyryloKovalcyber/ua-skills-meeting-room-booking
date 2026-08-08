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

type TestUser = {
  id: string;
  name: string;
  email: string;
  emailVerifiedAt: Date | null;
};

let owner: TestUser;
let otherUser: TestUser;
let unverifiedUser: TestUser;
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

function createRequest(title: string, startAt: Date, endAt: Date, recurrenceCount = 1) {
  return new Request("http://localhost/api/bookings", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title,
      roomId: room.id,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      recurrenceCount,
    }),
  });
}

async function createBooking(title: string, startAt: Date, endAt: Date, recurrenceCount = 1) {
  requireUserMock.mockResolvedValue(owner);
  return POST(createRequest(title, startAt, endAt, recurrenceCount));
}

beforeAll(async () => {
  const verifiedAt = new Date();

  owner = await prisma.user.create({
    data: {
      name: "Integration Owner",
      email: `integration-owner-${suffix}@example.com`,
      passwordHash: "integration-test-only",
      emailVerifiedAt: verifiedAt,
    },
    select: { id: true, name: true, email: true, emailVerifiedAt: true },
  });

  otherUser = await prisma.user.create({
    data: {
      name: "Integration Other",
      email: `integration-other-${suffix}@example.com`,
      passwordHash: "integration-test-only",
      emailVerifiedAt: verifiedAt,
    },
    select: { id: true, name: true, email: true, emailVerifiedAt: true },
  });

  unverifiedUser = await prisma.user.create({
    data: {
      name: "Integration Unverified",
      email: `integration-unverified-${suffix}@example.com`,
      passwordHash: "integration-test-only",
    },
    select: { id: true, name: true, email: true, emailVerifiedAt: true },
  });

  room = await prisma.room.create({
    data: {
      name: `Integration Room ${suffix}`,
      floor: 99,
      capacity: 20,
    },
    select: { id: true },
  });
});

afterAll(async () => {
  await prisma.room.deleteMany({ where: { id: room.id } });
  await prisma.user.deleteMany({
    where: {
      email: {
        in: [
          `integration-owner-${suffix}@example.com`,
          `integration-other-${suffix}@example.com`,
          `integration-unverified-${suffix}@example.com`,
        ],
      },
    },
  });
});

describe("booking API integration", () => {
  it("creates a booking and its slot claims", async () => {
    const response = await createBooking("Integration booking", officeTime(3, 10), officeTime(3, 11));
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
    const firstResponse = await createBooking("Existing booking", officeTime(4, 12), officeTime(4, 13));
    expect(firstResponse.status).toBe(201);

    requireUserMock.mockResolvedValue(otherUser);
    const overlapResponse = await POST(
      createRequest("Overlapping booking", officeTime(4, 12, 30), officeTime(4, 13, 30)),
    );

    expect(overlapResponse.status).toBe(409);
    const body = await overlapResponse.json();
    expect(body.error.code).toBe("BOOKING_CONFLICT");
  });

  it("rejects a booking that is not aligned to a 30-minute slot", async () => {
    const response = await createBooking("Invalid slot", officeTime(5, 14, 15), officeTime(5, 15, 15));
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error.code).toBe("INVALID_SLOT");
  });

  it("blocks booking before email verification", async () => {
    requireUserMock.mockResolvedValue(unverifiedUser);
    const response = await POST(
      createRequest("Unverified attempt", officeTime(6, 10), officeTime(6, 11)),
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error.code).toBe("EMAIL_NOT_VERIFIED");
  });

  it("creates a weekly recurring series atomically", async () => {
    const response = await createBooking("Weekly recurring", officeTime(20, 10), officeTime(20, 11), 3);
    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body.recurrenceCount).toBe(3);
    expect(body.seriesId).toBeTruthy();

    const series = await prisma.booking.findMany({
      where: { seriesId: body.seriesId },
      include: { slotClaims: true },
      orderBy: { startAt: "asc" },
    });

    expect(series).toHaveLength(3);
    expect(series.every((item: { slotClaims: unknown[] }) => item.slotClaims.length === 2)).toBe(true);
  });

  it("rolls back a recurring series if one occurrence conflicts", async () => {
    await createBooking("Blocking occurrence", officeTime(37, 13), officeTime(37, 14));

    const response = await createBooking("Should rollback", officeTime(30, 13), officeTime(30, 14), 3);
    expect(response.status).toBe(409);

    const count = await prisma.booking.count({ where: { title: "Should rollback" } });
    expect(count).toBe(0);
  });

  it("forbids cancelling another user's booking", async () => {
    const response = await createBooking("Protected booking", officeTime(10, 15), officeTime(10, 16));
    const body = await response.json();

    requireUserMock.mockResolvedValue(otherUser);
    const deleteResponse = await DELETE(
      new Request(`http://localhost/api/bookings/${body.booking.id}`, { method: "DELETE" }),
      { params: Promise.resolve({ bookingId: body.booking.id }) },
    );

    expect(deleteResponse.status).toBe(403);
  });

  it("cancels one occurrence and releases its slot claims", async () => {
    const response = await createBooking("Cancelable booking", officeTime(11, 16), officeTime(11, 17));
    const body = await response.json();
    requireUserMock.mockResolvedValue(owner);

    const deleteResponse = await DELETE(
      new Request(`http://localhost/api/bookings/${body.booking.id}?scope=single`, { method: "DELETE" }),
      { params: Promise.resolve({ bookingId: body.booking.id }) },
    );

    expect(deleteResponse.status).toBe(200);
    const saved = await prisma.booking.findUnique({ where: { id: body.booking.id } });
    expect(saved?.cancelledAt).toBeInstanceOf(Date);
    expect(await prisma.bookingSlot.count({ where: { bookingId: body.booking.id } })).toBe(0);
  });

  it("cancels all future occurrences in a series", async () => {
    const response = await createBooking("Cancelable series", officeTime(45, 16), officeTime(45, 17), 3);
    const body = await response.json();
    requireUserMock.mockResolvedValue(owner);

    const deleteResponse = await DELETE(
      new Request(`http://localhost/api/bookings/${body.booking.id}?scope=series`, { method: "DELETE" }),
      { params: Promise.resolve({ bookingId: body.booking.id }) },
    );

    expect(deleteResponse.status).toBe(200);
    const result = await deleteResponse.json();
    expect(result.cancelledCount).toBe(3);
    expect(await prisma.booking.count({ where: { seriesId: body.seriesId, cancelledAt: null } })).toBe(0);
  });

  it("allows only one winner in a concurrent race for the same slot", async () => {
    requireUserMock.mockResolvedValue(owner);
    const requestA = createRequest("Race A", officeTime(60, 11), officeTime(60, 12));
    const requestB = createRequest("Race B", officeTime(60, 11), officeTime(60, 12));

    const [a, b] = await Promise.all([POST(requestA), POST(requestB)]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);

    const count = await prisma.booking.count({
      where: {
        roomId: room.id,
        cancelledAt: null,
        startAt: officeTime(60, 11),
        endAt: officeTime(60, 12),
      },
    });
    expect(count).toBe(1);
  });

  it("returns 401 when the user is not authenticated", async () => {
    requireUserMock.mockRejectedValueOnce(new AppError("UNAUTHORIZED", "Потрібно увійти в систему.", 401));
    const response = await POST(
      createRequest("Unauthorized booking", officeTime(13, 10), officeTime(13, 11)),
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });
});
