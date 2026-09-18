import { useCallback, useEffect, useRef, useState } from "react";

// Purr's voice. Prefers the local neural voice from the backend (Piper) and falls back
// to the browser's built-in speech synthesis when that isn't available.

const API = import.meta.env.VITE_SERVER_URL || "http://localhost:8000";
const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
const CHUNK = 180;

// Language → preferred Piper model, when the server has it
const VOICE_FOR_LANG = {
  en: ["en_US-hfc_female-medium", "en_GB-jenny_dioco-medium"],
  ru: ["ru_RU-irina-medium"],
};

export function speakableText(text) {
  return (text || "")
    .replace(/```[\s\S]*?```/g, " (code block) ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "a link")
    .replace(/[*_#>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function chunkText(text) {
  const parts = [];
  let current = "";
  for (const sentence of text.split(/(?<=[.!?…])\s+/)) {
    if ((current + sentence).length > CHUNK && current) {
      parts.push(current.trim());
      current = "";
    }
    if (sentence.length > CHUNK) {
      for (const piece of sentence.match(new RegExp(`.{1,${CHUNK}}(\\s|$)`, "g")) || [sentence]) parts.push(piece.trim());
    } else {
      current += `${sentence} `;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts.filter(Boolean);
}

export default function useSpeaker(lang = "en-US") {
  const browserSupported = Boolean(synth);
  const [speaking, setSpeaking] = useState(false);
  const [serverVoices, setServerVoices] = useState([]);
  const voicesRef = useRef([]);
  const audioRef = useRef(null);
  const abortRef = useRef(null);
  const cancelledRef = useRef(false);

  // which local voices the backend has (empty → browser voice only)
  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem("token");
    if (!token) return undefined;
    fetch(`${API}/voices`, { headers: { authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.voices) setServerVoices(data.voices);
      })
      .catch(() => {
        /* backend voice unavailable: browser fallback */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!browserSupported) return undefined;
    const load = () => {
      voicesRef.current = synth.getVoices();
    };
    load();
    synth.addEventListener?.("voiceschanged", load);
    return () => {
      synth.removeEventListener?.("voiceschanged", load);
      synth.cancel();
    };
  }, [browserSupported]);

  const stop = useCallback(() => {
    cancelledRef.current = true;
    abortRef.current?.abort();
    abortRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      URL.revokeObjectURL(audioRef.current.src);
      audioRef.current = null;
    }
    synth?.cancel();
    setSpeaking(false);
  }, []);

  const speakInBrowser = useCallback(
    (clean) => {
      if (!browserSupported) return;
      synth.cancel();
      const voice =
        voicesRef.current.find((v) => v.lang === lang && /natural|google|premium/i.test(v.name)) ||
        voicesRef.current.find((v) => v.lang === lang) ||
        voicesRef.current.find((v) => v.lang?.startsWith(lang.slice(0, 2)));
      const parts = chunkText(clean);
      setSpeaking(true);
      parts.forEach((part, index) => {
        const utterance = new SpeechSynthesisUtterance(part);
        utterance.lang = lang;
        if (voice) utterance.voice = voice;
        utterance.rate = 1.02;
        utterance.pitch = 1.05;
        if (index === parts.length - 1) {
          utterance.onend = () => {
            if (!cancelledRef.current) setSpeaking(false);
          };
        }
        utterance.onerror = () => setSpeaking(false);
        synth.speak(utterance);
      });
    },
    [browserSupported, lang]
  );

  const speak = useCallback(
    async (text) => {
      const clean = speakableText(text);
      if (!clean) return;
      stop();
      cancelledRef.current = false;

      const wanted = (VOICE_FOR_LANG[lang.slice(0, 2)] || []).find((v) => serverVoices.includes(v));
      const token = localStorage.getItem("token");

      if (wanted && token) {
        setSpeaking(true);
        const controller = new AbortController();
        abortRef.current = controller;
        try {
          const response = await fetch(`${API}/speak`, {
            method: "POST",
            headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
            body: JSON.stringify({ text: clean, voice: wanted }),
            signal: controller.signal,
          });
          if (!response.ok) throw new Error(String(response.status));
          const blob = await response.blob();
          if (cancelledRef.current) return;
          const audio = new Audio(URL.createObjectURL(blob));
          audioRef.current = audio;
          audio.onended = () => {
            setSpeaking(false);
            audioRef.current = null;
          };
          audio.onerror = () => {
            setSpeaking(false);
            speakInBrowser(clean);
          };
          await audio.play();
          return;
        } catch (err) {
          if (err.name === "AbortError" || cancelledRef.current) return;
          // server voice failed — keep going with the browser one
        } finally {
          abortRef.current = null;
        }
      }

      speakInBrowser(clean);
    },
    [lang, serverVoices, speakInBrowser, stop]
  );

  return {
    supported: browserSupported || serverVoices.length > 0,
    usingLocalVoice: (VOICE_FOR_LANG[lang.slice(0, 2)] || []).some((v) => serverVoices.includes(v)),
    speaking,
    speak,
    stop,
  };
}
