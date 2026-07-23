# Life-OS Integrations — Context & Reference

_Last updated: 2026-07-23 (South Africa). Covers the data/automation/portal work
built across the HA config (`/Volumes/config`) and the HA Portal (this repo)._

This is the single source of truth for the external + local integrations, the
WhatsApp control channel, the SA data feeds, the solar-forecast stack, and the
operational gotchas discovered while wiring it all up. Read this before touching
any of the `feature_*` packages or the Markets/Timeline views.

---

## 1. Architecture at a glance

- **Home Assistant** (`/Volumes/config`, HAOS on `192.168.0.7`) — owns all sensors,
  automations, the WhatsApp brain, and the data feeds. Config is modular:
  every `packages/*.yaml` is merged via `!include_dir_named packages`.
- **HA Portal** (this repo, Svelte 5 + Vite + Firebase Hosting) — the dashboard at
  https://helloliam-ha-dashboard.web.app. Reads HA over the websocket API.
- **HQ** (`steyn-family-finance`, separate Firebase project) — finances; bridged
  into HA via the `hq_*` helpers. Finances stay OFF the public TV dashboard.
- **DNS**: the home runs **NextDNS** (profile *HelloLiamDNS*). This is load-bearing —
  see §9.

Array of record: **27 × 350 W = 9.45 kWp, single north-facing plane, ~20° roof
pitch, Pretoria** (lat −25.776, lon 28.314, elev 1600 m).

---

## 2. HA packages (what each does)

| Package | Purpose | Key entities |
|---|---|---|
| `feature_solar_intel.yaml` | Open-Meteo irradiance/cloud context, forecast **consensus** (native Forecast.Solar vs Victron VRM), clean **accuracy tracker** vs Victron actual | `sensor.solar_irradiance_today`, `sensor.cloud_cover_tomorrow`, `sensor.solar_forecast_tomorrow_consensus`, `sensor.solar_forecast_accuracy_*` |
| `solar_forecast.yaml` | Unified `sensor.solar_forecast_today/_tomorrow` — prefers native Forecast.Solar, falls back to Victron VRM | `sensor.solar_forecast_today`, `_tomorrow` |
| `feature_solcast.yaml` | Solcast satellite PV forecast (hobbyist tier) — daily kWh from 30-min `pv_estimate` | `sensor.solcast_forecast_today`, `_tomorrow` |
| `feature_sa_data.yaml` | SARB rates/FX/inflation/bonds, Eskom national stage, JSE indices, Pepkor, rate outlook, MPC countdown, Vaal dam helper | see §5 |
| `feature_severe_weather.yaml` | Derived severe-weather alert from Open-Meteo (NOT official SAWS) | `sensor.severe_weather_warning`, `binary_sensor.severe_weather_active` |
| `feature_space_weather.yaml` | NASA DONKI (space weather), EONET (natural events), NeoWs (asteroids), EPIC (Earth image) | `sensor.space_weather`, `sensor.natural_events_open`, `sensor.nasa_epic_image_url` |
| `feature_local_apis.yaml` | Printer low-ink alert, fibre/internet health, NextDNS block-rate | `sensor.printer_lowest_ink`, `binary_sensor.internet_up`, `sensor.dns_blocked_percent` |
| `feature_market_fuel.yaml` | Petrol 95 + Diesel 50ppm (manual monthly helpers — SA regulated, no feed) | `input_number.petrol_95_current/_forecast`, `input_number.diesel_current/_forecast` |
| `feature_morning_digest.yaml` | 06:30 WhatsApp+push daily briefing | `automation.morning_digest`, `input_boolean.morning_digest_enabled` |
| `feature_wa_inbound.yaml` | Inbound WhatsApp command + chat channel (see §7) | `script.wa_process_message`, `automation.wa_inbound_router` |

---

## 3. Solar-forecast stack

Three independent forecasts + the clean actual:
- **Native Forecast.Solar** (`sensor.energy_production_today/_tomorrow`) — array-geometry
  model (free tier: **12 API calls/hr per public IP**).
- **Solcast** (`sensor.solcast_forecast_*`) — satellite model, best accuracy (free
  hobbyist: **10 calls/day**; we poll every 3h = 8/day).
- **Victron VRM** (`sensor.victron_remote_monitoring_estimated_energy_production_*`) —
  site-history model; the fallback.
- **Actual**: `sensor.victron_total_pv_yield_today/_yesterday` (CLEAN — do NOT use
  `sensor.solar_yield_today`, which logs impossible daily values on reset).

The accuracy tracker measures forecast vs Victron actual once forecasts are trusted.
Observed: Forecast.Solar under-predicts (conservative); Solcast (~43 kWh good winter
day) tracks real output better; VRM ~conservative too.

### ⚠️ Forecast.Solar geometry lives in SUBENTRIES
This HA version stores each PV plane's `azimuth`/`declination`/`modules_power` in the
config entry's **`subentries`**, NOT `options` (options only holds damping/api_key).
Editing `.storage/core.config_entries` options does nothing, and any `.storage` edit
is re-wiped from memory on the next config change/restart. **The only reliable way to
set geometry is delete + recreate via the config flow.** Current entry: single plane
`azimuth 180, declination 20, modules_power 9450`.

---

## 4. Solcast setup (per-user)

Secret `solcast_forecast_url` in `secrets.yaml` holds the full URL with key + resource
baked in:
```
https://api.solcast.com.au/rooftop_sites/<RESOURCE_ID>/forecasts?format=json&hours=72&api_key=<API_KEY>
```
Site should be configured in the Solcast dashboard as **9.45 kWp, north, ~20° tilt,
Pretoria**. Response is 30-min `pv_estimate` (kW); daily kWh = Σ(pv_estimate × 0.5).

---

## 5. SA data feeds (all keyless unless noted)

| Source | Endpoint | Entities |
|---|---|---|
| **SARB** (Reserve Bank) | `custom.resbank.co.za/SarbWebApi/WebIndicators/HomePageRates` | `sensor.sarb_repo_rate` (7.0%), `sensor.sarb_prime_rate` (10.5%), `sensor.sa_inflation_cpi/_ppi`, `sensor.usd_zar_rate`, `sensor.eur_zar_rate`, `sensor.gbp_zar_rate`, `sensor.sa_r2030_bond_yield`, `sensor.sa_r209_bond_yield`, `sensor.sabor_overnight_rate` |
| **Rate outlook** (derived) | SABOR vs repo + curve slope | `sensor.rate_outlook`, `sensor.days_to_mpc_meeting`, `input_datetime.next_sarb_mpc` |
| **Eskom national** | `loadshedding.eskom.co.za/LoadShedding/GetStatus` (returns stage+1) | `sensor.eskom_national_stage`, `binary_sensor.national_loadshedding_active` |
| **JSE** (via Yahoo) | `query1.finance.yahoo.com/.../%5EJ200.JO` / `J203.JO` | `sensor.jse_top_40`, `sensor.jse_all_share` |
| **Pepkor** (via Yahoo) | `.../PPH.JO` (quoted in cents → ÷100) | `sensor.pepkor_share_price` (R), `sensor.pepkor_change_pct` |
| **Fuel** | manual (SA regulated monthly) | `input_number.petrol_95_current` (R26.10), `input_number.diesel_current` (R25.17) |
| **Vaal Dam** | manual (no clean API) | `input_number.vaal_dam_level` (~105%) |

**2026 SARB MPC dates**: 29 Jan · 26 Mar · 28 May · 23 Jul · **23 Sep** · 19 Nov.

---

## 6. Commute (Waze)

Native `waze_travel_time` config entry "Commute to work":
- Home: **302 Wyoming Street, Faerie Glen, Pretoria**
- Work: **Southdowns Office Park, Southdowns Rd, Centurion**
- Region `eu` (works for SA), keyless. Entity: `sensor.waze_commute_to_work` (min;
  attrs `distance`, `route`).

---

## 7. WhatsApp control channel (`feature_wa_inbound.yaml`)

**Flow:** TextMeBot webhook → Firebase `waInbound` fn → HA webhook
`wa_inbound_a7f3c9e21b` → `automation.wa_inbound_router` (queued) →
`script.wa_process_message` → reply via `script.notify_household` (`channel: whatsapp`,
`force: true`). Outbound send is `shell_command.whatsapp_notify_<person>` →
`/config/scripts/whatsapp_notify.sh <number> <b64 msg> [<b64 image>]`.

**Robustness fixes (2026-07-23) — root causes of "often doesn't reply":**
1. `wa_process_message` was **`mode: single`** → concurrent messages (esp. during a
   slow AI reply) were silently dropped. Now **`mode: parallel, max: 10`**.
2. The AI/question path (`conversation.process`, agent
   `conversation.google_ai_conversation_2`) had **no error handling** → any Gemini
   error/timeout aborted the script with no reply. Now **`continue_on_error: true`**
   and it **always** sends a reply (AI answer, or a graceful fallback).
3. Replies now target the **actual sender** via `reply_to` (christo / mandri).
- `force: true` bypasses BOTH quiet-hours AND the 30-min tag cooldown in
  `notify_household`, so command replies always go out.

**Commands** (deterministic `choose`, then AI fallback):
`help` · `arm`/`arm stay`/`arm beams`/`disarm` · `lights on/off` · `outside lights` ·
`pool` · `borehole` · `irrigation on/off` · scenes (`goodnight`/`morning`/`movie`/
`braai`/`away`) · `announce <text>` · `status` · `energy` · `weather` · `fuel` ·
`rates` · `shares` · `loadshedding` · `commute` · `dam` · `solar tomorrow` ·
`gate pic` (sends `image.main_gate_last_motion_image` snapshot) · `digest` (runs the
morning briefing now) · Vitality (`gym`/`points <n>`/`status <tier>`). Anything else →
AI agent.

**Gotcha:** `timeout:` is NOT a valid key on a `- action:` service call — it breaks
script validation.

---

## 8. Portal changes (this repo)

- **`src/views/Markets.svelte`** (new) — "Markets & Rates" view (nav: House → 💹).
  Shows SARB rates, CPI/PPI, bond yields, SABOR, rate outlook, MPC countdown,
  USD/EUR/GBP-ZAR, JSE Top40 + All Share, Pepkor (+day %), Brent, national stage.
  Registered in `src/lib/nav.ts` and `src/App.svelte`.
- **`src/views/Timeline.svelte`** — the **"Me / Liam & Eben" tab and kids section were
  removed** (tab switcher, markup, script, and CSS). The "Kids" / "TV Room" entries
  that remain are house *rooms* in the movement heatmap, not the person section.
- Deploy: `npm run deploy` (svelte-check + vite build + `firebase deploy --only hosting`).
  SPA — hard-refresh after deploy to bust the cache.

---

## 9. Operational gotchas (hard-won — read before debugging "nothing works")

1. **NextDNS blocks data domains.** The home resolver (NextDNS *HelloLiamDNS*) can
   block the API domains, making HA look internet-less while the LAN is fine.
   **Allowlisted** (NextDNS → Allowlist): `custom.resbank.co.za`, `open-meteo.com`,
   `finance.yahoo.com`, `nasa.gov`, `solcast.com.au`, `eskom.co.za`, `waze.com`
   (plus `googleapis.com`, `firebase.com` for the portal). Check **NextDNS → Logs**
   for the HA device to find newly-blocked domains.
2. **HAOS DNS**: the `.claude/ha.env` token is a **core** token — supervisor endpoints
   (`/api/hassio/dns/*`) return 401. A stuck CoreDNS can survive a core restart AND a
   host reboot; fix via SSH/Terminal add-on: `ha dns options --servers dns://1.1.1.1
   --servers dns://8.8.8.8 --fallback true` then `ha dns restart`.
3. **`rest:` platform is all-or-nothing.** One invalid sensor option (e.g. using
   `attributes:` — which is template-only; use `json_attributes`) makes
   `homeassistant.setup` fail the WHOLE `rest:` platform → every REST sensor MISSING.
   `check_config` does NOT catch this; diagnose via WS `system_log/list`.
4. **REST sensors only appear after a successful first fetch.** If a fetch fails at
   startup, pre-existing sensors restore as `unavailable`; brand-new ones are MISSING
   until a fetch succeeds. "MISSING vs unavailable" is a useful tell.
5. **Template sensor state of literal `"None"` → coerced to `unknown`.** Use another
   word (e.g. `Clear`). Attributes are not coerced.
6. **Forecast.Solar subentries** — see §3.
7. **Host reboot drops the `/Volumes/config` SMB share** on the Mac — reconnect via
   Finder → `smb://192.168.0.7/config`.

---

## 10. Secrets / credentials added

In `/Volumes/config/secrets.yaml` (gitignored): `solcast_forecast_url` (key+resource),
`nasa_apod_url` (NASA key). Portal `.env` (gitignored): Firebase config, VAPID key,
reCAPTCHA site key. WhatsApp/TextMeBot + Gemini keys live in the existing HA config /
Firebase secrets.

---

## 11. Monthly / periodic maintenance

- **Fuel** (first Wednesday): update `input_number.petrol_95_current/_forecast` and
  `input_number.diesel_current/_forecast` from the DMRE/AA figures.
- **Vaal dam** (weekly): update `input_number.vaal_dam_level` from The Citizen / gov.za.
- **SARB MPC**: `input_datetime.next_sarb_mpc` auto-counts down; reset after each meeting.
- **Solcast**: sanity-check the rooftop site config; watch Solcast-vs-actual.

---

## 12. Outstanding / next up

- **Portal coverage**: build a **Solar Intelligence** view (Solcast vs Forecast.Solar
  vs actual + accuracy), a **severe-weather** tile, the **commute** tile, and a
  **home-services strip** (DNS %, printer ink, internet). Markets view is done.
- **Deeper WhatsApp**: NL *actions* ("pool on for 2h"), quick-reply Yes/No buttons,
  per-person command scoping.
- **Gate-pic**: option for a live snapshot instead of last-motion.
- **Plex media tile** (currently deferred).
- **Security (user)**: WhatsApp allow-list = own number, App Check enforcement,
  GCP API-key referrer restriction.
