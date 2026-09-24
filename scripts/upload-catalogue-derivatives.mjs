import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const spawnAsync = (command, args, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      windowsHide: true,
      ...options,
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("error", reject);

    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        const error = new Error(`Process exited with code ${code}`);
        error.stdout = stdout;
        error.stderr = stderr;
        error.code = code;
        reject(error);
      }
    });
  });

const ROOT = process.cwd();

const DIRS = [
  {
    dir: join(ROOT, "data/source-catalogue/images/thumbs"),
    prefix: "thumbs",
  },
  {
    dir: join(ROOT, "data/source-catalogue/images/medium"),
    prefix: "medium",
  },
];

const BUCKET = "sparelink-india-assets";
const CONCURRENCY = 6;

const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const LIMIT = limitArg ? Number(limitArg.split("=")[1]) : null;

function collectFiles(dir, prefix) {
  return readdirSync(dir, { recursive: true })
    .filter(
      (file) =>
        typeof file === "string" &&
        file.toLowerCase().endsWith(".webp")
    )
    .map((file) => ({
      file: join(dir, file),
      key: `catalogue-images/${prefix}/${file.replace(/\\/g, "/")}`,
    }));
}

let files = DIRS.flatMap(({ dir, prefix }) =>
  collectFiles(dir, prefix)
);

if (LIMIT && Number.isFinite(LIMIT) && LIMIT > 0) {
  files = files.slice(0, LIMIT);
}

console.log(`Total WebP files: ${files.length}`);
console.log(`Concurrency: ${CONCURRENCY}`);
console.log("");

let uploaded = 0;
let failed = 0;
const failures = [];

async function upload(item) {
  const destination = `${BUCKET}/${item.key}`;

  const args = [
    "wrangler",
    "r2",
    "object",
    "put",
    destination,
    "--file",
    item.file,
    "--remote",
    "--content-type",
    "image/webp",
  ];

  try {
    await spawnAsync("npx.cmd", args);

    uploaded++;
  } catch (error) {
    failed++;

    const message =
      error?.stderr?.trim() ||
      error?.stdout?.trim() ||
      error?.message ||
      "Unknown error";

    failures.push({
      key: item.key,
      error: message,
    });

    console.log(`FAILED: ${item.key}`);
    console.log(`  ${message.split("\n")[0]}`);
  }

  const processed = uploaded + failed;

  if (processed % 10 === 0 || processed === files.length) {
    console.log(
      `Progress: ${processed}/${files.length} | Uploaded: ${uploaded} | Failed: ${failed}`
    );
  }
}

async function worker(queue) {
  while (queue.length > 0) {
    const item = queue.shift();
    if (!item) return;

    await upload(item);
  }
}

const queue = [...files];

await Promise.all(
  Array.from(
    { length: Math.min(CONCURRENCY, files.length) },
    () => worker(queue)
  )
);

console.log("");
console.log("========================================");
console.log("UPLOAD COMPLETE");
console.log("========================================");
console.log(`Total:    ${files.length}`);
console.log(`Uploaded: ${uploaded}`);
console.log(`Failed:   ${failed}`);
console.log("========================================");

if (failures.length > 0) {
  console.log("");
  console.log("First 20 failures:");

  for (const failure of failures.slice(0, 20)) {
    console.log(`- ${failure.key}`);
    console.log(`  ${failure.error.split("\n")[0]}`);
  }

  process.exitCode = 1;
}
