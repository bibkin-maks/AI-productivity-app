import { useCallback, useEffect, useRef, useState } from "react";

// Microphone input with two paths:
//  1. the browser's Web Speech API (instant, live transcript) when it works, and
//  2. record → POST /transcribe on our backend, used when the browser API isn't
//     available or fails. Edge and Chromium builds without Google's speech service
//     return a bare "network" error, which is what most people hit.

const API = import.meta.env.VITE_SERVER_URL || "http://localhost:8000";
const SpeechRecognition = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
const canRecord = typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== "undefined";

const ERRORS = {
  "not-allowed": "Microphone access is blocked. Allow it in your browser's site settings.",
  "service-not-allowed": "Microphone access is blocked by your browser or system settings.",
  "audio-capture": "No microphone found.",
  aborted: null,
  "no-speech": "I didn't catch that. Try again.",
};
// these mean the browser's speech service can't be reached — switch to recording
const FALLBACK_ERRORS = new Set(["network", "service-not-allowed", "language-not-supported", "bad-grammar"]);

function pickMimeType() {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
  return candidates.find((type) => MediaRecorder.isTypeSupported?.(type)) || "";
}

export default function useVoice(lang = "en-US") {
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState(null);
  const [mode, setMode] = useState(SpeechRecognition ? "browser" : canRecord ? "recorder" : "none");

  const recognitionRef = useRef(null);
  const finalRef = useRef("");
  const wantedRef = useRef(false);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const modeRef = useRef(mode);
  modeRef.current = mode;

  // ---------------------------------------------------------------- recorder path
  const startRecording = useCallback(async () => {
    if (!canRecord) {
      setError("This browser can't record audio.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data?.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, { type: mimeType || "audio/webm" });
        chunksRef.current = [];
        if (blob.size < 1200) {
          setTranscribing(false);
          return; // basically silence
        }
        setTranscribing(true);
        try {
          const form = new FormData();
          form.append("audio", blob, `speech.${(mimeType.split("/")[1] || "webm").split(";")[0]}`);
          form.append("language", lang);
          const response = await fetch(`${API}/transcribe`, {
            method: "POST",
            headers: { authorization: `Bearer ${localStorage.getItem("token")}` },
            body: form,
          });
          if (!response.ok) throw new Error(String(response.status));
          const data = await response.json();
          if (data.text) setTranscript(data.text);
          else setError("I didn't catch that. Try again.");
        } catch {
          setError("Couldn't transcribe that recording. Please try again.");
        } finally {
          setTranscribing(false);
        }
      };
      recorderRef.current = recorder;
      recorder.start();
      setListening(true);
      // note: no setError(null) here — the caller may have just explained the fallback
    } catch (err) {
      setListening(false);
      setError(
        err?.name === "NotAllowedError"
          ? "Microphone access is blocked. Allow it in your browser's site settings."
          : "Couldn't start the microphone."
      );
    }
  }, [lang]);

  const stopRecording = useCallback(() => {
    setListening(false);
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }, []);

  // ---------------------------------------------------------------- browser speech path
  useEffect(() => {
    if (!SpeechRecognition) return undefined;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalRef.current += result[0].transcript;
        else interim += result[0].transcript;
      }
      setTranscript((finalRef.current + interim).trim());
      setError(null);
    };
    recognition.onerror = (event) => {
      if (FALLBACK_ERRORS.has(event.error)) {
        // the browser's speech service is unreachable: switch to recording for good
        setMode("recorder");
        wantedRef.current = false;
        if (canRecord) {
          setError("Switched to on-device recording — your browser's speech service wasn't reachable.");
          startRecording();
        } else {
          setListening(false);
          setError("Speech recognition isn't available in this browser.");
        }
        return;
      }
      wantedRef.current = false;
      setListening(false);
      const message = ERRORS[event.error] ?? `Speech recognition failed (${event.error}).`;
      if (message) setError(message);
    };
    recognition.onend = () => {
      if (wantedRef.current) {
        try {
          recognition.start();
          return;
        } catch {
          // fall through
        }
      }
      setListening(false);
    };

    recognitionRef.current = recognition;
    return () => {
      wantedRef.current = false;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      try {
        recognition.abort();
      } catch {
        // already stopped
      }
      recognitionRef.current = null;
    };
  }, [lang, startRecording]);

  // ---------------------------------------------------------------- shared controls
  const start = useCallback(() => {
    setTranscript("");
    finalRef.current = "";
    setError(null);
    if (modeRef.current === "recorder") {
      startRecording();
      return;
    }
    const recognition = recognitionRef.current;
    if (!recognition || wantedRef.current) return;
    wantedRef.current = true;
    try {
      recognition.start();
    } catch {
      // already running
    }
    setListening(true);
  }, [startRecording]);

  const stop = useCallback(() => {
    if (modeRef.current === "recorder") {
      stopRecording();
      return;
    }
    wantedRef.current = false;
    setListening(false);
    try {
      recognitionRef.current?.stop();
    } catch {
      // not running
    }
  }, [stopRecording]);

  const toggle = useCallback(() => {
    const active = modeRef.current === "recorder" ? Boolean(recorderRef.current) : wantedRef.current;
    return active ? stop() : start();
  }, [start, stop]);

  useEffect(() => () => {
    try {
      recorderRef.current?.stop();
    } catch {
      // nothing to stop
    }
  }, []);

  return {
    supported: mode !== "none",
    mode, // "browser" (live transcript) or "recorder" (transcribed after you stop)
    listening,
    transcribing,
    transcript,
    error,
    start,
    stop,
    toggle,
    clearError: () => setError(null),
  };
}
