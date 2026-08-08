import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import { resolve } from "node:path";

export default function globalSetup() {
  const databaseUrl = process.env.TEST_DATABASE_URL ?? "file:./test.db";
  process.env.DATABASE_URL = databaseUrl;

  const dbPath = resolve(process.cwd(), "prisma", "test.db");
  for (const suffix of ["", "-journal", "-shm", "-wal"]) {
    rmSync(`${dbPath}${suffix}`, { force: true });
  }

  execSync("npx prisma migrate deploy", {
    cwd: process.cwd(),
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
    },
  });
}
