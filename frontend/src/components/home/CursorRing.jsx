import { useEffect, useRef } from "react";

// Dot + trailing ring cursor. Only for fine pointers without reduced motion;
// the native cursor stays visible so nothing is lost if this fails.
export default function CursorRing() {
  const dotRef = useRef(null);
  const ringRef = useRef(null);

  useEffect(() => {
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!finePointer || reducedMotion || !dot || !ring) return;

    const target = { x: -100, y: -100 };
    const pos = { x: -100, y: -100 };
    let raf = 0;

    const onMove = (e) => {
      target.x = e.clientX;
      target.y = e.clientY;
      dot.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      const interactive = e.target.closest?.("a, button, [role='button'], summary");
      ring.classList.toggle("is-hover", Boolean(interactive));
      ring.classList.add("is-visible");
      dot.classList.add("is-visible");
    };
    const onLeave = () => {
      ring.classList.remove("is-visible");
      dot.classList.remove("is-visible");
    };

    const tick = () => {
      pos.x += (target.x - pos.x) * 0.18;
      pos.y += (target.y - pos.y) * 0.18;
      ring.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
      raf = requestAnimationFrame(tick);
    };
    tick();

    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <>
      <div ref={ringRef} className="home-cursor-ring" aria-hidden="true"><span /></div>
      <div ref={dotRef} className="home-cursor-dot" aria-hidden="true"><span /></div>
    </>
  );
}
