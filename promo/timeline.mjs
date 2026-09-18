// Shared timing for the background and overlay passes.
export const W = 1080;
export const H = 1350;
export const FPS = 30;
export const DURATION = 30;

// Scene windows in seconds
export const SCENES = {
  intro: [0, 4.2],
  chat: [4.2, 8.6],
  notes: [8.6, 13.0],
  calendar: [13.0, 17.4],
  diary: [17.4, 21.8],
  purr: [21.8, 26.2],
  outro: [26.2, 30],
};

// [time, section progress] — 0 page, 1 bubble, 2 shield, 3 planet, 4 cat, 5 upload.
// Each morph runs across the cut between two scenes.
export const SHAPE_TIMELINE = [
  [0, 0], [3.6, 0], [4.8, 1],
  [8.0, 1], [9.2, 2],
  [12.4, 2], [13.6, 3],
  [21.2, 3], [22.4, 4],
  [25.6, 4], [26.6, 4.5],   // outro: hold the mid-morph burst as a scattered cloud behind the logo
];
