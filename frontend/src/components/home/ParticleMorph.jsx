import { useEffect, useRef } from "react";
import * as THREE from "three";
import { SHAPES } from "./particleShapes";
import { PALETTES, DEFAULT_PALETTE } from "./palettes";

// Full-screen particle field for the home page.
// Every element with `data-shape="<name>"` (and optional `data-side="left|right|center"`)
// is a scroll anchor: particles form that shape while the section is centred and
// morph into the next section's shape (with an outward burst) as it scrolls in.
// Three layers: tiny background stars, the shape particles, and large drifting bokeh orbs.

const CAMERA_Z = 16;
const FOV = 35;

// Shared GLSL: palette colouring. Weights blend the three colouring modes so palettes cross-fade.
const paletteGlsl = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uColorC;
  uniform vec3 uModeWeights;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x),
          mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x),
          mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }

  vec3 paletteColor(vec3 pos, float time) {
    float n = noise(pos * 0.55 + vec3(0.0, time * 0.25, time * 0.15));
    float sparkle = noise(pos * 1.4 + time * 0.4);

    // 0: drifting noise patches
    float t0 = smoothstep(0.3, 0.7, n);
    float h0 = smoothstep(0.72, 0.9, n);
    // 1: vertical gradient with a slow wave
    float t1 = clamp((pos.y + 2.8) / 5.6 + sin(time * 0.3 + pos.x * 0.5) * 0.08, 0.0, 1.0);
    float h1 = smoothstep(0.78, 0.95, sparkle);
    // 2: depth, near particles glow toward the highlight
    float t2 = clamp((pos.z + 2.5) / 5.0, 0.0, 1.0);
    float h2 = smoothstep(0.65, 1.0, t2) * (0.6 + 0.4 * sparkle);

    float t = dot(uModeWeights, vec3(t0, t1, t2));
    float h = dot(uModeWeights, vec3(h0, h1, h2));
    return mix(mix(uColorA, uColorB, t), uColorC, h * 0.8);
  }
`;

const particleVertex = /* glsl */ `
  attribute vec3 aFrom;
  attribute vec3 aTo;
  attribute vec3 aRand;
  attribute float aScale;

  uniform float uTime;
  uniform float uMix;
  uniform float uBurst;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform vec2 uCursor;
  uniform float uCursorActive;

  varying vec3 vPos;
  varying float vAlpha;
  varying float vWave;
  varying float vBlur;
  varying float vScale;

  void main() {
    float m = smoothstep(0.0, 1.0, uMix);
    vec3 p = mix(aFrom, aTo, m);

    // burst outward mid-morph, then settle into the next shape
    float wave = sin(m * 3.14159);
    wave = wave * wave * wave * uBurst;
    p = p * (1.0 + wave * 0.6) + aRand * wave * 3.5;

    // idle drift
    float offset = aScale * 10.0;
    float amp = 0.035 + 0.06 * aScale;
    p.x += sin(uTime * (0.6 + aScale) + offset) * amp;
    p.y += cos(uTime * (0.5 + aScale) + offset) * amp;

    vec4 world = modelMatrix * vec4(p, 1.0);

    // cursor repulsion
    vec2 diff = world.xy - uCursor;
    // soft round gap: gaussian falloff so the rim has no hard edge
    float dist = length(diff);
    float push = exp(-dist * dist * 0.9) * uCursorActive;
    world.xy += normalize(diff + 0.0001) * push * 0.5;

    vec4 view = viewMatrix * world;
    gl_Position = projectionMatrix * view;

    // depth of field: out-of-focus particles grow into soft bokeh and dim to keep energy constant
    float blur = clamp((abs(view.z + ${CAMERA_Z.toFixed(1)}) - 0.8) * 0.3, 0.0, 1.0);

    float twinkle = sin(uTime * 3.0 + offset) * 0.5 + 0.5;
    float size = uSize * (0.6 + aScale * 1.1 + twinkle * 0.35 * aScale) * (1.0 + blur * 3.0) + push * 1.5;
    gl_PointSize = size * uPixelRatio * (${CAMERA_Z.toFixed(1)} / -view.z);

    vPos = world.xyz;
    vWave = wave;
    vBlur = blur;
    vScale = aScale;
    vAlpha = (0.35 + 0.65 * aScale) / (1.0 + blur * 4.0) * (1.0 - push * 0.75);
  }
`;

const particleFragment = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;

  varying vec3 vPos;
  varying float vAlpha;
  varying float vWave;
  varying float vBlur;
  varying float vScale;

  ${paletteGlsl}

  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;

    // sharp orb with a glow halo; blur melts it into a soft disc
    float core = 1.0 - smoothstep(mix(0.45, 0.0, vBlur), 1.0, d);
    float glow = exp(-d * d * mix(10.0, 3.0, vBlur));
    float shape = max(core * 0.85, glow * 0.65);

    vec3 color = paletteColor(vPos, uTime);
    // hot white-ish centre on in-focus larger orbs
    color = mix(color, uColorC, pow(1.0 - d, 5.0) * (0.25 + 0.5 * vScale) * (1.0 - vBlur));

    float depthFade = clamp(0.6 + vPos.z * 0.2, 0.3, 1.0);
    gl_FragColor = vec4(color, shape * vAlpha * depthFade * (1.0 - vWave * 0.2) * uOpacity);
  }
`;

const starVertex = /* glsl */ `
  attribute float aScale;
  attribute float aPick;
  uniform float uTime;
  uniform float uScroll;
  uniform float uPixelRatio;
  varying float vAlpha;
  varying float vPick;

  void main() {
    vec3 p = position;
    p.y = mod(p.y + uScroll * (0.4 + aScale * 0.8) + 9.0, 18.0) - 9.0;
    vec4 view = viewMatrix * modelMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * view;
    gl_PointSize = (1.2 + aScale * 2.4) * uPixelRatio;
    vAlpha = (0.2 + 0.5 * aScale) * (0.6 + 0.4 * sin(uTime * (1.0 + aScale * 2.0) + aScale * 40.0));
    vPick = aPick;
  }
`;

const starFragment = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uColorC;
  varying float vAlpha;
  varying float vPick;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    float disc = smoothstep(0.5, 0.15, d);
    if (disc <= 0.0) discard;
    vec3 color = vPick < 0.4 ? uColorA : vPick < 0.8 ? uColorB : uColorC;
    gl_FragColor = vec4(color, disc * vAlpha);
  }
`;

const orbVertex = /* glsl */ `
  attribute vec4 aSeed; // phase, speed, size, colour pick

  uniform float uTime;
  uniform float uScroll;
  uniform vec2 uPointer;
  uniform float uPixelRatio;

  varying float vPick;
  varying float vNear;

  void main() {
    vec3 p = position;
    p.x += sin(uTime * aSeed.y * 0.3 + aSeed.x) * 1.4;
    p.y += cos(uTime * aSeed.y * 0.22 + aSeed.x * 1.3) * 1.0;

    float near = clamp((p.z + 12.0) / 21.0, 0.0, 1.0);
    // nearer orbs move faster with scroll and pointer (parallax)
    p.y = mod(p.y + uScroll * (0.6 + near * 3.0) + 12.0, 24.0) - 12.0;
    p.xy += uPointer * near * 1.2;

    vec4 view = viewMatrix * modelMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * view;
    gl_PointSize = min(aSeed.z * uPixelRatio * (${CAMERA_Z.toFixed(1)} / -view.z), 420.0);

    vPick = aSeed.w;
    vNear = near;
  }
`;

const orbFragment = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uColorC;
  uniform float uOpacity;

  varying float vPick;
  varying float vNear;

  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;

    // soft glowing orb: gaussian body, a gentle lit edge, a small bright heart
    float body = exp(-d * d * 3.5) * (1.0 - smoothstep(0.8, 1.0, d));
    float edge = smoothstep(0.55, 0.8, d) * (1.0 - smoothstep(0.8, 0.98, d));
    float heart = exp(-d * d * 30.0);

    vec3 base = mix(uColorA, uColorB, step(0.5, vPick));
    vec3 color = mix(base, uColorC, heart * 0.6);

    float alpha = (body * 0.55 + edge * 0.18 + heart * 0.35) * mix(0.5, 0.2, vNear) * uOpacity;
    gl_FragColor = vec4(color * 1.2, alpha);
  }
`;

const MODE_WEIGHTS = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];

function readSections() {
  return [...document.querySelectorAll("[data-shape]")].map((el) => {
    const rect = el.getBoundingClientRect();
    return {
      top: rect.top + window.scrollY,
      height: Math.max(rect.height, 1),
      shape: el.dataset.shape,
      side: el.dataset.side || "center",
    };
  });
}

function paletteTargets(name) {
  const palette = PALETTES[name] || PALETTES[DEFAULT_PALETTE];
  return {
    colors: palette.colors.map((c) => new THREE.Color(c)),
    weights: MODE_WEIGHTS[palette.mode] || MODE_WEIGHTS[0],
  };
}

export default function ParticleMorph({ palette = DEFAULT_PALETTE }) {
  const containerRef = useRef(null);
  const targetRef = useRef(paletteTargets(palette));

  // Palette changes cross-fade inside the render loop
  useEffect(() => {
    targetRef.current = paletteTargets(palette);
  }, [palette]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: "high-performance" });
    } catch {
      return; // no WebGL: the page still reads fine on plain black
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isSmall = window.innerWidth < 768;
    const lowEnd = (navigator.hardwareConcurrency || 8) <= 4;
    const count = isSmall ? 7000 : lowEnd ? 9000 : 16000;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);

    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(FOV, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.z = CAMERA_Z;

    // Palette uniforms are shared objects, so every layer updates together
    const initial = targetRef.current;
    const paletteUniforms = {
      uColorA: { value: initial.colors[0].clone() },
      uColorB: { value: initial.colors[1].clone() },
      uColorC: { value: initial.colors[2].clone() },
      uModeWeights: { value: initial.weights.clone() },
    };

    // Sample every shape once
    const shapeCache = {};
    const getShape = (name) => {
      if (!shapeCache[name]) shapeCache[name] = (SHAPES[name] || SHAPES.page)(count);
      return shapeCache[name];
    };

    // ---- Shape particles
    const geometry = new THREE.BufferGeometry();
    const aFrom = new THREE.BufferAttribute(new Float32Array(count * 3), 3);
    const aTo = new THREE.BufferAttribute(new Float32Array(count * 3), 3);
    aFrom.setUsage(THREE.DynamicDrawUsage);
    aTo.setUsage(THREE.DynamicDrawUsage);
    const aRand = new Float32Array(count * 3);
    const aScale = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const u = Math.random() * 2 - 1;
      const phi = Math.random() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u) * (0.5 + Math.random());
      aRand[i * 3] = s * Math.cos(phi);
      aRand[i * 3 + 1] = s * Math.sin(phi);
      aRand[i * 3 + 2] = u * (0.5 + Math.random());
      aScale[i] = Math.pow(Math.random(), 2);
    }
    geometry.setAttribute("position", aFrom); // bounding/culling only
    geometry.setAttribute("aFrom", aFrom);
    geometry.setAttribute("aTo", aTo);
    geometry.setAttribute("aRand", new THREE.BufferAttribute(aRand, 3));
    geometry.setAttribute("aScale", new THREE.BufferAttribute(aScale, 1));

    const material = new THREE.ShaderMaterial({
      vertexShader: particleVertex,
      fragmentShader: particleFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uMix: { value: 0 },
        uBurst: { value: reducedMotion ? 0 : 1 },
        uSize: { value: isSmall ? 2.8 : 3.4 },
        uPixelRatio: { value: pixelRatio },
        uCursor: { value: new THREE.Vector2(999, 999) },
        uCursorActive: { value: 0 },
        uOpacity: { value: 0 },
        ...paletteUniforms,
      },
    });
    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    scene.add(points);

    // ---- Background stars
    const starCount = isSmall ? 350 : 700;
    const starGeometry = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    const starScale = new Float32Array(starCount);
    const starPick = new Float32Array(starCount);
    for (let i = 0; i < starCount; i++) {
      starPos[i * 3] = (Math.random() - 0.5) * 30;
      starPos[i * 3 + 1] = (Math.random() - 0.5) * 18;
      starPos[i * 3 + 2] = -10 + Math.random() * 10;
      starScale[i] = Math.pow(Math.random(), 3);
      starPick[i] = Math.random();
    }
    starGeometry.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    starGeometry.setAttribute("aScale", new THREE.BufferAttribute(starScale, 1));
    starGeometry.setAttribute("aPick", new THREE.BufferAttribute(starPick, 1));
    const starMaterial = new THREE.ShaderMaterial({
      vertexShader: starVertex,
      fragmentShader: starFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uScroll: { value: 0 },
        uPixelRatio: { value: pixelRatio },
        uColorA: paletteUniforms.uColorA,
        uColorB: paletteUniforms.uColorB,
        uColorC: paletteUniforms.uColorC,
      },
    });
    const stars = new THREE.Points(starGeometry, starMaterial);
    stars.frustumCulled = false;
    scene.add(stars);

    // ---- Drifting bokeh orbs
    const orbCount = isSmall ? 12 : 26;
    const orbGeometry = new THREE.BufferGeometry();
    const orbPos = new Float32Array(orbCount * 3);
    const orbSeed = new Float32Array(orbCount * 4);
    for (let i = 0; i < orbCount; i++) {
      orbPos[i * 3] = (Math.random() - 0.5) * 26;
      orbPos[i * 3 + 1] = (Math.random() - 0.5) * 24;
      orbPos[i * 3 + 2] = -12 + Math.random() * 21; // some behind the shape, some close to the camera
      orbSeed[i * 4] = Math.random() * Math.PI * 2;
      orbSeed[i * 4 + 1] = 0.4 + Math.random() * 0.8;
      orbSeed[i * 4 + 2] = 22 + Math.pow(Math.random(), 2) * 90;
      orbSeed[i * 4 + 3] = Math.random();
    }
    orbGeometry.setAttribute("position", new THREE.BufferAttribute(orbPos, 3));
    orbGeometry.setAttribute("aSeed", new THREE.BufferAttribute(orbSeed, 4));
    const orbMaterial = new THREE.ShaderMaterial({
      vertexShader: orbVertex,
      fragmentShader: orbFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uScroll: { value: 0 },
        uPointer: { value: new THREE.Vector2() },
        uPixelRatio: { value: pixelRatio },
        uOpacity: { value: 0 },
        uColorA: paletteUniforms.uColorA,
        uColorB: paletteUniforms.uColorB,
        uColorC: paletteUniforms.uColorC,
      },
    });
    const orbs = new THREE.Points(orbGeometry, orbMaterial);
    orbs.frustumCulled = false;
    scene.add(orbs);

    // ---- Scroll anchors
    let sections = readSections();
    const resizeObserver = new ResizeObserver(() => {
      sections = readSections();
    });
    resizeObserver.observe(document.body);

    let pairKey = "";
    const loadPair = (fromShape, toShape) => {
      const key = `${fromShape}>${toShape}`;
      if (key === pairKey) return;
      pairKey = key;
      aFrom.array.set(getShape(fromShape));
      aTo.array.set(getShape(toShape));
      aFrom.needsUpdate = true;
      aTo.needsUpdate = true;
    };

    // ---- Pointer
    const pointer = { x: 0, y: 0, active: false };
    const onPointerMove = (e) => {
      if (e.pointerType === "touch") return;
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
      pointer.active = true;
    };
    const onPointerLeave = () => {
      pointer.active = false;
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onPointerLeave);

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      sections = readSections();
    };
    window.addEventListener("resize", onResize);

    const halfHeight = Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * CAMERA_Z;
    const sideX = (side) => {
      if (window.innerWidth < 768 || side === "center") return 0;
      const halfWidth = halfHeight * camera.aspect;
      return (side === "right" ? 1 : -1) * halfWidth * 0.52;
    };

    const state = { index: -1, progress: 0, rotX: 0, rotY: 0, px: 0, py: 0 };
    const clock = new THREE.Clock();
    let raf = 0;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const delta = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.elapsedTime;

      if (sections.length) {
        const probe = window.scrollY + window.innerHeight * 0.5;
        let index = 0;
        for (let i = 0; i < sections.length; i++) if (sections[i].top <= probe) index = i;
        const local = THREE.MathUtils.clamp((probe - sections[index].top) / sections[index].height, 0, 1);
        const last = sections.length - 1;
        // One continuous value: whole part = section, fraction = morph towards the next one
        const targetProgress = Math.min(index + (index < last ? THREE.MathUtils.smoothstep(local, 0.35, 1) : 0), last);

        // lower = lazier follow; ~0.9s to catch up with the scroll position
        const ease = 1 - Math.pow(0.03, delta);
        if (state.index === -1 || reducedMotion) state.progress = targetProgress;
        else state.progress += (targetProgress - state.progress) * ease;
        state.index = index;

        const from = Math.min(Math.floor(state.progress), last);
        const to = Math.min(from + 1, last);
        const mix = from === to ? 0 : state.progress - from;

        loadPair(sections[from].shape, sections[to].shape);
        material.uniforms.uMix.value = mix;
        points.position.x = THREE.MathUtils.lerp(sideX(sections[from].side), sideX(sections[to].side), THREE.MathUtils.smoothstep(mix, 0, 1));
      }

      // palette cross-fade
      const target = targetRef.current;
      const fade = reducedMotion ? 1 : Math.min(delta * 3, 1);
      paletteUniforms.uColorA.value.lerp(target.colors[0], fade);
      paletteUniforms.uColorB.value.lerp(target.colors[1], fade);
      paletteUniforms.uColorC.value.lerp(target.colors[2], fade);
      paletteUniforms.uModeWeights.value.lerp(target.weights, fade);

      const isSmallNow = window.innerWidth < 768;
      points.scale.setScalar(isSmallNow ? 0.8 : 1.05);
      const targetOpacity = isSmallNow ? 0.55 : 1;
      const fadeIn = Math.min(delta * 1.5, 1);
      material.uniforms.uOpacity.value += (targetOpacity - material.uniforms.uOpacity.value) * fadeIn;
      orbMaterial.uniforms.uOpacity.value += (targetOpacity - orbMaterial.uniforms.uOpacity.value) * fadeIn;

      if (!reducedMotion) {
        material.uniforms.uTime.value = elapsed;
        starMaterial.uniforms.uTime.value = elapsed;
        orbMaterial.uniforms.uTime.value = elapsed;
        const wave = Math.sin(material.uniforms.uMix.value * Math.PI);
        state.rotY += ((pointer.active ? pointer.x * 0.25 : 0) + Math.sin(elapsed * 0.15) * 0.35 - state.rotY) * Math.min(delta * 2, 1);
        state.rotX += ((pointer.active ? -pointer.y * 0.15 : 0) + Math.sin(elapsed * 0.1) * 0.1 - state.rotX) * Math.min(delta * 2, 1);
        points.rotation.set(state.rotX, state.rotY + wave * 0.6, 0);

        state.px += ((pointer.active ? pointer.x : 0) - state.px) * Math.min(delta * 1.5, 1);
        state.py += ((pointer.active ? pointer.y : 0) - state.py) * Math.min(delta * 1.5, 1);
        orbMaterial.uniforms.uPointer.value.set(state.px, state.py);
      }

      const scroll = window.scrollY / window.innerHeight;
      starMaterial.uniforms.uScroll.value = scroll;
      orbMaterial.uniforms.uScroll.value = scroll;

      // the gap trails the pointer slightly instead of snapping to it
      const cursor = material.uniforms.uCursor.value;
      const cursorTargetX = pointer.x * halfHeight * camera.aspect;
      const cursorTargetY = pointer.y * halfHeight;
      if (cursor.x > 900) cursor.set(cursorTargetX, cursorTargetY);
      const follow = reducedMotion ? 1 : Math.min(delta * 8, 1);
      cursor.x += (cursorTargetX - cursor.x) * follow;
      cursor.y += (cursorTargetY - cursor.y) * follow;
      const cursorTarget = pointer.active ? 1 : 0;
      material.uniforms.uCursorActive.value += (cursorTarget - material.uniforms.uCursorActive.value) * Math.min(delta * 4, 1);

      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      document.documentElement.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("resize", onResize);
      [geometry, material, starGeometry, starMaterial, orbGeometry, orbMaterial].forEach((r) => r.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={containerRef} className="home-canvas" aria-hidden="true" />;
}
