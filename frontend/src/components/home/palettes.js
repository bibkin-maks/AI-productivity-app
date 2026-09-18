// Color versions for the home page particles.
// colors: [primary, secondary, highlight]
// mode:   0 = drifting noise patches, 1 = vertical gradient, 2 = depth (far = primary, near = highlight)
// accent: CSS --home-accent while this palette is active (small UI highlights)

export const PALETTES = {
  ember: {
    label: "Ember",
    colors: ["#3b8dff", "#ffb547", "#fff4e0"],
    mode: 0,
    accent: "#ffb547",
  },
  aurora: {
    label: "Aurora",
    colors: ["#7c5cff", "#2ee6c5", "#e6fff8"],
    mode: 1,
    accent: "#2ee6c5",
  },
  nebula: {
    label: "Nebula",
    colors: ["#6d28ff", "#ff4fa3", "#ffe0f0"],
    mode: 0,
    accent: "#ff4fa3",
  },
  sunset: {
    label: "Sunset",
    colors: ["#ff3d5e", "#ffb13d", "#fff3dc"],
    mode: 1,
    accent: "#ffb13d",
  },
  glacier: {
    label: "Glacier",
    colors: ["#1e4dff", "#6fd3ff", "#ffffff"],
    mode: 2,
    accent: "#6fd3ff",
  },
  mono: {
    label: "Mono",
    colors: ["#4b5563", "#d1d5db", "#ffffff"],
    mode: 2,
    accent: "#ffffff",
  },
};

export const DEFAULT_PALETTE = "ember";
export const PALETTE_STORAGE_KEY = "home-palette";

// The palette picked on the home page, so other public pages keep the same colours
export function savedPalette() {
  try {
    const stored = localStorage.getItem(PALETTE_STORAGE_KEY);
    if (stored && PALETTES[stored]) return stored;
  } catch {
    // storage unavailable: fall back to the default
  }
  return DEFAULT_PALETTE;
}
