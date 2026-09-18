// Helpers for note previews, stats and exports. Notes are stored as HTML from the editor.

const parser = typeof DOMParser !== "undefined" ? new DOMParser() : null;

export function htmlToText(html) {
  if (!html) return "";
  if (!parser) return html.replace(/<[^>]*>/g, " ");
  const doc = parser.parseFromString(html, "text/html");
  // keep block boundaries readable in previews
  doc.querySelectorAll("p, h1, h2, h3, li, td, th, br").forEach((el) => el.append(" "));
  return (doc.body.textContent || "").replace(/\s+/g, " ").trim();
}

export function preview(html, max = 140) {
  const text = htmlToText(html);
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

export function countWords(text) {
  const words = text.trim().match(/\S+/g);
  return words ? words.length : 0;
}

export function readingTime(words) {
  return Math.max(1, Math.round(words / 220));
}

export function relativeTime(value, now = new Date()) {
  if (!value) return "";
  const date = new Date(value);
  const seconds = Math.round((now - date) / 1000);
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString([], { day: "numeric", month: "short", year: date.getFullYear() === now.getFullYear() ? undefined : "numeric" });
}

export const displayTitle = (note) => (note?.title || "").trim() || "Untitled";

export function hasTable(html) {
  return Boolean(html && html.includes("<table"));
}

// First table in the note as CSV (quoted so commas and quotes survive)
export function firstTableCsv(html) {
  if (!parser || !html) return null;
  const table = parser.parseFromString(html, "text/html").querySelector("table");
  if (!table) return null;
  const quote = (s) => `"${s.replace(/"/g, '""')}"`;
  return [...table.querySelectorAll("tr")]
    .map((row) => [...row.querySelectorAll("th, td")].map((cell) => quote(cell.textContent.trim())).join(","))
    .join("\n");
}

export function downloadText(filename, text, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const safeFilename = (name) => (name || "note").replace(/[\\/:*?"<>|]+/g, "-").slice(0, 80);
