# HA Portal — audit issues (prototype → implementation)

Audited `steyncd/ha_portal@085c280` against the design source of truth
(`docs/Home automation dashboard prototype/HA Portal.dc.html` + `HANDOFF.md` §4).
Each item below is written to drop straight into a GitHub issue (title, labels, body, acceptance).

Overall: faithful, well-structured rebuild. These are the deltas from the approved design, ranked.

---

## 1. Energy: Week and Month tabs render the same chart (Month is a no-op)
**Labels:** `bug` `energy` `high`

`src/views/Energy.svelte` — the range control has three tabs (Day / Week / Month) but the
markup only branches `{#if range === "day"} … {:else} … {/if}`, so **Week and Month show the
identical 7-day solar-yield bar chart**. Clicking "Month" changes nothing.

**Fix:** give Month its own branch. Fetch `dailyMax(history, 30)` (or weekly buckets) and render
a distinct month series + month summary stats. At minimum, differentiate Week vs Month data windows.

**Acceptance:** each of Day / Week / Month shows a visibly different, correct chart.

---

## 2. Energy: Victron charge-state track (Bulk / Absorption / Float) is missing
**Labels:** `feature` `energy` `medium`

HANDOFF §4 specifies a "charge-state track Bulk/Absorption/Float" in the Victron system block.
The implementation renders three tiles (Inverter / Solar / Battery) only — no charge-state track.

**Fix:** add the 3-segment charge-state progress track above the Victron tiles, driven by
`sensor.victron_battery_state_text` / inverter state. Mirror the prototype's Energy "Battery charge state" block.

**Acceptance:** charge-state track present, current stage highlighted from live state.

---

## 3. Energy: "Where energy flowed" Sankey is missing
**Labels:** `feature` `energy` `medium`

HANDOFF §4 lists a sources→home→areas→loads Sankey. Not present in the implementation.

**Fix:** port the prototype's `buildSankey()` as an inline-SVG component fed by history/estimated splits.
If per-area data isn't available live, render from the monitored/unmonitored load split and note the estimate.

**Acceptance:** Sankey renders on Energy with hover/tap-to-trace.

---

## 4. Energy: Day view lacks the production-vs-use overlay + week/month summary stats
**Labels:** `enhancement` `energy` `medium`

Prototype Day view overlays solar area + house-load line + grid line on one chart, then shows
summary stat rows (e.g. "64.2 kWh solar generated"). Implementation shows two separate single-series
area charts and no summary rows.

**Fix:** add a combined production-vs-use chart for Day; add a 3-up summary row under Week/Month.

**Acceptance:** Day shows the overlay; Week & Month each show a summary stat row.

---

## 5. Settings: Account card is missing
**Labels:** `feature` `settings` `low`

Prototype opens Settings with an Account card (avatar, name, email, Edit profile / Sign out).
Implementation starts at Appearance.

**Fix:** add the account card at the top of Settings (email from HA user, sign-out clears tokens + reloads).

**Acceptance:** account card present; sign-out clears `ha_portal_tokens` and returns to login.

---

## 6. Settings: Health-goals sliders are missing
**Labels:** `feature` `settings` `medium`

HANDOFF §4 lists "Health goals (`input_number` sliders)". Not present.

**Fix:** add a Health & goals card with `input_number` sliders (steps goal, low-readiness alert,
illness temp-deviation) wired via `ha.setNumber`.

**Acceptance:** sliders read/write the `input_number` entities.

---

## 7. Me: Last-workout card is missing
**Labels:** `feature` `me` `medium`

Prototype Me shows a "Last workout" card (type, intensity, duration, distance, energy).
Implementation omits it. *(Addressed in the Me redesign — see `Me Health.dc.html`.)*

**Fix:** add a workout card from `sensor.oura_last_workout_*` (guard when absent).

---

## 8. Me: Notifications list is missing
**Labels:** `feature` `me` `low`

Prototype Me shows a "My notifications" list (illness warning, bedtime nudge, alarm, gate, water).
Implementation omits it.

**Fix:** surface the relevant `input_boolean.*` notification toggles (or a read-only summary) on Me.

---

## 9. Water: "Where today's water went" breakdown missing; tank trend window differs
**Labels:** `enhancement` `water` `low`

Prototype shows a today's-water split (indoor/bathrooms/pool/outdoor) and a **30-day** tank trend.
Implementation drops the split and shows a **7-day** tank trend.

**Fix:** add the usage-split bars (from real sub-meters if available, else omit rather than fake);
extend tank trend to 30 days.

---

## 10. Redesign: bring Me in line with Oura / Apple Health / Samsung Health
**Labels:** `enhancement` `me` `design`

Delivered as `Me Health.dc.html` in the design project. Adds: Oura-style **readiness contributors**
(7 weighted bars with Optimal/Good/Pay-attention bands), Apple-style **concentric Move/Exercise/Stand
rings**, a **sleep hypnogram** (stage-over-time graph), **▲▼ trend deltas vs 7-day average**, and a
plain-language **headline insight**. Fold these patterns back into `src/views/Me.svelte`.

---

## 11. Tech-debt: Lights / Appliances views duplicate Overview & Energy surfaces
**Labels:** `tech-debt` `low`

The new Lights and Appliances pages (good additions) now duplicate the Overview lights card and the
Energy appliance live-draw grid. Decide the canonical home for each and have the other defer/link,
to avoid drift between two copies.

---

## 12. Nits
**Labels:** `nit` `trivial`

- `src/app.css` `--glass-blur: blur(0px)` is vestigial (actual blur is hardcoded on sidebar/header). Remove or wire it.
- Climate comfort thresholds (16/20/24) differ from the prototype's cold-house bands (14/17/21.5), so rooms read "Cold/Cool" where the design intended "Cool/Comfortable". Confirm intended bands.
- Hardcoded strings: TV "31 zones" / "8 cameras"; System device-category counts. Derive from entities where possible.

---

# ★ Design improvements (glanceability)

These are UX upgrades on top of the fidelity fixes above. The prototype
(`docs/Home automation dashboard prototype/HA Portal.dc.html`) is the reference for each.
Status reflects the design prototype; all still need porting into the Svelte views.

## 13. Climate: temperature heatmap floor plan  ✅ in prototype
**Labels:** `enhancement` `climate`
Rooms are now colour-coded by temperature (blue→cyan→green→amber→red) with a Cool/Warm legend,
instead of a uniform category tint — the plan reads at a glance. **Port to `Climate.svelte`:** map each
room's live temp to the same 5-band scale for its fill.

## 14. Security: 24h event timeline  ✅ in prototype
**Labels:** `enhancement` `security`
Added a horizontal 24h timeline (markers positioned by event time, colour = event type) above the
activity list. **Port to `Security.svelte`** from logbook history.

## 15. Energy: "self-powered now" hero  ✅ in prototype
**Labels:** `enhancement` `energy`
Added a hero band (big grid-independence %, home-load / battery / solar stats over the flow glow) at
the top of Energy. **Port to `Energy.svelte`** driven by `grid_independence_today` + live loads.

## 16. Overview: real timestamped logbook + tappable cards
**Labels:** `enhancement` `overview`
Replace the 4 derived activity items with a real timestamped logbook (HA logbook API); make each
summary card deep-link to its view; hide the Attention bar when nothing needs attention.

## 17. System: problems-first hero + derived counts
**Labels:** `enhancement` `system`
Lead with a problems summary (low-battery + offline devices); derive device-category counts from the
entity registry instead of hardcoding; add an internet outage/uptime timeline.

## 18. Cameras: snapshot stills
**Labels:** `enhancement` `cameras`
Render HA camera-proxy snapshot images in the tiles and on detection events (before full HLS/WebRTC);
add per-camera last-motion time + online dot.

## 19. Water: days-remaining hero + usage split
**Labels:** `enhancement` `water`
Promote "runs out in ~N days" to a hero with a depletion projection on the trend; add the today's
usage split and a net in/out (borehole vs consumption) indicator.

## 20. Irrigation: schedule timeline + weather-aware skip
**Labels:** `enhancement` `irrigation`
Add a week schedule timeline (next run per zone), a `weather.home`-driven smart-skip banner, and a live
countdown on the running zone.

## 21. Traffic: plate history + peak callout
**Labels:** `enhancement` `traffic`
Add an ANPR plate-history list and a "busiest hour / weekday-vs-weekend" callout above the bars.

## 22. Settings: sectioning (+ account card & health goals from #5/#6)
**Labels:** `enhancement` `settings`
Group the long flat scroll under clear section headings; include the account card (#5) and health-goals
sliders (#6).

## 23. TV Overview: distance legibility + solar/use overlay
**Labels:** `enhancement` `tv`
Increase type scale/contrast for across-room legibility; use the solar-vs-use overlay chart in the energy
panel (currently a battery sparkline).

## 24. Security: alarm modes + per-zone bypass  ✅ in prototype + mobile
**Labels:** `feature` `security`
Security now has a 4-mode control (Off / Home / Away / Night) replacing the single Arm-Away button,
and every zone has a Bypass / Restore toggle with a live "armed-ready · bypassed" summary (bypassed
zones dim + turn amber). **Port to `Security.svelte`:** map modes to `alarm_arm_away`/`arm_home`/
`arm_night`/`disarm`, and wire bypass to the `input_select.zone_bypass_selector` (or per-zone helpers).

## 25. Mobile app — navigable iOS prototype  ✅ delivered
**Labels:** `design` `mobile`
`HA Mobile.dc.html` — a navigable iPhone prototype (all 13 screens, bottom tab bar + More sheet) with
every ★ improvement folded in (energy hero, water reserve, climate heatmap, security modes+bypass,
system problems hero, Me contributors/rings, grouped lights). Reference target for the responsive
mobile layouts of the production app.
