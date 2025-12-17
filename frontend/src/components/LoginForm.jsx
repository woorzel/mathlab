import { useState, useEffect } from "react";
import { useToast } from "./ToastHost.jsx";
import { useNavigate } from "react-router-dom";
import { apiPost } from "../api";
import { makeT } from "../i18n";
const t = makeT('Auth');
const APP_NAME = 'MathLab';
const uiLang = (typeof localStorage !== 'undefined' && (localStorage.getItem('lang') || 'pl') === 'en') ? 'en' : 'pl';
const TT = (pl, en) => (uiLang === 'en' ? en : pl);

export default function LoginForm({ onLogged }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  const routeForRole = (role) =>
    String(role || "").toUpperCase() === "TEACHER" ? "/t/start" : "/student";

  function mapErrorToKey(msg) {
    const m = (msg || '').toLowerCase();
    if (m.includes('invalid credentials')) return 'invalidCreds';
    if (m.includes('email already used')) return 'emailUsed';
    return null; // fallback to raw text
  }

  async function submit(e) {
    e.preventDefault();
    setErr("");

    // Frontowa walidacja: min. 8 znaków
    if (!password || password.length < 8) {
      setErr(t('minPasswordMsg'));
      return;
    }

    setBusy(true);
    try {
      // backend zwraca: { token, role, userId, email }
      const json = await apiPost("/api/auth/login", { email, password });
      onLogged?.(json);
      toast.success(t('registerSuccess') || 'Logged in');
      navigate(routeForRole(json.role), { replace: true });
    } catch (ex) {
      const raw = ex?.message ? String(ex.message) : String(ex);
      const code = ex?.code ? String(ex.code).toUpperCase() : '';
      const status = typeof ex?.status === 'number' ? ex.status : undefined;
      let key = mapErrorToKey(raw);
      if (!key) {
        if (code === 'AUTH_INVALID_CREDENTIALS' || status === 401) key = 'invalidCreds';
        else if (code === 'EMAIL_ALREADY_USED') key = 'emailUsed';
      }
      const uiMsg = key ? t(key) : raw || t('genericError');
      setErr(uiMsg);
      toast.error(uiMsg);
    } finally {
      setBusy(false);
    }
  }

  // Ustaw tytuł strony dla ekranu logowania
  useEffect(() => {
    try { document.title = `${APP_NAME} – ${TT('Logowanie', 'Login')}`; } catch {}
  }, []);

  return (
    <div className="relative">
      {/* delikatne tło jak na innych stronach */}
      <div className="pointer-events-none absolute -inset-6 -z-10">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#f8fafc_0%,#f1f5f9_45%,#eef6fb_100%)]" />
        <div className="absolute -top-20 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-sky-300/15 blur-[90px]" />
        <div className="absolute bottom-0 right-6 h-72 w-72 rounded-full bg-indigo-300/10 blur-[100px]" />
        <div className="absolute inset-0 opacity-[0.04] [background:radial-gradient(#0f172a_0.8px,transparent_0.8px)] [background-size:8px_8px]" />
      </div>

      {/* CZOŁÓWKA / HERO aplikacji */}
      <section className="mb-4 overflow-hidden rounded-2xl bg-white/90 shadow-sm ring-1 ring-slate-200">
        <div className="relative">
          <div className="absolute inset-x-0 -top-10 h-24 bg-gradient-to-r from-sky-200/30 via-indigo-200/30 to-cyan-200/30 blur-2xl" />
          <div className="relative grid gap-4 p-5 md:grid-cols-[1fr_280px] md:items-center">
            <div>
              <h1 className="text-3xl font-black tracking-tight text-slate-900">{APP_NAME}</h1>
              <p className="mt-1 text-sm text-slate-600">
                {t('heroMainDesc')}
              </p>
              <div className="mt-2 text-xs text-slate-600">
                {t('heroSubDesc')}
              </div>
              <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                <li>• {t('heroBullet1')}</li>
                <li>• {t('heroBullet2')}</li>
                <li>• {t('heroBullet3')}</li>
                <li>• {t('heroBullet4')}</li>
              </ul>
            </div>
            <div className="hidden md:block">
              {/* Przyjazna ilustracja: słońce + liczby */}
              <svg width="280" height="160" viewBox="0 0 280 160" fill="none" aria-hidden="true">
                <rect x="0" y="0" width="280" height="160" rx="16" fill="#f8fafc" />
                <circle cx="60" cy="60" r="22" fill="#fde68a" stroke="#f59e0b" strokeWidth="2" />
                {Array.from({length:8}).map((_,i)=>null)}
                <line x1="60" y1="26" x2="60" y2="14" stroke="#f59e0b" strokeWidth="2" />
                <line x1="86" y1="34" x2="96" y2="26" stroke="#f59e0b" strokeWidth="2" />
                <line x1="98" y1="60" x2="110" y2="60" stroke="#f59e0b" strokeWidth="2" />
                <line x1="86" y1="86" x2="96" y2="94" stroke="#f59e0b" strokeWidth="2" />
                <line x1="60" y1="94" x2="60" y2="106" stroke="#f59e0b" strokeWidth="2" />
                <line x1="34" y1="86" x2="24" y2="94" stroke="#f59e0b" strokeWidth="2" />
                <line x1="22" y1="60" x2="10" y2="60" stroke="#f59e0b" strokeWidth="2" />
                <line x1="34" y1="34" x2="24" y2="26" stroke="#f59e0b" strokeWidth="2" />

                {/* Uśmiechnięta buźka */}
                <circle cx="52" cy="56" r="3" fill="#b45309" />
                <circle cx="68" cy="56" r="3" fill="#b45309" />
                <path d="M52 66 C60 72, 68 66, 68 66" stroke="#b45309" strokeWidth="2" fill="none" />

                {/* Kolorowe klocki z liczbami */}
                <rect x="140" y="90" width="32" height="22" rx="4" fill="#dbeafe" stroke="#60a5fa" />
                <rect x="176" y="90" width="32" height="22" rx="4" fill="#ede9fe" stroke="#a78bfa" />
                <rect x="212" y="90" width="32" height="22" rx="4" fill="#dcfce7" stroke="#34d399" />
                <text x="150" y="106" fontSize="14" fill="#1e40af">1</text>
                <text x="186" y="106" fontSize="14" fill="#4c1d95">+</text>
                <text x="224" y="106" fontSize="14" fill="#065f46">2</text>
                <text x="246" y="106" fontSize="14" fill="#334155">=</text>
                <text x="260" y="106" fontSize="14" fill="#334155">3</text>
              </svg>
            </div>
          </div>
        </div>
      </section>

      <div className="overflow-hidden rounded-2xl bg-white/80 shadow-sm ring-1 ring-slate-200 backdrop-blur-sm">
        {/* hero pasek */}
        <div className="relative">
          <div className="absolute inset-x-0 -top-10 h-24 bg-gradient-to-r from-sky-200/30 via-indigo-200/30 to-cyan-200/30 blur-2xl" />
          <div className="relative px-5 py-4">
            <h2 className="text-xl font-black tracking-tight text-slate-900">{t('loginTitle')}</h2>
            <p className="mt-1 text-sm text-slate-600">
              {t('loginDesc')}
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="grid gap-3 px-5 pb-5">
          <label className="text-xs font-medium text-slate-700">{t('emailLabel')}</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onInvalid={(e) => { e.preventDefault(); const v = e.target.value; if(!v) e.target.setCustomValidity(t('emailRequired')); else e.target.setCustomValidity(t('emailInvalid')); }}
            onInput={(e) => { e.target.setCustomValidity(''); }}
            placeholder={t('emailPlaceholder')}
            type="email"
            required
            autoComplete="username"
            className="rounded-xl border border-slate-300 px-3 py-2 text-[15px] outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
          />

          <label className="mt-1 text-xs font-medium text-slate-700">{t('passwordLabel')}</label>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onInvalid={(e) => { e.preventDefault(); const v = e.target.value; if(!v) e.target.setCustomValidity(t('passwordRequired')); else e.target.setCustomValidity(t('minPasswordMsg')); }}
            onInput={(e) => { e.target.setCustomValidity(''); }}
            type="password"
            placeholder={t('passwordPlaceholder')}
            required
            autoComplete="current-password"
            className="rounded-xl border border-slate-300 px-3 py-2 text-[15px] outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
          />

          <button
            disabled={busy}
            className={[
              "mt-2 rounded-xl px-4 py-2 text-sm font-semibold transition active:scale-[0.99]",
              "border border-slate-900 bg-slate-900 text-white",
              busy ? "cursor-not-allowed opacity-70" : "hover:opacity-95",
            ].join(" ")}
          >
            {busy ? t('logging') : t('loginBtn')}
          </button>

          {/* still keep inline error for accessibility (toast is transient) */}
          {err && (
            <div aria-live="assertive" className="mt-1 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800 ring-1 ring-rose-200">
              {err}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
