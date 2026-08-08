"use client";

import { useEffect, useState } from "react";

type NotificationItem = {
  id: string;
  message: string;
};

export function BookingNotifications() {
  const [items, setItems] = useState<NotificationItem[]>([]);

  useEffect(() => {
    let active = true;

    async function poll() {
      try {
        const response = await fetch("/api/notifications", { cache: "no-store" });
        if (!response.ok) return;

        const data = await response.json();
        const notifications: NotificationItem[] = data.notifications ?? [];
        if (!active || notifications.length === 0) return;

        setItems((current) => {
          const known = new Set(current.map((item) => item.id));
          return [...current, ...notifications.filter((item) => !known.has(item.id))].slice(-4);
        });
      } catch {
        // Notifications are intentionally non-blocking for the main booking flow.
      }
    }

    void poll();
    const timer = window.setInterval(() => void poll(), 30_000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  async function dismiss(id: string) {
    setItems((current) => current.filter((item) => item.id !== id));
    await fetch(`/api/notifications/${id}`, { method: "PATCH" }).catch(() => undefined);
  }

  if (items.length === 0) return null;

  return (
    <div className="notification-stack" aria-live="polite" aria-label="Сповіщення">
      {items.map((item) => (
        <div className="notification-toast" key={item.id}>
          <span className="notification-icon" aria-hidden="true">🔔</span>
          <p>{item.message}</p>
          <button
            className="notification-close"
            type="button"
            aria-label="Закрити сповіщення"
            onClick={() => void dismiss(item.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
