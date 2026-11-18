# Experiential, playful and artistic presentation of live and historical data on the web (2025-2026), applied to a family's smart-home data

Research date: 18 November 2026. Scope: creative-coding, data-art, game-UI and award-winning interactive design. Conventions used below:

- "Cited Findings" contain only things confirmed in a source opened or returned by search during this session, with the URL.
- "How it is built" notes that come from general practitioner knowledge rather than a source are placed under "Inferences" and labelled as such.
- Tags used in Inferences: [ALWAYS-ON OK] / [TOO HEAVY for low-power always-on] / [DAILY VALUE] / [ONE-TIME WOW] / [CVD] = note for the red-green colour-blind primary user.
- Several sources are secondary (studio blogs, vendor pages, review sites); where that matters it is flagged.

---

## 1. Interactive web design trends 2025-2026 in award winners: dominant techniques, reference studios, 10-15 concrete examples

### Takeaway
The 2025-2026 award circuit is dominated by real-time 3D built on three.js (WebGL, increasingly WebGPU + TSL with a WebGL fallback), scroll-as-camera storytelling, small "playable" worlds, cursor-reactive refraction/blob effects, and commissioned sound; the strongest work commits to one idea (one object, one tiny world, one mechanic) rather than stacking effects. The reference names that recur are abeto, Bruno Simon, Lusion, Immersive Garden, OFF+BRAND., Unseen Studio, Active Theory and Utsubo.

### Cited Findings

**Platform state (what is safe to ship in a browser in late 2026)**
- WebGPU is now in all major engines: Chrome/Edge 113+ on Windows/macOS/ChromeOS, Chrome 121+ on Android 12+ with Qualcomm or ARM GPUs, Firefox 141+ on Windows and 145+ on Apple-silicon macOS 26, and Safari 26 on macOS/iOS/iPadOS/visionOS 26. Linux and Firefox-on-Android/Intel-Mac support was still in progress as of the post (25 Nov 2025). — [web.dev](https://web.dev/blog/webgpu-supported-major-browsers)
- TSL (three.js Shading Language) lets shaders be written once in JavaScript and compiled to both WebGPU and WebGL; a 2026 studio roundup calls 2026 "the year WebGPU became safe to ship with a WebGL fallback". Source is a studio blog (Utsubo) that includes its own work, so treat ranking claims as self-interested. — [Utsubo](https://www.utsubo.com/blog/best-threejs-websites-2026)
- CSS scroll-driven animations shipped in Safari 26.0; same-document View Transitions have been in Safari since 18.0/18.2 (2024). — [WebKit Safari 26.0 notes](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/); one web.dev table still listed Safari as unsupported for scroll-driven animations, contradicted by WebKit's own notes — [web.dev Sept 2025](https://web.dev/blog/web-platform-09-2025)
- "Liquid glass" refraction on the web: the most thorough write-up (4 Sep 2025) computes refraction with Snell's law (air 1.0 / glass 1.5) over a bezel height profile (convex circle, convex squircle, concave, lip), bakes the result into a displacement map (red = X shift, green = Y shift, neutral 128), and applies it with SVG `feImage` + `feDisplacementMap` plus a rim-light specular blended on top. Using an SVG filter as `backdrop-filter` only works in Chrome/Chromium; Safari and Firefox need a fallback (layered blur) or a WebGL implementation. — [kube.io](https://kube.io/blog/liquid-glass-css-svg)
- WebGL alternatives for cross-browser glass refraction exist (full-screen shader ray refraction; libraries applying refraction, blur, chromatic aberration and lighting to HTML elements). — [LogRocket](https://blog.logrocket.com/how-create-liquid-glass-effects-css-and-svg/), [liquid-glass by ybouane](https://liquid-glass.ybouane.com/)

**Awwwards annual awards (the page is linked from the annual-awards hub as "winners of 2025"; the winners page itself does not print the year)**
- Site of the Year: Lando Norris (also Users' Choice); Developer Site of the Year: Messenger; E-commerce of the Year: Scout Motors; Agency of the Year: Immersive Garden; Studio of the Year: Malvah; Independent of the Year: Louis Paquet. — [Awwwards annual awards winners](https://www.awwwards.com/annual-awards/winners)
- Previous year (2024): Igloo Inc won both Site of the Year and Developer Site of the Year, with abeto credited. — [Awwwards 2024 SOTY](https://www.awwwards.com/annual-awards-2024/site-of-the-year), [Igloo Inc case study](https://awwwards.com/igloo-inc-case-study.html)

**Concrete, linkable examples (14)**
1. **Lando Norris** — https://landonorris.com/ — by OFF+BRAND.; Awwwards Site of the Day 17 Nov 2025 and listed as Site of the Year; tagged WebGL, GSAP, Webflow, 3D, Gestures/Interaction. Viewer sees a bold driver-brand site where reactive blob-like overlays animate across the hero image as the cursor moves; the WebGL developer describes building a refractive effect over moving 3D objects. Works because one tactile cursor effect carries the whole personality on top of an otherwise conventional CMS site. — [Awwwards](https://www.awwwards.com/sites/lando-norris), [DesignRush](https://www.designrush.com/best-designs/websites/lando-norris-website-design), [Codrops developer profile](https://tympanus.net/codrops/2025/12/05/from-illusions-to-optimization-the-creative-webgl-worlds-of-adrian-gubrica/). Note: one Awwwards studio listing showed a conflicting 2024 date for a developer mention.
2. **Messenger** — https://messenger.abeto.co — by abeto; released 25 Sep 2025; Awwwards SOTD 10 Nov 2025 + Developer Award, listed as Developer Site of the Year; three.js, WebGL, WebSockets. Viewer walks a kid around a tiny colourful planet delivering mail; a full lap takes about 30 seconds; other visitors are present via WebSockets. Works because the world is small enough to know by heart. — [Awwwards](https://www.awwwards.com/sites/messenger), [80.lv](https://80.lv/articles/deliver-mail-on-tiny-colorful-planet-in-this-relaxing-web-game), [Aftermath](https://aftermath.site/messenger-browser-game-abeto)
3. **Igloo Inc** — by abeto (with Bureaux per the case study); 2024 Awwwards Site of the Year + Developer Site of the Year; still the canonical reference for scroll-driven 3D with procedural ice/crystal shaders; it also appears in the 2026 Webby winners gallery (Best Visual Design – Aesthetic; winner-vs-nominee status not confirmed here). — [Awwwards case study](https://awwwards.com/igloo-inc-case-study.html), [Webby listing](https://winners.webbyawards.com/2026/websites-and-mobile-sites/features-design/best-visual-design-aesthetic/361001/igloo-inc)
4. **Bruno Simon's 2025 portfolio** (rebuild of the 2019 drive-a-car portfolio; source open-sourced as "folio-2025", MIT) — a physics-based driving game where the whole interface is 3D. Three.js with WebGPU + TSL ("automatically runs on WebGPU when available"); world modelled in Blender and driven by naming conventions; shared live weather with day/night and seasons; ~78,400 single-triangle grass blades in one merged geometry; spatialised object sounds; gamepad support; achievements unlocking car skins; visitor "Whispers" (max 30 live, moderated); global counters; daily-reset lap leaderboard. — [Awwwards case study, 11 Mar 2026](https://www.awwwards.com/brunos-portfolio-case-study.html), [Codrops, 6 Oct 2025](https://tympanus.net/codrops/2025/10/06/self-doubt-and-the-quest-for-fun-how-i-ended-up-turning-my-portfolio-into-a-game/)
5. **Oryzo** — oryzo.ai — by Lusion; Awwwards Site of the Month April 2026 + Developer Award. A single hero object (a cork coaster presented like a flagship device) rendered with inertia; scroll moves the camera through Z-depth. — [Utsubo](https://www.utsubo.com/blog/best-threejs-websites-2026)
6. **IVRESS** — brand.ivress.co.jp — by Utsubo; FWA Site of the Month May 2026; WebGPURenderer with WebGL fallback, shaders written once in TSL; a narration-free cinematic brand film in the browser. — [Utsubo](https://www.utsubo.com/blog/best-threejs-websites-2026)
7. **Lacoste Ace Breaker** — members-play.lacoste.com/ace-breaker-rg/gb/en/ — Awwwards nominee; a tightly scoped tennis brick-breaker with leaderboard and real prizes. — [Utsubo](https://www.utsubo.com/blog/best-threejs-websites-2026)
8. **Shopify Editions Spring 2026** — shopify.com/editions/spring2026 — a product changelog staged as scroll-sequenced "moments", with particle-dispersing type that scatters and reforms. — [Utsubo](https://www.utsubo.com/blog/best-threejs-websites-2026)
9. **Hubtown** — hubtown.co.in — by Unseen Studio; Awwwards SOTD June 2026; a glowing monolith over a reflective landscape where the cursor "reveals" hidden detail in geometry and lighting (WebGL + GSAP). — [Utsubo](https://www.utsubo.com/blog/best-threejs-websites-2026)
10. **Sleep Well Creative** — sleep-well-creatives.com — Awwwards SOTD Jan 2026; scroll-driven illustrated 3D scene (hand-drawn art direction on a three.js stage) presenting sleep science. — [Utsubo](https://www.utsubo.com/blog/best-threejs-websites-2026)
11. **Explore Primland** — explore.ownprimland.com — Awwwards SOTD Feb 2026; scroll-driven aerial flythrough over real terrain with atmospheric fog. — [Utsubo](https://www.utsubo.com/blog/best-threejs-websites-2026)
12. **Cartier Watches & Wonders 2026** — cartier.com/en-fr/watchesandwonders — by Immersive Garden (Awwwards Agency of the Year); six self-contained 3D "alcoves" like museum rooms, one per watch, with hidden gestures and a Web Audio score (three.js, GLSL, GSAP, Lenis). — [Utsubo](https://www.utsubo.com/blog/best-threejs-websites-2026), [Awwwards winners](https://www.awwwards.com/annual-awards/winners)
13. **Spotify Wrapped 2025** (in-app story, not a website, but the reference for data-driven motion): all data-story animations were built in Rive, prototyped with dummy data and then driven by live per-user data. — [Rive blog](https://rive.app/blog/spotify-used-rive-for-spotify-wrapped-2025). An Awwwards listing also appears to show a "Spotify Wrapped Party" Site of the Day (21 Jun 2026) credited to Active Theory; the attribution was ambiguous in the listing text and the exact listing page was not pinned down, so treat as unconfirmed. — [Awwwards listing page returned by search](https://www.awwwards.com/websites/%23B3CC19/?page=1)
14. **FOLLOW.ART** (Vide Infra) — 2026 Webby winner, Best Visual Design – Function (websites); Affinity Studio website (Canva) took People's Voice. — [Webby winners](https://winners.webbyawards.com/winners/websites-and-mobile-sites/features-design/best-visual-design-function)

**Studios / reference profiles**
- Lusion: studio site described as having won Site of the Year from FWA, Awwwards and CSSDA; Lusion v3 was Awwwards Site of the Year 2023. — [Codrops profile, Apr 2026](https://tympanus.net/codrops/2026/04/13/lusion-where-digital-craft-meets-ambitious-experimentation/), [Awwwards hall of fame](https://annuals.awwwards.com/hall-of-fame)
- Active Theory: earlier Awwwards Sites of the Year (Active Theory v4, 2018; Prometheus Fuels, 2021). — [Awwwards hall of fame](https://annuals.awwwards.com/hall-of-fame)
- OFF+BRAND.: Codrops studio story, Aug 2026. — [Codrops](https://tympanus.net/codrops/2026/08/17/creativity-at-enterprise-scale-without-compromise-the-offbrand-story/)

**Trend statements from the Utsubo roundup (secondary, self-interested)**
- "Scroll is the storytelling engine"; particles appear in type and reveals; "focus beats stacked effects"; performance is treated as a feature (instancing, baked lighting, BVH collision, byte budgets). — [Utsubo](https://www.utsubo.com/blog/best-threejs-websites-2026)

### Inferences
- The award-winning vocabulary that maps most directly to a home interface is (a) the "tiny knowable world" (Messenger, Bruno Simon), (b) one-object focus with inertia (Oryzo), (c) rooms-as-alcoves navigation (Cartier), and (d) cursor/touch "reveal" (Hubtown). Scroll-driven cinematic storytelling is built for a first visit and is a poor fit for a screen visited ten times a day. [ONE-TIME WOW for scroll films; DAILY VALUE for tiny worlds]
- Build stack implied by the winners: three.js (WebGPURenderer + TSL with WebGL2 fallback), GSAP for timelines, Lenis for smooth scroll, Rive for data-driven 2D character/number animation, Blender for authoring. For a family app the lower-risk split is: Rive/SVG/CSS for everyday surfaces, one WebGL scene for the "world" view.
- Wall tablets and TV browsers are the weak link for WebGPU (Android support is limited to Chromium on Android 12+ with specific GPUs per web.dev), so any shader work should be authored in TSL or plain WebGL2 and tested on the actual wall hardware first. [TOO HEAVY for low-power always-on if fluid sims, post-processing or refraction run continuously]
- Liquid-glass refraction via SVG `backdrop-filter` is Chromium-only, so on iPhone/iPad (the family's main devices) it degrades to plain blur unless implemented in WebGL; treat it as garnish on one or two controls, not a design foundation.

### Gaps
- FWA Site of the Year 2025 and CSS Design Awards 2025/2026 winners were not found in search; only individual FWA Site-of-the-Month mentions via Utsubo.
- No Codrops "best of year" roundup specific to immersive/WebGPU sites was found (Codrops pages returned HTTP 403 to direct fetch, so Codrops facts come from search snippets and the Awwwards mirror of Bruno Simon's case study).
- Awwwards 2026 annual awards had not been published at research time. The 2025 winners list does not name agencies beside each site; agency credits above come from the individual site pages.
- Webby 2026 "Best Use of Animation or Motion Graphics" (websites) winner not retrieved.
- Resn, Immersive Garden's own case studies, and kinetic-typography-specific examples were not individually researched.

---

## 2. Miniature worlds and dioramas: how they are built and lit, and how they show live state

### Takeaway
The "tiny room / tiny planet" pattern is the best-evidenced bridge between award-site craft and smart-home data: there is already a 2026 working example of a real house rendered low-poly in three.js with live Home Assistant state, sun position and energy flows, tuned to run on a wall-mounted iPad. The craft recipe is Blender-authored low-poly geometry, baked or cheap lighting, instancing, and state expressed through emissive glow, object animation and weather rather than labels.

### Cited Findings

**A real house as a live diorama (most directly relevant example found)**
- "My house as a live 3D dashboard" (Home Assistant community, posted 29 Sep 2026): a standalone three.js page (not a dashboard card) showing a deliberately low-poly model of the author's real house, interiors, garden, terrain and street. Viewer can fly into rooms, switch floors or hide the roof, and select a room to focus the camera. — [HA community](https://community.home-assistant.io/t/my-house-as-a-live-3d-dashboard-blender-model-three-js-driven-by-home-assistant/1026746)
- Live state mapping in that project: tap a lamp to toggle, long-press for dimmer/colour and the lamp glows to match; at night windows glow when lights are on; blinds move to real positions; contact sensors show open/tilted windows; bins physically roll out to the pavement and blink on pickup day, with an "x-ray" silhouette showing due bins through walls; a wall clock with moving hands; charging cable and socket flap appear only when the car is plugged in, charge level as a ring; an energy mode with PV/battery/grid/consumption and flow arrows in the direction of actual power, plus a light streak across the PV modules proportional to output; sun position computed from real location and orientation with a time slider to preview any hour. — [HA community](https://community.home-assistant.io/t/my-house-as-a-live-3d-dashboard-blender-model-three-js-driven-by-home-assistant/1026746)
- How it was built: a ~5,000-line Blender Python script rebuilds the scene from plans and measurements, exports Draco-compressed glTF (7.8 MB) with custom properties (kind, room, entity, hinge axis) as glTF extras; three.js 0.170 from a CDN via import map with no build step; Home Assistant WebSocket API for state, service calls, history and weather. — [HA community](https://community.home-assistant.io/t/my-house-as-a-live-3d-dashboard-blender-model-three-js-driven-by-home-assistant/1026746)
- Wall-display performance measures (target: 2020 iPad Pro 12.9" in Safari): textures capped at 512 px on touch devices (texture memory ~89 MB to ~49 MB); a fixed pool of point lights (14 desktop / 6 touch) reassigned to the nearest lamps so shaders never recompile; ~1.5 megapixel render budget, no MSAA, on-demand rendering; explicit WebGL context release on `pagehide`; an iPad GPU crash traced to an out-of-range array index in a shader. — [HA community](https://community.home-assistant.io/t/my-house-as-a-live-3d-dashboard-blender-model-three-js-driven-by-home-assistant/1026746)

**Existing open-source 3D-home components**
- floor3d-card: three.js card binding 3D model objects to entity states; a 2026 fork moves to three.js 0.186 and Lit 3 with sunlight and shadows. — [floor3d-card](https://github.com/ricetea/floor3d-card), [floor3d-card mod thread](https://community.home-assistant.io/t/floor3d-card-mod-updated-fork-of-the-3d-floor-plan-card-three-js-0-186-lit-3-sunlight-new-editor/1026920)
- 3DHome (Sweet Home 3D workflow): deliberately does not create a real light per fixture; light state is shown through emissive materials and rendering pauses unless state, camera or config changes. — [3DHome](https://github.com/lukevink/3DHome)
- A ready-made `.glb`-based 3D floorplan card with physically-based lighting rendered in the browser. — [HA community](https://community.home-assistant.io/t/ready-made-3d-floorplan-for-home-assistant-physics-based-lighting-fully-offline-no-extra-tools/1012715)

**Award-level tiny worlds: technique detail**
- Bruno Simon's 2025 portfolio: Blender-authored world; objects wired by naming convention (e.g. a reference named as a fixed physical "landing" body); weather system with day/night cycle and seasons, identical for every visitor at the same moment; wind sways grass and foliage; rain splashes on water and becomes snow when cold, water freezes, leaves fall in autumn, overcast skies produce lightning. Foliage is camera-facing planes with an SDF texture; water is painted in Blender and the same texture drives shoreline ripples. — [Awwwards case study](https://www.awwwards.com/brunos-portfolio-case-study.html)
- Performance recipe from the same case study: instancing for repeated objects; grass/water/terrain/rain looped around the camera; frustum culling; hidden faces removed and geometries merged; a single palette texture for colours via UV mapping; ETC1S/UASTC texture compression; DRACO geometry compression; on mobile, water blur and depth of field are disabled and shadow-map resolution reduced. — [Awwwards case study](https://www.awwwards.com/brunos-portfolio-case-study.html)
- Messenger (abeto): a whole planet lapped in ~30 seconds, three.js + WebSockets. — [Awwwards](https://www.awwwards.com/sites/messenger), [80.lv](https://80.lv/articles/deliver-mail-on-tiny-colorful-planet-in-this-relaxing-web-game)

**Lighting workflow references**
- Three.js Journey's "Portal Scene" chapter teaches the canonical workflow: build in Blender, UV-unwrap, bake the rendered lighting into a texture, and apply that texture in three.js; a three.js forum thread calls it the most complete baking tutorial on the web. — [Three.js Journey](https://threejs-journey.com/lessons/baking-and-exporting-the-scene), [three.js forum](https://discourse.threejs.org/t/how-to-bake-light-with-textures/52076)
- Baking several lighting states (e.g. day and night) and switching between them at runtime is a documented approach. — [Needle Engine lightmapping docs](https://engine.needle.tools/docs/blender/lightmapping)
- Blender's bundled Sun Position add-on places the sun from geographic location, date and time. — [Blender manual](https://docs.blender.org/manual/en/3.6/addons/lighting/sun_position.html)

**Weather apps that render a tiny live scene**
- (Not Boring) Weather by Andy Works: built with game-industry tools (3D modelling, lighting); temperature is a large 3D number, each metric has its own interactive 3D model, and a 3D wind vane turns as you scrub the timeline; Apple Design Award finalist 2021; member-supported with no ads or tracking. Still the canonical reference although the app dates from 2020-21. — [App Store story](https://apps.apple.com/us/story/id1556321408), [App Store listing](https://apps.apple.com/us/app/id1531063436?l=en-us)
- SPECTRA / Weather: a minimal weather app rendering current conditions as real-time generative art; its clear-sky beam follows the actual solar position. — [Product Hunt](https://www.producthunt.com/products/spectra-weather)

**Cozy builder reference**
- Townscaper has had a free in-browser demo since December 2021 (hosted at oskarstalberg.com/Townscaper; reported as a Unity port); click to add/remove blocks that auto-resolve into houses, arches and stairs, with a movable light. Older but canonical for "cozy" procedural dioramas. — [PC Gamer](https://www.pcgamer.com/the-most-pleasant-game-of-2021-is-now-playable-in-your-browser), [Gigazine](https://gigazine.net/gsc_news/en/20211202-townscaper-demo-browser)

### Inferences
- Build recipe (practitioner knowledge, consistent with the sources above): model low-poly in Blender; either bake lighting into one or two atlases (day/night) and cross-fade the two textures in a shader by a `sunElevation` uniform, or use one directional light positioned from a sun-position calculation (e.g. the SunCalc library) with a cheap shadow map; mark every stateful object with glTF extras that carry the entity id; express state through emissive intensity, simple transforms (blind height, door hinge, bin position) and a small pool of real lights. Orthographic or long-lens camera plus slight depth-of-field gives the tilt-shift "miniature" look; DOF should be off on mobile and wall devices (as Bruno Simon does).
- The 3DHome approach (emissive materials, render only on change) is the right default for an always-on wall display; a continuously animating scene is not. A good compromise is on-demand rendering plus a slow low-frequency "breathing" tick (e.g. one frame every few seconds for clouds/sun). [ALWAYS-ON OK only with on-demand rendering]
- Lasting value comes from the diorama being a truthful mirror (the bins really are out, the car really is plugged in). Weather, season and time of day matching the window outside is the cheapest source of everyday delight because it changes without anyone touching it. [DAILY VALUE]
- Children can read a diorama before they can read a chart; the bins-rolling-out and "x-ray" silhouettes are the kind of object-level state they will check unprompted.
- [CVD] Diorama state should not be red/green lamps: use glow on/off (luminance), position (open/closed), and motion; for alerts use shape plus blue/orange.

### Gaps
- Monument Valley, Polytopia-style dioramas, and Google/Apple Maps 3D landmark styles were not researched or verified this session; no sources are offered for them.
- No source was found describing a web project that cross-fades baked day/night lightmaps tied to the real sun position; that technique is stated above as inference.
- The Three.js Journey community "room" showcase was not opened; only the baking lesson was confirmed.
- No published long-term (months of use) evaluation of 3D home dashboards was found; the HA community post is weeks old.

---

## 3. Living visualisations of flows and rhythms; which suit an ambient always-on display

### Takeaway
Three flow idioms are proven and buildable: GPU particle fields with fading trails (wind-map style), particles travelling along Sankey/path links (energy-flow cards), and the diorama flow arrow. For rhythms, horizon charts, ridgelines, calendar/spiral heatmaps and 24-hour rings are standard; research says radial clocks are liked and good for "what happened at 7 pm" but not better for spotting daily patterns, and home-energy studies found people want more precise information than a purely artistic display gives.

### Cited Findings

**Particle-flow (wind map) pattern**
- What the viewer sees: thousands of short-lived particles advected by a vector field, leaving fading trails that make direction and speed legible at a glance. Lineage: Viégas & Wattenberg's US Wind Map, Cameron Beccario's "earth" (and its open-source version), then Mapbox's WebGL version. — [mapbox/webgl-wind](https://github.com/mapbox/webgl-wind)
- CPU approach (canvas 2D): look up velocity per particle each frame; caps at a few thousand particles — "earth" uses about 5k. GPU approach: store particle positions in a state texture, update them in a shader that samples a wind texture, draw trails; "capable of rendering up to 1 million wind particles at 60fps". — [Mapbox blog: How I built a wind map with WebGL](https://blog.mapbox.com/how-i-built-a-wind-map-with-webgl-b63022b5537f) (via search summary; direct fetch returned 403), [mapbox/webgl-wind](https://github.com/mapbox/webgl-wind), demo: https://mapbox.github.io/webgl-wind/demo/
- A MapLibre port renders the particles in the map's WebGL context with age-based fading trails. — [maplibre-wind-gl](https://www.pkgstats.com/pkg:maplibre-wind-gl)

**Sankey / path particles (energy flow)**
- Elijah Meeks' "Sankey Particles" uses particles to indicate flow between reservoirs; link geometry comes from d3-sankey, positions from `svg:path.getTotalLength()`, and particles are drawn on canvas for performance. Forks vary particle speed and keep the source node's colour. — [Sankey Particles III gist](https://gist.github.com/emeeks/21f99959d48dd0d0c746)
- Off-the-shelf: ApexSankey added a `particleFlow` option in 1.11.0; Semiotic's SankeyDiagram animates particles along links proportional to value. — [ApexSankey docs](https://apexcharts.com/apexsankey/docs/particle-flow/), [Semiotic](https://semiotic.nteract.io/charts/sankey-diagram)
- Home Assistant precedents: Power Flow Card Plus shows instantaneous power (not accumulated energy) as dots moving along lines between sun, grid, battery and home, with `min_flow_rate`, `max_flow_rate` and `watt_threshold` controlling how dot speed responds to watts. Users report the animated dots cause continuous high CPU usage and that disabling them reduces CPU substantially. — [Power Flow Card Plus thread](https://community.home-assistant.io/t/power-flow-card-plus/552326?page=8)
- Related cards: a "Tesla style" solar power card; an energy Sankey card; an "Energy Flow & Price" card built specifically for a wall tablet; an inverter power-flow card. — [tesla-style-solar-power-card](https://www.github.com/reptilex/tesla-style-solar-power-card), [energy-sankey](https://github.com/davet2001/energy-sankey), [Energy Flow & Price card](https://community.home-assistant.io/t/energy-flow-price-card-live-power-flow-hourly-quarter-hour-price-built-for-a-wall-tablet/1017068), [sunsynk-power-flow-card](https://www.github.com/slipx06/sunsynk-power-flow-card)
- Electricity Maps: a live map with switchable layers (carbon intensity, price, carbon-free share, renewable share, total load) that displays electricity flows between zones. The data parsers are open source (AGPLv3); the current map front-end has been rewritten on the company's own platform. — [Electricity Maps map product](https://electricitymaps.com/platform/map), [electricitymaps-contrib](https://github.com/electricitymaps/electricitymaps-contrib)

**Rhythm charts**
- Horizon chart: more precision per unit of vertical space by folding a series into colour bands; ridgeline trades overlap for the same. Canonical D3/Observable implementations exist for both. — [Observable horizon chart](https://observablehq.com/@d3/horizon-chart), [Observable Plot ridgeline](https://observablehq.com/@observablehq/plot-ridgeline)
- Spiral heatmap suits periodic data where a continuous series without visual breaks (e.g. at the year boundary) is wanted. — [d3-spiral-heatmap](https://github.com/tomshanley/d3-spiral-heatmap), [Observable spiral heatmap](https://observablehq.com/@elnino/spiral-heatmap)
- 24-hour radial clocks: a 2019 study (Waldner et al.) found a clock-like radial layout does not help untrained users understand daily patterns, but radial glyphs were more effective for reading values at specified times and users liked the colour-coded 24-hour clock metaphor. — [arXiv 1907.13534](https://ar5iv.arxiv.org/html/1907.13534)
- Consumer and art examples of the 24-hour ring: Oura's Body Clock (a 24-hour face with colour-coded sections comparing optimal and actual sleep windows); Kirell Benzi's "Circadian Rhythms" artwork (24-hour clock with two diverging palettes for sleep and day activity). — [Oura help](https://support.ouraring.com/hc/en-us/articles/14594974129555), [Kirell Benzi](https://kirellbenzi.com/art/circadian-rhythms)

**Data portraits / data humanism / data art**
- Giorgia Lupi proposed "Data Humanism" in 2017 (a 13-principle visual manifesto); "Dear Data" (with Stefanie Posavec) exchanged hand-drawn postcards of personal data for a year. A 2025 IEEE VIS paper characterises the principles via literature review and expert interviews. — [arXiv 2509.00440](https://arxiv.org/abs/2509.00440v1), [Print magazine](https://www.printmag.com/article/data-humanism-future-of-data-visualization/), [giorgialupi.com](https://giorgialupi.com/philosophy)
- Nadieh Bremer's "Elemental Flows" is a data-art collection (Earth, Water, Air, Sun, Digital) explicitly "not meant to reveal trends or patterns" but to create awareness; "Data Sketches" (Bremer & Shirley Wu) documents twelve projects with process write-ups. — [IIB showcase: Elemental Flows](https://informationisbeautifulawards.com/showcase/5052-elemental-flows), [IIB showcase: Data Sketches](https://www.informationisbeautifulawards.com/showcase/2244)
- Refik Anadol Studio's weather-driven "data paintings": Wind of Boston (2017) used one year of airport wind data on a 6' x 13' canvas; later works are described as using real-time weather sensor data (wind speed, direction, gusts, temperature). — [Creative Applications](https://www.creativeapplications.net/project/wind-of-boston-data-paintings-by-refik-anadol-studios/), [Refik Anadol Studio](https://blog.refikanadol.com/works/wind-of-boston-data-paintings/)
- Information is Beautiful Awards (2024 cycle, announced mid-2025): "Most Beautiful" and Arts gold went to "Is the Love Song Dying?" (David Mora, Michelle Jia); People/Language/Identity gold to "This is a Teenager" (Alvin Chang, The Pudding); Leisure silver to "Vertical Momentum: High Jump & Pole Vault" (Krisztina Szucs); Unusual gold to "World in Tangible Fragments" (physical data objects). — [IIB Awards 2024 winners](https://www.informationisbeautifulawards.com/news/680-announcing-the-2024-winners)

**Evidence on ambient/artistic feedback in homes**
- Rodgers & Bartram (2011, mixed-methods study): ambient and artistic visualisation is viable for residential resource-use feedback, and both the aesthetics of the representation and the context of use matter. — [Peeref record](https://peeref.com/works/10368038)
- A recurring finding across home eco-visualisation projects is that users wanted more information than could easily or elegantly be shown in an "ambient" or artistic display. — reported in search synthesis of [Stony Brook "Ambienizer" paper](https://www3.cs.stonybrook.edu/~mueller/papers/Ambienizer.pdf) and related work (exact attribution of the quote to a single paper not confirmed)
- Makonin et al. studied an ambient display with four eco-visualisations and how lifestyle factors (age, gender, busyness) shape preference for colour and form. — [arXiv 1405.5263](https://arxiv.org/pdf/1405.5263.pdf)

### Inferences
- Suitability for always-on ambient display, ranked from the evidence above plus practitioner judgement:
  - Calendar heatmap, horizon chart, ridgeline of the last N days, 24-hour ring: static between data updates, legible from across a room, zero idle GPU cost. [ALWAYS-ON OK] [DAILY VALUE]
  - Path/Sankey particles for power and water: good at-a-glance ("which way is it flowing, how hard"), but must be throttled — the HA card's CPU complaints show naive per-dot DOM/SVG animation is costly. Build as one canvas or one shader with a capped particle count, or as a CSS `stroke-dashoffset` animation on a handful of paths; pause when the tab is hidden or the room is empty. [ALWAYS-ON OK only if throttled]
  - GPU particle field (wind-map style) as a whole-house "energy weather" background: beautiful, but a continuous full-screen shader. Suitable for iPad/desktop on demand; on a low-power wall display run at reduced resolution and 15-20 fps or pre-render. [TOO HEAVY at full rate]
  - Data portraits (one generated glyph per day, Dear-Data style): cheap SVG, excellent for a "year wall" of days; value grows over time because the archive grows. [ALWAYS-ON OK] [DAILY VALUE]
- Pairing rule suggested by the research: an artistic layer for the periphery plus an exact-number layer one tap away, because householders consistently ask for more precision than ambient art provides.
- Use the 24-hour ring for "when" questions (when did the geyser run, when was the gate opened) and a linear strip for "pattern" questions, following Waldner et al.
- [CVD] Flow direction should be carried by motion direction and position, not by a red/green import/export convention. Use blue vs orange (e.g. Okabe-Ito blue #0072B2 and orange #E69F00), plus particle shape/size or line dash pattern for a third category. Horizon charts should use a single-hue or blue-orange diverging scheme, never red-green.

### Gaps
- Tesla's own app energy-flow animation: no primary description found; only community clones.
- windy.com and earth.nullschool.net were not opened directly this session (the lineage is confirmed via the Mapbox sources).
- Moritz Stefaner and Shirley Wu installation-specific examples were not confirmed beyond exhibition listings.
- No source specifically addressing legibility of horizon/ridgeline charts at wall-display viewing distances was found.
- Fluid/metaball "tank" visualisations (e.g. water tank levels as liquid): no verified web example found; technique is feasible (SDF metaballs in a fragment shader or a simple sine-wave SVG fill) but unsourced here.

---

## 4. Time as an interface: scrubbing, replay and recap

### Takeaway
The best time-travel UIs share a small set of mechanics: one always-visible timeline with a fixed "playhead" that content slides under, density marks showing where anything happened, event markers you can jump between, zoomable time scale, variable speed (up to 300x in flight playback), synchronised multi-view scrubbing, and direct, interruptible gestures. Security NVRs (Frigate, UniFi Protect) are the closest domain analogues for a home; Spotify Wrapped is the reference for the annual recap format.

### Cited Findings

**Security / NVR timelines**
- Frigate (0.14+ redesign): review items are a grid of thumbnail cards beside a vertical activity timeline; hover (desktop) or swipe (mobile) plays an inline preview; items are prioritised as alerts vs detections with a separate Motion category. A "review item" is a time period in which any number of tracked objects were active. — [Frigate docs: Review](https://docs.frigate.video/usage/review), [Frigate UI rebuild discussion](https://github.com/blakeblackshear/frigate/discussions/11136)
- Frigate Motion view: scrub all cameras simultaneously on a shared draggable timeline that shows relative motion activity, with a playback-speed selector; a heatmap overlay dims areas of the frame with no motion. — [Frigate 0.14 beta 3 notes](https://github.com/blakeblackshear/frigate/releases/tag/v0.14.0-beta3)
- Frigate History view: a scrubbable vertical timeline annotated with a motion line (horizontal lines down the centre, longer = more motion), review-item markers, and visible gaps where no recording exists; later timeline zoom keeps the handlebar centred while zooming. — [Frigate docs: History](https://docs.frigate.video/usage/history)
- A user complaint worth noting: in Frigate you can scroll the timeline independently of the "set" time on the handlebar, compared unfavourably with Nest's timeline; maintainers said this was intentional. — [Frigate issue #11398](https://www.github.com/blakeblackshear/frigate/issues/11398)
- UniFi Protect 6.0 (12 Jun 2025): timeline shows quick camera-specific object summaries with instant playback from any detected event, object-counting charts, spatial zone filters, multi-camera scrubbing in parallel, and a redesigned unified "Find Anything" search. Protect 7.2 added frame-by-frame scrubbing from the timeline on mobile. — [Ubiquiti: Protect 6.0](https://blog.ui.com/article/introducing-protect-6-0), [Ubiquiti: Protect 7.2](https://blog.ui.com/article/welcome-to-protect-7-2)

**Map / movement replay**
- Flightradar24 playback: timeline at the bottom of the screen, scrolled to move through time, zoom control to change the visible span, speed from 1x to 300x; single-flight playback adds altitude, ground-speed and vertical-speed graphs. — [FR24 support](https://support.fr24.com/support/solutions/articles/3000120423-how-to-view-playback-on-the-flightradar24-website-), [FR24 blog](https://www.flightradar24.com/blog/inside-flightradar24/updated-individual-playback-in-the-flightradar24-app/)
- Strava Flyby: replay your activity alongside anyone who crossed your path; play/pause, step through time, change speed, seek. After safety concerns, sharing became default-off. — [DC Rainmaker](https://dcrainmaker.com/2020/10/strava-flyby-feature.html), [Cycling Weekly](https://cyclingweekly.com/news/latest-news/strava-removes-automatic-flybys-after-safety-concerns-472797)
- Strava Flyover (Nov 2023): an aerial 3D video recap of a GPS activity. — [TechCrunch](https://techcrunch.com/2023/11/15/strava-launches-flyover-an-aerial-3d-video-recap-of-every-outdoor-activity-you-do/)

**Mission-control time model**
- NASA Open MCT's "Time Conductor" is a single global control with fixed-timespan and real-time modes that governs every view on screen. — [Open MCT User's Guide](https://nasa.github.io/openmct/docs/static/files/Open_MCT_Users_Guide.pdf)

**Spatial / metaphorical time**
- Apple Time Machine (Mac OS X Leopard, 2007): windows representing points in time recede into the distance; a timeline on the screen edge lets you pick a day by clicking or sliding; a later patent describes condensed tick marks each representing multiple snapshots. Externally almost unchanged for years. — [Eclectic Light history](https://eclecticlight.co/2024/09/07/a-brief-history-of-time-machine/), [eWeek 2006](https://www.eweek.com/pc-hardware/apples-mac-os-x-leopard-a-3-d-impossible-dream), [patent](https://uspto.report/patent/grant/7856424)
- Gource: version-control history animated as an expanding tree, files as coloured nodes on directory branches, contributors as avatars moving to what they touched. — [Gource man page](https://manpages.org/gource)

**Scrubbing tied to objects, not charts**
- (Not Boring) Weather: scrubbing the forecast timeline turns a 3D wind vane. — [App Store story](https://apps.apple.com/us/story/id1556321408)
- The live 3D house dashboard has a time slider that previews sun position for any hour. — [HA community](https://community.home-assistant.io/t/my-house-as-a-live-3d-dashboard-blender-model-three-js-driven-by-home-assistant/1026746)
- Family wallet: scrubbing a price chart flips an arrow's direction with the changing numbers. — [Benji Taylor: Family Values](https://benji.org/family-values)

**Annual recap format**
- Spotify Wrapped 2025: story slides in 9:16 vertical format sized for sharing; motion built in Rive from templates, prototyped with dummy data and then driven by each user's data; 2025 added more flexible swipe navigation. One industry source reports 500 million shares in the first day (single-source figure). — [Rive](https://rive.app/blog/spotify-used-rive-for-spotify-wrapped-2025), [NoGood analysis](https://nogood.io/blog/spotify-wrapped-marketing-strategy/), [Spotify newsroom](https://newsroom.spotify.com/tag/wrapped)

**Interaction principles that make scrubbing feel physical**
- Great interactions are interruptible; gestures should retain the throw's angle and velocity; lightweight actions can trigger mid-gesture while destructive ones wait for release; a gesture should respond immediately rather than animating after a threshold is crossed. — [Rauno Freiberg: Invisible Details of Interaction Design](https://rauno.me/craft/interaction-design)
- "Scroll landmarks": double-tapping a scrollbar to drop a marker you can jump back to. — [Rauno Freiberg](https://rauno.me/craft/interaction-design)

### Inferences
- What makes time travel through data feel physical (synthesis; no single source states this list): (1) a fixed playhead with the timeline moving under it and momentum on release; (2) density marks so "empty" time is visibly empty and can be skipped — Frigate's motion line and recording gaps; (3) magnetic snapping to event markers with a detent (haptic tick on phone); (4) zoomable scale from minutes to months with the playhead staying centred; (5) speed ramps — auto-accelerate through quiet periods and slow near events; (6) ghost trails — the previous N minutes of a moving thing (a person dot, a car, a power level) left as a fading path; (7) every view on screen obeys the same clock (Open MCT's Time Conductor); (8) direct object coupling — scrubbing visibly moves the sun, the blinds, the battery level, the car in the driveway.
- For a home, the natural product is a "day replay": scrub or play 24 hours in ~30 seconds in the diorama — sun arcs, lights go on and off room by room, the geyser heats, cars leave and return, the gate opens, traffic passes. This reuses the same scene as the live view with a different clock. [DAILY VALUE as a bedtime "what happened today"; strong for kids]
- A Wrapped-style annual or monthly story (8-12 vertical cards: sunniest day, longest grid-free streak, earliest riser, most chores, busiest traffic day) is the right place for exuberant motion precisely because it is infrequent. Build with Rive or CSS/SVG story cards; data via a precomputed JSON summary. [ONE-TIME WOW by design, repeated monthly/annually]
- Build notes (practitioner knowledge): timeline as a single canvas with pre-binned event density from the history database; pointer events with velocity tracking and a spring/decay animation; `requestAnimationFrame` loop only while moving; historical state fetched in coarse buckets and interpolated client-side.
- Privacy lesson from Strava Flyby: replay of people's movements becomes sensitive quickly; presence replay should be household-only and opt-in per person.
- [CVD] Event categories on a timeline should differ by shape/glyph and lane position, not hue alone.

### Gaps
- Figma / Google Docs version scrubbing, sports "match replay" visualisations, and Git visualisers other than Gource were not verified this session.
- No research paper was found that tests which scrubbing mechanics (inertia, ghost trails, speed ramps) improve comprehension; the list above is design inference.
- No design-rationale write-up from Ubiquiti or Frigate's maintainers explaining why their timelines are vertical vs horizontal was found.
- Flightradar24: it was not confirmed whether playback draws historical trails behind aircraft.

---

## 5. Generative and ambient art driven by real data (including smart-home / energy examples), sonification, burn-in-safe motion

### Takeaway
There is a real, if small, body of work using household energy and weather data as "living paintings" — from Samsung's commissioned ambient TV artworks to academic and student projects with e-ink frames — and a parallel body of ambient sonification work. The consistent lessons are: map only a few variables, keep motion slow, respect the home's existing visual and sound environment, and keep precise information reachable.

### Cited Findings

**Commercial / studio**
- Samsung Ambient (onformative for Samsung TVs): real-time digital artworks with soft nature motifs (sand, glass, abstracted leaves and petals) that respond to time of day, location and weather — specifically temperature, the sun's position and wind speed — so the TV acts as an ambient information display; one piece is "fluent, colorful silhouettes slowly moving behind a refracting glass wall". Year not stated on the page; mapping rules not published. — [onformative](https://onformative.com/work/samsung-ambient)
- SPECTRA / Weather: current atmospheric conditions as real-time generative art; beam follows actual solar position. — [Product Hunt](https://www.producthunt.com/products/spectra-weather)
- Windy live wallpaper (open source, Android): wind streamlines over a plain background, wind fields generated from NOAA GFS data. Not a web project but an open shader reference. — [pgaskin.net/windy](https://pgaskin.net/windy/)
- Weatherbrush (Aaron Alden): a weather report rendered as generative art for walls and screens. — [Derivative community post](https://derivative.ca/community-post/painting-weather-aaron-alden%E2%80%99s-creative-take-climate-data/70776)
- GaiaSenses (ICCC 2025): a web platform turning real-time climate data into non-figurative audiovisual art. — [ICCC 2025 paper](https://computationalcreativity.net/iccc25/papers/iccc25-mammoli2025integrating.pdf)
- Refik Anadol Studio data paintings driven by wind/weather data (see section 3). — [Creative Applications](https://www.creativeapplications.net/project/wind-of-boston-data-paintings-by-refik-anadol-studios/)

**Household / energy data as art**
- Energy Framer (NCAD student project, 2025): an e-ink frame that turns smart-meter data into changing artwork which varies with time of day and household behaviour; presents energy as cost rather than kWh; tested with nine people aged 16-55 in homes and studio (prototype used an iPad as stand-in for e-ink). — [Energy Framer](https://a2240772429cc.myportfolio.com/energy-framer)
- smART: a home art piece that receives real-time water and heating sensor data and changes its appearance with consumption. — [Core77 Design Awards](https://designawards.core77.com/Built-Environment/45461/)
- Monolith (Process studio, Vienna): generative art in a tower lobby driven by the building's energy consumption and production data. — [LS:N Global](https://www.lsnglobal.com/article/view/19017)
- Ambient Canvas (Bartram et al., 2011): a kitchen-backsplash ambient display rendering energy consumption as layers of light. — referenced in [SFU thesis "Energy Mirror"](https://summit.sfu.ca/_flysystem/fedora/2022-08/etd21991.pdf)
- Energy Mirror (SFU thesis): physical/ambient visualisations of residential energy; findings point to privacy and household conflict issues when consumption data becomes more visible. — [SFU Summit](https://summit.sfu.ca/_flysystem/fedora/2022-08/etd21991.pdf)
- Eco Garden: a data sculpture to encourage sustainable household practices (ambient information system). — [Cardiff ORCA](https://orca.cardiff.ac.uk/id/eprint/172384/1/Eco-Garden-%20A%20Data%20Sculpture%20to%20Encourage%20Sustainable%20Practices%20in%20Everyday%20Life%20in%20Households.pdf)
- A 2026 journal framework ("Data art to enhance users' pro-environmental behavior") turns building data streams including energy use into multisensory outputs (sound, haptics, interactive forms). Scope only partly visible in the listing. — [ETS Montreal publication record](https://pure.etsmtl.ca/en/publications/data-art-to-enhance-users-pro-environmental-behavior/)
- Rodgers & Bartram: ambient/artistic feedback is viable in homes; aesthetics and context of use both matter. — [Peeref record](https://peeref.com/works/10368038)

**Sonification and ambient sound**
- Listen to Wikipedia (Hatnote; 2013, still live at listen.hatnote.com; IIB Awards silver 2013): bells for additions, string plucks for subtractions, pitch by edit size (larger = deeper), coloured circles for bots/anonymous editors. Reviewers describe it as calming rather than overwhelming. Canonical older reference. — [GitHub](https://www.github.com/hatnote/listen-to-wikipedia), [FlowingData](https://flowingdata.com/2013/08/12/listening-to-wikipeda/)
- Powerchord (Lockton et al., 2014 onward): monitors multiple household appliances and turns instantaneous power draw into sound designed to fit everyday domestic soundscapes; co-created with householders, with swappable sound schemes. — [TU/e research portal](https://research.tue.nl/en/publications/powerchord-exploring-ambient-audio-feedback-on-energy-use/)
- Kitchen auditory augmentation (Groß-Vogt et al., ICAD 2018): room reverberation changes with current electric power consumption relative to a weekly baseline. — [Bielefeld record](https://pub.uni-bielefeld.de/record/2919778)
- Infodrops (ICAD 2013): shower water/energy use sonified as water-drop sounds. — [paper](https://typeset.io/pdf/infodrops-sonification-for-enhanced-awareness-of-resource-23w2yf0hft.pdf)
- Energy-Aware Sonic Carpet (ICAD 2022): smart-meter-type feedback via sonic augmentation of a household object. — [ICAD 2022](https://icad2022.icad.org/wp-content/uploads/2022/06/ICAD2022_20.pdf)
- Bruno Simon's portfolio as a web-audio craft reference: environmental layers (birds, crickets, waves, wind, thunder), spatialised object sounds, and a single UI click sound with varied playback rate; three commissioned music tracks released CC0. — [Awwwards case study](https://www.awwwards.com/brunos-portfolio-case-study.html)

**Always-on screen safety**
- Burn-in risk on OLED is driven by how long static elements stay on screen (fixed bars, logos, tickers, clocks), not by content type; panels mitigate with pixel shift and logo dimming; advice includes dark backgrounds (bright pixels degrade faster), rotating content and scheduled screen-off. Sources are consumer guidance, not panel-maker specifications. — [Tom's Guide](https://www.tomsguide.com/tvs/oled-tvs-burn-in-from-these-common-mistakes-prevent-it-with-3-settings), [Trusted Reviews](https://www.trustedreviews.com/how-to/manage-burn-in-and-image-retention-on-your-oled-tv-4170706)
- Calm technology (Weiser & Brown, 1990s; Amber Case's principles): technology should require the least attention, inform while creating calm, make use of the periphery, and move easily from periphery to centre and back; create ambient awareness through different senses. — [Calm Tech Institute](https://calmtech.institute/calm-tech-principles), [Wikipedia](https://en.wikipedia.org/wiki/Calm_technology)

### Inferences
- A "house painting" for the wall/TV can follow the Samsung Ambient recipe with home data: 3-5 slow uniforms into one fragment shader — sun elevation -> palette and light direction; wind speed -> flow speed; net power (export vs import) -> drift direction or warm/cool bias; battery state -> fill level or brightness floor; occupancy -> density of forms. Changes should take minutes, not seconds, so a glance shows state and a stare shows nothing jarring. [ALWAYS-ON OK if the shader is cheap: one full-screen quad, noise-based, capped at ~15-20 fps and reduced resolution; TOO HEAVY if it is a real fluid simulation]
- Burn-in-safe motion design (inference from the guidance above): no fixed high-contrast elements (clock, logo, legend) — let them drift on a slow Lissajous path of a few pixels per minute or fade in only on approach; dark base palette; rotate between 2-3 compositions per hour; night mode goes near-black; schedule off when the house is asleep or empty. An e-ink secondary frame (as in Energy Framer) sidesteps burn-in and power entirely for slow data such as "yesterday's energy portrait".
- Sonification for a family home should follow Powerchord and Listen to Wikipedia: sparse, pitched, pleasant events layered on silence, strictly opt-in and time-boxed (not at night), with mapping simple enough for a child to learn (e.g. gate = wooden knock, export to grid = soft bell, rain starting = brushed cymbal). Build with Web Audio: a few sampled notes, pitch via playbackRate, per-event gain, and a master limiter. Autoplay policies mean audio needs one user gesture per session; on a kiosk display that needs a start tap or a kiosk-mode flag. [DAILY VALUE only if very quiet; otherwise it will be muted within a week]
- The household-conflict finding (Energy Mirror) argues against per-person consumption attribution on a shared display; show the household as one organism.
- [CVD] Generative palettes should be built on luminance and blue-orange/yellow axes; avoid encoding "good/bad" as green/red hue shifts, which the primary user will not see.

### Gaps
- No verified example of a browser-based generative wallpaper driven specifically by a Home Assistant / smart-home feed was found, apart from the 3D dashboard in section 2; the home-data art examples found are hardware installations, student projects or academic prototypes.
- Sonified seismic or grid-frequency data examples were not found in the single search run.
- No panel-manufacturer documentation on burn-in thresholds was retrieved; e-ink and LCD wall panels have different constraints that were not researched.
- Samsung Ambient's data-to-visual mapping rules are unpublished.

---

## 6. Game-inspired and diegetic UI; what translates to a real house without kitsch

### Takeaway
Game UI theory gives a usable vocabulary (diegetic / spatial / meta / non-diegetic), and city-builder "info views" are the most transferable idea: one world, many switchable data lenses. Evidence also shows the limit — critical status is read faster from a conventional HUD than from in-world displays — and film-FUI practitioners themselves stress credibility and legibility over ornament.

### Cited Findings

**Vocabulary**
- Fagerholt & Lorentzon's 2009 thesis "Beyond the HUD" classifies game UI by whether it exists in the game's space and in its fiction: diegetic (in world, seen by characters), spatial (in 3D space but not part of the fiction), meta (on the 2D plane but fictional, e.g. blood splatter), non-diegetic (classic HUD). — [York University paper summarising the framework](https://www.yorku.ca/mack/ec2018.html), [DICE slides](https://www2.slideshare.net/DICEStudio/beyond-the-hud-user-interfaces-for-increased-player-immersion-in-fps-games)
- Dead Space: health is a light tube on the character's spine instead of a health bar; the benefit of fully diegetic UI is debated. — [HUDS+GUIS: Dead Space 2](https://www.hudsandguis.com/home/2012/08/22/dead-space-2-diegetic-interface-design), [Game Developer](https://gamedeveloper.com/design/user-interface-design-in-video-games)
- Empirical caution: in a York University study players performed significantly better with a HUD for health information, while diegetic/spatial displays worked better for ammo. — [yorku.ca](https://www.yorku.ca/mack/ec2018.html)

**Lo-fi and diegetic craft**
- Alien: Isolation: the UI was inspired by worn VHS footage (some interface footage was recorded to tape and replayed on an old TV); the team only used reference material from before 1979; the motion tracker is a clunky box that must be raised and aimed — an "active" UI element — and raising it blurs the background to show where the character's eyes are focused. — [GameSpot](https://www.gamespot.com/articles/baked-in-the-past-the-lo-fi-sci-fi-of-alien-isolation/1100-6418409/), [MCV/Develop](https://www.mcvuk.com/development-news/18-things-we-learned-about-alien-isolation-last-night/), [Escapist](https://www.escapistmagazine.com/alien-isolations-low-fi-sci-fi-trailer-discusses-retro-future-aesthetic/)
- Death Stranding 2 (2025): a GDC session covers the making of its voxel 3D UI map; the game also adds "Corpus", an interactive in-game encyclopedia praised for keeping the story followable. — [GDC schedule](https://schedule.gdconf.com/session/death-stranding-2-making-of-voxel-3d-ui-map/914844), [Game Informer](https://www.gameinformer.com/preview/2025/05/08/how-death-stranding-2s-interactive-encyclopedia-helps-players-make-sense-of-the)

**Film FUI (Territory Studio and others)**
- Territory's stated principles: screen graphics exist to tell part of the story or build the world; the successful ones have "some sense of reality" (for The Martian they worked closely with NASA for accurate screen content); design for the viewer's comprehension; grid/widget-based systems are a shortcut for producing large volumes of coherent screens. FUI = fictional user interface. — [Pushing Pixels interview](https://www.pushing-pixels.org/2014/08/07/the-craft-of-screen-graphics-and-movie-user-interfaces-interview-with-david-sheldon-hicks-of-territory-studio.html), [Sci-fi Interfaces Q&A](https://scifiinterfaces.com/tag/territory-studio/)
- Film FUI is feeding back into real products (e.g. vehicle interior displays traced to Territory's film work). — [Built In](https://builtin.com/articles/sci-fi-ui)
- Reference archives: HUDS+GUIS (film and game UI breakdowns, e.g. Blade Runner 2049); Game UI Database (recently revamped, aimed at developers). — [HUDS+GUIS](https://www.hudsandguis.com/home/2018/blade-runner-2049), [Aftermath on Game UI Database](https://aftermath.site/game-ui-database)

**Mission control**
- NASA Open MCT is an open-source, web-based mission-control framework with composable telemetry views governed by a global Time Conductor (real-time and fixed-timespan modes). — [Open MCT User's Guide](https://nasa.github.io/openmct/docs/static/files/Open_MCT_Users_Guide.pdf)

**City-builder data lenses**
- Cities: Skylines shipped with 19 info views (some with tabs), grouped as service-related (electricity, water, garbage, fire safety, public transport, etc.), citizen-related, and city/map-related. — [Dev Diary 9: Info Views](https://beyondsims.com/2015/02/skylines-dev-diary-9-info-views/)
- Cities: Skylines II is described as having 33 info views that open automatically when the relevant construction menu is opened; underground pipes and tunnels are bound to info views. — [Thunderstore mod page](https://thunderstore.io/c/cities-skylines-ii/p/Infixo/Info_Loom/v/0.7.0/), [gameplay.tips guide](https://gameplay.tips/guides/cities-skylines-ii-info-views-guide.html)
- SimCity (2013): "data layers" recolour the city to show one system at a time (e.g. ore deposits, happiness, power, waste flow and over-capacity points); because the GlassBox engine simulates agents, the layers show the simulation itself; the stated intent was to let the art carry the feedback while keeping numbers under the surface for data-minded players. — [BLDGBLOG interview with Stone Librande](https://bldgblog.com/2013/05/sim-city-an-interview-with-stone-librande/), [PC Gamer](https://www.pcgamer.com/simcity-interview-failure-states-casinos-minecraft-and-the-working-class)
- A real-house instance of the lens idea already exists: the live 3D dashboard's energy mode (flow arrows, PV light streak) and "x-ray" silhouettes that show due bins through walls. — [HA community](https://community.home-assistant.io/t/my-house-as-a-live-3d-dashboard-blender-model-three-js-driven-by-home-assistant/1026746)

### Inferences
- Translates well to a real house:
  - **Info views / data layers** (city-builder): the house model desaturates and one system lights up — power (cables glow, flow particles), water (pipes, tank fill, leak sensors), security (door/window/camera coverage cones, last-motion heat), climate (room temperature tint), presence. One tap per lens, auto-opening the relevant lens when an alert fires (as CS2 auto-opens views with the relevant tool). [DAILY VALUE] [ALWAYS-ON OK when static between updates]
  - **Diegetic state on objects**: battery as a fill level on the battery object, geyser glowing as it heats, the car's charge ring — the Dead Space principle applied to appliances. Good for ambient reading; pair with numbers on tap.
  - **Global time conductor** (Open MCT): one clock for every panel, live or replay.
  - **X-ray silhouettes** for things behind walls.
- Translates poorly / kitsch risk: full sci-fi FUI chrome (hex grids, scanning lines, fake telemetry), radar/sonar sweeps as decoration, VHS/CRT distortion layered over real controls. Territory's own rule — screens must be credible and comprehensible — plus the York finding that critical status reads faster from a plain HUD both argue for keeping alarms, security state and anything safety-related in a conventional, fixed, high-contrast strip. A radar sweep is defensible only where the data really is polar and periodic (e.g. presence radar sensors, or traffic past the house as distance-over-time).
- A restrained way to get "command centre" feeling without costume: dark theme, monospaced numerals, consistent grid, one accent colour, and real precision (units, timestamps, data age) — the Open MCT look rather than the film look.
- Factory-game flow views (belts with visible items, throughput per minute) map onto water and power as "things moving along a path at a rate", which is the Sankey-particle pattern from section 3.
- [CVD] City-builder overlays conventionally use green-to-red ramps; substitute a single-hue or blue-orange ramp and add icons for thresholds.

### Gaps
- Factorio and Satisfactory UI: only weak opinion sources were found; no design analysis is cited.
- The original Fagerholt & Lorentzon thesis text was not opened (framework taken from secondary summaries).
- Perception studio and SpaceX-style launch dashboards were not researched.
- Game UI Database entries themselves were not opened.

---

## 7. Gamification for families and kids that is well regarded rather than manipulative

### Takeaway
The products families use (Joon, Finch, Skylight, Greenlight, Habitica) converge on quests plus a pet or star economy with parent approval; the research base says streaks work by making the streak itself the goal and hurt motivation when visibly broken, expected tangible rewards can undermine activities children already enjoy, and existing chore apps lean on extrinsic rewards aimed at individuals rather than the family as a whole. Child-rights frameworks (UNICEF RITEC-8, 5Rights) point toward autonomy, competence, social bonds and creativity, and away from variable rewards, loss-framed streaks and pressure notifications.

### Cited Findings

**Products**
- Joon: a gamified chore/routine app where the child cares for a virtual pet ("Doter"); parents assign quests in one app, the child plays in a second app, and each completed quest is sent to the parent to verify and approve; marketed for ADHD among others. Evidence is reviewer and parent testimonial, not controlled study. — [Choosing Therapy review](https://www.choosingtherapy.com/joon-app-review/), [App Store](https://apps.apple.com/app/id1482225056)
- Finch (self-care pet): reviews describe a pet that is not harmed by a skipped day — a missed day reads as a pause — alongside milestone rewards at 7 and 14 days of check-ins; paid tier mostly cosmetic. Specific review attribution not pinned down in this session. — [Engadget](https://www.engadget.com/apps/this-self-care-virtual-pet-is-helping-me-get-my-act-together-160027169.html), [Internet Matters guide](https://www.internetmatters.org/advice/apps-and-platforms/wellbeing/finch/)
- Skylight Calendar: shared wall display with a digital chore chart and star-points rewards; Skylight Buddy is a separate chore device for ages 4-10. — [Babysense review, 2026](https://www.babysensemonitors.com/a/nursery-resources/parenting/skylight-calendar-review), [The Everymom](https://theeverymom.com/skylight-buddy-review/)
- Greenlight: chores tied to a kids' debit card/allowance; child marks done, parent is notified and approves before payout (vendor source). — [Greenlight](https://greenlight.com/learning-center/home-and-chores/chore-chart-for-kids)
- Bruno Simon's portfolio as a non-manipulative play reference: optional achievements from easy to cryptic unlock cosmetic car skins; collective counters (cookies accepted, falls into the abyss) and ephemeral visitor messages create shared rather than competitive play. — [Awwwards case study](https://www.awwwards.com/brunos-portfolio-case-study.html)

**Research on streaks and rewards**
- Silverman & Barasch, "On or Off Track: How (Broken) Streaks Affect Consumer Decisions" (Journal of Consumer Research, 2023; seven studies): showing an intact streak increases later engagement relative to showing a broken one, independent of actual past behaviour; people treat maintaining the streak as a goal in itself; the drop after a break is stronger when people blame themselves and weaker when the streak can be "repaired". — [CU Boulder summary](https://www.colorado.edu/business/faculty-research/2023/04/19/or-track-how-broken-streaks-affect-consumer-decisions); caveat that the studies used short streaks in lab settings — [Psychology Today](https://www.psychologytoday.com/us/blog/ulterior-motives/202306/how-broken-streaks-sap-motivation)
- Commentary (not peer-reviewed): streaks can shift the goal from the activity to the counter ("streak creep"). — [The Decision Lab](https://thedecisionlab.com/insights/consumer-insights/streak-creep-the-perils-of-too-much-gamification)
- Lepper, Greene & Nisbett (1973): 51 preschoolers who already liked drawing; those promised an award beforehand later showed significantly less interest in drawing, while unexpected-award and no-award groups did not. The authors still considered rewards sometimes "necessary and appropriate". The study concerned an activity children already enjoyed, not chores. — [paper PDF](https://typeset.io/pdf/undermining-children-s-intrinsic-interest-with-extrinsic-3qn44yqiou.pdf), [Psychology Today](https://www.psychologytoday.com/au/blog/the-baby-scientist/201806/motivating-children-without-rewards)
- Bjering, Høiseth & Alsos, "Gamification and Family Housework Applications" (2015): existing chore apps focus on external rather than intrinsic motivation and target family members individually rather than the family as a whole; framed around competence, autonomy and relatedness. — [IFIP digital library](https://dl.ifip.org/hal-01758462v1)
- Brewer et al. (IDC 2013): gamification components helped keep 5-7 year-olds motivated through repetitive tasks in a lab setting. — [paper](https://lisa-anthony.com/wp-content/uploads/2013/05/brewer-et-al-idc20131.pdf)

**Child-rights and advocacy guidance**
- UNICEF/LEGO RITEC-8 framework (built with 787 children, mostly 8-12, in 18 countries): eight wellbeing outcomes of digital play — autonomy, competence, emotional control, social bonds, creativity, personal identity, diversity/equity/inclusion, and safety/security; autonomy means children freely choose how to engage and feel agency; competence means experiences build a sense of mastery; not a checklist, but safety is mandatory. — [UNICEF Innocenti](https://www.unicef.org/innocenti/projects/responsible-innovation-technology-children), [UNICEF RITEC](https://www.unicef.org/innovation/responsible-innovation-technology-children-ritec)
- 5Rights, "Disrupted Childhood: the cost of persuasive design" (2018; updated 2023): identifies reward loops, notifications, autoplay and infinite feeds as attention-maximising techniques; recommends design transparency, easy log-off and notification controls, and that responsibility should not rest mainly on children and parents. Snapchat streaks were criticised. — [5Rights 2023 report page](https://5rightsfoundation.com/in-action/disrupted-childhood-the-cost-of-persuasive-design-2023.html), [report PDF](https://5rightsfoundation.com/uploads/Disrupted-Childhood-2023-v2.pdf)
- LSE/5Rights Digital Futures for Children (Feb 2026): EdTech used in UK schools increasingly replicates social-media patterns including gamification, public rankings and behaviour tracking; impact on outcomes still being examined. — [5Rights](https://5rightsfoundation.com/social-media-style-design-is-already-in-the-classroom-new-research-finds/)
- Fairplay: variable rewards, streaks and grinding encourage habitual and even compulsive engagement (advocacy report, not a controlled study). — [Fairplay](https://fairplayforkids.org/five-ways-social-gaming-platforms-harm-young-people/)
- Household-data caution: making consumption visible raised privacy and conflict issues among household members in a residential study. — [SFU "Energy Mirror" thesis](https://summit.sfu.ca/_flysystem/fedora/2022-08/etd21991.pdf)

### Inferences
- Healthy-versus-harmful checklist for a family system (synthesis of the cited research):
  - Prefer: collaborative household goals over sibling leaderboards (Bjering; 5Rights on public rankings); a mascot/pet that thrives with care but is never harmed or made sad by lapses (Finch model); unexpected or "surprise" celebration rather than a promised prize for things kids already like doing (Lepper); visible mastery and growing responsibility (RITEC competence); children choosing which quests to take or how to decorate their space (RITEC autonomy, creativity); parent approval as a moment of praise, not surveillance; a natural end to each session.
  - Avoid: loss-framed streaks with broken-streak displays (Silverman & Barasch — if streaks are used, make them repairable, cap them, and show "days done this month" rather than a zeroed counter); variable-ratio rewards/loot boxes; push notifications aimed at children; real-money economies for baseline family contributions; per-person consumption shaming.
- Concepts suited to this household: (1) a **house mascot** living in the diorama whose mood and surroundings reflect the home's collective state (sunny garden when the battery is full and chores are done; sleepy at night) — a Tamagotchi that cannot die; (2) **collection mechanics** tied to real events: a sticker or constellation for each "grid-free night", first rain of the season, a week of full water tanks — collections never decay, which avoids streak anxiety; (3) **family quests** with a shared progress ring (e.g. "five grid-free nights this month"), finishing in a small celebration in the diorama; (4) cosmetic unlocks only (mascot hats, house decorations, car skins as in Bruno Simon's site). [DAILY VALUE for the mascot and quests if mood changes are slow and truthful; collection gives long-term value because the archive grows]
- Young children cannot read; chore UI should be picture-first with large tap targets, with one clear "done" gesture that produces generous feedback (see "juice", section 8), and the parent approval step.
- [CVD] Chore status must not be red/green ticks; use shape (empty ring / filled star), position, and a blue-orange pair.

### Gaps
- No peer-reviewed evaluation of Joon, Finch, Skylight or Greenlight was found; evidence is reviews and vendor claims.
- No study specifically on streaks and children's wellbeing, and no controlled study of chore/reward charts, was found; the Lepper finding is an extrapolation when applied to chores.
- Common Sense Media material on gamification, Duolingo's streak mechanics in detail, Habitica and the Forest app were not verified from primary sources this session.
- No verified example of a family energy-saving challenge product ("grid-free nights", collaborative streaks) was found; these are proposed concepts.
- The RITEC design toolbox's feature-to-outcome mapping was not opened.

---

## 8. Tactile and multi-sensory web interaction: gestures, physics, haptics, audio, "juice"

### Takeaway
The current craft canon (Rauno Freiberg, Emil Kowalski, Benji Taylor/Family, Andy Works) agrees on a few rules: gestures must be direct, interruptible and momentum-preserving; springs beat fixed curves for anything the finger drives; frequent actions get little or no animation while rare, meaningful moments get the delight. On the web, haptics remain weak on iOS (an unofficial workaround only), device-tilt needs an explicit permission tap, and spatial audio is available but should be used sparingly.

### Cited Findings

**Interaction principles**
- Rauno Freiberg, "Invisible Details of Interaction Design" (July 2023; older but canonical): interruptibility; throws keep their angle and velocity; lighter things bounce less; lightweight overlays may trigger mid-swipe while destructive actions wait for gesture end; pinch should scale immediately rather than after a threshold; spatial consistency (things return to where they came from); frequent low-novelty actions (command menus, context menus) are better without animation; radial menus keep distance and target size constant so muscle memory takes over; "fidgetability" — some interactions are satisfying to play with for no reason; magnifier loupes for content hidden under a finger; implicit input from context. — [rauno.me](https://rauno.me/craft/interaction-design)
- Emil Kowalski: principles covering easing, timing, springs (stiffness/damping/mass), accessibility and performance; when the main thread is busy use hardware-accelerated CSS or the Web Animations API. — [Great Animations](https://emilkowal.ski/ui/great-animations), [Good vs Great Animations](https://emilkowal.ski/ui/good-vs-great-animations)
- Benji Taylor, "Family Values" (8 July 2024): three principles — simplicity (reveal complexity gradually via a tray system with varying heights), fluidity (directional tab slides; text morphing that reuses shared letters; elements that travel between screens rather than being duplicated; a spinner that flies to where the pending item will live), and delight applied selectively (tokens tumbling into a trash can with sound; confetti on completing a backup; QR-code ripple easter egg; commas that shift as digits are typed). The "delight-impact curve": delight is most effective in rarely used features and diminishes with repetition, so frequent actions get only subtle touches. — [benji.org](https://benji.org/family-values)
- "Juice it or lose it" (Martin Jonasson & Petri Purho, GDC 2012) showed a dull Breakout clone becoming engaging by layering flash, shake, particles and sound; "juiciness" = far more output than the simple input deserves; Steve Swink's book popularised "game feel". — [Wikipedia: Game feel](https://en.wikipedia.org/wiki/Game_feel)
- Andy Works applies game feel to product design ("The Art of Game Feel (a.k.a. Juice) in Product Design" — the most satisfying checkbox). — [notbor.ing](https://notbor.ing/words/the-most-satisfying-checkbox)
- Caveat repeated across sources: games flood users with juice because immersion is the goal, while a task app should let the task finish quickly; UI juice should enhance, not slow down. — [Brad Woods digital garden](https://garden.bradwoods.io/notes/design/juice)

**Platform capabilities and limits**
- Haptics: iOS Safari does not implement `navigator.vibrate()`; the common workaround toggles a hidden `<input type="checkbox" switch>` (via its label) to fire the native switch haptic; libraries wrap this and fall back to the Vibration API on Android. Sources disagree on whether the switch haptic arrived in Safari 17.4 or 18.0, and warn it is an undocumented side effect that could disappear. — [ios-haptics](https://npmjs.com/package/ios-haptics), [web-haptics browser support](https://www.mintlify.com/lochie/web-haptics/advanced/browser-support), [write-up](https://azukiazusa.dev/blog/ios-safari-web-haptics.md), [WebKit bug](https://bugs.webkit.org/show_bug.cgi?id=285120)
- Device tilt: on iOS, `DeviceOrientationEvent.requestPermission()` / `DeviceMotionEvent.requestPermission()` must be called from a user gesture (e.g. a button tap; `touchend` works, `touchstart` does not) over HTTPS; calling on load fails. — [MDN](https://developer.mozilla.org/docs/Web/API/Device_orientation_events), [dev.to guide](https://dev.to/li/how-to-requestpermission-for-devicemotion-and-deviceorientation-events-in-ios-13-46g2)
- Spatial audio: Web Audio's `PannerNode` positions sound in 3D with selectable `panningModel` (HRTF or equalpower — set it explicitly; sources differ on the default). One game-audio guide advises that UI sounds, music and ambience bypass the panner, and suggests limiting simultaneous HRTF sources to roughly 4-8 on mobile (single-source figure). — [MDN spatialization basics](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Web_audio_spatialization_basics), [game audio guide](https://abratabia.com/web-game-audio/spatial-audio-games.php)
- Real-world audio/tactile craft on the web: Bruno Simon's portfolio spatialises object sounds (heard from the side the object is on), varies one click sample's playback rate for UI, and supports a gamepad. — [Awwwards case study](https://www.awwwards.com/brunos-portfolio-case-study.html)
- Cursor/touch-reactive surfaces in award work: blob overlays following the pointer (Lando Norris), cursor reveal (Hubtown), refraction glass (section 1). — [DesignRush](https://www.designrush.com/best-designs/websites/lando-norris-website-design), [Utsubo](https://www.utsubo.com/blog/best-threejs-websites-2026), [kube.io](https://kube.io/blog/liquid-glass-css-svg)

### Inferences
- Pattern-to-home mapping (practitioner knowledge for the "how built" parts):
  - **Spring-driven direct manipulation**: drag a blind in the diorama to set its height; drag a dimmer; throw a card away to dismiss with preserved velocity. Build: Pointer Events + velocity sampling + a spring integrator (Motion/Framer Motion, react-spring, or a 20-line spring); animate only `transform`/`opacity`. [DAILY VALUE]
  - **Rubber-banding and magnetic snapping**: over-drag resistance at limits (thermostat min/max); snap points with a tick (haptic where available, a short sound otherwise) at setpoints, scene positions and timeline events.
  - **Dial / knob controls**: one large rotary control for temperature, volume or time-of-day, with detents; good on a wall display for adults and kids because the target is huge.
  - **Radial (pie) menu on long-press** of a room or device: constant distance to every option (Rauno's Fitts's-law point), ideal for 4-6 actions per room.
  - **Long-press peek**: press a room to see its camera, temperature and last events in a tray that grows from the touch point; release to dismiss, slide up to commit (Family-style trays).
  - **Pinch/zoom canvas**: the house as an infinitely zoomable plan — street to house to room to device — with zoom-dependent detail (semantic zoom). Build with CSS transforms on a container or a three.js orthographic camera; clamp with rubber-banding.
  - **Device-tilt parallax** on phones for the diorama or the "house painting": request permission behind an explicit "enable motion" control; keep amplitude small. [ONE-TIME WOW; default off — see section 9]
  - **Juice for children's chores**: the "done" action is rare and meaningful, so by the delight-impact curve it earns particles, a squash-and-stretch on the mascot, and a rising-pitch sound; adults' frequent toggles (lights) get an instant state change and nothing else.
- Haptics cannot be relied on in the family's iOS devices from a web app; design every interaction to be complete with visual + optional audio feedback, and treat the switch-based haptic as progressive enhancement.
- Sound needs a house rule: UI sounds off by default on the wall display, with a per-device mute and a night schedule.
- [CVD] Tactile and audio feedback are valuable redundant channels for a colour-blind user: confirmation via motion and sound rather than a colour flip.

### Gaps
- Infinite-canvas references (Figma, tldraw, Muse) and specific web dial/knob or pie-menu implementations were not verified from sources this session; they are described from general knowledge only.
- No dated 2025-2026 essays by Rauno Freiberg or Emil Kowalski were confirmed (the cited pieces are 2023 and undated respectively); Vercel/Linear design-blog posts were not researched.
- The original "Juice it or lose it" talk page/video was not opened (confirmed via Wikipedia's Game feel article).
- No authoritative statement from Apple/WebKit on future Vibration API support was retrieved.

---

## 9. Accessibility and restraint for motion-rich interfaces; keeping an ambient screen calm; colour-blind-safe encoding

### Takeaway
Restraint is itself well-evidenced: the motion types that trigger vestibular symptoms (zooming/scaling, spinning, parallax and multi-speed movement, constant motion near text) are exactly the award-site staples, while fades, colour changes and small movements are considered safe. For a red-green colour-blind primary user, colour must never carry meaning alone — pair the Okabe-Ito palette (or blue-orange) with shape, position, texture, labels and motion direction.

### Cited Findings

**Motion**
- WCAG 2.3.3 "Animation from Interactions" is Level AAA: motion animation triggered by interaction must be disableable unless essential; using the CSS `prefers-reduced-motion` query is a listed sufficient technique (C39). — [W3C Understanding 2.3.3](https://www.w3.org/WAI/WCAG21/Understanding/animation-from-interactions)
- WCAG 2.2.2 requires a pause/stop/hide control for motion that lasts more than five seconds (as summarised by practitioner guides). — [W3C draft Understanding doc](https://w3c.github.io/wcag/understanding/animation-from-interactions.html), [Yale usability guidance](https://usability.yale.edu/digital-accessibility/accessibility-resources/accessibility-articles/animated-content-and-timing)
- Val Head's trigger list: scaling and zooming, spinning and vortex effects, multi-speed or multidirectional movement (parallax), and constant animation near text; not on the list — animated colour changes, opacity fades, small movements. "What triggers one person may not affect another." Parallax in particular should always have a reduced alternative. — [A List Apart](https://alistapart.com/article/designing-safer-web-animation-for-motion-sensitivity), [Making Motion Inclusive slides](https://noti.st/valhead/PkWS2k/slides)
- Reduced motion means substitution, not removal: keep the fade, drop the movement; replace a looping bounce with a short fade. — [Smashing Magazine](https://www.smashingmagazine.com/2020/09/design-reduced-motion-sensitivities), [WebKit: Responsive Design for Motion](https://webkit.org/blog/7551/responsive-design-for-motion/)
- JavaScript-driven animation must check the preference too (`window.matchMedia('(prefers-reduced-motion: reduce)')`) before starting animation libraries. — [W3C draft Understanding doc](https://w3c.github.io/wcag/understanding/animation-from-interactions.html) (as summarised with practitioner guides in search)
- Frequent actions should not animate at all; animation becomes a burden with repetition. — [Rauno Freiberg](https://rauno.me/craft/interaction-design); delight diminishes with frequency. — [Benji Taylor](https://benji.org/family-values)

**Calm**
- Calm-technology principles: require the smallest possible amount of attention; inform and create calm; make use of the periphery; information should move from periphery to centre and back. — [Calm Tech Institute](https://calmtech.institute/calm-tech-principles), [Amber Case](https://www.caseorganic.com/post/principles-of-calm-technology)
- Critical information is read faster from a conventional HUD than from in-world/diegetic displays. — [York University study](https://www.yorku.ca/mack/ec2018.html)
- Householders want more precise information than ambient/artistic displays alone provide. — see section 3 sources, e.g. [Rodgers & Bartram record](https://peeref.com/works/10368038)
- Continuous animation has a real device cost on dashboards: animated flow dots were reported to cause sustained high CPU use. — [Power Flow Card Plus thread](https://community.home-assistant.io/t/power-flow-card-plus/552326?page=8)
- Static high-contrast elements are the burn-in risk on OLED; prefer dark themes and rotate content. — [Tom's Guide](https://www.tomsguide.com/tvs/oled-tvs-burn-in-from-these-common-mistakes-prevent-it-with-3-settings)

**Colour**
- Okabe-Ito palette (eight colours designed to stay distinguishable under protanopia, deuteranopia and tritanopia, with distinct luminance so they survive greyscale): Orange #E69F00, Sky Blue #56B4E9, Bluish Green #009E73, Yellow #F0E442, Blue #0072B2, Vermillion #D55E00, Reddish Purple #CC79A7, Black #000000. — [ConceptViz reference](https://conceptviz.app/blog/okabe-ito-palette-hex-codes-complete-reference) (vendor page; primary sources are Okabe & Ito 2008 and Wong 2011, not retrieved)
- "Information encoded only in colour can never be truly colourblind safe"; information should be conveyed in more than one way (shape, pattern, line style, direct labels). — [CTAN colorblind package documentation](https://ctan.math.illinois.edu/macros/latex/contrib/colorblind/documentation.pdf)
- For continuous data, perceptually uniform maps such as viridis and cividis are recommended and rainbow/jet maps warned against; cividis was designed so colour-vision-deficient and typical viewers perceive similar gradients; keep categorical palettes to about seven colours. — [colour accessibility guide](https://skills.sh/wentorai/research-plugins/color-accessibility-guide) (secondary; the Nuñez et al. 2018 cividis paper was not retrieved)

### Inferences
- A three-tier motion policy fits this product:
  1. **Ambient tier (wall/TV, always on)**: only slow drift, cross-fades and luminance changes; no parallax, zoom or spin; nothing loops faster than a breath; everything pausable; frame rate capped; rendering stops when nobody is present.
  2. **Interactive tier (someone is touching it)**: springs and direct manipulation, short (150-300 ms) transitions, interruptible.
  3. **Celebration tier (rare)**: confetti, mascot animation, recap stories — opt-in per person and replaced by a fade + still image under `prefers-reduced-motion`.
- Reduced-motion implementation plan (practitioner knowledge): one `motion` setting with three values (system / reduced / full) stored per device; CSS guarded by `@media (prefers-reduced-motion: no-preference)`; JS and WebGL read the same flag — camera fly-throughs become cuts or cross-fades, particle flows become static arrows with a number, scroll-linked effects are disabled, day-replay becomes a stepped slideshow.
- [CVD] Concrete encodings for a red-green colour-blind primary user:
  - Import vs export / charge vs discharge: orange (#E69F00) vs blue (#0072B2), plus arrow direction and motion direction; never green vs red.
  - Avoid using Okabe-Ito bluish green (#009E73) and vermillion (#D55E00) as the only distinguishing pair for a critical binary state, since that is the red-green axis; if both must appear, add shape/label (inference — the retrieved source gives no pair-level guidance).
  - OK / warning / alarm: shape + position + luminance (tick in circle / triangle / octagon; alarm also pulses in luminance and takes a fixed top strip), text label always present.
  - Heatmaps and room-temperature tints: cividis or a blue-to-yellow ramp; label extremes.
  - Lines in charts: vary dash pattern and end-label each line directly instead of relying on a legend.
  - Test every screen with a deuteranopia/protanopia simulator and in greyscale before shipping.
- Calm test for the wall display: from across the room, with the screen in peripheral vision, nothing should attract the eye unless something needs attention; an alert should be the only thing that moves.
- Novelty decay is the main risk of this whole design space: the patterns that keep value are those that are truthful (mirror the real house), slow (change with the day and season), and growing (archives, collections, recaps); those that are effects for their own sake (refraction, scroll cinematics, shake) should be reserved for rare moments or left out.

### Gaps
- MDN and web.dev primary pages on `prefers-reduced-motion` were not opened; the W3C Understanding document and WebKit post are the primary sources cited.
- A widely repeated statistic about vestibular disorder prevalence (about 35% of adults over 40) appeared only on marketing-style pages and was not verified against a primary study; it is deliberately not used above.
- Original Okabe & Ito (2008), Wong (2011) and Nuñez et al. (2018, cividis) papers were not retrieved; pair-level safety of specific Okabe-Ito colours under deuteranopia was not confirmed by a source.
- No research specific to colour-blind-safe encoding in motion-rich or 3D/ambient interfaces (as opposed to static charts) was found.
- No guidance was found on safe animation rates specifically for young children or for peripheral-vision wall displays.
