# Stride — Accessibility (WCAG 2.1 AA) — G5 / RAV-125

**Last updated:** 25 Jun 2026  
**Target:** WCAG 2.1 Level AA on dashboard, ESS, and public marketing surfaces.

---

## 1. Baseline (implemented)

| Area | Status |
|------|--------|
| **Focus visible** | Global `*:focus-visible` outline (`globals.css`) |
| **Skip link** | `SkipToMain` on dashboard + ESS → `#main-content` |
| **Landmarks** | `<main id="main-content" tabIndex={-1}>` on dashboard and ESS |
| **Reduced motion** | `prefers-reduced-motion` disables animations/transitions |
| **Dashboard nav** | `aria-label`, `aria-expanded`, `aria-controls` on collapsible sections |
| **ESS chrome** | Notification/close buttons have `aria-label` |
| **Form labels** | ESS procurement request form uses explicit `<label htmlFor>` |

---

## 2. Contrast (palette)

- Primary actions use `--brand-navy` on light backgrounds (≥ 4.5:1 for body text).
- Marketing coral (`--sc-coral`) used for accents only — not sole text colour on white.
- Muted text uses `--ess-muted` / `--neutral-600` — verify per theme in axe before launch.

**Manual check:** run axe DevTools on `/`, `/dashboard`, `/ess` in light and dark mode.

---

## 3. Keyboard navigation

- All interactive controls reachable via Tab.
- Skip link is first focusable element when tabbing from top.
- Modal/drawer patterns should trap focus (notifications overlay — follow-up: focus trap).

---

## 4. Testing checklist (pre-launch)

```bash
# Automated (browser extension)
# 1. axe DevTools on dashboard home, employees list, ESS home, marketing home
# 2. Lighthouse accessibility score ≥ 90 on same pages

# Manual
# - Tab through dashboard sidebar + topbar without mouse
# - Submit ESS leave request with screen reader (VoiceOver/NVDA spot check)
# - Verify error messages are announced (role=alert where applicable)
```

---

## 5. Known follow-ups

1. Focus trap in ESS notifications panel.
2. `aria-live` regions for toast/async errors on dashboard.
3. Full axe pass on `/dashboard/applications` (complex filters — many labels already present).
4. Marketing pages — audit coral-on-cream contrast for small text.

---

## 6. Related docs

- `docs/SECURITY-ONE-PAGER.md` (G6)
- Design system: `src/lib/stride-primitives.ts` (button/input focus rings)
