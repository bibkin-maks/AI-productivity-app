// Frame-exact footage of the landing page particle field (page text hidden).
// The page's clock is faked, so each frame advances exactly 1/FPS s; scrolling drives the morphs.
// Usage: node background.mjs → out/bg/000000.png …
import { mkdirSync } from "node:fs";
import { openBrowser, demoContext } from "./capture.mjs";
import { FPS, DURATION, SHAPE_TIMELINE, W, H } from "./timeline.mjs";

const APP = process.env.APP_URL || "http://localhost:5173";
mkdirSync("out/bg", { recursive: true });

const browser = await openBrowser();
const context = await demoContext(browser, { width: W, height: H, scale: 1, auth: false, mobile: false });
const page = await context.newPage();
await page.clock.install({ time: new Date("2026-09-18T09:00:00") });
await page.goto(APP + "/", { waitUntil: "networkidle" });

// Hide the page itself, centre every shape, and give each section the same height
await page.addStyleTag({
  content: `
    .home-content, .home-cursor-ring, .home-cursor-dot, .home-palette { visibility: hidden !important; }
    .home-section { min-height: 150vh !important; margin-top: 0 !important; }
    html { scroll-behavior: auto !important; }
  `,
});
const tops = await page.evaluate(() => {
  document.querySelectorAll("[data-shape]").forEach((el) => (el.dataset.side = "center"));
  window.dispatchEvent(new Event("resize"));
  return [...document.querySelectorAll("[data-shape]")].map((el) => {
    const r = el.getBoundingClientRect();
    return { top: r.top + window.scrollY, height: r.height, shape: el.dataset.shape };
  });
});
console.log(tops.map((s) => s.shape).join(" → "));

// Inverse of the page's mapping: progress p (section index + morph fraction) → scrollY
const smoothstepInv = (f) => {
  let lo = 0, hi = 1;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    const s = mid * mid * (3 - 2 * mid);
    s < f ? (lo = mid) : (hi = mid);
  }
  return (lo + hi) / 2;
};
const scrollFor = (p) => {
  const i = Math.min(Math.floor(p), tops.length - 1);
  const f = p - i;
  const local = f <= 0 ? 0.2 : 0.35 + smoothstepInv(f) * 0.65; // smoothstep(local, .35, 1) = f
  return Math.max(0, tops[i].top + local * tops[i].height - H / 2);
};

const progressAt = (t) => {
  let p = SHAPE_TIMELINE[0][1];
  for (let k = 1; k < SHAPE_TIMELINE.length; k++) {
    const [t0, p0] = SHAPE_TIMELINE[k - 1];
    const [t1, p1] = SHAPE_TIMELINE[k];
    if (t >= t1) p = p1;
    else if (t > t0) { const u = (t - t0) / (t1 - t0); p = p0 + (p1 - p0) * u * u * (3 - 2 * u); break; }
  }
  return p;
};

// settle: particles fade in and the scroll follower catches up before frame 0
await page.evaluate((y) => window.scrollTo(0, y), scrollFor(progressAt(0)));
await page.clock.runFor(3000);

const frames = Number(process.env.FRAMES) || Math.round(DURATION * FPS);
const started = Date.now();
for (let f = 0; f < frames; f++) {
  const t = f / FPS;
  await page.evaluate((y) => window.scrollTo(0, y), scrollFor(progressAt(t)));
  await page.clock.runFor(1000 / FPS);
  await page.screenshot({ path: `out/bg/${String(f).padStart(6, "0")}.png` });
  if (f % 60 === 0) console.log(`bg ${f}/${frames}  ${((Date.now() - started) / 1000).toFixed(0)}s`);
}
await browser.close();
console.log("background done");
