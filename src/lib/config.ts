function intEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) ? value : fallback;
}

export const OFFICE_TIME_ZONE = process.env.OFFICE_TIME_ZONE || "Europe/Kyiv";
export const OFFICE_OPEN_HOUR = intEnv("OFFICE_OPEN_HOUR", 9);
export const OFFICE_CLOSE_HOUR = intEnv("OFFICE_CLOSE_HOUR", 19);
export const SLOT_MINUTES = 30;
export const MAX_BOOKING_MINUTES = 240;
