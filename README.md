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

Seven views, modern dark "cb" design system, live data + history charts:

- **Home** — greeting, quick actions (arm/disarm, all-lights-off, pumps), live
  power-flow diagram, at-a-glance KPI gauges, light controls, comfort strip
- **Energy** — animated power flow, battery/solar 24h area charts, 7-day solar
  yield bars, power stats, appliance switches
- **Water** — tank gauge + 48h level trend, water-used & borehole 7-day bars, pumps
- **Climate** — indoor average + 24h trend, per-room temp/humidity with sparklines
- **Security** — alarm status, two-tap arm/disarm, live zone grid
- **Traffic** — vehicle/pedestrian counts, sidewalk traffic by time of day, analytics
- **System** — internet, router CPU/memory gauges, mesh nodes, printer ink, health

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
