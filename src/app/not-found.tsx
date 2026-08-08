import Link from "next/link";

export default function NotFound() {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <span className="eyebrow">404</span>
        <h1>Сторінку не знайдено</h1>
        <p className="muted">Перевірте адресу або поверніться до розкладу.</p>
        <Link className="button-link" href="/schedule">До розкладу</Link>
      </section>
    </main>
  );
}
