# Steyn Home — Design Handover

**Compiled:** 9 August 2026
**System:** Home Assistant Core 2026.8.1 · 4,623 entities · 425 devices · 170 integrations · 18 add-ons
**App:** Svelte 5 PWA on Firebase — `helloliam-ha-dashboard.web.app`

> Every figure in this document was read from the live system on 9 Aug 2026 — from the running state machine, the device/entity/area registries, and config entries. Nothing is estimated. Where something could not be verified, it is not claimed.

---

## 1. Who this is for

A family of four in Pretoria, South Africa:

- **Christo** — owner, builds and maintains the system. Technical, reads the code, opinionated.
- **Mandri** — wife.
- **Liam, 11** and **Eben, 8** — sons.

A Reformed Christian household, which shows in the product: a prayer board (*Gebedslys*), a daily devotional, Sabbath mode, and a media-discernment app ("Screening Room"). **Afrikaans matters to them.**

The house runs on **solar with battery backup** (Victron), a **borehole and JoJo tank** for water, a pool, and a **31-zone alarm** with armed response. Load shedding shaped much of the original thinking but has been **suspended nationally since May 2025** — so outage *resilience* still matters, scheduled outages don't.

### ⚠️ The single most important thing to understand

**They do not use Home Assistant's own dashboard any more.** Lovelace is effectively dead to them. The Svelte PWA **is** the interface to their house — for the whole family, on every device.

Anything designed for Home Assistant should be about **capability** (automations, data, integrations, intelligence) — **never about its UI**.

### Working style

Christo has explicitly asked for **research-backed alternatives rather than agreement**. He would rather be told a plan is wrong than have it quietly built. He is also **cost-sensitive**: no new subscriptions, nothing that raises hosting or API spend.

---

## 2. The devices it actually runs on

Design for these, in this order:

| Device | Notes for design |
|---|---|
| **iPhone** | Primary quick-glance surface. Installed to home screen — push and badging only work there. |
| **iPad 13"** + **iPad Air 13" M4** | Two large tablets. iPadOS 26 windowed mode has a real bug: window controls overlap the top-left of PWA content — reserve ~44–52px there. |
| **MacBook Air 15" M5** | Safari 26+. All modern CSS lands here — Grid Lanes, View Transitions, anchor positioning. |
| **Windows desktop, 3 × 2K/3K monitors** | The deep-dive surface. Was badly served — the app capped at 1440px. Now steps to 2000px / 5 columns. |
| 65" 4K TV (wall dashboard) | **Rarely used. Deprioritised** — don't invest here unless asked. |

**Practical read:** an Apple-first household with one big Windows desktop. Safari-only features are usually safe for four of five targets, but the desktop needs a working fallback.

---

## 3. The app as it stands

Svelte 5 (runes) + Vite PWA on Firebase Hosting, talking to Home Assistant over a live WebSocket. Roughly 2,000 lines of hand-rolled SVG charting — **no chart library**, deliberately.

**Stack:** `svelte@5.19` · `vite@6` · `vite-plugin-pwa@1.3` · `firebase@12.16` · `home-assistant-js-websocket@9.4` · `typescript@5.7`

### Information architecture — two front doors, deliberately

This was the outcome of a research pass that **rejected the owner's own suggestion** of a quick/advanced mode toggle. Modes halve discoverability and cause mode errors (NN/g), and no commercial system — Apple Home, Google Home, Control4, Savant, Crestron, Homey — uses one. They all converged on favourites-first with drill-down.

**Home** — the default landing:
- Security hero (arm/disarm, largest target on screen)
- Glance ribbon: battery · solar · tank · lights
- Scenes named by *intent*, not device
- "Suggested for now" — adaptive, frecency-ranked
- Pinned favourites (stable zone, never reordered by the algorithm)
- Room scenes, quick controls, adaptive jump-to

**Dashboard** — the dense board:
- 15-card masonry, the original deep-dive view
- Power flow, battery, solar, comfort, tank, lights, appliances, security, activity
- User-toggleable widgets
- This is the desktop / 3-monitor surface

### All 37 views

`Home` · `Overview (Dashboard)` · `Energy` · `EnergyHub` · `Solar` · `PowerTrends` · `Batteries` · `Water` · `Irrigation` · `Rooms` · `Lights` · `Appliances` · `Security` · `Cameras` · `Traffic` · `Devices` · `Automations` · `System` · `ServerControl` · `ControlHub` · `Reminders` · `Trello` · `Meals` · `FairPlay` · `Kids` · `Faith` · `Me` · `MeHub` · `Vitality` · `FocusWork` · `Timeline` · `Insights` · `Usage` · `Markets` · `Assist` · `TV` · `Settings`

### Shared components (25)

`AreaChart` · `BarChart` · `Sankey` · `Spark` · `PowerFlow` · `TrendCard` · `GridStatusCard` · `HomeStatusStrip` · `PresenceStrip` · `RightNow` · `NeedsAttention` · `Nudges` · `Briefing` · `Favourites` · `RoomScenes` · `TimeMachine` · `ExplainChart` · `CommandPalette` · `LightSheet` · `Overlay` · `Toast` · `Toggle` · `StatusChip` · `Icon` · `CrossLinks`

`Icon.svelte` is a hand-built 1.7px-stroke line-icon set (~42 glyphs, `currentColor`, 24×24). **Emoji are used alongside it as a deliberate second register** — warmer, and instantly readable for the kids.

---

## 4. The design system in use — "Aurora Command"

Dark-first, glass-and-glow. Tokens live in `src/app.css`. Accent colours are themable at runtime; **domain colours are semantic and never themed** — that separation is load-bearing.

### Brand accent — 4 selectable themes

| Theme | Gradient |
|---|---|
| **Tide** *(default)* | `#38bdf8 → #818cf8` |
| Meadow | `#34d399 → #38bdf8` |
| Spectrum | `#38bdf8 → #818cf8 → #a855f7` |
| Classic | `#818cf8 → #a855f7` |

### Domain colours — semantic, never themed

| Token | Value | Used for |
|---|---|---|
| `--energy` / `--solar` | `#fbbf24` | Generation, yield |
| `--battery` | `#a78bfa` | Storage, SoC |
| `--water` | `#38bdf8` | Tank, pumps, irrigation |
| `--climate` | `#fb923c` | Temperature, comfort |
| `--security` | `#34d399` | Alarm, zones, cameras |
| `--load` | `#818cf8` | Consumption, appliances |
| `--health` | `#fb7185` | Oura, vitality |
| `--grid-alert` | `#fb923c` | **Amber, not red** — deliberate, red/green CVD-safe |

### Two rules already baked in — please keep them

1. **Colour is never the only signal.** Status always pairs a colour with a glyph *and* a label.
2. **Grid alerts are amber, not red** — specifically so red/green colour-blindness cannot misread the most safety-relevant state in the app.

### Base + text

```
--base   #13171a   (dim, not black)
--text   #eef2f9   --text-2 #c8d4e2   --muted #93a3b5   --faint #7e8ea3
--r-card 16px      glass: backdrop-filter + inset 1px hairline
```

---

## 5. What just changed (this week — all shipped and live)

### New surfaces & features

- **Home quick surface** — new default landing (above).
- **Frecency intelligence** — "Suggested for now" ranks the owner's *own portal taps*, 30-day half-life, bucketed by time of day.
  **Key insight:** HA state history is *automation-polluted* — the pumps top "most active" purely from solar scheduling, not humans. So ranking entity changes recommends things the house already does itself. Portal taps are the clean, human-only signal.
- **Usage view** — most-used actions and most-visited pages by frecency, plus a time-of-day histogram. Feeds the adaptive "Jump to" row.
- **Room scenes** — one verb (Bright / Relax / Off) resolving per room. Backed by a single HA script where each room declares `bright` and `soft` light sets, so 8 rooms × 4 scenes is one script, not 32.
- **Proactive AI nudges** — a scheduled job hands Gemini a contextual house snapshot; a **deterministic gate** then decides what may surface (confidence ≥ 0.7, 6h cooldown per key, 3/day cap, quiet hours, one per run). *Model proposes, code decides.*
- **Time machine** 🕰️ — scrub the whole dashboard back through history. Hooks the store's **readers**, so all 37 views time-travel with no per-view changes. Writes are hard-blocked while rewound.
- **Explain this chart** ✨ — two-sentence caption under a chart. Only the rendered series is sent; answers cached on a content hash, so a daily chart costs ~one model call per day for the whole household.
- **Evening In** scene — arms the alarm but *leaves interior lights on*. Distinct from Goodnight. Existed in HA but was unreachable from anywhere until now.

### Performance & platform

- **Wide-screen layout** — 1440 → 2000px, 3 → 5 masonry columns at 2560px.
- **Grid Lanes** behind `@supports` — also fixes a real a11y bug: `column-count` flows top-to-bottom *per column*, so tab order and screen-reader order didn't match visual order.
- **Render loops killed** — deriveds that allocated a new array on every 300ms tick re-rendered forever. Now memoised by content signature (`lib/stable.ts`).
- **Firestore persistent cache** + multi-tab · **View Transitions** · **app badge** wired to the attention count · `content-visibility` on below-fold cards.

### Three real bugs found and fixed

1. Boot awaited a Firestore read for the HA token with **no timeout**, and Firestore's default cache is memory-only — so with WAN down but LAN up, the app couldn't reach HA *even though HA was reachable*. The moment you most want the dashboard was the moment it failed.
2. The service worker called `showNotification` without **returning** the promise. iOS counts that as a silent push and revokes the subscription after ~3 offences.
3. Notification taps always opened `/`, ignoring any deep link.

---

## 6. Open design problems — where a design pass should aim

**1 · 37 views is a lot.**
The Home surface fixed "I get lost", but the underlying IA is still 37 destinations behind a sidebar. Several overlap: Energy / EnergyHub / Solar / PowerTrends / Batteries, and Me / MeHub / Vitality / FocusWork. Usage data now exists to justify merging or demoting.

**2 · Staleness is invisible.**
A dead sensor holding its last value looks identical to a live one. Needed: *fresh / frozen / unavailable / disconnected*, with per-entity thresholds derived from observed cadence. A wrong number is worse than no number when deciding whether the battery lasts the night.

**3 · Notifications can't be edited on iOS.**
`tag` does not replace, action buttons don't render, images unsupported. Every push stacks forever, so coalescing must happen server-side *before* sending. Needs a digest and "all clear" design, not more alerts.

**4 · The kids have no surface of their own.**
Chores, allowance and routines exist but are rendered for adults. An 8-year-old needs icon-led, large-target, reading-light design. Photo-proof, streaks, and a money-like ledger were researched and not yet built.

**5 · Charts are all hand-rolled SVG.**
Genuinely the right call at this scale — a library would be a regression. But the energy Sankey and any streaming chart are at the edge of comfortable, and visual consistency across ~6 chart types is not formalised.

**6 · Afrikaans is entirely absent.**
Afrikaans household; the app is English-only. Faith content especially would land better in Afrikaans. No i18n scaffolding exists.

---

## 7. Entities available — 4,623 total

Far too many to enumerate, and most are noise. What matters is the split between *everything that exists* and *the curated set the dashboard actually renders*.

### Everything, by domain

| Domain | Count | Domain | Count |
|---|---:|---|---:|
| sensor | 1,978 | number | 67 |
| automation | 424 | input_datetime | 64 |
| binary_sensor | 419 | image | 46 |
| switch | 295 | select | 41 |
| input_number | 288 | input_text | 30 |
| input_boolean | 241 | light | 28 |
| device_tracker | 191 | camera | 26 |
| button | 136 | counter / media_player | 20 / 20 |
| update | 128 | alarm_control_panel | 5 |
| script | 101 | todo / person / calendar | 5 / 3 / 2 |

### The curated set — what design should work from

`src/lib/entities.ts` is the single source of truth for what the dashboard renders. It excludes dead and flaky entities deliberately. Anything new should be added there, not read ad-hoc.

| Catalogue | Size | Contents |
|---|---:|---|
| `E` | 179 | Named entities: Victron energy, water/tank/borehole, alarm, cameras, traffic, system, pumps, irrigation, Oura health |
| `ALARM_ZONES` | 31 | Every zone with state, bypass status, bypass/unbypass buttons |
| `LIGHT_AREAS` | 6 / 26 | 6 areas containing 26 individual lights |
| `APPLIANCE_AREAS` | 7 / 17 | 7 areas, 17 metered appliances (switch + power sensor each) |
| `CAMERAS` | 8 | Gate, driveway, front door, sidewalk, store room, back/front yard, pool |
| `ROOMS` | 8 | Temperature + humidity per room |
| `SCENES` | 6 | Evening In, Goodnight, Movie, Braai, Away, Morning |
| `ACCESS` / `IRR_ZONES` / `PUMPS` | 6 / 6 / 3 | Doors & gates · irrigation zones · water/borehole/pool pumps |

---

## 8. Devices & hardware — 425 active

| Manufacturer | n | What it is |
|---|---:|---|
| Tasmota | 41 | Flashed smart plugs / relays |
| TP-Link | 37 | Kasa/Tapo plugs with energy metering (+6 Deco mesh nodes) |
| Hikvision | 27 | NVR + cameras |
| SONOFF | 20 | Zigbee relays and switches |
| Espressif | 15 | ESPHome nodes (JoJo tank monitor etc.) |
| Frigate | 15 | NVR-derived camera devices |
| Victron Energy | 7 | Cerbo GX, inverter, MPPTs, battery |
| LUMI (Aqara) | 7 | Buttons + motion/contact sensors |
| Apple / Google / EZVIZ | 7 / 7 / 5 | Phones & watch · Cast targets · gate camera |
| Brother / eWeLink / HEIMAN | 5 / 4 / 3 | Printer · switches · Zigbee sensors |

### Zigbee mesh — 31 devices on ZHA (Sonoff CC2652 coordinator)

Kitchen / Bedroom / Patio buttons (Aqara) · Kitchen, Driveway, Main Bedroom, Bathroom, Hallway lights · Study & Liam lamps · 6 room temp/humidity sensors · Lounge + Study occupancy (SNZB-06P) · 4 window contacts · 3 vibration sensors · TV Room plug

### ⚠️ Known hardware pain worth designing around

- The **kitchen and bedroom Aqara buttons sit on weak links (LQI 11–18)**. Aqara devices are notoriously incompatible with Tuya/Sonoff routers and cling to the coordinator. Presses are occasionally missed — any UX depending on them must degrade gracefully.
- **Frigate runs CPU-only detection across 6 cameras.** Nothing new may add local inference load.
- A **flaky Tapo cloud relay** controls the street lights and drops commands; a self-heal loop papers over it.

---

## 9. Integrations — 170 config entries

**Energy & environment**
`victron_gx` (Cerbo, local MQTT push) · `victron_remote_monitoring` (VRM forecasts) · `forecast_solar` · `co2signal` · `powercalc` ×14 (virtual power for unmetered loads) · `utility_meter` ×10 · `integration` ×5 (Riemann) · native Modbus (41 register sensors from the Cerbo)

**Security & cameras**
`olarm` (official integration, OAuth2 + MQTT push) · `frigate` (6 AI cameras) · `hikvision_next` · `ezviz` ×6 · `go2rtc` · `llmvision` ×3 (Gemini vision on camera events)

**AI & voice**
`google_generative_ai_conversation` (Gemini + AI Task) · `google_cloud` (**primary TTS/STT**) · `mcp_server` (HA exposed as MCP) · `conversation` / `assist_pipeline` (fully Google)

**Home & family**
`zha` · `matter` · `mqtt` · `tasmota` · `tplink` ×13 · `sonoff` · `wyzeapi` · `tuya_local` · `icloud` · `mobile_app` ×4 · `ibeacon` · `proximity` · `oura` · `local_todo` ×5 · `local_calendar` · `plex` · `cast` · `androidtv_remote` ×2 · `homekit` ×29

**Network & system**
`asuswrt` · `tplink_deco` · `nextdns` · `nmap_tracker` · `upnp` · `influxdb` · `systemmonitor` · `speedtestdotnet` · `fastdotcom` · `watchman` · `spook` · `hacs` · `backup`

**Custom components (HACS)**
alarmo · blitzortung · browser_mod · frigate · hacs · hikvision_next · linkplay · llmvision · multiscrape · olarm · oura · powercalc · scheduler · sonoff · spook · tplink_deco · tuya_local · variable · watchman · weatherdotcom · webrtc · wyzeapi · yamaha_ynca

*Recently removed as dead weight (zero config entries, zero entities):* `victron` (HACS Modbus) · `victron_vrm_api` · `eskom_loadshedding` · `load_shedding` · `nodered` · Piper/Wyoming TTS.

---

## 10. Add-ons — 18 installed

| Add-on | Version | Role |
|---|---|---|
| MariaDB | 3.0.1 | Recorder database (external) |
| InfluxDB | 5.0.2 | Long-term time series |
| Grafana | 12.1.0 | Analytics (largely superseded by the PWA) |
| Mosquitto broker | 7.1.0 | MQTT — Frigate, Victron, Olarm |
| Frigate | 0.17.2 | NVR, 6 cameras, CPU detection, GenAI review summaries |
| Matter Server | 9.1.1 | Matter devices |
| NGINX SSL proxy + Let's Encrypt | 4.5.1 / 6.4.0 | TLS for `ha.helloliam.co.za` |
| Samba share | 12.10.0 | Config access |
| Studio Code Server / File editor | 6.0.1 / 6.1.0 | Config editing |
| Terminal & SSH / Advanced SSH | 10.3.0 / 24.0.1 | Shell access |
| Log Viewer / Glances | 0.17.1 / 0.22.0 | Diagnostics |
| phpMyAdmin / TasmoAdmin | 0.13.0 / 0.33.0 | DB + Tasmota device admin |
| AirCast | 5.1.1 | AirPlay → Cast bridge |

**Platform:** HA OS 18.2 · Core 2026.8.1 · Supervisor 2026.07.5. Self-hosted at `ha.helloliam.co.za` — **no Nabu Casa** (cancelled), so there is no vendor safety net for backups or remote access.

> *Caveat:* the Supervisor API rejects long-lived tokens, so this list is derived from the device registry. Accurate for what's installed and running, but an add-on registering no device would not appear.

---

## 11. Floors & rooms — 3 floors, 20 areas

Floors were only defined this week; before that all 22 areas were floorless, making HA 2026.7's floor/area-targeted automations unreachable. Two empty duplicate areas were deleted.

| Floor | Rooms | Entities |
|---|---|---:|
| **Ground Floor** | Entrance · Laundry · Store Room | 92 |
| **First Floor** *(most of the living space)* | Kitchen (208) · Main Bedroom (186) · Living Room (109) · Study (484) · Hallway · Kids Room · Guest Room · Dining · Lounge · Liam's Room · School Room · Bedroom | 1,149 |
| **Outside** | Back Yard (323) · Front Yard (160) · Patio · Sidewalk | 491 |

**Note the unusual layout:** the ground floor is only the store room, laundry and entrance hall — the family actually lives on the first floor. Worth respecting in any floor-plan visualisation.

---

## 12. Backend & data

### Cloud Functions (30)

`homeWatchdog` (30-min sweep, threshold alerts) · `anomalyNudges` (2-hourly Gemini contextual scan) · `morningBriefing` / `eveningBriefing` / `getBriefing` · `explainChart` (cached chart captions) · `warehouseSnapshot` (nightly → BigQuery) · `kidPayout` · `syncMoneyToHA` · `refreshParcels` · `waInbound` (WhatsApp command channel) · `trelloApi` · `parseDocument` · `sendPush` · Screening Room: `analyzeMovie`, `whereToWatch`, `tmdbSearch`, `discussTitle`, `similarTitles`, `getTrailer`, plus music equivalents

### Firestore collections

`action_log` (every tap + view open — frecency) · `access_log` · `nudges` · `chartExplain` · `prayers` · `gratitude` · `kids_payouts` · `responsibilities` · `shopping` · `parcels` · `watchlist*` · `music_items`

### Access model — three real design states

Google sign-in with a Firestore-rules allow-list and three roles: **owner / member / guest**. Guests get a forced restricted view with security, cameras, location and health hidden. There is also a **Sabbath mode** that quietens work, admin and money views. All three are design states worth accounting for.

---

## 13. The Home Assistant side — capability, not UI

Christo explicitly invited ideas here — just not dashboard ideas.
**Scale:** 424 automations (374 enabled) · 101 scripts · 111 feature packages in `/config/packages/`.

### What's already sophisticated

- **Solar load-shifting** — surplus detection with hysteresis (PV on >2000W, stays on until <1500W), asymmetric debounce, peak-tariff lockout, and an EMHASS interlock that cleanly hands pump control back and forth.
- **Arrival intelligence** — sensor fusion across car occupancy zones, plate recognition, phone presence, and a reliability-weighted phone sensor.
- **Context-aware buttons** — the bedroom button's single press reads time-of-day *and* alarm state to choose between bedtime, get-up, back-to-bed and daytime behaviours.
- **Announcement pipeline** — TTS with quiet hours, focus gating, and a digest queue.

### Known-weak — good targets

- **Room-level presence doesn't exist.** Presence is phone-GPS + a few occupancy sensors. BLE proxies with IRK would make iPhones room-level sensors with no app — the single biggest missing input.
- **No per-circuit energy monitoring.** Powercalc estimates fill gaps, but attribution is incomplete.
- **Scripts aren't exposed to the LLM as tools** — the highest-leverage way to make voice/NL control reliable.
- **Credentials in plaintext** — the Frigate config carries the MQTT password and four RTSP camera passwords.

### ⚠️ A hard-won lesson worth carrying forward

A bare `to: "on"` state trigger in HA **also matches `unavailable → on`**. Template sensors briefly go unavailable on *every* config reload and restart — so an auto-disarm automation triggered by a template-backed sensor **silently disarmed the house alarm on every reload**, including minutes after it was deliberately armed for the night.

Anything safety-critical must pin `from:`, and must never be undone by an inferred state.

---

## 14. Hard constraints — read before designing

| Constraint | Why it's immovable |
|---|---|
| **No new subscriptions or running cost** | Stated explicitly. Anything per-use needs caching or a free tier. |
| **Cannot connect to a LAN IP** | The app is HTTPS, so `ws://192.168.x.x` is blocked mixed content with no override. Chrome's Local Network Access excludes WebSockets; Safari has no implementation. Split-horizon DNS is the only fix, and it's network work. |
| **iOS notifications are immutable** | No action buttons, no images, `tag` doesn't replace. Design digests, not alerts. |
| **No background sync on iOS** | Never shipped, no standards position. Don't design around it. |
| **Home-screen install required for push** | Push is silently absent in a Safari tab. Any push UI must be hidden until installed. |
| **Frigate is CPU-only** | 6 cameras, no accelerator. Nothing may add local inference. |
| **Load shedding is over** | Suspended nationally since May 2025. Don't build around scheduled outages — but *do* keep outage resilience. |

---

## Repos

- **Portal:** `/Users/christo/Code/HA_Portal` — branch `portal-vision`, live at `helloliam-ha-dashboard.web.app`
- **HA config:** `/config` via Samba
- **Screening Room:** separate repo (`steyncd/screening_room`), shares the same Firebase backend
