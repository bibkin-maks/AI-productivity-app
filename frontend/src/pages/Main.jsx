import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MotionConfig } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { PurrAssistLogo } from "../assets/svgAssets";
import UploadBox from "../components/FileUpload";
import ParticleMorph from "../components/home/ParticleMorph";
import CursorRing from "../components/home/CursorRing";
import Reveal from "../components/home/Reveal";
import PaletteSwitcher from "../components/home/PaletteSwitcher";
import { PALETTES, PALETTE_STORAGE_KEY, savedPalette } from "../components/home/palettes";

// Landing Sections
import Features from "../components/landing/Features";
import Pricing from "../components/landing/Pricing";
import Team from "../components/landing/Team";
import Trust from "../components/landing/Trust";

import "./home.css";

const paletteFromUrl = new URLSearchParams(window.location.search).get("palette");
const SHOW_PALETTE_SWITCHER = import.meta.env.DEV || paletteFromUrl !== null;

function initialPalette() {
  if (paletteFromUrl && PALETTES[paletteFromUrl]) return paletteFromUrl;
  return savedPalette();
}

const SECTION_LINKS = [
  { label: "How it works", href: "#how" },
  { label: "Security", href: "#security" },
  { label: "Pricing", href: "#pricing" },
  { label: "Team", href: "#team" },
];

// ========================================================
// Header
// ========================================================
function Header({ onLogin, isAuthed, user }) {
  const navigate = useNavigate();

  return (
    <header className="home-header">
      <nav className="home-container home-header__bar" aria-label="Main">
        <a
          href="/"
          className="home-wordmark"
          onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); navigate("/"); }}
        >
          <PurrAssistLogo className="w-8 h-8" />
          ChatDoc
        </a>

        <div className="home-nav">
          <div className="home-nav__sections">
            {SECTION_LINKS.map((link) => (
              <a key={link.href} href={link.href} className="home-nav__link">{link.label}</a>
            ))}
          </div>

          {isAuthed ? (
            <button type="button" onClick={onLogin} className="home-nav__link flex items-center gap-3">
              <span className="hidden sm:inline">Welcome back, {user?.name?.split(" ")[0]}</span>
              <span className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center font-bold text-sm">
                {user?.name?.charAt(0).toUpperCase()}
              </span>
            </button>
          ) : (
            <>
              <button type="button" onClick={onLogin} className="home-nav__link hidden sm:inline">Login</button>
              <button type="button" onClick={onLogin} className="home-btn home-btn--ghost !min-h-[40px] !px-5 text-sm">
                Get Started
              </button>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}

// ========================================================
// Hero
// ========================================================
function Hero({ onLogin, isAuthed }) {
  return (
    <section className="home-section home-hero" data-shape="page" data-side="right" aria-labelledby="hero-title">
      <div className="home-container">
        <div className="max-w-3xl">
          <Reveal as="p" className="home-label mb-8">
            <span className="inline-block w-2 h-2 rounded-full bg-[var(--home-accent)] mr-3 align-middle" aria-hidden="true" />
            Feature Update <span aria-hidden="true">·</span> <span className="text-white">Multi-Format Support</span>
          </Reveal>

          <h1 id="hero-title" className="home-display home-h1">
            <Reveal as="span" className="block home-outline">Chat with</Reveal>
            <Reveal as="span" delay={0.1} className="block">your</Reveal>
            <Reveal as="span" delay={0.2} className="block">documents<span className="text-[var(--home-accent)]">.</span></Reveal>
          </h1>

          <Reveal delay={0.3} as="p" className="home-lead mt-10 max-w-2xl">
            Unlock <strong>instant answers, summaries, and citations</strong> from your files <strong>using AI</strong>.
          </Reveal>

          <Reveal delay={0.4} className="flex flex-wrap items-center gap-4 mt-12">
            {!isAuthed ? (
              <>
                <button type="button" onClick={onLogin} className="home-btn home-btn--solid">
                  Start for free <span className="home-btn__arrow" aria-hidden="true">→</span>
                </button>
                <a href="#how" className="home-btn home-btn--ghost">View Demo</a>
              </>
            ) : (
              <button type="button" onClick={onLogin} className="home-btn home-btn--solid">
                Open workspace <span className="home-btn__arrow" aria-hidden="true">→</span>
              </button>
            )}
          </Reveal>

          <Reveal delay={0.5} as="p" className="home-label mt-10">
            Trusted by <span className="text-white">10,000+</span> pros
          </Reveal>
        </div>
      </div>
    </section>
  );
}

// ========================================================
// Upload CTA
// ========================================================
function UploadCta({ isAuthed, onLogin }) {
  return (
    <section className="home-section" data-shape="upload" data-side="right" aria-labelledby="cta-title">
      <div className="home-container">
        <Reveal as="p" id="cta-title" className="home-body mb-6">start chatting:</Reveal>
        <Reveal delay={0.1}>
          {isAuthed ? (
            <UploadBox variant="statement" navigateTo="/chat" />
          ) : (
            <button type="button" onClick={onLogin} className="home-drop">
              <span className="home-drop__underline">Drop a PDF here to start chatting</span>
              <span className="home-label block mt-8">Sign in with Google to upload · PDF · DOCX · TXT</span>
            </button>
          )}
        </Reveal>
      </div>
    </section>
  );
}

// ========================================================
// Footer
// ========================================================
function Footer() {
  const columns = [
    { title: "Product", links: [["Features", "#how"], ["Pricing", "#pricing"], ["API", null]] },
    { title: "Company", links: [["About Us", null], ["Careers", null], ["Legal", null]] },
    { title: "Connect", links: [["Twitter", null], ["LinkedIn", null], ["GitHub", null]] },
  ];

  return (
    <footer className="home-footer">
      <div className="home-container">
        <div className="grid gap-12 md:grid-cols-4 mb-20">
          <div>
            <p className="home-wordmark !text-xl mb-4">ChatDoc</p>
            <p className="home-body !text-base">Transforming documents into intelligence.</p>
          </div>
          {columns.map((col) => (
            <div key={col.title}>
              <p className="home-label mb-5">{col.title}</p>
              <ul className="space-y-3">
                {col.links.map(([label, href]) => (
                  <li key={label}>
                    {href ? <a href={href}>{label}</a> : <span className="text-[var(--home-text-3)] text-[15px]">{label}</span>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="home-label !text-xs">© 2025 Purr Assist AI Inc. All rights reserved.</p>
      </div>
    </footer>
  );
}

// ========================================================
// Main Page
// ========================================================
export default function Main() {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const isAuthed = Boolean(token && user);
  const [palette, setPalette] = useState(initialPalette);

  // Keep the small UI accent in step with the particle palette
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--home-accent", PALETTES[palette].accent);
    try {
      localStorage.setItem(PALETTE_STORAGE_KEY, palette);
    } catch {
      // storage unavailable: the choice just won't persist
    }
    return () => root.style.removeProperty("--home-accent");
  }, [palette]);

  const handleLogin = useCallback(
    (e) => {
      e?.preventDefault();
      navigate(isAuthed ? "/chat" : "/login");
    },
    [navigate, isAuthed]
  );

  return (
    <MotionConfig reducedMotion="user">
      <div className="home">
        <ParticleMorph palette={palette} />
        <CursorRing />
        {SHOW_PALETTE_SWITCHER && <PaletteSwitcher value={palette} onChange={setPalette} />}

        <div className="home-content">
          <Header onLogin={handleLogin} isAuthed={isAuthed} user={user} />

          <main>
            <Hero onLogin={handleLogin} isAuthed={isAuthed} />
            <Features />
            <Trust />
            <Pricing onSelect={handleLogin} />
            <Team />
            <UploadCta isAuthed={isAuthed} onLogin={handleLogin} />
          </main>

          <Footer />
        </div>
      </div>
    </MotionConfig>
  );
}
