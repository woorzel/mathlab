// src/api.js
// Base URL comes from Vite env (define VITE_API_BASE in .env or .env.local). Fallback to localhost for dev.
export const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";

function authHeader(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handle(res) {
  if (res.status === 204) return null;
  const text = await res.text();
  if (!res.ok) {
    let raw = text;
    let obj;
    try { obj = JSON.parse(text); } catch {}
    const code = obj?.code;
    const message = obj?.message || obj?.error || raw;
    const err = new Error(message || `HTTP ${res.status}`);
    if (code) err.code = code;
    err.status = res.status;
    throw err;
  }
  return text ? JSON.parse(text) : null;
}

export async function apiGet(path, token) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "GET",
    headers: { ...authHeader(token), Accept: "application/json" },
    credentials: "omit",
  });
  return handle(res);
}

export async function apiPost(path, body, token) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader(token) },
    body: JSON.stringify(body ?? {}),
    credentials: "omit",
  });
  return handle(res);
}

export async function apiPut(path, body, token) {
  // ⬅️ NAJWAŻNIEJSZA ZMIANA: path -> `${API_BASE}${path}`
  const res = await fetch(`${API_BASE}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeader(token) },
    body: JSON.stringify(body ?? {}),
    credentials: "omit",
  });
  return handle(res);
}

export async function apiDelete(path, token) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "DELETE",
    headers: { ...authHeader(token) },
    credentials: "omit",
  });
  // pozwól na 204 No Content
  if (res.status === 204) return true;
  return handle(res);
}
