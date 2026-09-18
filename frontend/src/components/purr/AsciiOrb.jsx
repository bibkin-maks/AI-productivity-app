import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { PRESETS, blendParams, buildFrame, specToParams } from "./orbEngine";

const COLS = 54;
const ROWS = 32;
const FPS = 30;

// What the orb does between answers
const STATE_PRESET = {
  idle: "calm",
  listening: "ripple",
  thinking: "swirl",
  speaking: "pulse",
};

/**
 * The orb. It never translates or rotates: every frame rewrites the characters.
 * `reaction` is { id, spec } — a new id plays that spec once (capped at 1s).
 */
export default function AsciiOrb({ state = "idle", reaction = null, onReactionEnd, tint = null, label = "Purr" }) {
  const wrapRef = useRef(null);
  const charsRef = useRef(null);
  const glowRef = useRef(null);
  const [fontSize, setFontSize] = useState(12);

  const idleParams = useMemo(() => {
    const base = { ...PRESETS[STATE_PRESET[state] || "calm"] };
    return tint == null ? base : { ...base, hue: tint }; // keep the last answer's colour while idle
  }, [state, tint]);
  const idleRef = useRef(idleParams);
  idleRef.current = idleParams;

  // start a reaction when a new id arrives
  const reactionRef = useRef(null);
  const endRef = useRef(onReactionEnd);
  endRef.current = onReactionEnd;
  useEffect(() => {
    if (!reaction?.id) return;
    reactionRef.current = {
      id: reaction.id,
      start: performance.now(),
      duration: Math.min(1000, Math.max(300, reaction.spec?.duration_ms ?? 800)),
      params: specToParams(reaction.spec),
    };
  }, [reaction?.id, reaction?.spec]);

  // keep the orb square and as large as its box allows
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      const byWidth = width / (COLS * 0.6);
      const byHeight = height / ROWS;
      setFontSize(Math.max(4, Math.min(byWidth, byHeight)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const paint = (text, params) => {
      if (charsRef.current) charsRef.current.textContent = text;
      if (glowRef.current) glowRef.current.textContent = text;
      const wrap = wrapRef.current;
      if (wrap) {
        wrap.style.setProperty("--orb-hue", String(Math.round(params.hue ?? 28)));
        wrap.style.setProperty("--orb-glow", String((params.glow ?? 0.4).toFixed(3)));
      }
    };

    if (reduced) {
      paint(buildFrame(COLS, ROWS, 0, idleRef.current), idleRef.current);
      return undefined;
    }

    const started = performance.now();
    let raf = 0;
    let previous = 0;
    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      if (now - previous < 1000 / FPS) return;
      previous = now;

      let params = idleRef.current;
      const active = reactionRef.current;
      if (active) {
        const progress = (now - active.start) / active.duration;
        if (progress >= 1) {
          reactionRef.current = null;
          endRef.current?.();
        } else {
          params = blendParams(idleRef.current, active.params, progress);
        }
      }
      paint(buildFrame(COLS, ROWS, (now - started) / 1000, params), params);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div ref={wrapRef} className="orb" data-state={state} data-reacting={reaction ? "true" : "false"} role="img" aria-label={`${label} orb, ${state}`}>
      <pre ref={glowRef} className="orb__layer orb__layer--glow" aria-hidden="true" style={{ fontSize }} />
      <pre ref={charsRef} className="orb__layer orb__layer--chars" aria-hidden="true" style={{ fontSize }} />
    </div>
  );
}
