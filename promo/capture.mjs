// Screenshots of the running app (docker compose up) as the demo user.
// Usage: node capture.mjs [route ...]   → out/shots/<name>.png
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const APP = process.env.APP_URL || "http://localhost:5173";
const API = process.env.API_URL || "http://localhost:8000";
const CHROME = join(homedir(), "AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe");
const token = readFileSync("out/demo-token.txt", "utf8").trim();

const PAGES = {
  landing: { path: "/", auth: false },
  login: { path: "/login", auth: false },
  diary: { path: "/diary" },
  chat: { path: "/chat" },
  notes: { path: "/notes" },
  calendar: { path: "/calendar" },
  purr: { path: "/purr-assist" },
};

export async function openBrowser() {
  return chromium.launch({ executablePath: CHROME, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
}

export async function demoContext(browser, { width = 390, height = 844, scale = 3, auth = true, mobile = true } = {}) {
  const user = await (await fetch(`${API}/me`, { headers: { authorization: `Bearer ${token}` } })).json();
  const context = await browser.newContext({
    viewport: { width, height }, deviceScaleFactor: scale, isMobile: mobile, hasTouch: mobile,
    colorScheme: "dark", reducedMotion: "no-preference",
  });
  if (auth) {
    await context.addInitScript(([t, u]) => {
      localStorage.setItem("token", t);
      localStorage.setItem("user", u);
    }, [token, JSON.stringify(user)]);
  }
  return context;
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}`) {
  const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(PAGES);
  mkdirSync("out/shots", { recursive: true });
  const browser = await openBrowser();
  for (const name of names) {
    const { path, auth = true } = PAGES[name];
    const context = await demoContext(browser, { auth, height: 800 });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(APP + path, { waitUntil: "networkidle" });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `out/shots/${name}.png` });
    console.log(name, page.url(), errors.length ? `errors: ${errors.join(" | ")}` : "ok");
    await context.close();
  }
  await browser.close();
}
