# Accessibility audit & action plan

This document describes a lightweight WCAG 2.1 AA audit plan for the MathLab application, a list of quick fixes already applied, and further recommended changes.

---

## What I applied in this commit
- Added keyboard "skip link" styles and focus-visible improvements in `src/index.css` so keyboard users see a clear focus indicator.
- Made the top navigation regions semantic by using `<nav aria-label>` in `src/components/StudentNav.jsx` and `src/components/TeacherNav.jsx`.

These changes improve keyboard navigation and give assistive technologies clear navigation landmarks.

---

## How to run an automated accessibility audit (suggested)
1. Lighthouse (Chrome):
   - Open DevTools → Lighthouse → Accessibility → Generate report.
   - Save the report (HTML) into `docs/lighthouse/` and attach to your thesis.

2. axe-core (browser extension or CLI):
   - Install the axe DevTools browser extension and run it on main flows; export results.
   - Or run axe-core programmatically in tests (see below).

3. Playwright + axe: add an automated check in CI to run a11y scans on critical pages.

Suggested Playwright + axe snippet (conceptual):

```js
// playwright test snippet (concept)
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('home page should have no critical a11y defects', async ({ page }) => {
  await page.goto('http://localhost:5173');
  const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScanResults.violations.length).toBe(0);
});
```

---

## Checklist (WCAG 2.1 AA) — recommended fixes and verifications

1. Keyboard accessibility
   - Ensure all interactive controls (buttons, links, selects) are reachable with Tab and that custom widgets are operable with Enter/Space.
   - Add a visible "skip to main" link (done in CSS; must be added into `App.jsx` markup).

2. Focus indicators
   - Ensure meaningful :focus-visible outlines for keyboard users (implemented in CSS).

3. Landmarks and semantics
   - Use `<header>`, `<nav>`, `<main>`, `<footer>` where appropriate.
   - Provide `aria-label` for navigation regions (implemented for Teacher/Student navs).

4. ARIA and live regions
   - Add `role="status"` or `aria-live="polite"` region for ephemeral messages and errors.
   - Narrator should expose `aria-expanded`, `aria-controls`, and status messages via `aria-live` when starting/stopping speak.

5. Labels and form controls
   - Ensure every input has a visible label or `aria-label`/`aria-labelledby`.
   - Buttons that only show icons must include `aria-label`.

6. Contrast and text scaling
   - Verify color contrast ratios >= 4.5:1 for normal text and 3:1 for large text.
   - Ensure layout supports browser text zoom up to 200% without loss of content.

7. Media & captions
   - Provide captions/transcripts for audio where relevant (narrator logs / transcripts could be stored for lesson content).

8. Testing with assistive tech
   - Manually test using NVDA (Windows), VoiceOver (macOS), TalkBack (Android).

---

## Manual changes I recommend next (code edits I can apply on request)
- Add a persistent skip link element into `src/App.jsx` markup so keyboard users can immediately jump to the main content.
- Add an `aria-live` region in `src/App.jsx` and wire app-level messages into it.
- Update `src/components/Narrator.jsx`:
  - set `role="region"` and `aria-label` on the narrator panel,
  - add `aria-expanded` on the toggle and `aria-controls` referencing the panel,
  - announce start/stop actions using an `aria-live` region.
- Audit all form fields in `src/pages/*` to ensure labels exist.
- Run automated axe scans and fix blocking issues.

---

## Notes & limitations
- I couldn't run Lighthouse or axe-core from this environment. Please run those locally and paste the exported reports into `docs/lighthouse/` and `docs/axe/` for inclusion in your thesis.
- If you want, I can implement the narrator ARIA wiring and add the skip-link element directly into `src/App.jsx` — say the word and I'll patch those files next.

---

If you want me to continue, I can (pick one):
- add the skip-link markup into `src/App.jsx` and an `aria-live` region now,
- implement ARIA attributes and announcements inside `src/components/Narrator.jsx`,
- or produce a Playwright + axe test and a GitHub Actions workflow to run it.

Pick which of the follow-ups to do next and I'll implement it.
