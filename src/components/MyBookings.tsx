"use client";

import { DateTime } from "luxon";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Item = {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  seriesId: string | null;
  room: { id: string; name: string; floor: number };
};

export function MyBookings({ officeTimeZone }: { officeTimeZone: string }) {
  const router = useRouter();
  const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const WEEKDAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];
  const MONTH_LABELS = ["СІЧ", "ЛЮТ", "БЕР", "КВІ", "ТРА", "ЧЕР", "ЛИП", "СЕР", "ВЕР", "ЖОВ", "ЛИС", "ГРУ"];
  const [type, setType] = useState<"upcoming" | "past">("upcoming");
  const [items, setItems] = useState<Item[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [cancelTarget, setCancelTarget] = useState<Item | null>(null);
  const [cancelling, setCancelling] = useState(false);

  async function requestPage(targetPage: number, append = false) {
    append ? setLoadingMore(true) : setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/me/bookings?type=${type}&page=${targetPage}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message ?? "Не вдалося завантажити бронювання.");

      setItems((current) => append ? [...current, ...(data.items ?? [])] : (data.items ?? []));
      setTotal(data.total ?? 0);
      setPage(targetPage);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Сервер недоступний.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    setItems([]);
    setPage(1);
    void requestPage(1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  useEffect(() => {
    if (!cancelTarget) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !cancelling) setCancelTarget(null);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cancelTarget, cancelling]);

  async function cancel(scope: "single" | "series") {
    if (!cancelTarget) return;
    setCancelling(true);
    setError("");

    try {
      const response = await fetch(`/api/bookings/${cancelTarget.id}?scope=${scope}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message ?? "Не вдалося скасувати бронювання.");

      setCancelTarget(null);
      await requestPage(1, false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Сервер недоступний.");
    } finally {
      setCancelling(false);
    }
  }

  function openInSchedule(item: Item) {
    const week = DateTime.fromISO(item.startAt, { zone: "utc" })
      .setZone(officeTimeZone)
      .startOf("week")
      .toISODate();
    router.push(`/schedule?room=${encodeURIComponent(item.room.id)}&week=${encodeURIComponent(week ?? "")}`);
  }

  return (
    <main className="page">
      <section className="hero">
        <div>
          <span className="eyebrow">ОСОБИСТИЙ КАБІНЕТ</span>
          <h1>Мої бронювання</h1>
          <p className="muted">Час показано у вашому поясі: <b>{userTz}</b>.</p>
        </div>
        <div className="tabs">
          <button className={type === "upcoming" ? "active ghost" : "ghost"} onClick={() => setType("upcoming")}>Майбутні</button>
          <button className={type === "past" ? "active ghost" : "ghost"} onClick={() => setType("past")}>Минулі</button>
        </div>
      </section>

      {error && <div className="state error" role="alert">{error}</div>}

      {loading ? (
        <div className="state">Завантаження…</div>
      ) : items.length === 0 ? (
        <div className="state">
          <h3>Бронювань немає</h3>
          <p className="muted">Тут з’являться ваші {type === "upcoming" ? "майбутні" : "минулі"} зустрічі.</p>
        </div>
      ) : (
        <>
          <div className="booking-list">
            {items.map((item) => {
              const start = DateTime.fromISO(item.startAt, { zone: "utc" }).setZone(userTz);
              const end = DateTime.fromISO(item.endAt, { zone: "utc" }).setZone(userTz);

              return (
                <article key={item.id}>
                  <button className="booking-main" onClick={() => openInSchedule(item)}>
                    <div className="datebox">
  <b>{start.toFormat("dd")}</b>
  <span>{MONTH_LABELS[start.month - 1]}</span>
</div>
                    <div className="grow">
                      <h3>
                        {item.title}
                        {item.seriesId && <span className="series-badge">Щотижнева серія</span>}
                      </h3>
                      <p>{item.room.name} · {item.room.floor} поверх</p>
                      <small>
  {WEEKDAY_LABELS[start.weekday - 1]}, {start.toFormat("dd.MM")} · {start.toFormat("HH:mm")}–{end.toFormat("HH:mm")} · {userTz}
</small>
                    </div>
                    <span className="open-arrow" aria-hidden="true">→</span>
                  </button>
                  {type === "upcoming" && (
                    <button className="danger" onClick={() => setCancelTarget(item)}>Скасувати</button>
                  )}
                </article>
              );
            })}
          </div>

          {type === "past" && items.length < total && (
            <div className="load-more">
              <button className="ghost" disabled={loadingMore} onClick={() => requestPage(page + 1, true)}>
                {loadingMore ? "Завантаження…" : `Завантажити ще (${items.length}/${total})`}
              </button>
            </div>
          )}
        </>
      )}

      {cancelTarget && (
        <div className="modal-backdrop" onMouseDown={() => !cancelling && setCancelTarget(null)}>
          <div
            className="modal cancel-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-dialog-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div>
              <span className="eyebrow">СКАСУВАННЯ</span>
              <h2 id="cancel-dialog-title">Скасувати бронювання?</h2>
              <p className="muted">{cancelTarget.title}</p>
            </div>

            <div className="cancel-options">
              <button className="danger" disabled={cancelling} onClick={() => void cancel("single")}>Лише цю зустріч</button>
              {cancelTarget.seriesId && (
                <button className="danger strong-danger" disabled={cancelling} onClick={() => void cancel("series")}>Усю майбутню серію</button>
              )}
              <button className="ghost" disabled={cancelling} onClick={() => setCancelTarget(null)}>Не скасовувати</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
