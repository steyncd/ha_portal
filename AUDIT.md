# HA Portal — Codebase Audit (2026-08-06)

Four-front audit: performance, stability/best-practices, testing, design/usability.
Legend: ✅ fixed this pass · 🔜 recommended (tracked) · 💡 design decision to confirm.

## Security & stability

- ✅ **Webhook secret failed OPEN.** `waInbound`/`waCapture` skipped the key check when the secret was unset → public write/spend/HA-invoke. Now fail **closed** (`!expected || key !== expected`).
- ✅ **ID-token endpoints authenticated but never authorized.** `parseDocument`, `journalNow`, `mealsToShopping`, `refreshParcelsNow` accepted any Google account (incl. portal-`denied` users). Now gated by `requireMember()` against `settings/access` (members+owners) + BOOTSTRAP_OWNERS.
- ✅ **Error responses leaked internals** (raw exception text to client). Now log detail server-side, return generic message.
- ✅ **Store double-connect race.** `$effect`→`ha.init()` could fire a second `connect()`+`subscribeEntities()` mid-connect (duplicate WS sub, never torn down). Added synchronous `#connecting` guard + `stop()` that clears the sub and throttle timer.
- ✅ **Non-idempotent listeners.** `auth.init()` and `push` foreground `onMessage` stacked duplicate listeners on re-entry; now guarded/registered once.
- ✅ **`$effect` write-read** in `App.svelte` (`view` read+written) → replaced with a guarded assignment.
- ✅ `writeJournal` — was scanning the whole `life_tasks` collection nightly **and** reading the wrong field (`completedAt`; the store writes `doneAt`, so the count was always 0). Now a bounded `doneAt >= startOfToday` query with the correct field.
- 🔜 Type safety: replace `Record<string, any>` Firestore mappers with the existing `Bill`/`ShopItem`/`LifeItem` types; validate `assist`/`listReminders` `res.json()` casts. (Low user-facing value; not yet done.)

## Duplication
- ✅ `dueInDays` (portal) vs `dueInDaysServer` (functions) reimplemented the same month-clamp math. Portal copy extracted to `src/lib/lifeCalc.ts`; a **parity test** now guards the two from drifting.
- ✅ Capture grammar (`CAPTURE_RE`, shopping regex, `senderKey`) extracted to `functions/classify.js` (single source), unit-tested.

## Performance (root cause: view `$derived.by` that allocate arrays on every ~3/s WS tick)
- ✅ `System.svelte` — collapsed 6× `Object.keys(entities)` scans into a single pass.
- ✅ `AreaChart.svelte` — `Math.min(...spread)` over full series → single loop (also removes call-stack-overflow risk on large series).
- ✅ `Energy.svelte` — quadratic `includes()`-in-`filter` → `Set`.
- ✅ `Traffic.svelte` — ANPR chain memoised: `known`/`knownRaw` gate on the plate string; `detections` gates on the log entity's `last_updated` (heavy re-parse wrapped in `untrack`); detection rows keyed. Stops the unbounded per-tick re-parse.
- ✅ `Devices.svelte`/`Automations.svelte` — the sorted catalog is now rebuilt only when the entity-set size changes (`untrack`); live state/attrs read per-row in the template, so control stays live without an every-tick full-map sort.
- 🔜 Consider a coarser dashboard cadence (500–750 ms) for the always-on TV. (Judgment call, not a defect — left as-is.)

## Design & usability — colourblind-safe (user is red/green CVD; highest priority)
- ✅ `Rooms.svelte` lights-on vs occupied were amber-dot vs green-dot (colour only) → distinct glyphs + labels.
- ✅ Overview light tile was a `div role=button` with an empty keydown (unusable by keyboard) → real `<button>`.
- ✅ `App.svelte` collapsed-sidebar nav buttons had no accessible name → `aria-label`.
- ✅ `--danger` token referenced but undefined in `app.css` → defined (aliases `--error`).
- ✅ **Rooms heat-map** — recoloured to a CVD-safe blue→neutral→orange (Okabe-Ito) ramp (was blue→green→amber→red); legend now shows the °C ranges as **visible text**, and each room already prints its °C.
- ✅ **Security 24h track** — event type now carries a distinct **shape** (circle/square/diamond/ring) + CVD-safe colour + a **visible legend** (was armed=green/triggered=red/disarmed=amber, colour-only).
- ✅ **Timeline movement** — 8 rooms remapped to the 8-colour **Okabe-Ito** set (was repeated/ambiguous hues on the red-green axis).
- ✅ **Timeline battery** — adds a "⚠ Low" label under 20% (was red-vs-green only).
- ✅ **Touch targets** — `.tune` controls now ≥40px on touch (Overview `@media (pointer:coarse)`, Rooms mobile bump).
- ✅ **Load guards** — Rooms + Overview `onMount` fetches wrapped (no unhandled rejection; Rooms shows a "couldn't load" note instead of a blank chart).
- ✅ **Global status tokens retuned to Okabe-Ito** (`app.css`): `--success` bluish-green `#0aa17a`, `--warning` amber `#e69f00`, `--error`/`--danger` vermillion `#e8590c` — good-vs-bad no longer sits on the red/green axis. One-file change; every consumer updates automatically. Brightness is a first cut — easy to tune to taste.
- 🔜 **emoji-as-icon → `Icon` set: deliberate non-goal.** The status-carrying emoji were already replaced with shapes/`StatusChip`; the remaining emoji are decorative section glyphs, and a wholesale swap to monochrome line icons is a matter of taste (arguably more sterile), high churn, and not a defect. Left intentionally.
- ✅ **Load/error guards on every async view.** All `onMount` history/forecast fetches (Water, Me, Energy, Batteries, Security, System, FocusWork, Traffic — plus the earlier Rooms/Overview) are now wrapped in try/catch (no unhandled rejections); the four primary chart views (Water/Me/Energy/Batteries) show a visible "couldn't load" banner instead of a silently-blank chart.
- 🔜 Animated *loading skeletons* (as opposed to the error/empty handling now in place) remain a nice-to-have.
- 🔜 Type-safety: the `Record<string, any>` Firestore mappers are intentionally left — Firestore's `DocumentData` is untyped by design, so this is idiomatic and the change would be pure churn with no user benefit.
- 💡 **No light theme by design.** Your HA is pinned dark-always (force-dark), so the portal is intentionally dark-only — the "light+dark" phrasing was dropped rather than building an unused light theme.

## Testing
- ✅ Added Vitest + jsdom + Testing-Library. Suites: `format`, `trends`, `nav`, `lifeCalc` (portal) + `classify`/`dueInDays` parity (functions). `npm test` / `npm run coverage`.
