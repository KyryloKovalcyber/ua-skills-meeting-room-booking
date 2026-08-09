"use client";

import { DateTime } from "luxon";
import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

type OfficeConfig = {
  timeZone: string;
  openHour: number;
  closeHour: number;
  slotMinutes: number;
  maxBookingMinutes: number;
};

type Room = { id: string; name: string; floor: number; capacity: number };
type Booking = {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  seriesId?: string | null;
  user: { id: string; name: string };
};
type ApiError = { error?: { message?: string; fields?: Record<string, string> } };

function parseOfficeWeek(value: string | undefined, timeZone: string) {
  if (value) {
    const parsed = DateTime.fromISO(value, { zone: timeZone });
    if (parsed.isValid) return parsed.startOf("week").startOf("day");
  }
  return DateTime.now().setZone(timeZone).startOf("week").startOf("day");
}

const WEEKDAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];

export function Schedule({
  userId,
  emailVerified,
  initialRoomId,
  initialWeek,
  initialNotice,
  initialError,
  officeConfig,
}: {
  userId: string;
  emailVerified: boolean;
  initialRoomId?: string;
  initialWeek?: string;
  initialNotice?: string;
  initialError?: string;
  officeConfig: OfficeConfig;
}) {
  const { timeZone: officeTimeZone, openHour, closeHour, slotMinutes } = officeConfig;
  const slotCount = ((closeHour - openHour) * 60) / slotMinutes;
  const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomId, setRoomId] = useState(initialRoomId ?? "");
  const [week, setWeek] = useState(() => parseOfficeWeek(initialWeek, officeTimeZone));
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [capacity, setCapacity] = useState(0);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(initialNotice ?? "");
  const [verificationError, setVerificationError] = useState(initialError ?? "");
  const [selectedStart, setSelectedStart] = useState<string | null>(null);
  const [mobileDay, setMobileDay] = useState(0);

  const officeDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => week.plus({ days: index })),
    [week],
  );

  const dayHeaders = useMemo(
    () => officeDays.map((day) => day.set({ hour: openHour }).toUTC().setZone(userTz)),
    [officeDays, openHour, userTz],
  );

  const timeLabels = useMemo(
    () => Array.from({ length: slotCount }, (_, row) =>
      week
        .plus({ days: 2 })
        .set({ hour: openHour, minute: 0, second: 0, millisecond: 0 })
        .plus({ minutes: row * slotMinutes })
        .toUTC()
        .setZone(userTz)
        .toFormat("HH:mm"),
    ),
    [openHour, slotCount, slotMinutes, userTz, week],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadRooms() {
      setLoadingRooms(true);
      setError("");
      try {
        const response = await fetch(`/api/rooms?minCapacity=${capacity}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message ?? "Не вдалося завантажити кімнати.");
        if (cancelled) return;

        const nextRooms: Room[] = data.rooms ?? [];
        setRooms(nextRooms);
        setRoomId((current) => {
          if (nextRooms.some((room) => room.id === current)) return current;
          if (initialRoomId && nextRooms.some((room) => room.id === initialRoomId)) return initialRoomId;
          return nextRooms[0]?.id ?? "";
        });
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Сервер недоступний.");
      } finally {
        if (!cancelled) setLoadingRooms(false);
      }
    }

    void loadRooms();
    return () => { cancelled = true; };
  }, [capacity, initialRoomId]);

  useEffect(() => {
    if (!roomId) {
      setBookings([]);
      return;
    }

    let cancelled = false;

    async function loadSchedule() {
      setLoadingSchedule(true);
      setError("");
      try {
        const from = week.startOf("day").toUTC().toISO();
        const to = week.plus({ weeks: 1 }).startOf("day").toUTC().toISO();
        const response = await fetch(
          `/api/rooms/${roomId}/bookings?from=${encodeURIComponent(from ?? "")}&to=${encodeURIComponent(to ?? "")}`,
        );
        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message ?? "Не вдалося завантажити розклад.");
        if (!cancelled) setBookings(data.bookings ?? []);
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Сервер недоступний.");
      } finally {
        if (!cancelled) setLoadingSchedule(false);
      }
    }

    void loadSchedule();
    return () => { cancelled = true; };
  }, [roomId, week]);

  async function reloadSchedule() {
    if (!roomId) return;
    const from = week.startOf("day").toUTC().toISO();
    const to = week.plus({ weeks: 1 }).startOf("day").toUTC().toISO();
    const response = await fetch(
      `/api/rooms/${roomId}/bookings?from=${encodeURIComponent(from ?? "")}&to=${encodeURIComponent(to ?? "")}`,
    );
    const data = await response.json();
    if (response.ok) setBookings(data.bookings ?? []);
  }

  async function createBooking(title: string, endAt: string, recurrenceCount: number) {
    if (!selectedStart) return { ok: false, error: "Не вибрано початок бронювання." };

    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, roomId, startAt: selectedStart, endAt, recurrenceCount }),
      });
      const data: ApiError & { recurrenceCount?: number } = await response.json();

      if (!response.ok) {
        return {
          ok: false,
          error: data.error?.message ?? "Не вдалося створити бронювання.",
          fields: data.error?.fields ?? {},
        };
      }

      setSelectedStart(null);
      await reloadSchedule();
      const created = data.recurrenceCount ?? recurrenceCount;
      setNotice(created > 1 ? `Створено серію з ${created} бронювань.` : "Бронювання створено.");
      window.setTimeout(() => setNotice(""), 4500);
      return { ok: true };
    } catch {
      return { ok: false, error: "Сервер недоступний. Спробуйте ще раз." };
    }
  }

  const now = DateTime.now();
  const timezoneDiffers = userTz !== officeTimeZone;

  return (
    <main className="page">
      <section className="hero">
        <div>
          <span className="eyebrow">ТИЖНЕВИЙ РОЗКЛАД</span>
          <h1>Переговорні кімнати</h1>
          <p className="muted timezone-note">
            Час у вашому поясі: <b>{userTz}</b>.
            {timezoneDiffers && <> Офіс: <b>{officeTimeZone}</b> ({String(openHour).padStart(2, "0")}:00–{String(closeHour).padStart(2, "0")}:00).</>}
          </p>
        </div>

        <div className="toolbar">
          <label className="compact-field">
            Місткість
            <select value={capacity} onChange={(event) => setCapacity(Number(event.target.value))}>
              <option value={0}>Будь-яка</option>
              <option value={4}>4+</option>
              <option value={6}>6+</option>
              <option value={8}>8+</option>
              <option value={10}>10+</option>
              <option value={12}>12+</option>
            </select>
          </label>

          <label className="compact-field room-select">
            Кімната
            <select value={roomId} onChange={(event) => setRoomId(event.target.value)} disabled={!rooms.length}>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name} · {room.floor} поверх · {room.capacity} ос.
                </option>
              ))}
            </select>
          </label>

          <div className="week-nav" aria-label="Навігація тижнями">
            <button className="ghost icon-button" onClick={() => setWeek((value) => value.minus({ weeks: 1 }))} aria-label="Попередній тиждень">←</button>
            <button className="ghost" onClick={() => setWeek(parseOfficeWeek(undefined, officeTimeZone))}>Сьогодні</button>
            <button className="ghost icon-button" onClick={() => setWeek((value) => value.plus({ weeks: 1 }))} aria-label="Наступний тиждень">→</button>
          </div>
        </div>
      </section>

      <div className="week-caption">
        <strong>{week.toFormat("dd.LL")}–{week.plus({ days: 6 }).toFormat("dd.LL.yyyy")}</strong>
        <span>Робочий тиждень офісу · {officeTimeZone}</span>
      </div>

      <div className="calendar-legend" aria-label="Легенда розкладу">
        <span><i className="legend-swatch mine-swatch" />Моє бронювання</span>
        <span><i className="legend-swatch other-swatch" />Інше бронювання</span>
        <span><i className="legend-line" />Поточний час</span>
      </div>

      <div className="mobile-day-tabs" aria-label="Дні тижня">
        {dayHeaders.map((day, index) => (
          <button
            key={`${day.toISODate()}-${index}`}
            className={mobileDay === index ? "active ghost" : "ghost"}
            onClick={() => setMobileDay(index)}
          >
            {WEEKDAY_LABELS[index]} {day.toFormat("dd.MM")}
          </button>
        ))}
      </div>

      {notice && <div className="success-notice" role="status">{notice}</div>}
      {verificationError && (
        <div className="state error compact-state" role="alert">
          {verificationError}
          <button className="ghost inline-action" onClick={() => setVerificationError("")}>Закрити</button>
        </div>
      )}
      {error && <div className="state error" role="alert">{error}</div>}

      {loadingRooms ? (
        <div className="state">Завантаження кімнат…</div>
      ) : rooms.length === 0 ? (
        <div className="state">
          <h3>Немає кімнат за цим фільтром</h3>
          <p className="muted">Зменште мінімальну місткість.</p>
        </div>
      ) : loadingSchedule ? (
        <div className="calendar-skeleton" aria-label="Завантаження розкладу">
          {Array.from({ length: 8 }, (_, index) => <span key={index} />)}
        </div>
      ) : (
        <div className="calendar-wrap">
          <div className="calendar">
            <div className="corner"><small>{userTz}</small></div>
            {dayHeaders.map((day, dayIndex) => (
              <div
                className={`day-head ${day.hasSame(DateTime.now().setZone(userTz), "day") ? "today" : ""} ${dayIndex !== mobileDay ? "mobile-hidden" : ""}`}
                key={`${day.toISODate()}-${dayIndex}`}
              >
                <b>{WEEKDAY_LABELS[dayIndex]}</b>
                <span>{day.toFormat("dd.MM")}</span>
              </div>
            ))}

            {Array.from({ length: slotCount }, (_, row) => (
              <div className="row" key={row}>
                <div className="time">{timeLabels[row]}</div>
                {officeDays.map((officeDay, dayIndex) => {
                  const slotStart = officeDay
                    .set({ hour: openHour, minute: 0, second: 0, millisecond: 0 })
                    .plus({ minutes: row * slotMinutes })
                    .toUTC();
                  const slotEnd = slotStart.plus({ minutes: slotMinutes });
                  const booking = bookings.find((item) => {
                    const start = DateTime.fromISO(item.startAt, { zone: "utc" });
                    const end = DateTime.fromISO(item.endAt, { zone: "utc" });
                    return start < slotEnd && end > slotStart;
                  });
                  const bookingStart = booking ? DateTime.fromISO(booking.startAt, { zone: "utc" }) : null;
                  const bookingEnd = booking ? DateTime.fromISO(booking.endAt, { zone: "utc" }) : null;
                  const isFirst = Boolean(bookingStart?.equals(slotStart));
                  const isLast = Boolean(bookingEnd?.equals(slotEnd));
                  const isCurrent = now >= slotStart && now < slotEnd;
                  const isPast = slotStart <= now;

                  return (
                    <button
                      className={[
                        "slot",
                        booking ? "busy" : "",
                        booking?.user.id === userId ? "mine" : "",
                        isFirst ? "booking-start" : "",
                        isLast ? "booking-end" : "",
                        isCurrent ? "current-time" : "",
                        dayIndex !== mobileDay ? "mobile-hidden" : "",
                      ].filter(Boolean).join(" ")}
                      key={`${row}-${dayIndex}`}
                      disabled={Boolean(booking) || isPast || !emailVerified}
                      onClick={() => setSelectedStart(slotStart.toISO())}
                      aria-label={booking
                        ? `${booking.title}, ${booking.user.name}`
                        : !emailVerified
                          ? `Вільно, ${slotStart.setZone(userTz).toFormat("dd.LL HH:mm")}. Потрібно підтвердити email.`
                          : `Вільно, ${slotStart.setZone(userTz).toFormat("dd.LL HH:mm")}`}
                    >
                      {isCurrent && <i className="now-dot" aria-hidden="true" />}
                      {isFirst && booking && (
                        <span>
                          <strong>{booking.title}</strong>
                          <small>{booking.user.name}</small>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedStart && (
        <BookingDialog
          startAt={selectedStart}
          userTz={userTz}
          officeConfig={officeConfig}
          onClose={() => setSelectedStart(null)}
          onCreate={createBooking}
        />
      )}
    </main>
  );
}

function BookingDialog({
  startAt,
  userTz,
  officeConfig,
  onClose,
  onCreate,
}: {
  startAt: string;
  userTz: string;
  officeConfig: OfficeConfig;
  onClose: () => void;
  onCreate: (
    title: string,
    endAt: string,
    recurrenceCount: number,
  ) => Promise<{ ok: boolean; error?: string; fields?: Record<string, string> }>;
}) {
  const startUtc = DateTime.fromISO(startAt, { zone: "utc" });
  const officeStart = startUtc.setZone(officeConfig.timeZone);
  const officeClose = officeStart.startOf("day").set({ hour: officeConfig.closeHour });
  const maxEnd = DateTime.min(
    startUtc.plus({ minutes: officeConfig.maxBookingMinutes }),
    officeClose.toUTC(),
  );
  const optionCount = Math.max(
    1,
    Math.floor(maxEnd.diff(startUtc, "minutes").minutes / officeConfig.slotMinutes),
  );
  const options = Array.from(
    { length: optionCount },
    (_, index) => startUtc.plus({ minutes: (index + 1) * officeConfig.slotMinutes }),
  );

  const [title, setTitle] = useState("");
  const [endAt, setEndAt] = useState(options[0]?.toISO() ?? startUtc.plus({ minutes: 30 }).toISO());
  const [repeatWeekly, setRepeatWeekly] = useState(false);
  const [recurrenceCount, setRecurrenceCount] = useState(4);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [busy, onClose]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setFields({});

    const result = await onCreate(title, endAt ?? "", repeatWeekly ? recurrenceCount : 1);
    if (!result.ok) {
      setError(result.error ?? "Не вдалося створити бронювання.");
      setFields(result.fields ?? {});
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <form
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={submit}
        noValidate
      >
        <div>
          <span className="eyebrow">НОВЕ БРОНЮВАННЯ</span>
          <h2 id="booking-dialog-title">Забронювати кімнату</h2>
          <p className="muted">
{WEEKDAY_LABELS[startUtc.setZone(userTz).weekday - 1]}, {startUtc.setZone(userTz).toFormat("dd.MM · HH:mm")} · {userTz}          </p>
        </div>

        <label>
          Назва
          <input
            ref={titleRef}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={100}
            required
            aria-invalid={Boolean(fields.title)}
            placeholder="Наприклад, Product sync"
          />
          {fields.title && <small className="field-error">{fields.title}</small>}
        </label>

        <label>
          Час завершення
          <select value={endAt ?? ""} onChange={(event) => setEndAt(event.target.value)}>
            {options.map((value) => (
              <option key={value.toISO()} value={value.toISO() ?? ""}>
                {value.setZone(userTz).toFormat("HH:mm")}
              </option>
            ))}
          </select>
        </label>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={repeatWeekly}
            onChange={(event) => setRepeatWeekly(event.target.checked)}
          />
          <span>Повторювати щотижня</span>
        </label>

        {repeatWeekly && (
          <label>
            Кількість зустрічей у серії
            <select
              value={recurrenceCount}
              onChange={(event) => setRecurrenceCount(Number(event.target.value))}
            >
              {Array.from({ length: 11 }, (_, index) => index + 2).map((count) => (
                <option key={count} value={count}>{count}</option>
              ))}
            </select>
            <small className="muted">
              Уся серія створюється атомарно: при одному конфлікті не створюється нічого.
            </small>
          </label>
        )}

        {error && <p className="form-error" role="alert">{error}</p>}

        <div className="actions">
          <button type="button" className="ghost" onClick={onClose} disabled={busy}>Закрити</button>
          <button disabled={busy}>{busy ? "Бронювання…" : "Забронювати"}</button>
        </div>
      </form>
    </div>
  );
}
