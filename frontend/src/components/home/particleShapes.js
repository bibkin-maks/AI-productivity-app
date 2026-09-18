// Procedural point clouds for the home page particle morph.
// Every sampler returns a Float32Array of `count * 3` positions centred on the origin
// (roughly 3 units tall), so any shape can morph into any other.

// Deterministic PRNG so shapes look the same on every load
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TAU = Math.PI * 2;

function pointOnSegment(rand, ax, ay, bx, by) {
  const t = rand();
  return [ax + (bx - ax) * t, ay + (by - ay) * t];
}

// Pick a point on a closed polyline, weighted by segment length
function pointOnPath(rand, path, lengths, total) {
  let d = rand() * total;
  for (let i = 0; i < lengths.length; i++) {
    if (d <= lengths[i]) {
      const [ax, ay] = path[i];
      const [bx, by] = path[(i + 1) % path.length];
      const t = d / lengths[i];
      return [ax + (bx - ax) * t, ay + (by - ay) * t];
    }
    d -= lengths[i];
  }
  return path[0];
}

function pathLengths(path) {
  const lengths = path.map(([ax, ay], i) => {
    const [bx, by] = path[(i + 1) % path.length];
    return Math.hypot(bx - ax, by - ay);
  });
  return [lengths, lengths.reduce((s, l) => s + l, 0)];
}

function insidePolygon(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function randomOnSphere(rand, r) {
  const u = rand() * 2 - 1;
  const phi = rand() * TAU;
  const s = Math.sqrt(1 - u * u);
  return [r * s * Math.cos(phi), r * s * Math.sin(phi), r * u];
}

function fill(count, seed, pick) {
  const rand = mulberry32(seed);
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const [x, y, z] = pick(rand);
    out[i * 3] = x;
    out[i * 3 + 1] = y;
    out[i * 3 + 2] = z;
  }
  return out;
}

// A page with a folded corner, text lines, and a second page peeking out behind it
export function samplePage(count) {
  const w = 3.2, h = 4.2, fold = 0.9;
  const L = -w / 2, R = w / 2, T = h / 2, B = -h / 2;
  const outline = [[L, T], [R - fold, T], [R, T - fold], [R, B], [L, B]];
  const [outLens, outTotal] = pathLengths(outline);
  const back = outline.map(([x, y]) => [x + 0.45, y + 0.4]);
  const [backLens, backTotal] = pathLengths(back);

  const lineRand = mulberry32(7);
  const lines = Array.from({ length: 9 }, (_, i) => ({
    y: T - 0.85 - i * 0.38 - (i > 0 ? 0.2 : 0),
    end: L + 0.35 + (i === 0 ? 1.5 : 1.3 + lineRand() * 1.2),
    thick: i === 0 ? 0.09 : 0.045,
  }));

  return fill(count, 11, (rand) => {
    const r = rand();
    const jitter = () => (rand() - 0.5) * 0.08;
    if (r < 0.45) {
      const line = lines[Math.floor(rand() * lines.length)];
      return [L + 0.35 + rand() * (line.end - L - 0.35), line.y + (rand() - 0.5) * line.thick * 2, jitter()];
    }
    if (r < 0.72) {
      const [x, y] = pointOnPath(rand, outline, outLens, outTotal);
      return [x + jitter(), y + jitter(), jitter()];
    }
    if (r < 0.8) {
      const [x, y] = pointOnSegment(rand, R - fold, T, R - fold, T - fold);
      const [x2, y2] = pointOnSegment(rand, R - fold, T - fold, R, T - fold);
      return rand() < 0.5 ? [x + jitter(), y, 0.05] : [x2, y2 + jitter(), 0.05];
    }
    if (r < 0.9) {
      const [x, y] = pointOnPath(rand, back, backLens, backTotal);
      return [x + jitter(), y + jitter(), -0.7 + jitter()];
    }
    // sparse paper fill
    let x, y;
    do {
      x = L + rand() * w;
      y = B + rand() * h;
    } while (insidePolygon(x, y, [[R - fold, T], [R, T - fold], [R, T]]));
    return [x, y, jitter() * 0.5];
  });
}

// Rounded speech bubble with a tail and three "typing" dots
export function sampleBubble(count) {
  const w = 4.6, h = 3.0, rad = 0.9;
  const hw = w / 2 - rad, hh = h / 2 - rad;
  const path = [];
  const corners = [[hw, hh, 0], [-hw, hh, 0.25], [-hw, -hh, 0.5], [hw, -hh, 0.75]];
  for (const [cx, cy, start] of corners) {
    for (let s = 0; s <= 8; s++) {
      const a = (start + (s / 8) * 0.25) * TAU;
      path.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]);
    }
  }
  const [lens, total] = pathLengths(path);
  const tail = [[-1.3, -h / 2 + 0.02], [-2.1, -h / 2 - 0.9], [-0.5, -h / 2 + 0.02]];
  const dots = [-1.1, 0, 1.1];

  return fill(count, 23, (rand) => {
    const r = rand();
    const jitter = () => (rand() - 0.5) * 0.1;
    if (r < 0.45) {
      const [x, y] = pointOnPath(rand, path, lens, total);
      const bulge = (rand() - 0.5) * 0.5;
      return [x * (1 + bulge * 0.04), y * (1 + bulge * 0.04), bulge];
    }
    if (r < 0.55) {
      const [x, y] = rand() < 0.5
        ? pointOnSegment(rand, ...tail[0], ...tail[1])
        : pointOnSegment(rand, ...tail[1], ...tail[2]);
      return [x + jitter(), y + jitter(), jitter()];
    }
    if (r < 0.85) {
      const cx = dots[Math.floor(rand() * 3)];
      const [x, y, z] = randomOnSphere(rand, 0.32 * Math.cbrt(rand()));
      return [cx + x, y, z];
    }
    let x, y;
    do {
      x = (rand() - 0.5) * w;
      y = (rand() - 0.5) * h;
    } while (Math.abs(x) > hw + rad * 0.9 || Math.abs(y) > hh + rad * 0.9 ||
      (Math.abs(x) > hw && Math.abs(y) > hh && Math.hypot(Math.abs(x) - hw, Math.abs(y) - hh) > rad * 0.9));
    return [x, y, (rand() - 0.5) * 0.35];
  });
}

// Shield outline with a padlock in the middle
export function sampleShield(count) {
  const shield = [];
  for (let s = 0; s <= 16; s++) {
    const t = s / 16;
    shield.push([-2.1 + 4.2 * t, 2.1 + Math.sin(t * Math.PI) * 0.25]);
  }
  for (let s = 1; s <= 16; s++) {
    const t = s / 16;
    shield.push([2.1 - Math.pow(t, 1.6) * 2.1, 2.1 - t * 4.6 + Math.sin(t * Math.PI) * 0.6]);
  }
  for (let s = 15; s >= 1; s--) {
    const t = s / 16;
    shield.push([-(2.1 - Math.pow(t, 1.6) * 2.1), 2.1 - t * 4.6 + Math.sin(t * Math.PI) * 0.6]);
  }
  const [lens, total] = pathLengths(shield);

  return fill(count, 37, (rand) => {
    const r = rand();
    const jitter = () => (rand() - 0.5) * 0.09;
    if (r < 0.4) {
      const [x, y] = pointOnPath(rand, shield, lens, total);
      return [x + jitter(), y + jitter(), jitter()];
    }
    if (r < 0.62) {
      // lock body
      return [(rand() - 0.5) * 1.5, -0.95 + rand() * 1.15, 0.35 + jitter()];
    }
    if (r < 0.74) {
      // shackle arc
      const a = rand() * Math.PI;
      const rr = 0.5 + (rand() - 0.5) * 0.14;
      return [Math.cos(a) * rr, 0.2 + Math.sin(a) * rr + 0.2, 0.35 + jitter()];
    }
    // domed shield face, sparse
    let x, y;
    do {
      x = (rand() - 0.5) * 4.2;
      y = -2.5 + rand() * 4.8;
    } while (!insidePolygon(x, y, shield));
    return [x, y, 0.45 * (1 - (x / 2.1) ** 2) - 0.3];
  });
}

// Planet with a tilted ring
export function samplePlanet(count) {
  const tilt = 0.45;
  return fill(count, 41, (rand) => {
    if (rand() < 0.45) return randomOnSphere(rand, 1.4 + (rand() - 0.5) * 0.06);
    const a = rand() * TAU;
    const rr = 2.0 + Math.pow(rand(), 0.7) * 1.0;
    const x = Math.cos(a) * rr;
    const z = Math.sin(a) * rr;
    const y = (rand() - 0.5) * 0.06;
    return [x, y * Math.cos(tilt) - z * Math.sin(tilt), y * Math.sin(tilt) + z * Math.cos(tilt)];
  });
}

// Cat head (Purr Assist): ellipsoid head, ears, eyes and whiskers
export function sampleCat(count) {
  const ear = (side) => [[side * 0.6, 1.25], [side * 1.75, 2.75], [side * 1.85, 0.9]];
  const whiskers = [];
  for (const side of [-1, 1]) {
    for (const dy of [-0.1, -0.35, -0.6]) {
      whiskers.push([side * 0.75, -0.45, side * 2.6, -0.3 + dy * 1.6]);
    }
  }

  return fill(count, 53, (rand) => {
    const r = rand();
    const jitter = () => (rand() - 0.5) * 0.08;
    if (r < 0.5) {
      const [x, y, z] = randomOnSphere(rand, 1);
      return [x * 2.0, y * 1.7, z * 1.3];
    }
    if (r < 0.7) {
      const side = rand() < 0.5 ? -1 : 1;
      const tri = ear(side);
      const e = Math.floor(rand() * 3);
      const [x, y] = pointOnSegment(rand, ...tri[e], ...tri[(e + 1) % 3]);
      return [x + jitter(), y + jitter(), 0.2 + jitter()];
    }
    if (r < 0.84) {
      // eyes: filled almond discs on the front of the face
      const side = rand() < 0.5 ? -1 : 1;
      const a = rand() * TAU;
      const rr = Math.sqrt(rand());
      return [side * 0.75 + Math.cos(a) * rr * 0.32, 0.25 + Math.sin(a) * rr * 0.42, 1.25];
    }
    if (r < 0.88) {
      // nose
      const a = rand() * TAU;
      return [Math.cos(a) * 0.16 * rand(), -0.35 + Math.sin(a) * 0.1 * rand(), 1.3];
    }
    const [ax, ay, bx, by] = whiskers[Math.floor(rand() * whiskers.length)];
    const [x, y] = pointOnSegment(rand, ax, ay, bx, by);
    return [x, y + jitter() * 0.3, 1.1];
  });
}

// Upload: an arrow rising out of an open tray, with sparks streaming off the tip
export function sampleUpload(count) {
  const drop = -0.3; // centre the whole shape vertically
  const tray = [[-2.3, 0.1], [-2.3, -2.1], [2.3, -2.1], [2.3, 0.1]];
  const [trayLens, trayTotal] = pathLengths(tray);
  const arrow = [
    [-0.28, -0.9], [-0.28, 1.35], [-1.1, 1.35], [0, 2.55],
    [1.1, 1.35], [0.28, 1.35], [0.28, -0.9], [-0.28, -0.9],
  ];
  const [arrowLens, arrowTotal] = pathLengths(arrow);

  const points = fill(count, 67, (rand) => {
    const r = rand();
    const jitter = () => (rand() - 0.5) * 0.09;
    if (r < 0.34) {
      // tray: front and back rims give it depth
      const [x, y] = pointOnPath(rand, tray, trayLens, trayTotal);
      const z = rand() < 0.6 ? 0.55 : -0.55;
      return [x + jitter(), y + drop + jitter(), z + jitter()];
    }
    if (r < 0.4) {
      // tray floor, sparse
      return [(rand() - 0.5) * 4.6, -2.1 + drop + jitter(), (rand() - 0.5) * 1.1];
    }
    if (r < 0.72) {
      const [x, y] = pointOnPath(rand, arrow, arrowLens, arrowTotal);
      return [x + jitter(), y + drop + jitter(), 0.3 + jitter()];
    }
    if (r < 0.86) {
      // arrow body, lightly filled
      let x, y;
      do {
        x = (rand() - 0.5) * 2.2;
        y = -0.9 + rand() * 3.45;
      } while (!insidePolygon(x, y, arrow));
      return [x, y + drop, 0.3 + jitter() * 1.5];
    }
    // sparks thinning out above the tip
    const t = Math.pow(rand(), 1.8);
    return [(rand() - 0.5) * (0.3 + t * 1.4), 2.75 + t * 1.0 + drop, (rand() - 0.5) * 0.6];
  });
  // scale to the same footprint as the other shapes
  for (let i = 0; i < points.length; i++) points[i] *= 0.82;
  return points;
}

export const SHAPES = {
  page: samplePage,
  bubble: sampleBubble,
  shield: sampleShield,
  planet: samplePlanet,
  cat: sampleCat,
  upload: sampleUpload,
};
