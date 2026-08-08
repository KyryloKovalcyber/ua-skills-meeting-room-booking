import { describe, expect, it } from "vitest";
import { bookingSlotStarts, intervalsOverlap, validateBookingTimes } from "../src/modules/bookings/rules";

const d = (value: string) => new Date(`2026-08-${value}:00.000Z`);

describe("intervalsOverlap", () => {
  it("allows touching intervals", () =>
    expect(intervalsOverlap(d("03T10:00"), d("03T11:00"), d("03T11:00"), d("03T12:00"))).toBe(false));

  it("detects partial overlap", () =>
    expect(intervalsOverlap(d("03T10:00"), d("03T11:00"), d("03T10:30"), d("03T11:30"))).toBe(true));

  it("detects exact match", () =>
    expect(intervalsOverlap(d("03T10:00"), d("03T11:00"), d("03T10:00"), d("03T11:00"))).toBe(true));

  it("does not overlap adjacent days", () =>
    expect(intervalsOverlap(d("03T10:00"), d("03T11:00"), d("04T10:00"), d("04T11:00"))).toBe(false));
});

describe("booking slot claims", () => {
  it("creates one claim for every 30-minute slot", () => {
    const starts = bookingSlotStarts(d("03T10:00"), d("03T12:00"));
    expect(starts.map((x) => x.toISOString())).toEqual([
      d("03T10:00").toISOString(),
      d("03T10:30").toISOString(),
      d("03T11:00").toISOString(),
      d("03T11:30").toISOString(),
    ]);
  });
});

describe("validateBookingTimes", () => {
  const now = new Date("2026-08-01T00:00:00.000Z");

  it("accepts a valid Kyiv-office interval", () => {
    expect(() => validateBookingTimes(new Date("2026-08-03T07:00:00.000Z"), new Date("2026-08-03T08:00:00.000Z"), now)).not.toThrow();
  });

  it("rejects duration longer than four hours", () => {
    expect(() => validateBookingTimes(new Date("2026-08-03T07:00:00.000Z"), new Date("2026-08-03T11:30:00.000Z"), now)).toThrow();
  });

  it("rejects a non-30-minute boundary", () => {
    expect(() => validateBookingTimes(new Date("2026-08-03T07:15:00.000Z"), new Date("2026-08-03T08:15:00.000Z"), now)).toThrow();
  });
});
