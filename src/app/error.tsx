"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <span className="eyebrow">ROOMLY</span>
        <h1>Щось пішло не так</h1>
        <p className="muted">Не вдалося завантажити сторінку. Спробуйте повторити дію.</p>
        <button onClick={reset}>Спробувати ще раз</button>
      </section>
    </main>
  );
}
