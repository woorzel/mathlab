import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { apiGet } from "./api";
import { makeT } from "./i18n";

import TeacherHome from "./pages/TeacherHome.jsx";
import TeacherAssignments from "./pages/TeacherAssignments.jsx";
import TeacherSend from "./pages/TeacherSend.jsx";
import TeacherGrading from "./pages/TeacherGrading.jsx";
import TeacherGroups from "./pages/TeacherGroups.jsx";
import TeacherJournal from "./pages/TeacherJournal.jsx";
import TeacherSettings from "./pages/TeacherSettings.jsx";

import StudentHomework from "./pages/StudentHomework.jsx";
import StudentGrades from "./pages/StudentGrades.jsx";
import StudentStats from "./pages/StudentStats.jsx";
import StudentGroups from "./pages/StudentGroups.jsx";
import StudentHome from "./pages/StudentHome.jsx";
import StudentSettings from "./pages/StudentSettings";

import LoginForm from "./components/LoginForm.jsx";
import RegisterForm from "./components/RegisterForm.jsx";
import Narrator from "./components/Narrator.jsx";
import { ToastHost } from "./components/ToastHost.jsx";

const rolaPL = (r) =>
  r === "TEACHER" ? "NAUCZYCIEL" : r === "STUDENT" ? "UCZEŃ" : r;

export default function App() {
  const [auth, setAuth] = useState(() => {
    const s = localStorage.getItem("auth");
    return s ? JSON.parse(s) : null;
  });
  const [lang, setLang] = useState(() => {
    try {
      return localStorage.getItem("lang") === "en" ? "en" : "pl";
    } catch {
      return "pl";
    }
  });

  function setLanguage(l) {
    try {
      localStorage.setItem("lang", l);
    } catch {}
    setLang(l);
    try {
      window.dispatchEvent(
        new CustomEvent("app:lang-changed", { detail: l })
      );
    } catch {}
  }

  const tApp = makeT("App");

  function roleLabel(role) {
    if (role === "TEACHER")
      return lang === "en" ? "TEACHER" : "NAUCZYCIEL";
    if (role === "STUDENT")
      return lang === "en" ? "STUDENT" : "UCZEŃ";
    return role || "";
  }

  const [pokazRejestracje, setPokazRejestracje] = useState(false);

  function onLogged(a) {
    localStorage.setItem("auth", JSON.stringify(a));
    setAuth(a);
  }

  function logout() {
    localStorage.removeItem("auth");
    setAuth(null);
  }

  function updateAuth(patch) {
    setAuth((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      localStorage.setItem("auth", JSON.stringify(next));
      return next;
    });
  }

  // „ping” dla ucznia
  useEffect(() => {
    (async () => {
      if (!auth || auth.role !== "STUDENT") return;
      try {
        await apiGet(
          `/api/submissions?studentId=${auth.userId}`,
          auth.token
        );
      } catch {}
    })();
  }, [auth]);

  return (
    <BrowserRouter>
      {/* skip link for keyboard users */}
      <a href="#main-content" className="skip-link">
        {lang === "en" ? "Skip to main content" : "Przejdź do treści"}
      </a>

      {/* narrator z językiem z App – wspólny dla wszystkich ról */}
      <Narrator lang={lang} />

  <main id="main-content" tabIndex={-1}>
  <ToastHost />
      {!auth ? (
        <div className="mx-auto max-w-3xl p-4">
          <div className="mb-3 flex gap-2 items-center">
            <button
              onClick={() => setPokazRejestracje(false)}
              className={`rounded-xl px-3 py-1.5 text-sm ring-1 transition ${
                !pokazRejestracje
                  ? "bg-slate-900 text-white ring-slate-900"
                  : "bg-white text-slate-900 ring-slate-300 hover:bg-slate-50"
              }`}
            >
              {tApp("haveAccount")}
            </button>
            <button
              onClick={() => setPokazRejestracje(true)}
              className={`rounded-xl px-3 py-1.5 text-sm ring-1 transition ${
                pokazRejestracje
                  ? "bg-slate-900 text-white ring-slate-900"
                  : "bg-white text-slate-900 ring-slate-300 hover:bg-slate-50"
              }`}
            >
              {tApp("noAccount")}
            </button>

            <button
              onClick={() => setLanguage(lang === "en" ? "pl" : "en")}
              title="Language"
              className={`ml-1 rounded-xl px-3 py-1.5 text-sm ring-1 ${
                lang === "en"
                  ? "bg-slate-900 text-white ring-slate-900"
                  : "bg-white text-slate-900 ring-slate-300 hover:bg-slate-50"
              }`}
            >
              {lang === "en" ? "EN" : "PL"}
            </button>
          </div>

          {pokazRejestracje ? (
            <RegisterForm onLogged={onLogged} />
          ) : (
            <LoginForm onLogged={onLogged} />
          )}

          <Routes>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      ) : (
        <div className="mx-auto max-w-6xl p-4">
          <div className="mb-3 flex items-center gap-2">
            <div>
              {tApp("loggedInPrefix")} <b>{auth.email}</b> (
              {roleLabel(auth.role)})
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => setLanguage(lang === "en" ? "pl" : "en")}
                title="Language"
                className={`rounded-xl px-3 py-1.5 text-sm ring-1 ${
                  lang === "en"
                    ? "bg-slate-900 text-white ring-slate-900"
                    : "bg-white text-slate-900 ring-slate-300 hover:bg-slate-50"
                }`}
              >
                {lang === "en" ? "EN" : "PL"}
              </button>

              <button
                onClick={logout}
                className="rounded-xl bg-white px-3 py-1.5 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-slate-300 hover:bg-slate-50"
              >
                {tApp("logout")}
              </button>
            </div>
          </div>

          {auth.role === "TEACHER" ? (
            <Routes>
              <Route
                path="/"
                element={<Navigate to="/t/start" replace />}
              />
              <Route
                path="/teacher"
                element={<Navigate to="/t/start" replace />}
              />
              <Route
                path="/t"
                element={<Navigate to="/t/start" replace />}
              />

              <Route
                path="/t/start"
                element={<TeacherHome auth={auth} />}
              />
              <Route
                path="/t/zadania"
                element={<TeacherAssignments auth={auth} />}
              />
              <Route
                path="/t/wysylka"
                element={<TeacherSend auth={auth} />}
              />
              <Route
                path="/t/ocenianie"
                element={<TeacherGrading auth={auth} />}
              />
              <Route
                path="/t/grupy"
                element={<TeacherGroups auth={auth} />}
              />
              <Route
                path="/t/dziennik"
                element={<TeacherJournal auth={auth} />}
              />
              <Route
                path="/t/ustawienia"
                element={
                  <TeacherSettings
                    auth={auth}
                    onAuthUpdate={updateAuth}
                  />
                }
              />
              <Route
                path="*"
                element={<Navigate to="/t/start" replace />}
              />
            </Routes>
          ) : (
            <Routes>
              <Route
                path="/"
                element={<Navigate to="/student" replace />}
              />
              <Route
                path="/student"
                element={<StudentHome auth={auth} />}
              />
              <Route
                path="/student/zadania"
                element={<StudentHomework auth={auth} />}
              />
              <Route
                path="/student/oceny"
                element={<StudentGrades auth={auth} />}
              />
              <Route
                path="/student/statystyki"
                element={<StudentStats auth={auth} />}
              />
              <Route
                path="/student/grupy"
                element={<StudentGroups auth={auth} />}
              />
              <Route
                path="/student/ustawienia"
                element={
                  <StudentSettings
                    auth={auth}
                    onAuthUpdate={updateAuth}
                  />
                }
              />
              <Route
                path="*"
                element={<Navigate to="/student" replace />}
              />
            </Routes>
          )}
        </div>
      )}
      </main>
    </BrowserRouter>
  );
}
