import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Keeps Prisma commands usable on a completely clean machine before `.env` exists.
    url: process.env.DATABASE_URL ?? "file:./dev.db",
  },
});
