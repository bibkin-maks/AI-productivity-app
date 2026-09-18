// ASCII orb: a grid of characters recomputed every frame from a field function.
// Nothing moves or rotates — "spin" is a phase shift in the longitude term, so the
// sphere reads as turning while every glyph stays in its cell.

export const PRESETS = {
  calm:   { bands: 2.2, latFreq: 1.4, waveAmp: 0.10, waves: 1, twist: 0.25, speed: 0.55, density: 0.42, glow: 0.35, hue: 28, jitter: 0.03 },
  pulse:  { bands: 3.0, latFreq: 1.8, waveAmp: 0.20, waves: 2, twist: 0.35, speed: 1.00, density: 0.55, glow: 0.55, hue: 24, jitter: 0.05, breathe: 0.35 },
  ripple: { bands: 1.6, latFreq: 1.0, waveAmp: 0.36, waves: 4, twist: 0.20, speed: 1.10, density: 0.50, glow: 0.50, hue: 330, jitter: 0.04 },
  swirl:  { bands: 4.5, latFreq: 2.6, waveAmp: 0.14, waves: 1, twist: 0.95, speed: 1.40, density: 0.60, glow: 0.45, hue: 200, jitter: 0.06 },
  burst:  { bands: 2.0, latFreq: 1.2, waveAmp: 0.46, waves: 3, twist: 0.50, speed: 2.00, density: 0.70, glow: 0.85, hue: 12, jitter: 0.12, shock: 1 },
  scan:   { bands: 1.2, latFreq: 6.0, waveAmp: 0.16, waves: 1, twist: 0.15, speed: 1.20, density: 0.50, glow: 0.40, hue: 46, jitter: 0.03, scan: 1 },
  bloom:  { bands: 2.6, latFreq: 1.6, waveAmp: 0.24, waves: 3, twist: 0.40, speed: 0.80, density: 0.75, glow: 0.70, hue: 300, jitter: 0.05, bloom: 1 },
};

// Sparse → dense character ramps; density picks the ramp and how hard we push intensity into it
const RAMPS = [
  " ..·:-=",
  " .·:-=+*",
  " .·:-=+*oO#",
  " .·:;-=+*oO0#%@8&WM",
  " .'`^\",:;Il!i><~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$",
];

const CELL_ASPECT = 0.6; // monospace cell is ~0.6 as wide as it is tall

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a, b, t) => a + (b - a) * t;

// cheap deterministic noise, stable per cell
function hash(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

export function specToParams(spec) {
  const base = PRESETS[spec?.preset] || PRESETS.calm;
  if (!spec) return { ...base };
  return {
    ...base,
    waves: spec.waves ?? base.waves,
    speed: spec.speed ?? base.speed,
    twist: spec.twist ?? base.twist,
    density: spec.density ?? base.density,
    glow: spec.glow ?? base.glow,
    hue: spec.hue ?? base.hue,
  };
}

// progress 0→1 through a reaction; returns params blended from idle → reaction → idle
export function blendParams(idle, reaction, progress) {
  if (!reaction) return idle;
  const envelope = Math.sin(Math.PI * clamp(progress, 0, 1)) ** 0.7;
  const mix = (key) => lerp(idle[key] ?? 0, reaction[key] ?? 0, envelope);
  return {
    ...reaction,
    bands: mix("bands"),
    latFreq: mix("latFreq"),
    waveAmp: mix("waveAmp") + envelope * 0.18,
    waves: Math.round(mix("waves")),
    twist: mix("twist"),
    speed: mix("speed") * (1 + envelope * 0.6),
    density: mix("density"),
    glow: clamp(mix("glow") + envelope * 0.35, 0, 1.3),
    hue: mix("hue"),
    jitter: mix("jitter") + envelope * 0.05,
    shock: reaction.shock ? envelope : 0,
    ringRadius: progress, // expanding ring for burst/ripple reactions
    envelope,
  };
}

/**
 * Build one frame.
 * @param {number} cols  grid width in characters
 * @param {number} rows  grid height in characters
 * @param {number} time  seconds
 * @param {object} p     params (see PRESETS)
 * @returns {string} rows joined with \n
 */
export function buildFrame(cols, rows, time, p) {
  const ramp = RAMPS[clamp(Math.round((p.density ?? 0.5) * (RAMPS.length - 1)), 0, RAMPS.length - 1)];
  const last = ramp.length - 1;
  const cx = (cols - 1) / 2;
  const cy = (rows - 1) / 2;
  const radius = Math.min(cols * CELL_ASPECT, rows) / 2 - 0.6;
  const t = time * (p.speed ?? 1);
  const breathe = p.breathe ? 1 + Math.sin(time * 2.4) * 0.05 * p.breathe : 1;
  const out = [];

  for (let row = 0; row < rows; row++) {
    let line = "";
    for (let col = 0; col < cols; col++) {
      const dx = (col - cx) * CELL_ASPECT;
      const dy = row - cy;
      const r = Math.hypot(dx, dy) / (radius * breathe);

      if (r > 1) {
        // sparse dust around the orb, denser right after a reaction
        const sparkle = hash(col * 3.1 + Math.floor(time * 6), row * 7.3);
        const reach = 1 + 0.35 * (p.envelope ?? 0);
        const near = clamp(1 - (r - 1) / 0.55, 0, 1);
        line += sparkle > 0.995 - near * 0.02 * reach ? "·" : " ";
        continue;
      }

      // project the cell onto a sphere
      const z = Math.sqrt(Math.max(0, 1 - r * r));
      const lon = Math.atan2(dx / (radius * breathe), z) + t * (p.twist ?? 0.3) * 2.2;
      const lat = Math.asin(clamp(dy / (radius * breathe), -1, 1));

      // banded surface + concentric waves + a light from the upper left
      let value = 0.5 + 0.5 * Math.sin(lon * (p.bands ?? 2) + Math.sin(lat * (p.latFreq ?? 1.5) + t * 0.7));
      if (p.waves) value += Math.sin(r * Math.PI * p.waves - t * 2.2) * (p.waveAmp ?? 0.2);
      if (p.scan) value += Math.sin((dy / radius) * 6 - t * 3.4) * 0.22;
      if (p.bloom) value += (1 - r) * 0.25;

      const light = clamp(0.45 + z * 0.55 + (-dx - dy) * 0.03, 0, 1);
      value = value * 0.6 + light * 0.4;

      // expanding shock ring during a burst reaction
      if (p.shock) {
        const ring = 1 - Math.min(1, Math.abs(r - (p.ringRadius ?? 0)) * 6);
        value += ring * 0.7 * p.shock;
      }

      value += (hash(col, row + Math.floor(t * 8)) - 0.5) * (p.jitter ?? 0.04);
      value *= clamp((1 - r) * 4.5, 0, 1) * 0.55 + 0.45; // soften the rim

      line += ramp[clamp(Math.round(clamp(value, 0, 1) ** 1.15 * last), 0, last)];
    }
    out.push(line);
  }
  return out.join("\n");
}
