# Architecture notes

## Shape

The project is a modular Next.js monolith:

- `src/app` — pages and HTTP Route Handlers;
- `src/components` — client UI;
- `src/modules/bookings` — booking validation/domain rules;
- `src/lib` — sessions, Prisma, HTTP errors and shared config;
- `prisma` — data model, migrations and seed.

Route Handlers validate/authenticate requests and delegate domain rules instead of relying on client-side checks.

## Booking interval model

Intervals are `[start, end)`. The overlap predicate is:

```text
aStart < bEnd && aEnd > bStart
```

This allows adjacent bookings while rejecting every real overlap.

## Race protection

Every active booking claims one `BookingSlot` row for every 30-minute segment. `BookingSlot` has a unique `(roomId, startAt)` index. Since all bookings are aligned to 30-minute boundaries, any two overlapping bookings share at least one slot key. The database therefore becomes the final concurrency guard.

Cancellation removes slot claims and soft-cancels the booking using `cancelledAt`.

## Time zones

The browser's IANA time zone is presentation-only. Office slots originate in `Europe/Kyiv`, convert to UTC for transport/storage, and then convert to the browser time zone for display. Server validation always converts incoming UTC dates back to `Europe/Kyiv` before enforcing 09:00–19:00.

## Sessions

The browser receives a random 256-bit token in an HttpOnly cookie. Only a SHA-256 hash of that token is stored in the database. Sessions have an expiry time and can be deleted on logout.

## Why SQLite

SQLite is enough for the tournament scope, is explicitly supported by the specification, keeps local startup simple, and still gives database-enforced race protection through the unique slot-claim index.
