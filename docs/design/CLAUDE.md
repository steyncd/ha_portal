# HA Portal — build & design direction (handoff to Claude Code)

Persistent project context. The **design source of truth** is the prototype in this project:
- `HA Portal.dc.html` — the full app: Overview, Energy, Water, Irrigation, Climate, Security, Cameras, Traffic, System, Me (health), Settings.
- `HA TV Overview.dc.html` — the always-on wall/TV screen.

These are authored as self-contained HTML with inline styles + a small logic class (a prototyping format). Claude Code should **rebuild them as the production app**, wiring live Home Assistant entities. Match the layout, hierarchy, motion, states and component structure shown in the prototype.

## Fixed constraint
- **Hosting: Firebase Hosting** — static SPA, 100% client-side. Browser talks straight to Home Assistant over WSS (Nabu Casa remote URL, HA OAuth, per-origin). No server/SSR/backend. Everything else is open to change.

## Recommended stack (endorsed — keep as-is)
The existing choice is a good fit; no change recommended.
- **Svelte 5** (runes: `$state`/`$derived`/`$props`/snippets) + **TypeScript** + **Vite**.
- **Plain scoped CSS** with CSS custom-property tokens in `src/app.css`. No Tailwind / no UI or component library.
- `home-assistant-js-websocket` → one small reactive store (`store.svelte.ts`) streaming entity states + fetching history.
- **Hand-rolled inline SVG** for all charts/gauges (AreaChart, BarChart, RingGauge, TankGauge, PowerFlow, sparklines). No charting library.
- **System font stack** only. Keep the bundle lean (~34 kB gzip target).
- Optional refinements: CSS container queries for card density; `prefers-reduced-motion` guards (already assumed); a tiny localStorage layer for per-user prefs (see Customize).

## Design system — "Aurora Glass" (violet/indigo)
Use these exact token names in `app.css`:
```
--bg:#08070f;              /* + layered violet radial gradients + 2 drifting blur orbs, fixed */
--card:rgba(255,255,255,.055);      --border:rgba(255,255,255,.10);
--fill:rgba(255,255,255,.045);      --fill-strong:rgba(255,255,255,.09);
--divider:rgba(255,255,255,.07);    --glass-blur:blur(22px) saturate(150%);
--shadow:0 10px 34px -12px rgba(0,0,0,.6);
--text:#f3f2fb;  --text-2:#c3d1e0;  --muted:#aebccd;   /* NOTE: raised from #837f9a for legibility */
--brand:#a78bfa; --brand-2:#818cf8; --grad:linear-gradient(135deg,#818cf8,#a855f7);
--glow:rgba(139,92,246,.55);
--success:#34d399; --warning:#fbbf24; --error:#fb7185; --water:#38bdf8; --solar:#fbbf24;
--r-hero:24px; --r:18px; --r-tile:16px; --r-pill:999px;
```
Rules that matter:
- **Borderless surfaces.** Do NOT use hard 1px tinted borders. Depth = translucent fill + top light edge + soft shadow, plus (on domain blocks) a subtle corner radial glow of the domain color. See TV panels for the reference treatment.
- **Legible labels.** Secondary text `--muted` ≈ `#aebccd`; never let a colored/active overlay paint over text — content sits above glow (z-index). Small labels on tinted backgrounds get a text-shadow.
- **Motion** ≤ ~300ms, purposeful; wrap non-essential in `@media (prefers-reduced-motion: reduce)`.
- **Domain colors** for glanceable coding: energy=solar amber, battery=violet, water=cyan, climate=orange, security=emerald.

## Interaction patterns (keep these)
- **Command palette** — ⌘K / Ctrl-K / "/" opens a searchable overlay to jump to views + run actions (scenes, all-lights-off, arm/disarm, pumps). Esc closes.
- **Customize** — per-user show/hide of Overview widgets, persisted (localStorage now → could be a user pref). Constrained to the grid so layout can't break. This is the safe ceiling for customization: curate content, not free-form drag that breaks design.
- **Two-tap arm/disarm** on Security (confirm step).
- **Read-only climate** — comfort pill (Cold/Cool/Comfortable/Warm) + trend, NOT a setpoint (no thermostat entities exist).
- **Victron** — animated power-flow + charge-state track (Bulk/Absorption/Float) + VE.Bus/MPPT/grid tiles.
- **Me = health** — Oura Ring: Sleep/Readiness/Activity scores, sleep stages, HRV/SpO₂/vitals, activity, last workout, 7-day trends.

## Entity wiring map (primary IDs — see the pasted §4 catalog for the full set)
- Energy: `sensor.victron_battery_soc|_power|_voltage|_temperature`, `sensor.victron_total_pv_power`, `sensor.victron_grid_total_power`, `sensor.victron_ac_consumption_l1`, `sensor.victron_inverter_state_text`, `sensor.grid_independence_today`, `sensor.energy_cost_today`, appliance `switch.*` + matching `sensor.*_power`.
- Water: `sensor.jojo_tank_monitor_tank_water_level|_volume`, `sensor.jojo_tank_days_remaining`, `sensor.water_used_today`, `sensor.borehole_pump_*`, controls `switch.water_pump|pool_pump|borehole_pump`.
- Climate (read-only): `sensor.indoor_average_temperature`, per-room `sensor.*_temperature` + `_humidity`, `weather.home`.
- Security: `alarm_control_panel.helloliam_alarm_area_01_huis` (+ `_02_beams`), `binary_sensor.helloliam_alarm_zone_*`, covers/locks for Access.
- Cameras/Traffic: `camera.*`, `counter.frigate_*`, `sensor.vehicles_*`/`pedestrians_*`, `sensor.sidewalk_*`.
- Lights: `switch.kitchen_lights|living_room_lamp|main_bedroom_lamp`, `light.study_lamp` (dimmable), `group.room_lamps|lounge_lamps`, `light.back_yard_fire_pit_light`.
- System: `sensor.fibre_router_*`, `sensor.brother_dcp_t720dw*`, `device_tracker.*_deco`.
- Me/health: `sensor.oura_*` (sleep_score, readiness_score, activity_score, *_sleep_duration, average_sleep_hrv, spo2_average, resting/current HR, steps, last_workout_*, ring_battery_level).
- Settings: `input_boolean.*`, `input_datetime.alarm_auto_*`, `input_select.zone_bypass_selector`.

## Data reality (don't break)
- No `climate.*` thermostats — temperature is monitoring only.
- Skip ⚠ entities (dead/flaky) noted in the catalog (`*_power_usage` bogus, `light.lamps` dead members, `sensor.adjusted_temperature`, etc.).
- All charts should use HA's history API; the prototype's arrays are realistic placeholders.
