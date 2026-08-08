"use client";

import { DateTime } from "luxon";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

const OFFICE_TZ = "Europe/Kyiv";
const OFFICE_OPEN_HOUR = 9;
const OFFICE_CLOSE_HOUR = 19;
const SLOT_MINUTES = 30;
const SLOT_COUNT = ((OFFICE_CLOSE_HOUR - OFFICE_OPEN_HOUR) * 60) / SLOT_MINUTES;

type Room = { id: string; name: string; floor: number; capacity: number };
type Booking = {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  user: { id: string; name: string };
};
type ApiError = { error?: { message?: string; fields?: Record<string, string> } };

function parseOfficeWeek(value?: string) {
  if (value) {
    const parsed = DateTime.fromISO(value, { zone: OFFICE_TZ });
    if (parsed.isValid) return parsed.startOf("week").startOf("day");
  }
  return DateTime.now().setZone(OFFICE_TZ).startOf("week").startOf("day");
}

export function Schedule({
  userId,
  initialRoomId,
  initialWeek,
}: {
  userId: string;
  initialRoomId?: string;
  initialWeek?: string;
}) {
  const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomId, setRoomId] = useState(initialRoomId ?? "");
  const [week, setWeek] = useState(() => parseOfficeWeek(initialWeek));
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [capacity, setCapacity] = useState(0);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [error, setError] = useState("");
  const [selectedStart, setSelectedStart] = useState<string | null>(null);
  const [mobileDay, setMobileDay] = useState(0);

  const officeDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => week.plus({ days: index })),
    [week],
  );

  const dayHeaders = useMemo(
    () => officeDays.map((day) => day.set({ hour: OFFICE_OPEN_HOUR }).toUTC().setZone(userTz)),
    [officeDays, userTz],
  );

  const timeLabels = useMemo(
    () => Array.from({ length: SLOT_COUNT }, (_, row) =>
      week
        .plus({ days: 2 })
        .set({ hour: OFFICE_OPEN_HOUR, minute: 0, second: 0, millisecond: 0 })
        .plus({ minutes: row * SLOT_MINUTES })
        .toUTC()
        .setZone(userTz)
        .toFormat("HH:mm"),
    ),
    [week, userTz],
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

  async function createBooking(title: string, endAt: string) {
    if (!selectedStart) return { ok: false, error: "Не вибрано початок бронювання." };

    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, roomId, startAt: selectedStart, endAt }),
      });
      const data: ApiError = await response.json();

      if (!response.ok) {
        return {
          ok: false,
          error: data.error?.message ?? "Не вдалося створити бронювання.",
          fields: data.error?.fields ?? {},
        };
      }

      setSelectedStart(null);
      await reloadSchedule();
      return { ok: true };
    } catch {
      return { ok: false, error: "Сервер недоступний. Спробуйте ще раз." };
    }
  }

  const now = DateTime.now();
  const timezoneDiffers = userTz !== OFFICE_TZ;

  return (
    <main className="page">
      <section className="hero">
        <div>
          <span className="eyebrow">ТИЖНЕВИЙ РОЗКЛАД</span>
          <h1>Переговорні кімнати</h1>
          <p className="muted timezone-note">
            Час у вашому поясі: <b>{userTz}</b>.
            {timezoneDiffers && <> Офіс: <b>{OFFICE_TZ}</b> (09:00–19:00).</>}
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
            <button className="ghost" onClick={() => setWeek(parseOfficeWeek())}>Сьогодні</button>
            <button className="ghost icon-button" onClick={() => setWeek((value) => value.plus({ weeks: 1 }))} aria-label="Наступний тиждень">→</button>
          </div>
        </div>
      </section>

      <div className="week-caption">
        <strong>{week.toFormat("dd.LL")}–{week.plus({ days: 6 }).toFormat("dd.LL.yyyy")}</strong>
        <span>Робочий тиждень офісу · {OFFICE_TZ}</span>
      </div>

      <div className="mobile-day-tabs" aria-label="Дні тижня">
        {dayHeaders.map((day, index) => (
          <button
            key={`${day.toISODate()}-${index}`}
            className={mobileDay === index ? "active ghost" : "ghost"}
            onClick={() => setMobileDay(index)}
          >
            {day.toFormat("ccc dd.MM")}
          </button>
        ))}
      </div>

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
                <b>{day.toFormat("ccc")}</b>
                <span>{day.toFormat("dd.MM")}</span>
              </div>
            ))}

            {Array.from({ length: SLOT_COUNT }, (_, row) => {
              return (
                <div className="row" key={row}>
                  <div className="time">{timeLabels[row]}</div>
                  {officeDays.map((officeDay, dayIndex) => {
                    const slotStart = officeDay
                      .set({ hour: OFFICE_OPEN_HOUR, minute: 0, second: 0, millisecond: 0 })
                      .plus({ minutes: row * SLOT_MINUTES })
                      .toUTC();
                    const slotEnd = slotStart.plus({ minutes: SLOT_MINUTES });
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
                        disabled={Boolean(booking) || isPast}
                        onClick={() => setSelectedStart(slotStart.toISO())}
                        aria-label={booking
                          ? `${booking.title}, ${booking.user.name}`
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
              );
            })}
          </div>
        </div>
      )}

      {selectedStart && (
        <BookingDialog
          startAt={selectedStart}
          userTz={userTz}
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
  onClose,
  onCreate,
}: {
  startAt: string;
  userTz: string;
  onClose: () => void;
  onCreate: (
    title: string,
    endAt: string,
  ) => Promise<{ ok: boolean; error?: string; fields?: Record<string, string> }>;
}) {
  const startUtc = DateTime.fromISO(startAt, { zone: "utc" });
  const officeStart = startUtc.setZone(OFFICE_TZ);
  const officeClose = officeStart.startOf("day").set({ hour: OFFICE_CLOSE_HOUR });
  const maxEnd = DateTime.min(startUtc.plus({ hours: 4 }), officeClose.toUTC());
  const optionCount = Math.max(1, Math.floor(maxEnd.diff(startUtc, "minutes").minutes / SLOT_MINUTES));
  const options = Array.from({ length: optionCount }, (_, index) => startUtc.plus({ minutes: (index + 1) * SLOT_MINUTES }));

  const [title, setTitle] = useState("");
  const [endAt, setEndAt] = useState(options[0]?.toISO() ?? startUtc.plus({ minutes: 30 }).toISO());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setFields({});

    const result = await onCreate(title, endAt ?? "");
    if (!result.ok) {
      setError(result.error ?? "Не вдалося створити бронювання.");
      setFields(result.fields ?? {});
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <form className="modal" onMouseDown={(event) => event.stopPropagation()} onSubmit={submit} noValidate>
        <div>
          <span className="eyebrow">НОВЕ БРОНЮВАННЯ</span>
          <h2>Забронювати кімнату</h2>
          <p className="muted">
            {startUtc.setZone(userTz).toFormat("cccc, dd LLLL · HH:mm")} · {userTz}
          </p>
        </div>

        <label>
          Назва
          <input
            autoFocus
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

        {error && <p className="form-error" role="alert">{error}</p>}

        <div className="actions">
          <button type="button" className="ghost" onClick={onClose} disabled={busy}>Закрити</button>
          <button disabled={busy}>{busy ? "Бронювання…" : "Забронювати"}</button>
        </div>
      </form>
    </div>
  );
}
