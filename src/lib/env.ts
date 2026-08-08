import { z } from "zod";

const schema = z.object({
  SESSION_COOKIE_NAME: z.string().default("meeting_session"),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(14),
});

export const env = schema.parse({
  SESSION_COOKIE_NAME: process.env.SESSION_COOKIE_NAME,
  SESSION_TTL_DAYS: process.env.SESSION_TTL_DAYS,
});
