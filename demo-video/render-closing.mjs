import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, "title-cards", "06-contact.html");
const outDir = path.join(__dirname, "out");
const webmTmp = path.join(outDir, "closing-tmp");
const mp4Path = path.join(outDir, "06-contact.mp4");

fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(webmTmp, { recursive: true });

const WIDTH = 1920;
const HEIGHT = 1080;
// Slogan stagger ends ~1.6s; contact fade ends ~2.05s; then hold
const ANIMATION_MS = 2200;
const HOLD_MS = 4000;

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
});

const context = await browser.newContext({
  viewport: { width: WIDTH, height: HEIGHT },
  deviceScaleFactor: 1,
  recordVideo: {
    dir: webmTmp,
    size: { width: WIDTH, height: HEIGHT },
  },
  reducedMotion: "no-preference",
});

const page = await context.newPage();
await page.goto(`file://${htmlPath}`, { waitUntil: "load" });

// Ensure recording is rolling before animations start
await page.waitForTimeout(400);

// Restart the entrance from a clean frame (fonts already cached)
await page.evaluate(() => {
  document.body.classList.remove("is-ready");
});
await page.waitForTimeout(100);
await page.evaluate(async () => {
  try {
    await document.fonts.ready;
  } catch (_) {}
  document.body.classList.add("is-ready");
});

await page.waitForTimeout(ANIMATION_MS + HOLD_MS);
await context.close();
await browser.close();

const webm = fs.readdirSync(webmTmp).find((f) => f.endsWith(".webm"));
if (!webm) {
  console.error("No webm recorded");
  process.exit(1);
}
const webmPath = path.join(webmTmp, webm);

const ff = spawnSync(
  "ffmpeg",
  [
    "-y",
    "-i",
    webmPath,
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    "-an",
    mp4Path,
  ],
  { encoding: "utf8" },
);

if (ff.status !== 0) {
  console.error(ff.stderr);
  process.exit(1);
}

fs.rmSync(webmTmp, { recursive: true, force: true });
console.log(`Wrote ${mp4Path}`);
const stat = fs.statSync(mp4Path);
console.log(`Size: ${(stat.size / 1024 / 1024).toFixed(2)} MB`);
