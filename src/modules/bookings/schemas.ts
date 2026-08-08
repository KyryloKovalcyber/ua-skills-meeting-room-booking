import { z } from "zod";

export const createBookingSchema = z.object({
  title: z.string().trim().min(1, "Введіть назву.").max(100, "Максимум 100 символів."),
  roomId: z.string().min(1, "Оберіть кімнату."),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
});
