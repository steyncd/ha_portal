# Handoff: HA Portal — design re-sync (prototype → `steyncd/ha_portal`)

## Overview
The production app **already exists** at `steyncd/ha_portal` (Svelte 5 + Vite + TS, Firebase Hosting).
This bundle is a **re-sync**: the design prototype was diffed against the shipped code, and six
view-level changes were folded back into the prototype where the code had made a forward product
decision the design hadn't captured yet. This README is a **changelog to apply to the existing repo** —
not a from-scratch build. Work view by view; most changes are small deltas on top of what already ships.

Repo state when this was written: `main @ c17e0fa` (past the `085c280` audit in `docs/AUDIT_ISSUES.md`).

## About the design files
The `*.dc.html` files are **design references** — self-contained HTML prototypes showing the intended
look and behavior. They are **not** production code to paste in. Recreate each delta in the existing
Svelte views under `src/views/` using the app's established patterns (scoped CSS + `--`-token theme,
`home-assistant-js-websocket` store, hand-rolled inline-SVG charts). Open a `.dc.html` in a browser to
see the target (they load `./support.js`, included here).

- **`HA Portal.dc.html`** — the full desktop app (source of truth). Contains every change below.
- **`Me Health.dc.html`** — standalone reference for the Me redesign (item 6).
- **`HA TV Overview.dc.html`**, **`HA Mobile.dc.html`**, **`Home Directions.dc.html`** — unchanged, for reference.
- **`CLAUDE.md`** — Aurora-Glass tokens (exact names/values), entity wiring map, data guardrails. **Read first.**
- **`HANDOFF.md`** — original build plan (repo structure, per-view inventory).

## Fidelity
**High-fidelity.** Colors, type, spacing and states are final. Recreate pixel-accurately with the
existing components. All values below are the same Aurora-Glass `--` tokens already in `src/app.css`
(`--acc`, `--success`, `--warning`, `--water`, `--solar`, `--muted`, `--soft`, `--line`, etc.).

## Data guardrails (unchanged, still binding)
- No `climate.*` thermostats — temperature is monitoring only.
- **No `lock.*` / `cover.*` entities exist** — Access & openings is read-only (see item 2).
- Per-**room/area** live energy split is **not** available — only per-plug power + an estimated
  unmonitored remainder (see item 1).
- Charts use HA history API; prototype arrays are realistic placeholders.

---

# Changes to apply

Each item: what changed · target file · exact spec · entities · acceptance.

## 1. Energy — Sankey is a live snapshot, not a 4-column areas flow
**File:** `src/views/Energy.svelte` (+ `src/lib/components/Sankey.svelte`)
The prototype previously showed an aspirational Sources→Home→**Areas**→Loads Sankey with fabricated
per-room data. Per-area data isn't available live, so it's now an honest **2-column** flow:
- **Sources** → **Where it goes**. Sources: Solar (`--solar`), Grid (`--water`/`--error`), Battery (`--acc`).
  Sinks: **Monitored plugs** (`--success`, = `sensor.total_monitored_loads`) and **Estimated other**
  (`--muted`, = `sensor.estimated_unmonitored_loads`).
- Header copy: **"Where energy flows now"** · right tag **"live · estimated split"**; column labels
  **"Sources" / "Where it goes"**.
- Caption beneath: *"Split from monitored plugs vs estimated unmonitored load — a live snapshot, not a
  daily total."* (Omit sources reading 0 W, e.g. Solar at night.)
- This already matches the shipped `Sankey.svelte` (sources/sinks). Just confirm the header/caption copy
  and that it's fed `sources=[Solar,Grid,Battery]`, `sinks=[Monitored,Other]`.

**Also — Energy hero:** the "self-powered today" hero stat row is now **4-up**: Solar now · Battery ·
Home load · **Grid** (`sensor.victron_grid_total_power`; green when ≤5 W, amber otherwise). Add the Grid stat.

**Acceptance:** Sankey renders sources→sinks from live watts with the estimate caption; hero shows 4 stats incl. Grid.

## 2. Security — Home + Beams areas, active-zones indicator, Restore-all, read-only Access
**File:** `src/views/Security.svelte`
- **Two area controls** (side by side, stack on mobile), replacing a single mode row:
  - **Home area** — segmented `Off / Home / Away / Night` → `alarm_control_panel.helloliam_alarm_area_01_huis`
    (`alarm_disarm` / `alarm_arm_home` / `alarm_arm_away` / `alarm_arm_night`). Two-tap confirm (button
    shows "Confirm?" on first tap, 3 s window).
  - **Beams area** — segmented `Off / Arm` → `alarm_control_panel.helloliam_alarm_area_02_beams`.
- **Status hero** stays but is status-only; move the mode buttons into the Home-area card. Add a **Beams
  chip** in the hero (green when armed).
- **Active-zones indicator** — a slim card under the hero: green dot + "All zones clear · N armed-ready · N bypassed"
  (turns to "N zones active" from `binary_sensor.helloliam_alarm_zone_*` live states).
- **Zones grid** — add a **"Restore all"** button in the header, shown only when ≥1 zone is bypassed;
  restores every bypassed zone. Per-zone bypass wiring unchanged (`button.*_bypass_*` / `*_unbypass_*`).
- **Access & openings is READ-ONLY** — remove the open/close/lock/unlock buttons (they drove non-existent
  `cover.*`/`lock.*` entities). Show icon + name + status only, tag the section header "read-only · no
  lock/cover devices". Status from the `binary_sensor.helloliam_alarm_zone_*` door/beam sensors.

**Acceptance:** Home + Beams arm independently with two-tap confirm; active-zones line reflects live zones;
Restore-all appears only when something is bypassed; Access shows status with no action buttons.

## 3. Irrigation — per-zone soil, run-time slider, schedule countdown, weather banner
**File:** `src/views/Irrigation.svelte`
- **Weather-aware banner** (top): three states from `weather.home` + `input_boolean.irrigation_intelligence_enabled` —
  rainy ("🌧️ Rain now — skipping"), smart+dry ("☀️ No rain forecast — running as scheduled. Next run …"),
  manual ("🗓️ Manual mode — runs as programmed. Next run …").
- **Smart-irrigation card**: toggle (`input_boolean.irrigation_intelligence_enabled`) + a **run-time slider**
  1–30 min (`input_number.irrigation_runtime_minutes`).
- **Schedule card**: big **next-run countdown** ("in 6h 12m" from `sensor.helloeben_sprinkler_next_scheduled_run`),
  active-schedule count, and month-total watering (`sensor.sprinkler_watering_time_this_month`); when a zone is
  running show a live "Xm left" banner instead.
- **Zone cards**: fold soil moisture **into each zone card** (bar, `sensor.helloeben_sprinkler_<slug>_soil_moisture`,
  color: <15 % amber / <40 % cyan / else green) + "watered Xago" (`…_last_watered`) + Start/Stop.
  Remove the separate "Rain delay" and standalone "Soil moisture" cards.

**Acceptance:** banner reflects weather+smart state; run-time writes the `input_number`; each zone shows its
own soil bar + last-watered; schedule shows a live countdown.

## 4. Traffic — peak callout + ANPR plate history
**File:** `src/views/Traffic.svelte` (already largely shipped — confirm present)
- **Peak callout** (3 cards) under the time-of-day bars: busiest time of day, busiest weekday, weekday-vs-weekend
  average — derived from `sensor.sidewalk_*_traffic` and 7-day `sensor.vehicles_today` history.
- **ANPR plate history** list at the bottom: recent recognised plates + relative time from
  `sensor.main_gate_ai_last_recognized_plate` history (`historyStates`); empty-state "No plates recognised recently."

**Acceptance:** peak callout computes from live/history; plate list renders history or the empty state.

## 5. Cameras — live-snapshot treatment
**File:** `src/views/Cameras.svelte` (already largely shipped — confirm copy)
- KPI "Cameras online" reads **"N / total"** + sub **"online · live snapshots"** (online = `ha.available`).
- Tile badge is **LIVE** (green) / REC when `state==="recording"` / **OFFLINE** (muted) when unavailable.
- Snapshot stills via HA camera-proxy `entity_picture`, cache-busted ~every 10 s.
- Caption: *"Snapshots refresh every 10s from the HA camera proxy · tap-through to full HLS/WebRTC streams is a future step."*

**Acceptance:** tiles show live snapshots with correct LIVE/OFFLINE state + online count + caption.

## 6. Me — full "Me Health" redesign (Oura / Apple Health patterns)
**File:** `src/views/Me.svelte` · **reference:** `Me Health.dc.html`
This is the largest item — the shipped `Me.svelte` already has it; use this to confirm parity. Replace the
old (single activity ring + Last-workout card) layout with:
- **Headline insight** banner ("✦ Today" + plain-language summary driven by `sensor.oura_*` — temp deviation,
  readiness, sleep).
- **Three score rings** (Sleep / Readiness / Activity) each with a **👑 crown** at ≥85 and a **▲/▼ delta vs
  7-day average** pill (green up / muted down). Scores: `sensor.oura_sleep_score|readiness_score|activity_score`.
- **Sleep hypnogram** — stage-over-time graph (Awake/REM/Light/Deep lanes) in place of the flat stage bar,
  from `sensor.oura_*_sleep_duration`; keep the stage key + efficiency/restful/latency/HR sub-stats.
- **Readiness contributors** — 7 weighted bars with **Optimal (≥85, green) / Good (≥70, indigo) /
  Pay-attention (<70, amber)** bands (resting HR, HRV balance, body temp, recovery index, sleep, sleep
  balance, previous-day activity).
- **Concentric Move / Exercise / Stand rings** (Apple-style, red `#fb2d55` / green `#a3f335` / cyan `#2fe6de`)
  + legend (value / goal) from `sensor.oura_active_calories|target_calories`, medium+high activity minutes, steps.
- **7-day trends** (sleep score area, steps bars) each carry a **delta-vs-average pill**.
- Keep favourites + notifications (`input_boolean.oura_*`) below.

**Acceptance:** Me matches `Me Health.dc.html` — headline, crowned scores with deltas, hypnogram, 7 contributor
bands, concentric rings, trend deltas.

---

## Design tokens
Unchanged — use `CLAUDE.md` §"Aurora Glass" verbatim (the `:root` tokens already in `src/app.css`). No new
tokens are introduced by these changes. Band/accent colors used above (`#fb2d55`, `#a3f335`, `#2fe6de` for the
Apple activity rings) are the only literals not in the token set — keep them local to the Me activity ring.

## Files in this bundle
- `HA Portal.dc.html` — full design, all six changes (open in a browser; needs `support.js`).
- `Me Health.dc.html` — Me redesign reference (item 6).
- `HA TV Overview.dc.html`, `HA Mobile.dc.html`, `Home Directions.dc.html` — reference, unchanged.
- `support.js` — runtime for the `.dc.html` files.
- `CLAUDE.md`, `HANDOFF.md` — persistent direction + original build plan.

> Note: this design project can't push to the repo. After applying, re-sync the repo's `docs/` copy from
> the updated `HA Portal.dc.html`, and consider collapsing the two prototype copies in `docs/`
> (`docs/` vs `docs/Home automation dashboard prototype/`) into one.
