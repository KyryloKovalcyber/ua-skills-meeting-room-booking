"use client";

import { DateTime } from "luxon";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const OFFICE_TZ = "Europe/Kyiv";

type Item = {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  room: { id: string; name: string; floor: number };
};

export function MyBookings() {
  const router = useRouter();
  const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const [type, setType] = useState<"upcoming" | "past">("upcoming");
  const [items, setItems] = useState<Item[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

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

  async function cancel(id: string) {
    if (!window.confirm("Скасувати це бронювання?")) return;

    try {
      const response = await fetch(`/api/bookings/${id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message ?? "Не вдалося скасувати бронювання.");
      await requestPage(1, false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Сервер недоступний.");
    }
  }

  function openInSchedule(item: Item) {
    const week = DateTime.fromISO(item.startAt, { zone: "utc" })
      .setZone(OFFICE_TZ)
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
                    <div className="datebox"><b>{start.toFormat("dd")}</b><span>{start.toFormat("LLL")}</span></div>
                    <div className="grow">
                      <h3>{item.title}</h3>
                      <p>{item.room.name} · {item.room.floor} поверх</p>
                      <small>{start.toFormat("cccc, dd LLLL · HH:mm")}–{end.toFormat("HH:mm")} · {userTz}</small>
                    </div>
                    <span className="open-arrow" aria-hidden="true">→</span>
                  </button>
                  {type === "upcoming" && (
                    <button className="danger" onClick={() => cancel(item.id)}>Скасувати</button>
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
    </main>
  );
}
