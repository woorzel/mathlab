// src/pages/StudentSettings.jsx
import { useEffect, useState } from "react";
import { apiGet, apiPut } from "../api";
import StudentNav from "../components/StudentNav";
import { makeT } from "../i18n";
const t = makeT('StudentSettings');

function klass(...xs) { return xs.filter(Boolean).join(" "); }
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function pickErrorMessage(e, fallback = "Wystąpił błąd.") {
  const status = e?.status;
  const raw = String(e?.message || "").toUpperCase();
  const reason = (() => {
    const m = String(e?.message || "").match(/[A-Z_]{3,}/g);
    return m ? m[0] : null;
  })();

  if (status === 409 || /EMAIL_TAKEN|EMAIL.*EXIST/i.test(raw) || reason === "EMAIL_TAKEN") {
    return "Ten adres e-mail jest już zajęty.";
  }
  if (status === 403 || /BAD_OLD_PASSWORD/i.test(raw) || reason === "BAD_OLD_PASSWORD") {
    return "Stare hasło jest nieprawidłowe.";
  }
  if (status === 400 || /WEAK_PASSWORD|PASSWORD.*SHORT/i.test(raw) || reason === "WEAK_PASSWORD") {
    return "Nowe hasło jest zbyt krótkie (min. 8 znaków).";
  }
  if (status === 401) return "Sesja wygasła. Zaloguj się ponownie.";
  if (status === 403) return "Brak uprawnień do wykonania tej operacji.";
  return `${fallback}${status ? ` (HTTP ${status})` : ""}`;
}

export default function StudentSettings({ auth, onAuthUpdate }) {
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  // Profil
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  // Hasło
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [newPwd2, setNewPwd2] = useState("");
  const [pwdMsg, setPwdMsg] = useState("");

  // Motyw (light | dark)
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('theme') || 'light'; } catch { return 'light'; }
  });

  useEffect(() => {
    try { document.documentElement.setAttribute('data-theme', theme); localStorage.setItem('theme', theme); } catch {}
  }, [theme]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // dane /me z backendu
        let me;
        try {
          me = await apiGet(`/api/users/me`, auth.token);
        } catch (e) {
          // fallback na starsze API
          if (![404, 405, 501].includes(e?.status)) throw e;
          me = await apiGet(`/api/users/${auth.userId}`, auth.token);
        }
        if (!alive) return;
        setName(me?.name || "");
        setEmail(me?.email || "");
        setMsg("");
      } catch {
        if (alive) setMsg("Nie udało się pobrać danych profilu.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [auth]);

  async function saveProfile() {
    setMsg("");
    if (!name?.trim()) { setMsg("Podaj imię i nazwisko."); return; }
    if (!email?.trim() || !EMAIL_RE.test(email.trim())) {
      setMsg("Podaj poprawny adres e-mail."); return;
    }
    try {
      try {
        await apiPut(`/api/users/me`, { name: name.trim(), email: email.trim() }, auth.token);
      } catch (e) {
        if (![404, 405, 501].includes(e?.status)) throw e;
        await apiPut(`/api/users/${auth.userId}`, { name: name.trim(), email: email.trim() }, auth.token);
      }
      // aktualizacja nagłówka + localStorage (PATCH, nie pełny obiekt!)
      if (typeof onAuthUpdate === "function") onAuthUpdate({ email: email.trim(), name: name.trim() });
      setMsg("Zapisano dane profilu.");
    } catch (e) {
      setMsg(pickErrorMessage(e, "Nie udało się zapisać profilu."));
    }
  }

  async function changePassword() {
    setPwdMsg("");
    if (!oldPwd || !newPwd) { setPwdMsg("Uzupełnij stare i nowe hasło."); return; }
    if (newPwd !== newPwd2) { setPwdMsg("Nowe hasła nie są takie same."); return; }
    if (newPwd.length < 8) { setPwdMsg("Nowe hasło musi mieć co najmniej 8 znaków."); return; }

    try {
      try {
        await apiPut(`/api/users/me/password`, { oldPassword: oldPwd, newPassword: newPwd }, auth.token);
      } catch (e) {
        if (![404, 405, 501].includes(e?.status)) throw e;
        await apiPut(`/api/users/${auth.userId}/password`, { oldPassword: oldPwd, newPassword: newPwd }, auth.token);
      }
      setOldPwd(""); setNewPwd(""); setNewPwd2("");
      setPwdMsg("Hasło zostało zmienione.");
    } catch (e) {
      setPwdMsg(pickErrorMessage(e, "Nie udało się zmienić hasła."));
    }
  }

  return (
    <div className="relative min-h-[100svh] overflow-x-hidden">
      {/* tło */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#f8fafc_0%,#f1f5f9_45%,#eef6fb_100%)]" />
        <div className="absolute -top-24 left-1/3 h-80 w-80 rounded-full bg-sky-300/15 blur-[90px]" />
        <div className="absolute top-64 -left-20 h-72 w-72 rounded-full bg-indigo-300/10 blur-[90px]" />
        <div className="absolute bottom-24 right-10 h-96 w-96 rounded-full bg-cyan-300/10 blur-[100px]" />
        <div className="absolute inset-0 opacity-[0.04] [background:radial-gradient(#0f172a_0.8px,transparent_0.8px)] [background-size:8px_8px]" />
      </div>

      <div className="mx-auto max-w-6xl px-4 pb-20">
        <StudentNav auth={auth} />
  <header className="mt-6 rounded-2xl bg-white/80 backdrop-blur-sm shadow-sm ring-1 ring-slate-200">
          <div className="relative overflow-hidden rounded-2xl">
            <div className="absolute inset-x-0 -top-10 h-24 bg-gradient-to-r from-sky-200/30 via-indigo-200/30 to-cyan-200/30 blur-2xl" />
            <div className="relative grid gap-2 p-6 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <h1 className="text-3xl font-black tracking-tight text-slate-900">{t('title')}</h1>
                <p className="mt-1 text-sm text-slate-600">{t('heroDesc')}</p>
              </div>
              <div className="flex justify-start gap-2 md:justify-end">
                <span className="rounded-full bg-sky-600/10 px-3 py-1 text-xs font-semibold text-sky-700 ring-1 ring-sky-200">
                  {t('panelBadge')}
                </span>
              </div>
            </div>
          </div>
        </header>
      
 

        {msg && (
          <div className={klass(
            "mt-4 rounded-xl px-3 py-2 text-sm ring-1",
            msg.startsWith(t('errorPrefix')) ? "bg-rose-50 text-rose-800 ring-rose-200"
                                        : "bg-emerald-50 text-emerald-800 ring-emerald-200"
          )}>
            {msg}
          </div>
        )}

        <div className="mt-6 grid gap-4">
          {/* Profil */}
          <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">{t('profileHeading')}</h2>
            <p className="mt-1 text-sm text-slate-600">{t('profileDesc')}</p>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div>
                <div className="mb-1 text-xs text-slate-600">{t('nameLabel')}</div>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                  placeholder={t('namePlaceholder')}
                />
              </div>
              <div>
                <div className="mb-1 text-xs text-slate-600">{t('emailLabel')}</div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                  placeholder={t('emailPlaceholder')}
                />
              </div>
            </div>

            <div className="mt-3">
              <button
                onClick={saveProfile}
                disabled={loading}
                className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 active:scale-[0.99] disabled:opacity-60"
              >
                {t('saveProfileBtn')}
              </button>
              <span className="ml-2 text-xs text-slate-500">{t('emailChangeNote')}</span>
            </div>
          </section>

          {/* Hasło */}
          <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">{t('changePwdHeading')}</h2>
            <p className="mt-1 text-sm text-slate-600">{t('changePwdDesc')}</p>

            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <div>
                <div className="mb-1 text-xs text-slate-600">{t('oldPwdLabel')}</div>
                <input type="password" value={oldPwd} onChange={(e)=>setOldPwd(e.target.value)}
                       className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100" />
              </div>
              <div>
                <div className="mb-1 text-xs text-slate-600">{t('newPwdLabel')}</div>
                <input type="password" value={newPwd} onChange={(e)=>setNewPwd(e.target.value)}
                       className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100" />
              </div>
              <div>
                <div className="mb-1 text-xs text-slate-600">{t('repeatNewLabel')}</div>
                <input type="password" value={newPwd2} onChange={(e)=>setNewPwd2(e.target.value)}
                       className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100" />
              </div>
            </div>

            <div className="mt-3">
              <button
                onClick={changePassword}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 active:scale-[0.99]"
              >
                {t('changePwdBtn')}
              </button>
              {pwdMsg && (
                <span className={klass("ml-3 text-sm", pwdMsg.startsWith(t('errorPrefix')) ? "text-rose-700" : "text-emerald-700")}>
                  {pwdMsg}
                </span>
              )}
            </div>
          </section>

          {/* Appearance (theme) */}
          <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">{t('appearanceHeading')}</h2>
            <p className="mt-1 text-sm text-slate-600">{t('appearanceDesc')}</p>

            <div className="mt-3 flex items-center gap-4">
              <label className="inline-flex items-center gap-2">
                <input type="radio" name="theme" value="light" checked={theme==="light"} onChange={() => setTheme('light')} />
                <span className="text-sm">{t('themeLight')}</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="radio" name="theme" value="dark" checked={theme==="dark"} onChange={() => setTheme('dark')} />
                <span className="text-sm">{t('themeDark')}</span>
              </label>
            </div>
            <div className="mt-3 text-xs text-slate-500">{t('themeNote')}</div>
          </section>
        </div>

        {loading && <div className="mt-4 text-sm text-slate-500">{t('loading')}</div>}
      </div>
    </div>
  );
}
