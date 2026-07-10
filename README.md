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

## Local development

```bash
npm install
npm run dev
```

Open http://localhost:5173. On first load you'll be redirected to Home Assistant
to log in; after that, tokens are cached in `localStorage` and it connects
silently.

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
