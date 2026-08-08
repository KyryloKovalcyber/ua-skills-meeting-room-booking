import { copyFileSync, existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

if (!existsSync(".env")) {
  copyFileSync(".env.example", ".env");
  console.log("Created .env from .env.example");
} else {
  const existing = readFileSync(".env", "utf8");

  if (/DATABASE_URL\s*=\s*["']?postgres/i.test(existing)) {
    copyFileSync(".env", ".env.postgres-backup");
    copyFileSync(".env.example", ".env");
    console.log("Replaced old PostgreSQL .env with SQLite config");
  }
}

function run(command) {
  const result = spawnSync(command, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run("npx prisma migrate deploy");
run("npx prisma db seed");

console.log("Setup complete. Run: npm run dev");