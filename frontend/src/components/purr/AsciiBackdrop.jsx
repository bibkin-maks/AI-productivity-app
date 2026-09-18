import { useEffect, useLayoutEffect, useRef } from "react";

// Full-bleed ambient ASCII field behind the orb: slow interfering waves, masked so it
// fades away near the orb and the edges. Coarse grid at 10fps — cheap next to the orb.

const CELL = 13; // px per character cell
const FPS = 10;
const RAMP = " ..···:::+";

function hash(x, y) {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

export default function AsciiBackdrop({ intensity = 1 }) {
  const wrapRef = useRef(null);
  const preRef = useRef(null);
  const sizeRef = useRef({ cols: 40, rows: 20 });
  const intensityRef = useRef(intensity);
  intensityRef.current = intensity;

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      sizeRef.current = {
        cols: Math.max(12, Math.ceil(width / (CELL * 0.6))),
        rows: Math.max(8, Math.ceil(height / CELL)),
      };
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const frame = (time) => {
      const { cols, rows } = sizeRef.current;
      const boost = intensityRef.current;
      const cx = cols / 2;
      const cy = rows * 0.42;
      const lines = [];
      for (let row = 0; row < rows; row++) {
        let line = "";
        for (let col = 0; col < cols; col++) {
          const dx = (col - cx) * 0.6;
          const dy = row - cy;
          const dist = Math.hypot(dx, dy);
          // two slow waves + one ring travelling out from the orb
          let v =
            0.5 +
            0.25 * Math.sin(dx * 0.22 + time * 0.35) +
            0.25 * Math.sin(dy * 0.3 - time * 0.27) +
            0.3 * Math.sin(dist * 0.35 - time * 0.9) * boost;
          v += (hash(col, row) - 0.5) * 0.25;
          const index = Math.round(Math.max(0, Math.min(1, v)) * (RAMP.length - 1) * (0.55 + 0.45 * boost));
          line += RAMP[Math.max(0, Math.min(RAMP.length - 1, index))];
        }
        lines.push(line);
      }
      if (preRef.current) preRef.current.textContent = lines.join("\n");
    };

    if (reduced) {
      frame(0);
      return undefined;
    }

    let raf = 0;
    let previous = 0;
    const started = performance.now();
    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      if (now - previous < 1000 / FPS) return;
      previous = now;
      frame((now - started) / 1000);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div ref={wrapRef} className="purr-backdrop" aria-hidden="true">
      <pre ref={preRef} style={{ fontSize: CELL }} />
    </div>
  );
}
