import { spawn } from "node:child_process";

const target = process.argv[2];
const rest = process.argv.slice(3).filter((arg) => arg !== "--i-understand-production");
const wantsProductionAck = process.argv.includes("--i-understand-production");

if (target !== "test" && target !== "production") {
  console.error(
    "Refusing ambiguous database command.\n" +
      "Use: npm run db:migrate:test\n" +
      "Or:  npm run db:migrate:production",
  );
  process.exit(1);
}

if (target === "production" && !wantsProductionAck) {
  console.error(
    "Refusing production database command without --i-understand-production.",
  );
  process.exit(1);
}

const env = {
  ...process.env,
  SPARELINK_DB_TARGET: target,
  ...(target === "production"
    ? { SPARELINK_ALLOW_PRODUCTION_DB: "YES" }
    : {}),
};

const child = spawn("npx", ["drizzle-kit", ...rest], {
  stdio: "inherit",
  shell: true,
  env,
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
