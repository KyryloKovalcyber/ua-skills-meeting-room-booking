"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function AppShell({
  user,
  children,
}: {
  user: { name: string; email: string };
  children: ReactNode;
}) {
  const router = useRouter();

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
      {children}
    </>
  );
}
