# HA Portal

A clean, lean custom dashboard for Home Assistant, built with Svelte + Vite and
hosted on Firebase. It connects directly to Home Assistant over the WebSocket
API for real-time state, using the official
[`home-assistant-js-websocket`](https://github.com/home-assistant/home-assistant-js-websocket)
client and HA's OAuth login flow (no tokens to paste).

## Stack

- **Svelte 5 + TypeScript + Vite** — the app
- **home-assistant-js-websocket** — live connection + auth
- **Firebase Hosting** — static hosting
- **Nabu Casa** — secure remote access to HA (already set up)

## Views

Aurora-Glass design system (violet/indigo, six accent schemes), sidebar nav,
command palette, live data + history charts. Built from the Claude Design
prototype in `docs/`.

- **Overview** — greeting, command palette (⌘K), Customize (show/hide widgets),
  live power flow, battery/solar/tank, scenes, quick controls, lights (→ light
  sheet), today's energy, security & presence, recent activity, forecast
- **Energy** — Day/Week/Month charts, animated power flow, Victron system, appliances
- **Water** — tank gauge, 7-day usage & level, pumps
- **Irrigation** — Wyze zones (start/stop), smart-irrigation, run-time
- **Climate** — floor-plan room picker, per-room 24h trend + comfort + lights
- **Security** — two-tap arm/disarm, activity, access status, zone grid
- **Cameras** — detection KPIs, recent events, camera grid
- **Traffic** — vehicle/pedestrian analytics, time-of-day bars
- **System** — internet, router CPU/mem, printer ink, device breakdown
- **Me** — Oura health: sleep/readiness/activity, stages, vitals, activity, trends
- **Settings** — appearance (accent/density/motion), people, alarm automations +
  schedule, notifications, zone bypass, broadcast, enabled views
- **TV Overview** — standalone wall display (bento layout, live clock)

Interactions: command palette (⌘K / `/`), light sheet (brightness + colour),
two-tap arm/disarm, per-user Customize + theme (localStorage), toasts.

## Local development

```bash
npm install
npm run dev        # live — connects to your real Home Assistant
npm run dev:mock   # offline — runs against the mock dataset, no HA needed
```

Open http://localhost:5173. On first (live) load you'll be redirected to Home
Assistant to log in; after that, tokens are cached in `localStorage` and it
connects silently. Mock mode is also reachable in any build via `?mock=1`.

> **First-time auth note:** HA's OAuth (IndieAuth) only allows redirects back to
> the same origin that requested login. `http://localhost:5173` and your
> deployed Firebase URL are each valid origins, so log in once per origin.

Config lives in [`src/lib/config.ts`](src/lib/config.ts) — your HA URL and which
entity domains are tappable.

## Deploy to Firebase

One-time setup (interactive — run these yourself in a terminal):

```bash
npm install -g firebase-tools      # or use npx firebase
firebase login
firebase projects:create ha-dashboard   # or create in the console
```

Make sure the project id in [`.firebaserc`](.firebaserc) matches the real
project id Firebase assigned (it may append a suffix, e.g. `ha-dashboard-1a2b3`).

Then, any time you want to ship:

```bash
npm run deploy
```

Your app will be live at `https://<project-id>.web.app`. Log in to HA once from
that URL and you're set.

## Project layout

| Path | What |
| --- | --- |
| `src/lib/config.ts` | HA URL + toggleable domains |
| `src/lib/ha.ts` | Auth + WebSocket connection |
| `src/lib/EntityCard.svelte` | Single entity tile |
| `src/App.svelte` | Dashboard: live grid, search, toggle |
| `firebase.json` | Hosting config (SPA rewrite) |

## Roadmap

- [ ] Rooms / areas grouping
- [ ] Custom curated views instead of the flat entity grid
- [ ] Sliders for lights (brightness) and climate
- [ ] PWA / add-to-home-screen
