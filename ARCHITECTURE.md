# Roomly architecture

Roomly is a modular Next.js App Router monolith with server-side Route Handlers, Prisma ORM and SQLite.

## Boundaries

- `src/app` — pages and HTTP endpoints;
- `src/components` — client UI;
- `src/lib` — infrastructure: auth, env, Prisma, verification, HTTP errors;
- `src/modules/bookings` — booking validation and slot calculations;
- `src/modules/notifications` — end-of-booking notification generation;
- `prisma` — schema, migrations and deterministic seed;
- `tests` — unit and DB-backed integration tests.

Route Handlers authenticate/validate requests and keep domain rules on the server instead of trusting the browser.

## Authentication

A random 256-bit session token is stored only in an HttpOnly cookie. The database stores its SHA-256 hash. Session expiry is checked server-side on authenticated requests.

## Email verification

A registration creates a random verification token. Only the SHA-256 hash is persisted. Tokens are single-use and expire.

In development, the verification link is printed to the server log. No SMTP dependency is required for the competition workflow.

`POST /api/bookings` rejects an authenticated but unverified user with HTTP 403, so the rule cannot be bypassed by calling the API directly.

## Booking time model

All persisted booking timestamps are UTC.

Server validation converts timestamps to `Europe/Kyiv` before checking:

- future-only booking;
- 30-minute alignment;
- 30–240 minute duration;
- same office day;
- office hours.

Intervals are half-open `[start, end)`. The overlap predicate is:

```text
aStart < bEnd && aEnd > bStart
```

This allows adjacent bookings while rejecting real overlap.

## Recurring bookings

A recurring request stores a shared `seriesId` on every occurrence.

Occurrences are produced by adding calendar weeks in the office timezone and converting every occurrence back to UTC. This preserves the intended local meeting time across DST transitions.

The full series is created inside one Prisma interactive transaction. If one occurrence fails, the entire transaction is rolled back.

## Race protection

Every active booking claims one `BookingSlot` row for every 30-minute segment. `BookingSlot` has a unique `(roomId, startAt)` constraint.

Because all bookings are aligned to 30-minute boundaries, overlapping bookings must share at least one slot key. The database therefore acts as the final concurrency guard even if two requests pass the friendly preflight overlap check at the same time.

## Cancellation

Bookings are soft-cancelled with `cancelledAt`; their `BookingSlot` claims are deleted in the same transaction so the room becomes available again.

For recurring bookings, the API supports:

- cancelling one occurrence;
- cancelling all active future occurrences in the series.

Ownership is enforced server-side before either operation.

## Notifications

The authenticated client polls `/api/notifications`.

A booking is eligible when:

- it belongs to the current user;
- it has already started;
- it ends within `NOTIFY_BEFORE_MINUTES`;
- it is not cancelled;
- another non-cancelled booking in the same room starts exactly at its end time.

Exactly-once notification persistence is enforced by a unique `(userId, currentBookingId, type)` constraint.

Cancellation deletes notification rows involving the cancelled booking so a stale not-yet-seen message cannot survive the cancellation flow.

## Testing

Vitest runs DB-backed tests against a dedicated SQLite `prisma/test.db` recreated from migrations before the suite.

Coverage includes:

- half-open interval semantics;
- slot claims;
- server time validation;
- DST-safe weekly recurrence generation;
- booking create/conflict/cancel API flows;
- unverified-user blocking;
- recurring atomicity;
- series cancellation;
- concurrency race protection;
- verification token hashing/expiry/single-use semantics;
- notification exactly-once and cancellation suppression.

## CI

GitHub Actions executes the documented clean-machine path on Node.js 24:

```text
npm ci
npm run setup:all
npm run check
```

This verifies setup, migrations, seed, tests, TypeScript and the production build on every push to `main` and on pull requests.
