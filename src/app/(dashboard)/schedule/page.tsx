import { requireUser } from "@/lib/auth";
import {
  MAX_BOOKING_MINUTES,
  OFFICE_CLOSE_HOUR,
  OFFICE_OPEN_HOUR,
  OFFICE_TIME_ZONE,
  SLOT_MINUTES,
} from "@/lib/config";
import { Schedule } from "@/components/Schedule";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    room?: string;
    week?: string;
    verified?: string;
    verification?: string;
  }>;
}) {
  const user = await requireUser();
  const query = await searchParams;

  const initialNotice = query.verified === "1"
    ? "Email підтверджено. Тепер можна створювати бронювання."
    : undefined;
  const initialError = query.verification === "invalid"
    ? "Посилання підтвердження недійсне або прострочене."
    : undefined;

  return (
    <Schedule
      userId={user.id}
      emailVerified={Boolean(user.emailVerifiedAt)}
      initialRoomId={query.room}
      initialWeek={query.week}
      initialNotice={initialNotice}
      initialError={initialError}
      officeConfig={{
        timeZone: OFFICE_TIME_ZONE,
        openHour: OFFICE_OPEN_HOUR,
        closeHour: OFFICE_CLOSE_HOUR,
        slotMinutes: SLOT_MINUTES,
        maxBookingMinutes: MAX_BOOKING_MINUTES,
      }}
    />
  );
}
