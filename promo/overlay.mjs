// Renders overlay.html frame by frame with a transparent background → out/fg/000000.png …
// Usage: node overlay.mjs            all frames
//        node overlay.mjs 1.5 6 12   single stills at those seconds → out/stills/
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { openBrowser } from "./capture.mjs";
import { FPS, DURATION, W, H } from "./timeline.mjs";

const stills = process.argv.slice(2).map(Number);
const browser = await openBrowser();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.goto(pathToFileURL(resolve("overlay.html")).href);
await page.waitForFunction(() => window.ready === true, null, { timeout: 30000 });

if (stills.length) {
  mkdirSync("out/stills", { recursive: true });
  for (const t of stills) {
    await page.evaluate((s) => window.seek(s), t);
    await page.screenshot({ path: `out/stills/fg-${t.toFixed(2)}.png`, omitBackground: true });
  }
} else {
  mkdirSync("out/fg", { recursive: true });
  const frames = Math.round(DURATION * FPS);
  for (let f = 0; f < frames; f++) {
    await page.evaluate((s) => window.seek(s), f / FPS);
    await page.screenshot({ path: `out/fg/${String(f).padStart(6, "0")}.png`, omitBackground: true });
    if (f % 150 === 0) console.log(`fg ${f}/${frames}`);
  }
}
await browser.close();
console.log("overlay done");
