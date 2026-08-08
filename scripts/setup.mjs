import { copyFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

if (!existsSync(".env")) {
  copyFileSync(".env.example", ".env");
  console.log("Created .env from .env.example");
}

function run(command) {
  const result = spawnSync(command, {
    stdio: "inherit",
    shell: true,
    env: process.env,
  });

  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run("npx prisma generate");
run("npx prisma migrate deploy");
run("npx prisma db seed");

console.log("Setup complete. Run: npm run dev");
