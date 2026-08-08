"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BookingNotifications } from "@/components/BookingNotifications";

export function AppShell({
  user,
  children,
}: {
  user: { name: string; email: string; emailVerified: boolean };
  children: ReactNode;
}) {
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState("");

  async function resendVerification() {
    setSending(true);
    setVerificationMessage("");

    try {
      const response = await fetch("/api/auth/verification/request", { method: "POST" });
      const data = await response.json();

      if (!response.ok) {
        setVerificationMessage(data.error?.message ?? "Не вдалося створити посилання.");
        return;
      }

      if (data.alreadyVerified) {
        router.refresh();
        return;
      }

      setVerificationMessage("Нове посилання виведено в terminal/server log.");
    } catch {
      setVerificationMessage("Сервер недоступний.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <header className="topbar">
        <Link className="brand" href="/schedule"><span>R</span>Roomly</Link>
        <nav aria-label="Основна навігація">
          <Link href="/schedule">Розклад</Link>
          <Link href="/my-bookings">Мої бронювання</Link>
        </nav>
        <div className="user">
          <div><strong>{user.name}</strong><small>{user.email}</small></div>
          <button
            className="ghost"
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              router.push("/login");
              router.refresh();
            }}
          >
            Вийти
          </button>
        </div>
      </header>

      {!user.emailVerified && (
        <div className="verification-banner" role="status">
          <div>
            <strong>Email не підтверджено.</strong>
            <span> До підтвердження створювати бронювання не можна.</span>
            {verificationMessage && <small>{verificationMessage}</small>}
          </div>
          <button className="ghost" disabled={sending} onClick={() => void resendVerification()}>
            {sending ? "Створюємо…" : "Нове посилання"}
          </button>
        </div>
      )}

      {children}
      <BookingNotifications />
    </>
  );
}
