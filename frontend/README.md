# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## i18n & Login Error Localization

The app uses a lightweight string map in `src/i18n.js`. Current language is read from `localStorage.getItem('lang')` (`'pl'` or `'en'`).

### Adding / Using Keys
Strings are grouped under feature namespaces (e.g. `Auth`, `TeacherSettings`). To fetch a string:

```js
import { makeT } from './i18n';
const t = makeT('Auth');
console.log(t('loginTitle'));
```

### Login Errors
Backend returns English messages (`Invalid credentials`, `Email already used`). The frontend maps these to translation keys so UI shows Polish or English appropriately.

Keys added:
- `invalidCreds`: Invalid credentials message
- `emailUsed`: Email already used (during registration)
- `genericError`: Fallback generic error

Mapping logic lives in `src/components/LoginForm.jsx` (`mapErrorToKey`). Unknown messages fall back to raw backend text or `genericError` if empty.

### Changing Language Manually
Open dev tools and run:

```js
localStorage.setItem('lang','en'); location.reload(); // English
localStorage.setItem('lang','pl'); location.reload(); // Polish
```

### Testing
1. Set language to English as above.
2. Open login form and enter wrong email/pass -> should show `Invalid credentials.` localized via i18n.
3. Switch to Polish (`'pl'`), repeat -> should show `Nieprawidłowe dane logowania.`
4. Attempt registering an existing email -> `Email already used.` / `Adres e-mail jest już użyty.`

If you introduce new backend error texts, add a condition in `mapErrorToKey` and a key in `i18n.js`.

## Unified Error Schema (Backend)

Auth & global exceptions now return JSON shape:

```json
{ "code": "AUTH_INVALID_CREDENTIALS", "message": "Invalid credentials" }
```

Validation errors:
```json
{
	"code": "VALIDATION_ERROR",
	"message": "Validation failed",
	"details": [ { "field": "email", "message": "must not be blank" } ]
}
```

Registration conflict:
```json
{ "code": "EMAIL_ALREADY_USED", "message": "Email already used" }
```

Frontend maps `err.code` (and `err.status`) to i18n keys (`invalidCreds`, `emailUsed`).

## Configurable API Base URL

Set `VITE_API_BASE` in `.env` (frontend root):
```
VITE_API_BASE=http://localhost:8080
```
`api.js` falls back to `http://localhost:8080` if missing.

## Language Switcher

Buttons in `App.jsx`, `TeacherNav.jsx`, `StudentNav.jsx` toggle `localStorage.lang` and reload. Add more languages by extending `STR` in `i18n.js`.

## Toast Notifications

Global toast system lives in `ToastHost.jsx` and is mounted in `App.jsx` (inside `<main>`). Use it:

```js
import { useToast } from './components/ToastHost.jsx';
const toast = useToast();
toast.success('Saved');
toast.error('Failed');
toast.info('Loading...');
```

Toasts auto‑dismiss after 4s; each also has a dismiss button for accessibility. Inline form error messages are kept for screen readers.

## Rate Limiting (Login)

Simple in‑memory limiter in `AuthController` blocks after 5 failed attempts per (email+IP) in a 5‑minute window.
Returns:

```json
{ "code": "RATE_LIMIT", "message": "Too many attempts. Please try again later." }
```

You can later swap to a distributed solution (Redis) by replacing the in‑memory map.

## Actuator & OpenAPI

Enabled dependencies: `spring-boot-starter-actuator`, `springdoc-openapi-starter-webmvc-ui`.
- Actuator endpoints exposed: `/actuator/health`, `/actuator/info`, `/actuator/metrics`.
- Swagger UI available at `/swagger-ui.html` (or `/swagger-ui/index.html`).



