import { useState } from "react";
import { useToast } from "./ToastHost.jsx";
import { useNavigate } from "react-router-dom";
import { apiPost } from "../api";
import { makeT } from "../i18n";
const t = makeT('Auth');

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

  return (
    <div className="relative">
      {/* delikatne tło jak na innych stronach */}
      <div className="pointer-events-none absolute -inset-6 -z-10">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#f8fafc_0%,#f1f5f9_45%,#eef6fb_100%)]" />
        <div className="absolute -top-20 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-sky-300/15 blur-[90px]" />
        <div className="absolute bottom-0 right-6 h-72 w-72 rounded-full bg-indigo-300/10 blur-[100px]" />
        <div className="absolute inset-0 opacity-[0.04] [background:radial-gradient(#0f172a_0.8px,transparent_0.8px)] [background-size:8px_8px]" />
      </div>

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
