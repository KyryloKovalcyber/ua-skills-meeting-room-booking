import { DateTime } from "luxon";
import { AppError } from "@/lib/errors";
import {
  MAX_BOOKING_MINUTES,
  OFFICE_CLOSE_HOUR,
  OFFICE_OPEN_HOUR,
  OFFICE_TIME_ZONE,
  SLOT_MINUTES,
} from "@/lib/config";

export const intervalsOverlap = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) =>
  aStart < bEnd && aEnd > bStart;

export function bookingSlotStarts(startAt: Date, endAt: Date) {
  const result: Date[] = [];
  for (let cursor = startAt.getTime(); cursor < endAt.getTime(); cursor += SLOT_MINUTES * 60_000) {
    result.push(new Date(cursor));
  }
  return result;
}

export function buildWeeklyOccurrences(startAt: Date, endAt: Date, count: number) {
  const localStart = DateTime.fromJSDate(startAt, { zone: "utc" }).setZone(OFFICE_TIME_ZONE);
  const localEnd = DateTime.fromJSDate(endAt, { zone: "utc" }).setZone(OFFICE_TIME_ZONE);

  return Array.from({ length: count }, (_, index) => ({
    startAt: localStart.plus({ weeks: index }).toUTC().toJSDate(),
    endAt: localEnd.plus({ weeks: index }).toUTC().toJSDate(),
  }));
}

export function validateBookingTimes(startAt: Date, endAt: Date, now = new Date()) {
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
    throw new AppError("INVALID_TIME", "Некоректна дата або час.");
  }
  if (startAt >= endAt) {
    throw new AppError("INVALID_INTERVAL", "Час завершення має бути пізніше початку.");
  }
  if (startAt <= now) {
    throw new AppError("BOOKING_IN_PAST", "Бронювання можна створити лише в майбутньому.");
  }

  const duration = (endAt.getTime() - startAt.getTime()) / 60_000;
  if (duration < SLOT_MINUTES || duration > MAX_BOOKING_MINUTES) {
    throw new AppError("INVALID_DURATION", "Тривалість має бути від 30 хвилин до 4 годин.");
  }

  const start = DateTime.fromJSDate(startAt, { zone: "utc" }).setZone(OFFICE_TIME_ZONE);
  const end = DateTime.fromJSDate(endAt, { zone: "utc" }).setZone(OFFICE_TIME_ZONE);

  const aligned = (value: DateTime) =>
    value.minute % SLOT_MINUTES === 0 && value.second === 0 && value.millisecond === 0;

  if (!aligned(start) || !aligned(end)) {
    throw new AppError("INVALID_SLOT", "Час має бути кратним 30 хвилинам.");
  }
  if (start.toISODate() !== end.toISODate()) {
    throw new AppError("OUTSIDE_WORKING_HOURS", "Бронювання має завершитися того самого робочого дня.");
  }

  const open = start.startOf("day").set({ hour: OFFICE_OPEN_HOUR });
  const close = start.startOf("day").set({ hour: OFFICE_CLOSE_HOUR });
  if (start < open || end > close) {
    throw new AppError(
      "OUTSIDE_WORKING_HOURS",
      `Робочі години кімнат: ${String(OFFICE_OPEN_HOUR).padStart(2, "0")}:00–${String(OFFICE_CLOSE_HOUR).padStart(2, "0")}:00 за ${OFFICE_TIME_ZONE}.`,
    );
  }
}
