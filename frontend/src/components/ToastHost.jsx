import { useEffect, useState, useRef } from 'react';
import { getLang, makeT } from '../i18n';

// Simple global pub/sub
const listeners = new Set();
export function pushToast(toast) {
  const id = Math.random().toString(36).slice(2);
  const full = { id, ttl: 4000, ...toast };
  listeners.forEach((l) => l(full));
}

const tCommon = {
  pl: { dismiss: 'Zamknij' },
  en: { dismiss: 'Dismiss' }
};

export function ToastHost() {
  const [items, setItems] = useState([]);
  const timers = useRef(new Map());
  const lang = getLang();

  useEffect(() => {
    const handler = (toast) => {
      setItems((prev) => [...prev, toast]);
    };
    listeners.add(handler);
    return () => listeners.delete(handler);
  }, []);

  useEffect(() => {
    items.forEach((it) => {
      if (!timers.current.has(it.id)) {
        const to = setTimeout(() => {
          setItems((prev) => prev.filter((p) => p.id !== it.id));
          timers.current.delete(it.id);
        }, it.ttl);
        timers.current.set(it.id, to);
      }
    });
  }, [items]);

  function remove(id) {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setItems((prev) => prev.filter((p) => p.id !== id));
  }

  if (!items.length) return null;
  return (
    <div aria-live="polite" className="pointer-events-none fixed top-4 right-4 z-50 flex w-80 flex-col gap-3">
      {items.map((it) => (
        <div
          key={it.id}
          className={`pointer-events-auto rounded-xl border px-4 py-3 shadow-md backdrop-blur-sm ${
            it.type === 'error' ? 'border-rose-300 bg-rose-50/90 text-rose-900' : it.type === 'success' ? 'border-emerald-300 bg-emerald-50/90 text-emerald-900' : 'border-slate-300 bg-white/90 text-slate-900'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="flex-1 text-sm">
              {it.title && <div className="font-semibold mb-0.5">{it.title}</div>}
              <div>{typeof it.message === 'function' ? it.message() : it.message}</div>
            </div>
            <button
              onClick={() => remove(it.id)}
              className="rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              {tCommon[lang].dismiss}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export function useToast() {
  return {
    info(msg, opts = {}) { pushToast({ type: 'info', message: msg, ...opts }); },
    success(msg, opts = {}) { pushToast({ type: 'success', message: msg, ...opts }); },
    error(msg, opts = {}) { pushToast({ type: 'error', message: msg, ...opts }); },
  };
}
