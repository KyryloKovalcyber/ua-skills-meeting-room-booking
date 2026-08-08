import { z } from "zod";

const schema = z.object({
  SESSION_COOKIE_NAME: z.string().default("meeting_session"),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(14),
  APP_URL: z.string().url().default("http://localhost:3000"),
  EMAIL_VERIFICATION_TTL_MINUTES: z.coerce.number().int().min(5).max(1440).default(30),
  NOTIFY_BEFORE_MINUTES: z.coerce.number().int().min(1).max(120).default(10),
});

export const env = schema.parse({
  SESSION_COOKIE_NAME: process.env.SESSION_COOKIE_NAME,
  SESSION_TTL_DAYS: process.env.SESSION_TTL_DAYS,
  APP_URL: process.env.APP_URL,
  EMAIL_VERIFICATION_TTL_MINUTES: process.env.EMAIL_VERIFICATION_TTL_MINUTES,
  NOTIFY_BEFORE_MINUTES: process.env.NOTIFY_BEFORE_MINUTES,
});
