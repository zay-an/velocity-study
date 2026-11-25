# VelocityStudy — Architecture Rules

VelocityStudy is a gamified study platform and a research instrument: it measures how
speed-based scoring affects answer accuracy and retention. **Data integrity is a
product requirement**, not a nice-to-have. When a shortcut would make trial data less
trustworthy, don't take it.

@AGENTS.md

## Stack

- Next.js 16 App Router with `cacheComponents: true`. Read `node_modules/next/dist/docs/` before using any Next API: this version differs from older training data.
  - `src/proxy.ts` replaces `middleware.ts`, which is deprecated in Next 16.
  - Runtime data (`cookies()`, `headers()`, `searchParams`) must be read inside a `<Suspense>` boundary and never inside `'use cache'`.
  - Browser-only reads (localStorage, etc.) use `use(browser(reason))` from `react-dom` inside `<Suspense>`.
- React 19.3, Tailwind CSS v4, Supabase (`@supabase/ssr`), zod v4, zustand, framer-motion, recharts.

## TypeScript

- Strict mode. **Zero `any`**: no `any`, no `as any`, no `@ts-ignore`. Use `unknown` and narrow it, use zod at trust boundaries, or use a type guard.
- Avoid non-null assertions (`!`). Handle the `null` case.
- DB types live in `src/lib/supabase/database.types.ts` and must mirror `supabase/migrations/`. If you change the schema, update the types in the same change.

## Code layout

| Path | Contents |
| --- | --- |
| `src/lib/` | Pure, framework-free logic: scoring math, statistics (accuracy, mean RT, inverse efficiency score), Latin-square validation, validation schemas. **No React, no Next, no Supabase, no I/O, no `Date.now()` or `Math.random()` inside the math.** Inject clocks and RNGs as parameters so the code is deterministic and unit-testable. |
| `src/lib/supabase/` | Supabase clients only: `client.ts` (browser), `server.ts` (RSC / Server Functions / Route Handlers), `proxy.ts` (session refresh). |
| `src/components/` | Shared UI components. `ui/` holds design-system primitives. |
| `src/app/` | Routes. Keep page files thin and put logic in `src/lib/`. |
| `supabase/migrations/` | Numbered SQL migrations (`NNN_description.sql`). Never edit a migration after it has been applied. Add a new one. |

## Timing and measurement

- Measure every reaction time with `performance.now()`. **Never** use `Date.now()` or `new Date()` for intervals, because they are not monotonic.
- Store durations as **integer milliseconds**: `Math.round(performance.now() - t0)`. DB columns ending in `_ms` are `integer`.
- Start a trial's clock only after the question is actually painted. Start the timer inside `requestAnimationFrame` after render, not when the component mounts.
- Track `visibilitychange` and set `tab_switched = true` on the attempt if the page was hidden at any point during the trial.
- `is_correct` is computed by the DB trigger `grade_question_attempt()`. Never trust or send a client-computed value.
- `question_attempts` are append-only. Never update or delete trial rows.

## Security (Supabase)

- RLS is enabled on every table. Every new table needs RLS plus explicit policies in the same migration.
- The `anon` role has no table access. Research participants use **Supabase anonymous sign-in**, so they are `authenticated` and own their rows via `auth.uid()`. Anonymous Sign-Ins must be enabled in the Supabase dashboard.
- Clients may only update `profiles.display_name` and `profiles.selected_avatar`. XP, level, streaks, unlocks and role are written only by trusted server code.
- The `researcher` role is granted out-of-band through SQL or the service role. Never grant it from the client or from user metadata.
- In the server, call `supabase.auth.getClaims()` (or `getUser()`), **never** `getSession()`, to trust identity.
- Policies call `auth.uid()` as `(select auth.uid())` for per-statement caching. Helper functions are `SECURITY DEFINER` with `set search_path = ''`.
- Never expose the service-role key with a `NEXT_PUBLIC_` prefix.

## UI conventions: tactile 3D game style

- **Dark slate theme**: page `bg-slate-900`, cards `bg-slate-800` with `border-b-4 border-slate-950`, inset fields `bg-slate-950`.
- **Push buttons**: use `<PushButton>` from `src/components/ui/push-button.tsx`. It has a `border-b-4` darker-shade "depth" edge, and pressing it sets `active:translate-y-[2px] active:border-b-2`. Don't hand-roll buttons.
- **WCAG AA contrast is required**: 4.5:1 for body text and 3:1 for large text and UI components. Approved pairs:
  - `bg-emerald-500` + `text-slate-950`
  - `bg-indigo-600` + `text-white`
  - `bg-slate-800` + `text-slate-100` or `text-slate-300`
  - Do not use `text-slate-500` or darker on slate backgrounds.
- Every interactive element needs a visible `focus-visible:ring-*`. Respect `motion-reduce:` for animations.
- Feedback must never rely on color alone: pair it with an icon or text.

## Required checks

- **Always run `npm run build` after multi-file edits** and fix every TypeScript and lint error before finishing.
- Run `npm run lint` for lint-only changes.
