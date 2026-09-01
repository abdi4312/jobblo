# Jobblo — design context prompt

Paste everything below the line into a fresh Claude conversation before asking for design
work. It gives Claude the product, the palette, the system already in code, and the rules
that have already been decided — so it extends what exists instead of inventing a
parallel style.

Keep this file updated when the palette or the system changes.

---

## Context: Jobblo

You are designing for **Jobblo**, a Norwegian two-sided marketplace for small jobs
("oppdrag" — moving help, painting, gardening, assembly, handyman work).

**How it works.** A customer posts an oppdrag with a description, location and price.
Local providers apply. The customer picks one, pays into **SafePay** escrow, the provider
does the work, and the money is released only once the customer approves. Either side can
open a dispute instead of approving.

**Audience.** Norwegian consumers and small businesses. Everything user-facing is in
Norwegian (nb-NO). Do not write English UI copy. The product is not translated — there is
no i18n layer on the customer-facing app and none is planned before launch.

**Business model.** Free to post an oppdrag and to receive offers. Jobblo takes **3 % of
the agreed price** when a job actually completes, and nothing otherwise. Providers have
contact quotas tied to a subscription plan.

**Sign-in methods**, in the order they should appear: **Vipps** (used by roughly four and
a half million Norwegians — it is the primary path and must lead), then Google, then
email + password.

**Stack.** React 19 + TypeScript + Vite, Tailwind CSS v4, React Router v7, TanStack Query
v5, `lucide-react` for icons, `react-hot-toast` for toasts. Deliver designs as Tailwind
utility classes in `.tsx` components, not as CSS files or Figma specs.

---

## Palette

Every colour is sampled from the logo — black wordmark, green sprout. **Do not introduce
hues that are not on this list.** Before this palette existed the app carried six
different greens; that is the failure mode to avoid.

### Brand

| Token | Hex | Use |
|---|---|---|
| Ink | `#0B0B0B` | Headings, body text, the wordmark |
| Green (stem) | `#2E6641` | **The** accent — primary buttons, links, focus rings, the one highlighted block per section |
| Green dark | `#255335` | Hover state for the primary green only |
| Leaf | `#347028` | Link hover; use sparingly |

### Neutrals

| Token | Hex | Use |
|---|---|---|
| Ink muted | `#63665F` | Body copy, secondary text |
| Ink faint | `#9B9E96` | Placeholders, micro-labels, metadata |
| Line | `#E6E7E1` | Every border and divider. One value, no alpha borders |
| Field | `#F5F6F1` | Input resting surface |
| Panel | `#F4F6F0` | Tinted blocks inside a white section |
| Page | `#EFF0EA` | Page background |
| Green tint | `#EAF1E9` | Icon plates, small green-on-light chips |

### The one exception

`#FF5B24` — **Vipps orange**, mandated by Vipps' brand guidelines, permitted *only* on the
Vipps sign-in button. It is the only saturated colour outside the logo palette and it must
stay rare, which is what makes it read as "the fast way in".

There is also a legacy `--color-orange-custom: #e08835` token in `src/styles/index.css`
used by older screens. Do not use it in new work.

### Discipline

- Green carries **actions** and at most **one highlighted element per section**. Everything
  else is black, white and the two greys.
- No gradients as decoration. A single soft radial tint on a large surface is acceptable.
- Contrast: `#63665F` on white and `#2E6641` on white both pass AA for body text. Do not
  put `#9B9E96` on anything but large or non-essential text.

---

## Type

Typeface is **Inter Display**, already loaded globally. No new fonts.

| Role | Spec |
|---|---|
| Display / hero | `2rem` → `3.5rem` clamp, weight 700, tracking `-0.035em`, leading `1.15` |
| Section heading | `1.875rem` → `2.375rem`, weight 700, tracking `-0.035em` |
| Card title | `0.9375rem`–`1.0625rem`, weight 600 |
| Body | `0.875rem`–`0.9375rem`, weight 400, `leading-relaxed`, colour `#63665F` |
| Micro-label | `0.6875rem`, weight 600, `uppercase`, tracking `0.16em`, colour `#9B9E96` |

The uppercase micro-label above a block is a recurring device — keep using it.

---

## System already in code

Defined in `src/theme/brand.ts`. Import from there rather than restating values.

- **Corner radius:** `rounded-xl` (12px) for cards, inputs and buttons · `rounded-2xl`
  (16px) for feature panels · `rounded-[24px]` for large containers and the CTA band.
  Pills (`rounded-full`) only for small status chips.
- **Control height:** 46px (`h-11.5`) for every button, input and select. The hero search
  and its button use 52px (`h-13`). Nothing else.
- **Container:** `mx-auto w-full max-w-300 px-5 sm:px-8 lg:px-12` — every section uses this
  so edges line up down the page.
- **Section rhythm:** `py-16 sm:py-20`.
- **Cards:** white, `rounded-xl`, `border border-[#E6E7E1]`. Hover raises the border to
  `border-[#2E6641]/45`. Shadows are rare — reserved for the one elevated element on a
  screen.
- **Focus:** `focus-visible:ring-4 ring-[#2E6641]/20`. Never remove focus rings.

---

## What already exists — match it, don't restyle it

- **`/login`, `/register`, `/forgot-password`** — asymmetric split. Off-white showcase
  panel on the left with the wordmark, a headline and a staggered stack of oppdrag cards;
  white form column on the right. Sized to the viewport with `dvh` and **does not scroll**.
  Register is two steps so neither step overflows a phone.
- **`/` (landing)** — question-led sections, in the order a visitor actually asks them:
  hero → "Hva trenger du hjelp til?" → "Er pengene mine trygge?" → "Hvordan fungerer det?"
  → "Hva koster det?" → "Hvem trenger hjelp nå?" → CTA. The hero headline *is* the search
  form: you complete the sentence "Jeg trenger hjelp til [kategori]".
- **Header** — sticky, translucent white, hairline bottom border, colour wordmark left,
  text nav centre, "Logg inn" text action and a green "Legg ut oppdrag" button right.

The tone is Scandinavian: quiet, high-contrast, generous whitespace, no ornament that
isn't doing work.

---

## Hard rules

1. **Never invent trust signals.** No star ratings, review counts, "10 000+ users",
   "responds in under an hour", client logos or testimonials unless the number comes from a
   real API. The product previously shipped a hardcoded "4.8 ★ Snittrating" and a "250+
   jobber per dag" badge; both were removed. If there is no real figure, design a layout
   that does not need one. Illustrative example listings are fine, but they must carry no
   company names, ratings or response times.
2. **Never design a control that does nothing.** If a filter, toggle or button has no
   backend behind it, leave it out. The codebase had several of these and they read as
   broken, not as "coming soon".
3. **Norwegian only** in all UI copy, including error and empty states.
4. **Vipps before Google**, always, in its own orange.
5. **Mobile down to 360px.** Use `dvh`, never `vh` — iOS Safari counts the URL bar in `vh`
   and it pushes submit buttons under the browser chrome.
6. **No new dependencies.** Icons come from `lucide-react`. Illustration is CSS and inline
   SVG — the auth pages used to load ~640 KB of PNG mockups and that is not coming back.
7. **Accessibility is not optional:** labels tied to inputs by `id`, `aria-describedby` on
   errors, correct `autoComplete`, real `<button>` and `<form>` elements, visible focus.

---

## How to respond

When I ask for a screen or a section:

1. Ask what real data is available before designing anything that displays data.
2. Give a short rationale — what the section is for and why it is laid out that way —
   then the component code.
3. Use the tokens from `src/theme/brand.ts` by name where they exist.
4. Flag anything you had to assume.
