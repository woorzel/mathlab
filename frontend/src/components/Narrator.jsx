import { useEffect, useState, useRef } from "react";

const LS_KEY = "narrator:settings";

function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(LS_KEY)) || {};
    if (s && s.voiceURI) delete s.voiceURI;
    return s;
  } catch {
    return {};
  }
}

export default function Narrator({ lang }) {
  const [available] = useState(
    typeof window !== "undefined" && !!window.speechSynthesis
  );
  const [voices, setVoices] = useState([]);
  const [settings, setSettings] = useState(() => ({
    open: false,
    hoverRead: false,
    hoverDelayMs: 350,
    rate: 1,
    pitch: 1,
    volume: 1,
    ...loadSettings(),
  }));
  const [selectedVoice, setSelectedVoice] = useState(null);

  const utterRef = useRef(null);
  const hoverTimer = useRef(null);
  const lastHoverEl = useRef(null);
  const [statusMsg, setStatusMsg] = useState("");

  // język UI – tylko z App (spójny dla ucznia i nauczyciela)
  const uiLang = lang === "en" ? "en" : "pl";

  // zapis ustawień do localStorage
  useEffect(() => {
    try {
      const s = { ...settings };
      if (s && s.voiceURI) delete s.voiceURI;
      localStorage.setItem(LS_KEY, JSON.stringify(s));
    } catch {}
  }, [settings]);

  // pobieranie listy głosów
  useEffect(() => {
    if (!available) return;
    const synth = window.speechSynthesis;
    function update() {
      setVoices(synth.getVoices ? synth.getVoices() : []);
    }
    update();
    synth.addEventListener?.("voiceschanged", update);
    return () => synth.removeEventListener?.("voiceschanged", update);
  }, [available]);

  // wybór najlepszego głosu dla języka
  const pickVoice = (langCode, vs) => {
    if (!vs || vs.length === 0) return null;
    const desired = (String(langCode || "").toLowerCase()).trim();

    let candidates = vs.slice();
    try {
      if (desired.startsWith("en")) {
        const filtered = candidates.filter(
          (v) => !String(v.lang || "").toLowerCase().startsWith("pl")
        );
        if (filtered.length > 0) candidates = filtered;
      } else if (desired.startsWith("pl")) {
        const filtered = candidates.filter(
          (v) => !String(v.lang || "").toLowerCase().startsWith("en")
        );
        if (filtered.length > 0) candidates = filtered;
      }
    } catch {}

    function score(v) {
      let s = 0;
      const vl = String(v.lang || "").toLowerCase();
      const name = String(v.name || "").toLowerCase();
      if (desired && vl.startsWith(desired)) s += 300;
      if (desired && name.includes(desired)) s += 150;
      if (
        desired.startsWith("en") &&
        /english|us|uk|en-/i.test(v.name || v.lang || "")
      )
        s += 80;
      if (
        desired.startsWith("pl") &&
        /polish|polski|pl-/i.test(v.name || v.lang || "")
      )
        s += 80;
      if (desired.startsWith("en") && vl.startsWith("pl")) s -= 500;
      if (desired.startsWith("pl") && vl.startsWith("en")) s -= 500;
      if (/google/i.test(name)) s += 10;
      if (vl) s += 5;
      return s;
    }

    let best = candidates[0];
    let bestScore = score(best);
    for (const v of candidates) {
      const sc = score(v);
      if (sc > bestScore) {
        best = v;
        bestScore = sc;
      }
    }
    return best || null;
  };

  const UI_LABELS = {
    en: {
      title: "Narrator (Ctrl+Alt+N)",
      readHover: "Read on hover",
      delay: "Delay",
      readSelection: "Read selection",
      readPage: "Read page",
      voiceLabel: "Voice",
      speed: "Speed",
      volume: "Volume",
      stop: "Stop",
      noSupport: "Your browser does not support SpeechSynthesis API.",
      shortcutHint: "Shortcut: Ctrl+Alt+N",
      noSelection: "No selection",
      panelLabel: "Narrator panel",
      speaking: "Narrator: speaking",
      stopped: "Narrator: stopped",
      lector: "Voice",
    },
    pl: {
      title: "Narrator (Ctrl+Alt+N)",
      readHover: "Czytaj przy najechaniu",
      delay: "Opóźnienie",
      readSelection: "Czytaj zaznaczenie",
      readPage: "Czytaj stronę",
      voiceLabel: "Lektor",
      speed: "Szybkość",
      volume: "Głośność",
      stop: "Stop",
      noSupport:
        "Twoja przeglądarka nie wspiera SpeechSynthesis API.",
      shortcutHint: "Skrót: Ctrl+Alt+N",
      noSelection: "Brak zaznaczenia.",
      panelLabel: "Panel narratora",
      speaking: "Narrator: czyta",
      stopped: "Narrator: zatrzymany",
      lector: "Lektor",
    },
  };

  const labels = UI_LABELS[uiLang];

  // wybór głosu przy zmianie języka / listy głosów
  useEffect(() => {
    try {
      const v = pickVoice(uiLang, voices);
      setSelectedVoice(v || null);
    } catch {
      setSelectedVoice(null);
    }
  }, [voices, uiLang]);

  function stop() {
    if (!available) return;
    window.speechSynthesis.cancel();
    utterRef.current = null;
    try {
      setStatusMsg(labels.stopped || "");
      setTimeout(() => setStatusMsg(""), 1500);
    } catch {}
  }

  function speakText(text) {
    if (!available || !text) return;
    stop();
    const s = new SpeechSynthesisUtterance(String(text));

    const desiredLang = uiLang;
    let v = pickVoice(desiredLang, voices);

    if (!v) {
      v =
        voices.find(
          (x) =>
            x.lang &&
            x.lang
              .toLowerCase()
              .startsWith(String(desiredLang || "").toLowerCase())
        ) || null;
    }
    if (!v) v = voices[0] || null;

    try {
      setSelectedVoice(v || null);
    } catch {}

    if (v) {
      s.voice = v;
      if (v.lang) s.lang = v.lang;
    }

    try {
      setStatusMsg(labels.speaking || "");
    } catch {}

    s.rate = Number(settings.rate) || 1;
    s.pitch = Number(settings.pitch) || 1;
    s.volume = Number(settings.volume) ?? 1;
    s.onend = () => {
      utterRef.current = null;
      try {
        setStatusMsg(labels.stopped || "");
        setTimeout(() => setStatusMsg(""), 1500);
      } catch {}
    };
    s.onerror = () => {
      utterRef.current = null;
    };
    utterRef.current = s;
    try {
      window.speechSynthesis.speak(s);
    } catch (e) {
      console.warn("TTS failed", e);
    }
  }

  function shouldReadElement(el) {
    if (!el) return false;
    const tag = el.tagName?.toLowerCase?.();
    if (["input", "textarea", "button", "select", "svg"].includes(tag))
      return false;
    if (el.closest && el.closest('[data-narrator="false"]')) return false;
    if (el.closest('[aria-hidden="true"]')) return false;
    const style = window.getComputedStyle(el);
    if (style && (style.visibility === "hidden" || style.display === "none"))
      return false;
    const txt = (el.innerText || el.textContent || "").trim();
    if (!txt) return false;
    return true;
  }

  function extractTextForReading(el) {
    if (!el) return "";
    const aria =
      el.getAttribute?.("aria-label") ||
      el.getAttribute?.("aria-labelledby") ||
      null;
    if (aria && aria.trim()) return aria.trim();
    const alt = el.getAttribute?.("alt");
    if (alt) return alt.trim();
    const title = el.getAttribute?.("title");
    if (title) return title.trim();
    let txt = (el.innerText || el.textContent || "").trim();
    txt = txt.replace(/\s+/g, " ").trim();
    if (txt.length > 800) txt = txt.slice(0, 800) + ", ...";
    return txt;
  }

  // czytanie przy najechaniu
  useEffect(() => {
    function onOver(e) {
      if (!settings.hoverRead) return;
      const el = e.target;
      lastHoverEl.current = el;
      if (!shouldReadElement(el)) return;
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
      hoverTimer.current = setTimeout(() => {
        try {
          const sel = window.getSelection();
          if (sel && sel.toString().trim()) return;
        } catch {}
        if (lastHoverEl.current !== el) return;
        const text = extractTextForReading(el);
        if (text) speakText(text);
      }, Number(settings.hoverDelayMs) || 350);
    }

    function onOut() {
      if (hoverTimer.current) {
        clearTimeout(hoverTimer.current);
        hoverTimer.current = null;
      }
    }

    document.addEventListener("mouseover", onOver, { capture: true });
    document.addEventListener("mouseout", onOut, { capture: true });
    return () => {
      document.removeEventListener("mouseover", onOver, { capture: true });
      document.removeEventListener("mouseout", onOut, { capture: true });
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
    };
  }, [settings.hoverRead, settings.hoverDelayMs, voices]);

  // skrót Ctrl+Alt+N
  useEffect(() => {
    function onKey(e) {
      try {
        // Use layout-independent `code` when available (KeyN),
        // but fall back to key for older browsers or unexpected values.
        const k = (e.key || "").toLowerCase?.() || "";
        const code = e.code || "";
        // Accept either physical KeyN or character 'n' (case-insensitive).
        if (e.ctrlKey && e.altKey && (code === "KeyN" || k === "n")) {
          // Prevent browser/OS handling and stop propagation so the
          // shortcut reliably toggles the panel across layouts.
          try {
            e.preventDefault?.();
            e.stopPropagation?.();
          } catch {}
          // Toggle only the "read on hover" setting (checkbox). Do not
          // change `open` so the panel visibility is unaffected.
          setSettings((s) => ({ ...s, hoverRead: !s.hoverRead }));
        }
      } catch {}
    }

    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  return (
    <div
      className="fixed bottom-4 right-4 z-50"
      aria-hidden={!settings.open}
    >
      {/* aria-live status for screen readers */}
      <div
        id="narrator-status"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={{ position: "absolute", left: -9999, width: 1, height: 1, overflow: "hidden" }}
      >
        {statusMsg}
      </div>
      {/* przycisk otwierający panel */}
      <button
        className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-600 bg-slate-900 text-slate-100 shadow-lg hover:bg-slate-800"
        title={labels.title}
        aria-pressed={settings.open}
        aria-expanded={!!settings.open}
        aria-controls="narrator-panel"
        aria-label={labels.title}
        onClick={() =>
          setSettings((s) => ({ ...s, open: !s.open }))
        }
      >
        {settings.hoverRead ? "🔊" : "🗣️"}
      </button>

      {settings.open && (
        <div
          className="mt-2 w-80 rounded-2xl border border-slate-700 bg-slate-900/95 p-4 text-sm text-slate-100 shadow-2xl backdrop-blur-md"
          id="narrator-panel"
          role="region"
          aria-label={labels.panelLabel}
        >
          {/* hover + skrót */}
          <div className="mb-3 flex items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                className="h-4 w-4 accent-sky-500"
                checked={!!settings.hoverRead}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    hoverRead: e.target.checked,
                  }))
                }
              />
              <span>{labels.readHover}</span>
            </label>
            <div className="text-[10px] text-slate-400">
              {labels.shortcutHint}
            </div>
          </div>

          {/* delay */}
          <div className="mb-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-300">
                {labels.delay}
              </span>
              <span className="text-[10px] text-slate-500">
                {settings.hoverDelayMs} ms
              </span>
            </div>
            <input
              type="range"
              min="100"
              max="1500"
              step="50"
              value={settings.hoverDelayMs}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  hoverDelayMs: Number(e.target.value),
                }))
              }
              className="w-full accent-sky-500"
            />
          </div>

          {/* czytaj zaznaczenie / stronę */}
          <div className="mb-3 flex gap-2">
            <button
              onClick={() => {
                const sel =
                  window
                    .getSelection?.()
                    ?.toString?.()
                    ?.trim() || "";
                if (sel) speakText(sel);
                else speakText(labels.noSelection);
              }}
              className="flex-1 rounded-xl bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-sky-500"
            >
              {labels.readSelection}
            </button>
            <button
              onClick={() => {
                const main =
                  document.querySelector("main") || document.body;
                speakText(
                  (main && main.innerText)
                    ? main.innerText
                    : document.body.innerText
                );
              }}
              className="flex-1 rounded-xl bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-sky-500"
            >
              {labels.readPage}
            </button>
          </div>

          {/* głos */}
          <div className="mb-3 flex flex-col gap-0.5">
            <div className="text-xs text-slate-300">
              {labels.lector}
            </div>
            <div className="truncate text-[11px] text-slate-400">
              {selectedVoice
                ? `${selectedVoice.name}${
                    selectedVoice.lang
                      ? ` (${selectedVoice.lang})`
                      : ""
                  }`
                : `(${labels.voiceLabel || labels.lector})`}
            </div>
          </div>

          {/* szybkość */}
          <div className="mb-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-300">
                {labels.speed}
              </span>
              <span className="text-[10px] text-slate-500">
                {settings.rate.toFixed(1)}x
              </span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={settings.rate}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  rate: Number(e.target.value),
                }))
              }
              className="w-full accent-sky-500"
            />
          </div>

          {/* głośność */}
          <div className="mb-4 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-300">
                {labels.volume}
              </span>
              <span className="text-[10px] text-slate-500">
                {Math.round(settings.volume * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={settings.volume}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  volume: Number(e.target.value),
                }))
              }
              className="w-full accent-sky-500"
            />
          </div>

          {/* Stop */}
          <div>
            <button
              onClick={stop}
              className="w-full rounded-xl bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-100 shadow-sm hover:bg-slate-700"
            >
              {labels.stop}
            </button>
          </div>

          {!available && (
            <div className="mt-3 text-[11px] text-amber-300">
              {labels.noSupport}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
