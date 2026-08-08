"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type FieldErrors = Record<string, string>;

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<FieldErrors>({});

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setFields({});

    try {
      const form = new FormData(event.currentTarget);
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(Object.fromEntries(form)),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error?.message ?? "Не вдалося виконати запит.");
        setFields(data.error?.fields ?? {});
        return;
      }

      router.push("/schedule");
      router.refresh();
    } catch {
      setError("Сервер недоступний. Спробуйте ще раз.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="auth-card" onSubmit={submit} noValidate>
      <div>
        <span className="eyebrow">ROOMLY</span>
        <h1>{mode === "login" ? "Вхід" : "Створити акаунт"}</h1>
        <p className="muted">Керуйте бронюваннями переговорних без зайвих листувань.</p>
      </div>

      {mode === "register" && (
        <label>
          Ім’я
          <input name="name" required autoComplete="name" aria-invalid={Boolean(fields.name)} />
          {fields.name && <small className="field-error">{fields.name}</small>}
        </label>
      )}

      <label>
        Email
        <input name="email" type="email" required autoComplete="email" aria-invalid={Boolean(fields.email)} />
        {fields.email && <small className="field-error">{fields.email}</small>}
      </label>

      <label>
        Пароль
        <input
          name="password"
          type="password"
          required
          minLength={mode === "register" ? 8 : 1}
          maxLength={72}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          aria-invalid={Boolean(fields.password)}
        />
        {fields.password && <small className="field-error">{fields.password}</small>}
      </label>

      {error && <p className="form-error" role="alert">{error}</p>}
      <button disabled={busy}>{busy ? "Зачекайте…" : mode === "login" ? "Увійти" : "Зареєструватися"}</button>

      <Link href={mode === "login" ? "/register" : "/login"}>
        {mode === "login" ? "Немає акаунта? Зареєструватися" : "Уже є акаунт? Увійти"}
      </Link>

      {mode === "login" && <small className="demo">Демо: alice@example.com / Password123</small>}
    </form>
  );
}
