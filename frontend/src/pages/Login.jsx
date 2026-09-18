import { useEffect, useCallback, useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { Link, useNavigate } from "react-router-dom";
import { MotionConfig } from "framer-motion";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { PurrAssistLogo } from "../assets/svgAssets";
import ParticleMorph from "../components/home/ParticleMorph";
import CursorRing from "../components/home/CursorRing";
import Reveal from "../components/home/Reveal";
import { PALETTES, savedPalette } from "../components/home/palettes";

import "./home.css";

// ========================================================================
// Login Page — same language as the home page (see frontend/design/style-spec.md)
// ========================================================================

export default function Login() {
  const navigate = useNavigate();
  const { login, user, token } = useAuth();
  const [palette] = useState(savedPalette);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  // Redirect if user is already authenticated
  useEffect(() => {
    if (token && user) {
      navigate("/chat");
    }
  }, [token, user, navigate]);

  // Keep the small UI accent in step with the particle palette
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--home-accent", PALETTES[palette].accent);
    return () => root.style.removeProperty("--home-accent");
  }, [palette]);

  // Handle Google login
  const handleLogin = useCallback(
    async (googleResponse) => {
      setError("");
      setPending(true);
      try {
        const response = await axios.post(
          `${import.meta.env.VITE_SERVER_URL}/userauth/`,
          { token: googleResponse.credential }
        );

        const { user, token } = response.data;

        login(user, token);
        navigate("/chat");
      } catch (err) {
        console.error("Login failed:", err);
        setError("We couldn't sign you in. Check your connection and try again.");
        setPending(false);
      }
    },
    [login, navigate]
  );

  return (
    <MotionConfig reducedMotion="user">
      <div className="home">
        <ParticleMorph palette={palette} />
        <CursorRing />

        <div className="home-content">
          <header className="home-header">
            <nav className="home-container home-header__bar" aria-label="Main">
              <Link to="/" className="home-wordmark">
                <PurrAssistLogo className="w-8 h-8" />
                ChatDoc
              </Link>
              <Link to="/" className="home-nav__link">
                <span aria-hidden="true">← </span>Back to home
              </Link>
            </nav>
          </header>

          <main>
            <section className="home-section home-hero" data-shape="shield" data-side="right" aria-labelledby="login-title">
              <div className="home-container">
                <div className="max-w-2xl">
                  <Reveal as="p" className="home-label mb-8">
                    <span className="inline-block w-2 h-2 rounded-full bg-[var(--home-accent)] mr-3 align-middle" aria-hidden="true" />
                    Your workspace
                  </Reveal>

                  <h1 id="login-title" className="home-display home-h1">
                    <Reveal as="span" className="block home-outline">Welcome</Reveal>
                    <Reveal as="span" delay={0.1} className="block">back<span className="text-[var(--home-accent)]">.</span></Reveal>
                  </h1>

                  <Reveal delay={0.2} as="p" className="home-lead mt-10">
                    Sign in to pick up <strong>your chats, notes and calendar</strong> where you left them.
                  </Reveal>

                  <Reveal delay={0.3} className="mt-12 border-t border-[var(--home-rule)] pt-8">
                    <div className={pending ? "opacity-50 pointer-events-none" : undefined} aria-busy={pending}>
                      <GoogleLogin
                        onSuccess={handleLogin}
                        onError={() => setError("Google sign-in was cancelled or failed. Please try again.")}
                        theme="filled_black"
                        size="large"
                        shape="pill"
                        text="continue_with"
                        width="320"
                        useOneTap={false}
                      />
                    </div>

                    <p role="status" aria-live="polite" className="home-body !text-base mt-6 min-h-[1.6em]">
                      {pending ? "Signing you in…" : error && <span className="text-white">{error}</span>}
                    </p>

                    <p className="home-label !text-xs mt-2">
                      No password <span aria-hidden="true">·</span> Verified by Google <span aria-hidden="true">·</span> Opens your chat
                    </p>
                  </Reveal>
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>
    </MotionConfig>
  );
}
