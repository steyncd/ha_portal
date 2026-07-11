# HA Portal → Claude Code handoff

Everything needed to rebuild the approved prototype as the production app. Read `CLAUDE.md` first (stack + design tokens + entity map); this file is the build plan.

## 1. What you're getting
- **`HA Portal.dc.html`** — the full app design (all views + all interactions). **Design source of truth.**
- **`HA TV Overview.dc.html`** — the always-on wall/TV screen.
- **`CLAUDE.md`** — persistent direction: fixed constraint, endorsed stack, Aurora-Glass tokens (exact names/values), interaction patterns, entity wiring map, data guardrails.

> The two `.dc.html` files are self-contained — open them in a browser to see the exact target: layout, hierarchy, motion, states, copy, and realistic data. Rebuild to match; don't reinterpret.

## 2. Fixed constraint & stack
- **Fixed:** Firebase Hosting, static SPA, 100% client-side, browser → Home Assistant over WSS (Nabu Casa URL, HA OAuth per-origin). No server/SSR/backend.
- **Endorsed stack (keep):** Svelte 5 (runes) + TypeScript + Vite · plain scoped CSS with custom-property tokens in `src/app.css` (no Tailwind/UI lib) · `home-assistant-js-websocket` reactive store · hand-rolled inline-SVG charts/gauges · system fonts · target ~34 kB gzip.

## 3. Proposed repo structure
```
src/
  app.css                 # :root Aurora-Glass tokens (see CLAUDE.md) + resets
  main.ts
  App.svelte              # shell: aurora backdrop + drifting orbs, sidebar/topbar nav, router outlet, command palette, light sheet
  lib/
    store.svelte.ts       # HA websocket connection, live entity map, history fetch, service calls
    ha.ts                 # typed service helpers (toggle, turn_on/off, arm/disarm, light.turn_on{brightness_pct,rgb_color}, notify/tts, input_* setters)
    format.ts             # units, durations (h→"6h 48m"), R currency, %,  negatives
    prefs.ts              # localStorage: overview show/hide, accent, density, motion
  components/
    KpiCard, RingGauge, TankGauge, AreaChart, BarChart, Sparkline, PowerFlow,
    Tile, Pill, BarRow, Section, Toggle, TimeField, SelectField, Slider,
    CommandPalette, LightSheet, Toast
  views/
    Overview, Energy, Water, Irrigation, Climate, Security, Cameras, Traffic, System, Me, Settings
```

## 4. Views to build (match the prototype)
- **Overview** — greeting + alarm/weather chips; **command palette** (⌘K/"/") and **Customize** (show/hide widgets, persisted, Reset) in the header; masonry of: power-flow, battery (SoC ring + 24h sparkline + runtime), solar (sparkline), comfort, tank, scenes, quick controls, lights (brightness % + ⋯→light sheet), today's energy, security & presence, recent-activity logbook, next-hours forecast.
- **Energy** — KPIs; Day/Week/Month toggle → production-vs-use area + 24h battery SoC + weekly/monthly stacked bars; animated **PowerFlow**; **Victron system** block (charge-state track Bulk/Absorption/Float + VE.Bus/MPPT/grid tiles); "where energy flowed" sankey; appliance switches with live wattage.
- **Water** — tank gauge; 7-day usage bars; 30-day tank trend; today's-usage breakdown; pump controls.
- **Irrigation** — zones (run/stop); rain-delay toggle; soil-moisture bars; smart-skip note.
- **Climate** — floor-plan room picker; per-room 24h trend + min/max + humidity + **read-only comfort pill** (NO setpoint — no thermostat entities); room light toggles.
- **Security** — big status + **two-tap arm/disarm**; 24h activity timeline; **Access & openings** (gate/garage covers, door locks); zone grid.
- **Cameras** — detections KPIs; recent-detections list; camera grid (wire HLS/WebRTC or snapshots).
- **Traffic** — vehicle/pedestrian KPIs; by-time-of-day bars; 7-day trend.
- **System** — internet KPIs; router CPU/mem rings; internet 24h sparkline + uptime; device-category breakdown; printer ink bars.
- **Me (health)** — Oura: Sleep/Readiness/Activity score rings; last-night sleep (stages bar, efficiency, HRV, SpO₂…); heart & vitals grid; activity ring + calories; last workout; 7-day sleep + steps trends; favourites; notifications.
- **Settings** — Account; **People & profiles**; Appearance; **Alarm automations + schedule** (`input_boolean`/`input_datetime`); Notifications; **Zone bypass** (`input_select`); **Broadcast & messages** (`notify.*`/`tts.*` presets + composer + target); **Health goals** (`input_number` sliders); Enabled views.
- **TV Overview** — separate route/screen: hero clock + weather + presence; bento of borderless domain panels (energy/battery/water/climate/security) with sparklines; forecast strip; today + latest-activity footer.

## 5. Interaction patterns (must keep)
Command palette (Esc closes) · Customize show/hide (localStorage → per-user pref later) · light sheet (brightness slider + colour swatches; `light.turn_on brightness_pct`/`rgb_color`; only dimmables get the sheet, switches stay simple) · two-tap arm/disarm · read-only climate · broadcast toast on send · every interactive element needs default/hover/active/on-lit(glow)/disabled/empty states.

## 6. Wiring & data
- Entity IDs per view: see **CLAUDE.md §"Entity wiring map"** and the pasted §4 catalog.
- Actions: `homeassistant.toggle|turn_on|turn_off`, `alarm_control_panel.alarm_arm_away|arm_home|disarm`, `light.turn_on`, `cover.*`, `lock.*`, `scene.turn_on`, `input_*` setters, `notify.*`/`tts.*`.
- Charts use HA history API; the prototype's arrays are realistic placeholders.
- **Guardrails:** no `climate.*` thermostats (monitor only); skip ⚠ entities (`*_power_usage`, `light.lamps` dead members, `sensor.adjusted_temperature`); OAuth per-origin; keep bundle lean.

## 7. Acceptance
Matches prototype layout/motion/states on desktop (~1240px) and mobile (~375–430px) · live entities stream and re-render · all listed controls call the right service and reflect result · prefers-reduced-motion respected · Aurora-Glass tokens used verbatim · deployed to Firebase.

## 8. Kickoff prompt for Claude Code
> Rebuild the HA Portal production app from the prototype in this project. Read `CLAUDE.md` and `HANDOFF.md`, then open `HA Portal.dc.html` and `HA TV Overview.dc.html` to see the exact target design. Use Svelte 5 + TS + Vite, plain CSS with the Aurora-Glass tokens, `home-assistant-js-websocket` for live state + history, and hand-rolled inline-SVG charts. Build the repo structure in HANDOFF §3, implement every view (§4) and interaction (§5), wire the real entities/actions (§6, CLAUDE.md map), honor the guardrails, and deploy to Firebase. Match the prototype's layout, hierarchy, motion and states on both desktop and mobile.
