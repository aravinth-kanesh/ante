// Vendor the MediaPipe vision assets so the app serves them from its own origin
// (no runtime CDN dependency). Copies the WASM runtime out of the installed
// package and downloads the face and pose models. Run with `npm run setup` after
// `npm install`. The output lives in public/mediapipe/ and is gitignored.

import { cp, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const wasmSrc = join(root, "node_modules", "@mediapipe", "tasks-vision", "wasm");
const outDir = join(root, "public", "mediapipe");

const MODELS = {
  "face_landmarker.task":
    "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
  "pose_landmarker_lite.task":
    "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
};

async function main() {
  if (!existsSync(wasmSrc)) {
    throw new Error(`WASM source not found at ${wasmSrc}. Run npm install first.`);
  }
  await mkdir(outDir, { recursive: true });

  await cp(wasmSrc, join(outDir, "wasm"), { recursive: true });
  console.log("Copied MediaPipe WASM runtime.");

  for (const [name, url] of Object.entries(MODELS)) {
    const dest = join(outDir, name);
    process.stdout.write(`Downloading ${name}... `);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`failed (${res.status} ${res.statusText})`);
    await writeFile(dest, Buffer.from(await res.arrayBuffer()));
    console.log("done.");
  }
  console.log("MediaPipe assets ready in public/mediapipe/.");
}

main().catch((err) => {
  console.error(`\nCould not fetch MediaPipe assets: ${err.message}`);
  process.exit(1);
});
