#!/usr/bin/env bun
import { spawn } from "bun";
import { createWriteStream } from "fs";

const SERVICE = process.argv[2] ?? "review-api-dev";
const LOG_FILE = "devlogs.log";

const PROJECT = process.env.GCP_PROJECT_ID;
const REGION = process.env.GCP_REGION;

if (!PROJECT || !REGION) {
  console.error("Missing GCP_PROJECT_ID or GCP_REGION — load .env.dev first");
  process.exit(1);
}

const logStream = createWriteStream(LOG_FILE, { flags: "a" });

console.log(`Streaming logs for ${SERVICE} (${PROJECT}/${REGION}) → ${LOG_FILE} (tee)`);
console.log("Press Ctrl+C to stop.\n");

const proc = spawn(
  [
    "gcloud",
    "run",
    "services",
    "logs",
    "tail",
    SERVICE,
    `--region=${REGION}`,
    `--project=${PROJECT}`,
  ],
  { stdout: "pipe", stderr: "pipe" }
);

async function pipe(stream: ReadableStream<Uint8Array>) {
  const decoder = new TextDecoder();
  for await (const chunk of stream) {
    const text = decoder.decode(chunk);
    process.stdout.write(text);
    logStream.write(text);
  }
}

await Promise.all([pipe(proc.stdout), pipe(proc.stderr)]);
logStream.end();
