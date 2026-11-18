# Web platform technology for immersive / 3D / richly animated browser UI (state as of 18 Nov 2026) — Svelte 5 + Vite PWA focus

Research conventions used in these notes:
- "Current" browser versions at time of writing, per the sources below: Chrome/Edge 157 (stable 3 Nov 2026), Firefox 159 (27 Oct 2026), Safari 27.2 (26 Oct 2026; Safari 27.0 shipped 14 Sep 2026 with iOS/iPadOS/macOS/visionOS 27).
- "(search snippet)" marks a fact taken from a search-result summary where the underlying page was not opened; treat as lower confidence.
- The web-search budget for this session ran out before every item could be double-checked; anything not confirmed is listed under Gaps rather than guessed.

---

## 1. WebGPU status as of late 2026 (browsers, iOS/iPadOS, Android, TV browsers, iOS standalone PWA, WebGL2 fallback)

### Takeaway
WebGPU ships by default in Chrome/Edge (desktop since 113, Android since 121), Safari 26.0+ on macOS/iOS/iPadOS/visionOS (15 Sep 2025) and Firefox on Windows (141) and Apple-Silicon macOS (145/147); Firefox on Linux/Android and essentially all smart-TV browsers remain the holes, so a WebGL2 fallback is still mandatory for a TV/wall-display target. No first-party source explicitly confirms WebGPU inside an iOS home-screen web app, although the main iOS-PWA compatibility tracker lists it as available since 26.0.

### Cited Findings

**Desktop and mobile browsers**
- Chrome and Edge: WebGPU available on Windows (Direct3D 12), macOS and ChromeOS since version 113; Chrome for Android since 121 on Android 12+ with Qualcomm/ARM GPUs; Linux listed as "in progress" in Nov 2025 — [web.dev, 25 Nov 2025](https://web.dev/blog/webgpu-supported-major-browsers)
- Chrome on Linux: on by default from v144 (Intel) and v147 (NVIDIA on Wayland) — [Utsubo, updated 6 Nov 2026](https://www.utsubo.com/blog/threejs-2026-what-changed)
- Safari: "WebKit for Safari 26.0 adds support for WebGPU", shipping on macOS, iOS, iPadOS and visionOS; released 15 Sep 2025; WebKit states WebGPU "supersedes WebGL" on these platforms and names Three.js, Babylon.js, Unity and PlayCanvas as working — [WebKit, Safari 26.0](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/)
- Safari 26.2 (12 Dec 2025): WebXR on visionOS can now use WebGPU; `GPUTexture` accepted as depth-stencil/resolve attachments — [WebKit, Safari 26.2](https://webkit.org/blog/17640/webkit-features-for-safari-26-2/)
- Safari 27.0 (14 Sep 2026; post dated 17 Sep 2026): adds WGSL `clip_distances`; fixes include `GPUDevice.onuncapturederror`, restored `maxStorageBuffersInFragmentStage` limits and multisampled passes with direct `GPUTexture` — [WebKit, Safari 27.0](https://webkit.org/blog/18325/webkit-features-for-safari-27-0/)
- Safari 27.2 (26 Oct 2026): fixed "a severe frame rate drop with `executeBundles()` using `drawIndirect()`/`drawIndexedIndirect()`" — [WebKit, Safari 27.2](https://webkit.org/blog/18515/webkit-features-for-safari-27-2/)
- Safari 27.0 is also installable on macOS 26 Tahoe and macOS 15 Sequoia separately from the OS update — [WebKit, Safari 27.0](https://webkit.org/blog/18325/webkit-features-for-safari-27-0/)
- Firefox: Windows as of 141; macOS Tahoe 26 on ARM64 as of 145; Linux, Android and Intel Macs "in progress" (Nov 2025) — [web.dev](https://web.dev/blog/webgpu-supported-major-browsers)
- Firefox: v147 extends to all macOS on Apple Silicon; "Linux and Android still need a flag" as of Nov 2026 — [Utsubo](https://www.utsubo.com/blog/threejs-2026-what-changed)
- Baseline data still classes WebGPU as "Limited availability … blocked since January 2026 by Firefox"; lists Chrome desktop 144 (13 Jan 2026), Chrome Android 121, Safari/iOS 26, Firefox "not supported" (i.e. not on all platforms) — [web-features explorer](https://web-platform-dx.github.io/web-features-explorer/features/webgpu)
- PlayCanvas (June 2026) quotes roughly 85% of end users having WebGPU per caniuse, with automatic WebGL2 fallback for the rest — [PlayCanvas blog, 3 Jun 2026](https://blog.playcanvas.com/new-in-supersplat-webgpu-and-streaming-bring-huge-performance-wins)
- WebGPU "compatibility mode" (opt-in via `requestAdapter({ featureLevel: "compatibility" })`) shipped in Chrome 146 (Feb 2026) starting with Android on OpenGL ES 3.1-class devices; ChromeOS (GLES 3.1) and Windows (D3D11) "being explored" — [Chrome for Developers, 25 Feb 2026](https://developer.chrome.com/blog/new-in-webgpu-146)
- The Chromium Intent to Ship for compatibility mode lists Android WebView shipping in 146 (search snippet) — [blink-dev](https://groups.google.com/a/chromium.org/g/blink-dev/c/N3RlLGCOTJ4)

**iOS home-screen web apps / WKWebView**
- firt.dev's "iOS PWA Compatibility" notes (last updated 13 Oct 2026) list "WebGL 2.0: since 15.0. WebGPU: since 26.0" in the compatibility list for installed web apps, with no standalone-specific exception recorded — [firt.dev](https://firt.dev/notes/pwa-ios/)
- On iOS 18.2 a developer found the Safari WebGPU feature flag did not give WKWebView GPU access; an Apple engineer replied it would work once enabled by default and pointed to iOS 26 beta where it is default-on (search snippet) — [Apple Developer Forums](https://developer.apple.com/forums/thread/770862)
- A forum thread reports a WebContent/GPU process crash in WKWebView on iPhone 15 with iOS 26.4 while the same flow was stable on iPad (search snippet) — [Apple Developer Forums](https://developer.apple.com/forums/thread/822200)
- iOS/iPadOS 26: "By default, every website added to the Home Screen opens as a web app"; a manifest is no longer required; users can switch "Open as Web App" off — [WebKit, Safari 26.0](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/)

**Smart-TV / wall-display browsers**
- Samsung Tizen web engine by model year: 2026 = Tizen 10.0 / Chromium M130; 2025 = Tizen 9.0 / M120; 2024 = Tizen 8.0 / M108; 2023 = Tizen 7.0 / M94; 2022 = M85; 2021 = M76. The page content retrieved has a WebGL row marked "Yes" and no WebGPU row — [Samsung Developer](https://developer.samsung.com/smarttv/develop/specifications/web-engine-specifications.html)
- LG webOS TV web engine: webOS 26 (2026) = Chromium 132; webOS 25 (2025) = Chromium 120; webOS 24 = Chromium 108; webOS 23 = Chromium 94; webOS 22 = Chromium 87; webOS 6 (2021) = Chromium 79. No WebGL/WebGPU statement on the page — [LG webOS TV Developer](https://webostv.developer.lge.com/develop/specifications/web-api-and-web-engine)
- Amazon Vega OS (new Fire TV OS) WebView: "supports WebGL 2.0, backed by OpenGL ES 3.0", WASM supported, "WebGPU is not currently supported"; sample UA shows Chrome/118 on a Mali-G310 device — [Amazon Developer, Vega WebView WebGL best practices](https://developer.amazon.com/docs/vega/0.21/webview-webgl-best-practices.html)
- Apple announced a new device class, "Apple HomeView" (a 7-inch display used by voice from across the room or touch up close), with Safari on it; WebKit suggests testing at a 448×364 viewport; it reports an iOS user agent; the post does not say whether WebGPU or Home Screen web apps are supported on it — [WebKit, "Safari on Apple HomeView", 13 Nov 2026](https://webkit.org/blog/18608/safari-on-apple-homeview/)

**Fallback**
- three.js `WebGPURenderer` falls back to a WebGL 2 backend where WebGPU is missing; `forceWebGL: true` forces that path for testing and a practitioner reports identical output for TSL content — [Utsubo](https://www.utsubo.com/blog/threejs-2026-what-changed); [Maxime Heckel, 14 Oct 2025](https://blog.maximeheckel.com/posts/field-guide-to-tsl-and-webgpu/)
- WebGL 2 is in iOS Safari since 15.0 — [firt.dev](https://firt.dev/notes/pwa-ios/)

### Inferences
- Because Chrome only enabled WebGPU on desktop at 113 and on Android at 121, and TV vendors ship frozen forks (M120 on 2025 sets, M130/132 on 2026 sets, M108 or older on 2024-and-earlier sets), WebGPU must be assumed absent on Tizen/webOS until proven on the actual set; design the TV/wall-display tier around WebGL2 (or no WebGL at all on weak SoCs).
- For the iPhone/iPad PWA target WebGPU is very likely usable in standalone mode on iOS 26+ (firt.dev lists it without caveat and Home Screen web apps use the system WebKit), but it should be feature-detected (`navigator.gpu` + `requestAdapter()` non-null) with a WebGL2 path, particularly given the iOS 26.4 GPU-process crash report on iPhone.
- Devices still on iOS 18 or earlier have no WebGPU at all; the fallback also covers them.

### Gaps
- No first-party (Apple/WebKit) statement found that explicitly confirms WebGPU in an installed Home Screen web app; needs an on-device test on current iOS 27.x.
- No authoritative source found for WebGPU on Android TV / Google TV WebView or the Fire TV Silk browser (Fire OS, as opposed to Vega). Could not confirm whether Tizen 10 (M130) or webOS 26 (Chromium 132) builds enable WebGPU.
- Firefox for Android/Linux WebGPU ship dates not confirmed from a Mozilla source.

---

## 2. Three.js in 2025–2026 (WebGPURenderer, TSL, bundle size, post-processing, instancing/BatchedMesh, lighting, particles)

### Takeaway
three.js is at r187 (30 Oct 2026); development focus has moved to `WebGPURenderer` + TSL (importable as `three/webgpu` and `three/tsl` since r171, Nov 2024), with WebXR on the WebGPU renderer since r185 and a native Gaussian-splat addon since r186. The cost is bundle size: a minimal tree-shaken scene is about 121 kB gzip with `WebGLRenderer` versus about 192 kB gzip with `WebGPURenderer` (April 2026 measurement).

### Cited Findings

**Release timeline**
- r182 10 Dec 2025; r183 18 Feb 2026; r184 16 Apr 2026; r185 25 Jun 2026 (patch 1 Jul); r186 8 Sep 2026 (patch 24 Sep); r187 30 Oct 2026; releases in 2026 arrived every 7–11 weeks — [Utsubo, updated 6 Nov 2026](https://www.utsubo.com/blog/threejs-2026-what-changed); [three.js GitHub releases](https://github.com/mrdoob/three.js/releases)
- r171 (29 Nov 2024) added the `three/webgpu` and `three/tsl` entry points — [Utsubo](https://www.utsubo.com/blog/threejs-2026-what-changed)
- The three.js manual says the project's focus has moved to WebGPURenderer with no plans to add larger new features to the older renderer, and recommends staying on the latest release (search snippet; the manual URL returned 404 when fetched directly) — [three.js manual](https://threejs.org/manual/en/webgpurenderer)

**WebGPURenderer / TSL milestones**
- r183: `PostProcessing` renamed `RenderPipeline`; reversed depth buffer; read-write storage textures in TSL; BatchedMesh per-instance opacity; `Clock` deprecated in favour of `Timer`; `WebGLCubeRenderTarget` no longer works with WebGPURenderer — [Utsubo](https://www.utsubo.com/blog/threejs-2026-what-changed)
- r183 added a formal TSL specification document (TSL.md) (search snippet) — [cinevva news, 18 Mar 2026](https://app.cinevva.com/news/2026-03-18-threejs-r183-render-pipeline)
- r184: `compileAsync()` no longer blocks rendering; FSR 1 and TAAU upscaling nodes added; deprecated multi-draw path of BatchedMesh removed; `HTMLTexture` added — [Utsubo](https://www.utsubo.com/blog/threejs-2026-what-changed); [three.js releases](https://github.com/mrdoob/three.js/releases)
- r185: WebXR works on WebGPURenderer; clustered (Forward+) lighting added, `TiledLighting` removed; render-to-texture-array; fuller InstancedMesh support with render bundles; premultiplied-alpha behaviour changed — [Utsubo](https://www.utsubo.com/blog/threejs-2026-what-changed); [three.js releases](https://github.com/mrdoob/three.js/releases)
- r186: `compileComputeAsync()`; MSAA for WebXR and native XR layers; `SunLight` addon with cascaded shadow maps; Gaussian splatting addon; `PCFSoftShadowMap` removed; minified builds removed and `require('three')` logs a deprecation warning; top-level side effects removed for better tree-shaking; `renderer.dispose()` now async — [Utsubo](https://www.utsubo.com/blog/threejs-2026-what-changed); [three.js releases](https://github.com/mrdoob/three.js/releases)
- r187: parallel pipeline compilation in `compileAsync()`; depth-only render targets; BatchedMesh fixes (sort corruption, draw ranges after `setGeometrySize()`, memory leak); TSL automatic type promotion; improved tree-shaking of unused classes — [three.js releases](https://github.com/mrdoob/three.js/releases); [Utsubo](https://www.utsubo.com/blog/threejs-2026-what-changed)
- TSL is "a Node-based shader abstraction, written in JavaScript" that compiles to WGSL (WebGPU) and GLSL (WebGL); supports node materials (`colorNode`, `positionNode`, `outputNode` …), `compute()` with atomics, `instancedArray`/`storage()`/`storageTexture()` — [three.js wiki: TSL](https://github.com/mrdoob/three.js/wiki/Three.js-Shading-Language)
- Not supported on the node/WebGPU path per practitioner notes: `onBeforeCompile` string patching is replaced by node hooks; primitives must be imported from `three/webgpu`; `renderer.init()` is async and must be awaited — [Maxime Heckel](https://blog.maximeheckel.com/posts/field-guide-to-tsl-and-webgpu/)

**Bundle size (three.js CI bot, PR #33419, 19 Apr 2026; units inferred as kB, minified / gzipped)**
- Full ESM build: WebGL 365.32 / 86.79; WebGPU 639.38 / 177.49; WebGPU Nodes 637.49 / 177.2 — [three.js PR #33419](https://github.com/mrdoob/three.js/pull/33419)
- Tree-shaken "minimal build including a renderer, camera, empty scene, and dependencies": WebGL 497.84 / 121.46; WebGPU 711.23 / 192.43; WebGPU Nodes 660.45 / 179.68 — [three.js PR #33419](https://github.com/mrdoob/three.js/pull/33419)

**Post-processing**
- Set up with `new THREE.RenderPipeline(renderer)`, a `pass(scene, camera)` node and an `outputNode` chain; MRT via `scenePass.setMRT(mrt({...}))`; built-in nodes include bloom, dof, fxaa, smaa, traa, ssr, ssgi, GTAO (`ao()`), motion blur, chromatic aberration, outline, transition — [three.js wiki: TSL](https://github.com/mrdoob/three.js/wiki/Three.js-Shading-Language)
- Practitioner view: TSL post-processing was "less documented than expected", relying on examples and trial and error — [Maxime Heckel](https://blog.maximeheckel.com/posts/field-guide-to-tsl-and-webgpu/)
- r186 replaced separable blur with spiral blur in the PMREM/post path; r187 override passes track the source material — [three.js releases](https://github.com/mrdoob/three.js/releases)

**Particles / compute**
- Compute replaces FBO ping-pong GPGPU with a single per-frame compute pass; default workgroup size `[64,1,1]`, 256-invocation limit per workgroup; a 25,000-particle demo and 1,024-instance GPU-positioned grid are described (no benchmarks) — [Maxime Heckel](https://blog.maximeheckel.com/posts/field-guide-to-tsl-and-webgpu/)
- A production installation (Expo 2025 Osaka) simulated about 1 million particles in real time on a 98-inch 4K display — [Utsubo](https://www.utsubo.com/blog/threejs-2026-what-changed)
- A forum thread reports cases where WebGPURenderer was slower than WebGLRenderer; the advice is to profile before migrating for speed alone — [Utsubo](https://www.utsubo.com/blog/threejs-2026-what-changed)

**Gaussian splats in core**
- r186 addon: `GaussianSplatMesh` (WebGPU/TSL NodeMaterial) with GPU counting sort in four TSL compute passes; loaders `SPZLoader`, `PLYLoader` helper, `SPLATLoader`, `KSPLATLoader`, `GLTFGaussianSplatLoaderExtension` (KHR_gaussian_splatting); about 7 kB on top of base three.js; limitations: SH0 colour only, no LoD, no streaming, no workers — [radiancefields.com](https://radiancefields.com/three.js-merges-a-native-gaussian-splat-renderer-for-webgpu-in-r186)

**HTML in 3D**
- `THREE.HTMLTexture` (experimental) maps a live DOM element into a material via Chrome's HTML-in-Canvas API; added r184, updated for new WICG signatures in r185 — [three.js releases](https://github.com/mrdoob/three.js/releases); [Chrome for Developers](https://developer.chrome.com/blog/html-in-canvas)

**Ecosystem scale**
- three: about 12.18 M npm downloads/week (15–21 Sep 2026) versus @babylonjs/core 314,621 and playcanvas 56,681; 600+ official examples of which 230 are WebGPU — [Utsubo](https://www.utsubo.com/blog/threejs-2026-what-changed)

**Upgrade gotchas (r182–r187)**
- Replace `PCFSoftShadowMap` with `PCFShadowMap` and re-tune `shadow.bias`; `rangeFog()` and `viewportResolution` TSL exports deleted; call `super.dispose()` in custom Object3D subclasses; upgrade in steps of 10 releases or fewer — [Utsubo](https://www.utsubo.com/blog/threejs-2026-what-changed)

### Inferences
- For a small-bundle PWA, choosing `WebGLRenderer` saves roughly 70 kB gzip over `WebGPURenderer` for a minimal scene, but forgoes TSL, compute particles, the node post-processing stack and the core splat addon. Since WebGPURenderer carries its own WebGL2 backend, a single `three/webgpu` code path can serve iOS 26+, desktop and TV fallback at about 190 kB gzip plus scene code, all in a lazy chunk.
- The PR-bot "Full ESM build" WebGL figure (86.79 kB gz) being smaller than the tree-shaken minimal build (121.46 kB gz) suggests the "full" figure excludes the shared `three.core` chunk; treat 121 kB / 192 kB as the realistic minimums.
- BatchedMesh is in active maintenance (per-instance opacity r183, fixes in r186 and r187) and is a reasonable basis for many-object scenes such as per-device markers.

### Gaps
- No source located on baked lighting / lightmap blending (e.g. cross-fading day/night lightmaps) in TSL; would need the three.js examples or forum.
- No official statement found declaring WebGPURenderer "stable"/non-experimental at a specific release; third-party blogs disagree (r171 versus "Safari 26 made it production ready").
- No measured gzip size for a realistic scene (GLTFLoader + controls + post-processing) was found; must be measured in the actual Vite build.
- The official three.js manual page could not be fetched (404), so its exact wording is unverified.

---

## 3. Threlte (Svelte) and alternatives (Babylon.js, PlayCanvas, Spline, Needle, model-viewer, raw three, svelte-cubed, R3F)

### Takeaway
Threlte 8 (released early 2025, Svelte 5-only) is actively maintained: `@threlte/core` 8.7.0 and `@threlte/extras` 9.23.1 were published 2 Nov 2026, the autumn 2026 releases added WebGPU entry points across core and extras, and rendering is on-demand by default. Among alternatives, Babylon.js 9 and PlayCanvas 2.x are complete engines with strong splat support but no Svelte bindings; Spline and Rive-style runtimes are heavy (Spline about 548 kB gzip).

### Cited Findings

**Threlte**
- "Threlte 8 is out and is more performant, flexible and aligned with Svelte 5" — [Svelte blog, Feb 2025](https://svelte.dev/blog/whats-new-in-svelte-february-2025)
- Threlte 8 adds Svelte 5 support and removes Svelte 4 support (search snippet) — [Threlte migration guide](https://threlte-git-studio-threlte.vercel.app/docs/learn/advanced/migration-guides)
- The unscoped `threlte` npm package is deprecated in favour of `@threlte/core` and `@threlte/extras` — [npm](https://npmjs.com/package/threlte)
- Packages: `@threlte/core` (the `<T>` component, declarative wrapper for any three class, plugin system), `@threlte/extras` (components/plugins), `@threlte/gltf` (CLI turning GLTF into components), `@threlte/rapier` (physics), `@threlte/theatre` (Theatre.js animation), `@threlte/xr` (VR/AR), `@threlte/flex` (yoga-layout flexbox in 3D), `@threlte/studio` — [Threlte docs](https://threlte.xyz/docs/learn/getting-started/introduction)
- Latest releases: `@threlte/core` 8.7.0 and `@threlte/extras` 9.23.1 (2 Nov 2026); `@threlte/rapier` 3.5.1 and `@threlte/studio` 0.4.4 (24 Sep 2026, type fixes against three r183+) — [Threlte GitHub releases](https://github.com/threlte/threlte/releases)
- WebGPU: `@threlte/extras` 9.22.0 (24 Sep 2026) added a `@threlte/extras/webgpu` entry point where unsupported components "throw explicit runtime errors"; 9.22.1–9.22.4 (Oct 2026) added WebGPU support to `<Gizmo>`, `<CSM>`, `<BakeShadows>`, `<MeshLineMaterial>`, `<CubeCamera>` and fixed `<View>` — [Threlte GitHub releases](https://github.com/threlte/threlte/releases)
- TSL usage imports `Canvas`, `T`, `useTask`, `useThrelte` from `@threlte/core/webgpu`, materials from `three/webgpu`, nodes from `three/tsl`; nodes can be passed as props (e.g. `outputNode`) on `<T.MeshPhysicalNodeMaterial>` — [Threlte docs: TSL](https://threlte.xyz/docs/learn/advanced/webgpu)
- Render modes: `'on-demand'` is the default and recommended; Threlte invalidates automatically on prop changes and mount/unmount; `useTask` invalidates every frame unless `autoInvalidate: false`; `'manual'` uses `advance()`; `'always'` is "the most resource-intensive" — [Threlte docs: render modes](https://threlte.xyz/docs/learn/basics/render-modes)
- `<Canvas>` defaults: `renderMode='on-demand'`, `dpr=window.devicePixelRatio` (accepts `[min,max]` clamp), `toneMapping=AgXToneMapping`, `shadows=PCFSoftShadowMap`, `createRenderer(canvas)` for a custom renderer — [Threlte docs: Canvas](https://threlte.xyz/docs/reference/core/canvas)
- Threlte 8 shipped with the first alpha of Threlte Studio, a "spatial programming toolset" (search snippet) — [Hacker News mirror](https://nextjs-hackernews.vercel.app/item/42813264)

**svelte-cubed**
- The repository is public and not archived, has 116 commits and a README describing "A Three.js component library for Svelte"; no Svelte 5 statement, releases or recent-activity data visible — [GitHub](https://github.com/Rich-Harris/svelte-cubed)

**Babylon.js**
- Babylon.js 9.0 released 26 Mar 2026: clustered lighting on both WebGPU and WebGL2, volumetric light shafts, Frame Graph, Node Particle Editor; splats can cast shadows, SOG/SOGS support, triangle splatting (search snippets) — [cinevva](https://app.cinevva.com/news/2026-03-26-babylonjs-9); [radiancefields.com](https://radiancefields.com/babylon.js-v9.0-3dgs-gets-shadows-sogs-and-triangle-splatting-support-announced)
- Later 9.x point releases reportedly added WebGPU XR features and Gaussian-splat LOD streaming (9.21.0) (search snippet, aggregator) — [gamedev.net](https://gamedev.net/news/5529/)

**PlayCanvas**
- Engine v2.19.0 shipped a compute-based WebGPU splat renderer (June 2026); engine v2.23.0 reported in Oct 2026; engine, SuperSplat and splat-transform are MIT — [PlayCanvas blog](https://blog.playcanvas.com/new-in-supersplat-webgpu-and-streaming-bring-huge-performance-wins); [radiancefields.com](https://radiancefields.com/playcanvas-engine-v2.23.0-returns-gaussian-splat-lod-to-distance-only-selection)
- `@playcanvas/web-components` (declarative `<pc-app>`, `<pc-splat>` etc.) at v0.28.0; the minified `pwc.min.mjs` is "under a third the size of pwc.mjs"; each release pins a range of engine versions as a peer dependency (search snippets) — [PlayCanvas API reference](https://api.playcanvas.com/web-components/); [PlayCanvas docs](https://developer.playcanvas.com/user-manual/web-components/getting-started/)

**Spline**
- `@splinetool/runtime` about 1,967 kB minified / 548 kB gzip (v1.12.97, third-party measurement); official wrappers found only for React; guides advise lazy-loading (search snippet) — [DepScope](https://depscope.dev/pkg/npm/@splinetool/runtime)

**Needle Engine**
- Built as a web component on three.js; bundles Rapier, whose removal "reduces the overall bundle size by ~2MB (~600KB when gzipping)"; Rapier is lazily loaded at runtime; npm package `@needle-tools/engine` 5.0.x (search snippets) — [Needle docs](https://engine.needle.tools/docs/html.html); [Needle Vite plugin reference](https://engine.needle.tools/docs/reference/needle-vite-plugin)

**model-viewer**
- `@google/model-viewer` (4.2.0 README on jsDelivr) has three.js as a peer dependency and maintainers strongly recommend locking three to the version they test against; a competitor's page lists it at about 200 kB without stating gzip or version (search snippets) — [npm](https://npmjs.com/package/@google/model-viewer); [SceneView comparison](https://sceneview.github.io/web.html)

**React Three Fiber (comparison only)**
- R3F v9 requires an async `gl` factory that awaits `renderer.init()` for WebGPU; lights had to be added imperatively and `extend` was still being troubleshot by the author — [Maxime Heckel](https://blog.maximeheckel.com/posts/field-guide-to-tsl-and-webgpu/)

### Inferences
- Threlte's default `shadows=PCFSoftShadowMap` collides with three r186 removing `PCFSoftShadowMap`; pin a three version Threlte's current release is tested against, or set `shadows` explicitly. The September 2026 "type fixes against r183+" suggest Threlte tracks three with a lag of a few releases.
- For this project Threlte is the lowest-friction path (Svelte 5 runes, on-demand rendering by default, WebGPU entry points) and, like raw three, can live entirely in a dynamically imported route chunk. Raw three inside a Svelte `$effect`/action remains viable for a single canvas and avoids Threlte's wrapper layer; no size figures for Threlte itself were found.
- Babylon.js and PlayCanvas would each add a second, self-contained engine with no Svelte integration; only justified if their splat pipeline (SOG streaming, shadows) is the centrepiece.

### Gaps
- No published bundle sizes found for `@threlte/core`/`extras`, Babylon.js 9 (tree-shaken) or the PlayCanvas engine.
- svelte-cubed's last commit date and Svelte 5 compatibility could not be read from the page; whether it is effectively dead is unconfirmed (it has no visible releases).
- `@threlte/xr`, `@threlte/theatre` and `@threlte/flex` current versions not captured; the dedicated Threlte WebGPU reference page (renderer setup, async init) was not located.
- The specific three.js version range supported by Threlte 8.7 is not stated in the pages read.

---

## 4. Gaussian splat rendering on the web in 2026

### Takeaway
Spark (World Labs, three.js + WebGL2, v2.x with LoD streaming and the .RAD format) is the de-facto three.js splat renderer and the designated successor to the now-unmaintained GaussianSplats3D; PlayCanvas/SuperSplat with Streamed SOG is the strongest non-three pipeline and has published iPhone numbers (about 78 fps at 1 M splats and 42 fps at 4 M with WebGPU on an iPhone 13 Pro Max). Practical mobile budgets are 1–3 M splats, and the Khronos `KHR_gaussian_splatting` glTF extension reached release candidate in Feb 2026 with a reported (unannounced) ratification in Sept 2026.

### Cited Findings

**Spark**
- Spark is "a dynamic 3D Gaussian Splatting renderer for THREE.js and WebGL2"; `SplatMesh` derives from `THREE.Object3D` and renders with normal meshes in the regular `render(scene, camera)` call with correct sorting between splat objects; reads .PLY (incl. compressed), .SPZ, .SPLAT, .KSPLAT; programmable via `Dyno` shader-graph blocks compiled to GLSL — [Spark docs](https://sparkjs.dev/docs/overview/)
- The Spark README also lists SOG and links PlayCanvas's SOG docs; MIT-licensed (search snippet) — [Spark GitHub](https://github.com/sparkjsdev/spark)
- Spark 2.0 (blog dated 14 Apr 2026): continuous LoD splat tree with per-frame budget, foveated detail, progressive streaming starting from about 64 K splats, virtual-memory paging with a fixed 16 M-splat GPU pool and LRU eviction of 64 K-splat chunks; default LoD budget 500 K–2.5 M splats by device type; most consumer devices render about 1–5 M splats interactively; WebGL2 chosen because WebGPU "is not available on all devices" — [World Labs blog](https://worldlabs.ai/blog/spark-2.0)
- Device budgets: Quest 3 ≤1 M; Android phone 1–2 M; iPhone 1–3 M; computer 1–5 M (10–20 M+ on some desktops); keep `antialias: false`; reconsider high DPR for splat-heavy scenes; `maxStdDev` can drop from √8 to √5 for VR — [Spark performance docs](https://sparkjs.dev/docs/performance/)
- Spark version reported as 2.4.0 in late Oct 2026 — [radiancefields.com](https://radiancefields.com/spark-radix-brings-webgpu-splat-rendering-to-threejs)
- Spark Radix 0.0.1 (World Labs, experimental): WebGPU splat renderer drawing through three r186 `WebGPURenderer`, GPU sort, single draw call; WebGL2 fallback with worker sort; 1.37× faster than Spark on WebGPU across five 0.5–10 M scenes on an M3 Max (10 M-splat interior 9.2 ms versus 16.5 ms); lacks LoD, skinning, built-in raycasting, SDF edits and SPLAT/KSPLAT/SOG formats — [radiancefields.com](https://radiancefields.com/spark-radix-brings-webgpu-splat-rendering-to-threejs)

**File formats**
- .PLY about 2.3 GB for 10 M splats with SH0–3; .SPZ about 200–250 MB for the same and not progressively loadable; .RAD (new in Spark 2.0) is streamable/random-access in 64 K-splat chunks — [World Labs blog](https://worldlabs.ai/blog/spark-2.0)
- SOG is typically about 15–20× smaller than the equivalent PLY (third-party reference, search snippet) — [3dtiled docs](https://docs.3dtiled.iconem.com/docs/references/3dgs-splats/sog)
- Streamed SOG = spatial chunks at multiple LODs indexed by `lod-meta.json`; produced by `splat-transform`; loading that file onto a GSplat component enables streaming with no further configuration (search snippets) — [PlayCanvas docs](https://developer.playcanvas.com/user-manual/gaussian-splatting/formats/streamed-sog/)

**PlayCanvas / SuperSplat**
- Compute-based WebGPU renderer (cull, project, GPU radix sort) in engine v2.19.0; WebGL2 fallback renders identically — [PlayCanvas blog, 3 Jun 2026](https://blog.playcanvas.com/new-in-supersplat-webgpu-and-streaming-bring-huge-performance-wins)
- iPhone 13 Pro Max at 642×1126: WebGL2 38.1 / 35.5 / 25.5 / 20.4 fps and WebGPU 77.6 / 73.2 / 52.7 / 42.4 fps at 1 / 2 / 3 / 4 M splats (about 2× speed-up) — [PlayCanvas blog](https://blog.playcanvas.com/new-in-supersplat-webgpu-and-streaming-bring-huge-performance-wins)
- Apple M4 Max at 1298×962: WebGL2 137 fps at 1 M falling to 48 fps at 10 M and 13 fps at 35 M; WebGPU 139 fps at 1 M, 124 fps at 10 M, 76 fps at 35 M (up to 5.7×) — [PlayCanvas blog](https://blog.playcanvas.com/new-in-supersplat-webgpu-and-streaming-bring-huge-performance-wins)
- SuperSplat converts every upload to Streamed SOG; scenes of about 1 M Gaussians or more get LODs with the count halved per level; the Gaussian budget adapts to the device — [PlayCanvas blog](https://blog.playcanvas.com/new-in-supersplat-webgpu-and-streaming-bring-huge-performance-wins); [PlayCanvas streaming docs](https://developer.playcanvas.com/user-manual/supersplat/streaming/)

**Other renderers**
- GaussianSplats3D (mkkellogg): README says "this repo is no longer in active development" and recommends Spark; CPU sort causes artifacts in fast motion; shared-memory sort worker needs COOP/COEP headers unless `sharedMemoryForWorkers: false`; "performance on mobile devices is sub-optimal" — [GitHub](https://github.com/mkkellogg/GaussianSplats3D)
- Luma web library (`@lumaai/luma-web`, `LumaSplatsThree`): repository archived by its owner on 2 Apr 2025 (read-only) — [GitHub](https://github.com/lumalabs/luma-web-examples)
- gsplat.js (Hugging Face): WebGL renderer for .splat/.ply; 62 commits, no releases shown, 38 open issues — [GitHub](https://github.com/huggingface/gsplat.js)
- three.js native addon (r186): WebGPU/TSL, SH0 only, no LoD/streaming — [radiancefields.com](https://radiancefields.com/three.js-merges-a-native-gaussian-splat-renderer-for-webgpu-in-r186)
- Babylon.js 9: splat shadows, SOG/SOGS, .splat/.ply/.spz (search snippet) — [radiancefields.com](https://radiancefields.com/babylon.js-v9.0-3dgs-gets-shadows-sogs-and-triangle-splatting-support-announced)

**Khronos standardisation**
- Khronos announced a `KHR_gaussian_splatting` release candidate on 3 Feb 2026 (search snippet) — [radiancefields.com](https://radiancefields.com/the-khronos-group-introduces-a-gltf-baseline-for-gaussian-splatting)
- One source says the extension became "Complete, Ratified" on 3 Sep 2026 via a registry commit with no press release (search snippet; single weak source) — [radiancefields.com](https://radiancefields.com/platforms/the-khronos-group)
- The base extension does not define compression; an SPZ child extension (`KHR_gaussian_splatting_compression_spz_2`) exists; CesiumJS 1.139 and Cesium for Unreal 2.23.0 shipped support in March 2026 (search snippets) — [3dtiled docs](https://docs.3dtiled.iconem.com/docs/references/3dtiles-gltf/3dgs-extension-lineage); [radiancefields.com](https://radiancefields.com/cesium-brings-khr_gaussian_splatting-support-to-cesiumjs-and-unreal-engine)

**Mobile memory**
- Forum reports: large .ply failing to load on iPhone 13 (iOS 18.1.1), with the reply that "Safari is notoriously tight on memory" and compression as the fix (search snippet) — [PlayCanvas forum](https://forum.playcanvas.com/t/solved-large-3d-gaussian-splatting-file-doesnt-load-on-mobile/38758)
- World Labs notes mobile browsers cap GPU memory use, which limits shareable world sizes — [World Labs blog](https://worldlabs.ai/blog/spark-2.0)

### Inferences
- A splat capture of a home (rooms scanned with a phone) at 1–3 M splats in SPZ/SOG/RAD is feasible on recent iPhones/iPads at interactive rates, and Spark lets ordinary three meshes (device markers, labels, highlight volumes) share the scene. Click targets should be invisible proxy meshes raycast with the normal three raycaster rather than relying on splat picking (Spark's own raycasting support was not confirmed in the pages read; Radix explicitly lacks it).
- Spark targets `WebGLRenderer`, whereas the TSL/compute/post-processing stack targets `WebGPURenderer`; combining splats with TSL effects today means either Spark Radix (experimental 0.0.1) or the SH0-only core addon. This is the main architectural fork for a splat-based concept.
- Splats are a poor fit for the low-power TV tier: even an iPhone 13 Pro Max manages only about 38 fps at 1 M splats on WebGL2.

### Gaps
- No Spark bundle size (kB) found. No integrated-GPU (Intel/AMD iGPU) benchmark found for any renderer.
- Spark raycasting/picking API was not confirmed from the docs pages read.
- KHR_gaussian_splatting ratification is reported by a single secondary source; not verified against the Khronos registry.
- No authoritative Safari per-tab GPU/JS memory ceiling found; iOS evidence is anecdotal.

---

## 5. Modern CSS / DOM platform features for immersive non-WebGL UI (support as of late 2026)

### Takeaway
By November 2026 the big four are all in iOS Safari and Chromium: same-document View Transitions (Baseline Oct 2025), scroll-driven animations (Baseline 27 Oct 2026 with Firefox 159), anchor positioning (Safari 26, Firefox 147) and `@starting-style`/popover/invoker commands; the Chromium-only frontier is element-scoped and nested view transitions, `interpolate-size`, `corner-shape` and HTML-in-Canvas (stable in Chrome 157).

### Cited Findings

| Feature | Chrome/Edge | Safari (macOS + iOS) | Firefox | Baseline status | Source |
|---|---|---|---|---|---|
| Same-document View Transitions | 111 | 18 (16 Sep 2024) | 144 (14 Oct 2025) | Newly available 14 Oct 2025 | [web-features](https://web-platform-dx.github.io/web-features-explorer/features/view-transitions) |
| Cross-document View Transitions | 126 | 18.2 (11 Dec 2024) | Not supported | Limited; "blocked … by Firefox (23 months)" | [web-features](https://web-platform-dx.github.io/web-features-explorer/features/cross-document-view-transitions) |
| `view-transition-class` | 125 | 18.2 | 144 | Newly available 14 Oct 2025 | [web-features](https://web-platform-dx.github.io/web-features-explorer/features/view-transition-class) |
| `view-transition-name: match-element` | 137 | 18.4 | 144 | — | [Chrome blog, 8 Oct 2025](https://developer.chrome.com/blog/view-transitions-in-2025) |
| `document.activeViewTransition` | 142 | 26.2 | 147 | — | [Chrome blog](https://developer.chrome.com/blog/view-transitions-in-2025); [WebKit 26.2](https://webkit.org/blog/17640/webkit-features-for-safari-26-2/) |
| Nested view transition groups | 140 | Not supported (per Chrome docs) | Not supported | — | [Chrome docs](https://developer.chrome.com/docs/css-ui/view-transitions/nested-view-transition-groups) |
| Element-scoped view transitions (`element.startViewTransition()`) | 147 stable (post dated 27 Mar 2026) | Not supported (as of Oct 2025 table) | Not supported | — | [Chrome blog](https://developer.chrome.com/blog/element-scoped-view-transitions); [Chrome blog 2025 update](https://developer.chrome.com/blog/view-transitions-in-2025) |
| Scroll-driven animations (`animation-timeline`) | 115 | 26 (15 Sep 2025) | 159 (27 Oct 2026) | Newly available 27 Oct 2026 | [web-features](https://web-platform-dx.github.io/web-features-explorer/features/scroll-driven-animations) |
| CSS anchor positioning | (see conflict note) | 26.0 | 147 (13 Jan 2026) | Conflicting, see below | [WebKit 26.0](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/); [MDN Firefox 147](https://developer.mozilla.org/en-US/Firefox/Releases/147) |
| `@starting-style` | 117 | 17.5 | 129 | Newly available 6 Aug 2024 | [web-features](https://web-platform-dx.github.io/web-features-explorer/features/starting-style) |
| `interpolate-size` | 129 | Not supported | Not supported | Limited | [web-features](https://web-platform-dx.github.io/web-features-explorer/features/interpolate-size) |
| Popover API | 116 | 17 (iOS: 18.3) | 125 | Newly available 27 Jan 2025 | [web-features](https://web-platform-dx.github.io/web-features-explorer/features/popover) |
| Invoker commands (`command`/`commandfor`) | 135 | 26.2 (12 Dec 2025) | 144 | Newly available 12 Dec 2025 | [web-features](https://web-platform-dx.github.io/web-features-explorer/features/invoker-commands) |
| `linear()` easing | 113 | 17.2 | 112 | Widely available 11 Jun 2026 | [web-features](https://web-platform-dx.github.io/web-features-explorer/features/linear-easing) |
| `light-dark()` | 123 | 17.5 | 120 | Newly available 13 May 2024 (widely available due 13 Nov 2026) | [web-features](https://web-platform-dx.github.io/web-features-explorer/features/light-dark) |
| CSS `shape()` | 135 | 18.4 | 148 | Newly available 24 Feb 2026 (search snippet) | [web-features](https://web-platform-dx.github.io/web-features-explorer/features/shape-function); [web.dev Feb 2026 digest](https://web.dev/blog/baseline-digest-feb-2026) |
| `corner-shape` | 139 (5 Aug 2025) | Not supported | Not supported | Limited | [web-features](https://web-platform-dx.github.io/web-features-explorer/features/corner-shape) |
| HTML-in-Canvas | 157 stable (origin trial 148–151) | — | — | Chromium only | [Chrome blog, 26 Oct 2026](https://developer.chrome.com/blog/html-in-canvas); [Chrome origin-trial post](https://developer.chrome.com/blog/html-in-canvas-origin-trial) |

- Anchor positioning conflict: MDN states it is "enabled by default" in Firefox 147 and web.dev says Firefox 147 made it "Baseline Newly available" (Jan 2026), with Safari support from 26.0; yet the web-features explorer page currently shows "Limited availability", Chrome 157, Safari 27 and Firefox "not supported" — [MDN](https://developer.mozilla.org/en-US/Firefox/Releases/147); [web.dev, Jan 2026](https://web.dev/blog/web-platform-01-2026); contradicted by [web-features explorer](https://web-platform-dx.github.io/web-features-explorer/features/anchor-positioning)
- Safari anchor-positioning increments: 26.0 `position-area`, `anchor()`, `position-try`; 26.1 "a dozen improvements" (search snippet); 26.2 `flip-x`/`flip-y`, `position-visibility`; 27.0 follows transformed anchors, `position-anchor` defaults to `normal`, adds `anchor-valid`/`anchor-visible` — [WebKit 26.0](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/); [WebKit 26.2](https://webkit.org/blog/17640/webkit-features-for-safari-26-2/); [WebKit 27.0](https://webkit.org/blog/18325/webkit-features-for-safari-27-0/)
- Safari 26.2 also added `random()`, `sibling-index()`/`sibling-count()`, `field-sizing: content`, `scrollend`, the Navigation API, Web Animations `overallProgress` and `commitStyles()` on completed animations — [WebKit 26.2](https://webkit.org/blog/17640/webkit-features-for-safari-26-2/)
- Safari 27.0 added customizable `<select>` (`appearance: base-select`), `stretch` sizing keyword, `light-dark()` with images, multi-colour `color-mix()`, scroll anchoring, `<model>` on iOS/iPadOS/macOS, canvas `srgb-linear` and `display-p3-linear` colour spaces, and better HDR gain-map rendering; the visible feature list contains no new View Transition features (only a snapshot fix) — [WebKit 27.0](https://webkit.org/blog/18325/webkit-features-for-safari-27-0/)
- HDR/P3: Safari 26.0 "adds support for HDR images on the web" including in WebGPU canvas, plus `dynamic-range-limit` (`no-limit`, `standard`) — [WebKit 26.0](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/)
- Scoped view transitions: scope element is self-participating, nested pseudos are contained automatically, and overlapping scopes can run concurrently (search snippet) — [Chrome docs](https://developer.chrome.com/docs/css-ui/view-transitions/element-scoped-view-transitions)
- HTML-in-Canvas API surface (Chrome 157): `drawElementImage()` for 2D, `updateElementGeometry()` to sync DOM hit-testing for WebGL/WebGPU, a canvas `paint` event; three.js (`THREE.HTMLTexture`) and PlayCanvas integrations are community/experimental; feature detection and fallbacks recommended — [Chrome blog](https://developer.chrome.com/blog/html-in-canvas)
- `corner-shape`: Chromium-only as of mid-2026; Mozilla "intent to prototype" dated Sept 2026 (search snippets) — [Smashing Magazine, Mar 2026](https://www.smashingmagazine.com/2026/03/beyond-border-radius-css-corner-shape-property-ui/); [mozilla dev-platform](https://groups.google.com/a/mozilla.org/g/dev-platform/c/IQX3aJ5tujE)
- `interpolate-size` and `calc-size()` shown as unsupported in Firefox and Safari in an Interop 2027 proposals article (search snippet) — [buildmvpfast.com](https://www.buildmvpfast.com/blog/interop-2027-css-proposals-border-shape-function-if-browser-support-2026)
- Safari 27.1 (23 Oct 2026) previews Device Posture and Viewport Segments APIs behind flags for a foldable "iPhone Duo"; viewport width ranges 382–951 CSS px depending on pose — [WebKit 27.1](https://webkit.org/blog/18486/webkit-features-for-safari-27-1/)

### Inferences
- Safe on every primary target (iOS 26+/27 Safari and current Chromium): same-document view transitions with classes and `match-element`, scroll-driven animations, anchor positioning, popover + invoker commands, `@starting-style`, `linear()` springs, `light-dark()`, `shape()`. Cross-document transitions are irrelevant to an SPA.
- Progressive-enhancement only (Chromium desktop gets them, iOS does not): element-scoped/nested view transitions, `interpolate-size`/`calc-size()`, `corner-shape`, HTML-in-Canvas. A design that depends on concurrent per-card view transitions will not work on iPhone/iPad as of Safari 27.2.
- TV browsers lag badly: a 2025 Tizen/webOS set (Chromium 120) has view transitions (111), scroll-driven animations (115), popover and `@starting-style` (116/117) and `linear()` (113) but not anchor positioning, `light-dark()` (123), `interpolate-size` or invoker commands (135); a 2024 set (M108) has none of these. This is derived by comparing the vendor engine versions in section 1 with the Chrome version column above.
- The anchor-positioning discrepancy most plausibly reflects the web-features definition being widened to newer sub-features (the 157/27 versions match the Safari 27 additions), not a regression; core anchor positioning should be treated as available in Safari 26+, Firefox 147+ and Chromium.

### Gaps
- No sources gathered on the runtime cost of `backdrop-filter`, CSS 3D transforms/`preserve-3d` compositing, or Houdini paint worklets (support and performance); these remain unverified.
- Whether Safari 27.x supports nested view-transition groups or scoped transitions was not confirmed from a 2026 WebKit source (the Chrome tables saying "not supported" date from Oct 2025 – Mar 2026).
- Chrome-side HDR canvas / P3 status and CSS custom shaders were not researched. Interop 2026 focus-area list was not retrieved in full.

---

## 6. Animation and motion tooling (Motion, GSAP, Rive, Lottie, Theatre.js, Svelte 5 motion, WAAPI, physics)

### Takeaway
For a zero-dependency Svelte 5 app the built-in `Spring`/`Tween` classes (since 5.8) plus CSS `linear()` and the Web Animations API cover most UI motion at no bundle cost; GSAP is now free including all former Club plugins but under a proprietary Webflow "no charge" licence, Motion's mini `animate()` is 3.2 kB, and Rive is the heavyweight option (222–648 kB Brotli of mostly WASM).

### Cited Findings

**Svelte 5 built-ins**
- `Spring` and `Tween` classes available since Svelte 5.8.0: `new Spring(value, { stiffness, damping, precision })`, `.target` (read/write), `.current` (read-only), `set(value, { instant, preserveMomentum })` returning a promise, `Spring.of(fn)` / `Tween.of(fn)` bound to reactive state; `Tween` takes `delay`, `duration`, `easing`, `interpolate` — [Svelte docs](https://svelte.dev/docs/svelte/svelte-motion)
- `prefersReducedMotion` media query object since 5.7.0; the old `spring()`/`tweened()` stores are deprecated — [Svelte docs](https://svelte.dev/docs/svelte/svelte-motion)

**Motion (motion.dev)**
- Package `motion`; vanilla imports `animate`, `scroll`, `stagger`; spring via `type: "spring"`; the mini HTML/SVG `animate()` is "just 3.2kb"; some AI-kit features (inline bezier editing, CSS spring generation) need paid Motion+ — [Motion docs](https://motion.dev/docs/quick-start)

**GSAP**
- Webflow made GSAP free for everyone, including previously paid Club plugins — [Webflow blog](https://webflow.com/blog/gsap-becomes-free)
- Standard "no charge" licence: effective 30 Apr 2025 (last modified 30 May 2025); commercial use covered; includes ScrollTrigger, ScrollSmoother, Flip, Draggable, Inertia, MorphSVG, DrawSVG, SplitText, MotionPath, Physics2D, GSDevTools etc.; proprietary (Webflow retains all IP, not MIT); prohibits use in tools that let people build visual animations without code where it "materially assists" a competitor to Webflow's animation builder; Webflow may amend or terminate — [GSAP standard licence](https://gsap.com/community/standard-license/)
- All plugins are in the public `gsap` npm package (a `gsap@3.15.0` README exists); `gsap-trial` is deprecated (search snippets) — [jsDelivr](https://cdn.jsdelivr.net/npm/gsap@3.15.0/README.md); [npm gsap-trial](https://npmjs.com/package/gsap-trial)

**Rive**
- Runtime sizes (last updated Jan 2026; uncompressed / Brotli -9): `canvas-lite` 707 kB / 222 kB; `canvas` 1,728 kB / 567 kB; `webgl2` 2,179 kB / 648 kB; most of each is the WASM library — [Rive docs: runtime sizes](https://rive.app/docs/runtimes/runtime-sizes.md)
- `@rive-app/canvas-lite` omits Rive Text, Layouts, Audio and Scripting; the web runtime supports state machines and data binding (`autoBind`, view models, `bindViewModelInstance`) (search snippets) — [Rive docs: web](https://rive.app/docs/runtimes/web/web-js)
- No official Svelte package was found; third-party guidance is to use the canvas runtime from a Svelte action (search snippet) — [Rive docs: web runtimes](https://rive.app/docs/runtimes/web/)

**Lottie / dotLottie**
- `@lottiefiles/dotlottie-web` now has software, WebGL2 and WebGPU backends powered by ThorVG (May 2026 post); ThorVG 1.0 released 30 Jan 2026; older v0.x docs estimate the WASM engine at roughly 500 kB compressed (search snippets) — [LottieFiles blog](https://lottiefiles.com/blog/working-with-lottie-animations/hardware-accelerated-lottie-on-the-web-dotlottie-web-now-ships-webgl-webgpu); [LottieFiles docs](https://docs.lottiefiles.com/en/runtimes/distributions/js/v0.x/core-concepts.md)

**Theatre.js**
- The GitHub README still says "Theatre.js 1.0 is around the corner"; `@theatre/studio` is AGPL-3.0 (search snippet) — [GitHub](https://github.com/theatre-js/theatre)

**Web Animations API / CSS**
- `linear()` easing (for CSS spring curves) is Baseline Widely available since 11 Jun 2026 — [web-features](https://web-platform-dx.github.io/web-features-explorer/features/linear-easing)
- Safari 26.2 added Web Animations `overallProgress` and `commitStyles()` on completed animations; Safari 27.0 exposes `animation` on `AnimationEvent`/`TransitionEvent` — [WebKit 26.2](https://webkit.org/blog/17640/webkit-features-for-safari-26-2/); [WebKit 27.0](https://webkit.org/blog/18325/webkit-features-for-safari-27-0/)

**Physics**
- Rapier (WASM) costs about 2 MB (about 600 kB gzip) when bundled, per Needle Engine's docs; `@threlte/rapier` 3.5.1 wraps it for Threlte — [Needle docs](https://engine.needle.tools/docs/html.html); [Threlte releases](https://github.com/threlte/threlte/releases)

### Inferences
- Default stack for this project: Svelte `Spring`/`Tween` + CSS transitions/`@starting-style` + view transitions + scroll-driven animations, adding Motion's mini `animate()` (3.2 kB) only if sequencing/stagger is needed. GSAP is technically free but its revocable proprietary licence is a consideration for a long-lived personal project; it is not a legal blocker for a private dashboard.
- Rive (≥222 kB Brotli) or dotLottie (about 500 kB) should only be loaded lazily for specific hero/character animations; neither is justified for micro-interactions.
- Theatre.js looks stalled before 1.0 and its studio is AGPL; `@threlte/theatre` inherits that risk.

### Gaps
- GSAP core gzip size, Motion's "hybrid" `animate()` size and Motion's licence text were not captured; Motion's current major version was not confirmed (docs show a placeholder 11.x script tag).
- Matter.js status/size not researched. Rapier's own published size not checked (figure is via Needle).
- Theatre.js last-release date and maintenance state not confirmed beyond the README banner. No official Rive–Svelte 5 integration confirmed either way.

---

## 7. Device and ambient APIs from a PWA: iOS Safari versus Chromium

### Takeaway
iOS installed web apps now have Wake Lock (18.4+ in standalone), Web Push and badging (16.4+, installed only), WebGPU (26+), WebRTC/MSE, speech synthesis and (cloud) speech recognition, but still lack the Vibration API, iPhone Fullscreen, Web Bluetooth, WebXR, Document PiP, Idle Detection, Window Management and any built-in LLM API; the `<input switch>` haptic trick is reported patched in iOS 26.5. Chromium desktop has nearly all of these, with the Prompt API (Gemini Nano) on the web from Chrome 148 on capable desktops only.

### Cited Findings

| API | iOS/iPadOS Safari + Home Screen web app | Chromium (desktop / Android) | Source |
|---|---|---|---|
| Screen Wake Lock | Safari 16.4; works in installed web apps only from 18.4 | Chrome 84 | [firt.dev](https://firt.dev/notes/pwa-ios/); [web-features](https://web-platform-dx.github.io/web-features-explorer/features/screen-wake-lock) |
| Fullscreen API | iPad only (since iOS 8); manifest `display: fullscreen` falls back to `standalone` | Supported | [firt.dev](https://firt.dev/notes/pwa-ios/) |
| Screen orientation | Screen Orientation API partial since 16.4; manifest `orientation` lock not supported | Supported | [firt.dev](https://firt.dev/notes/pwa-ios/) |
| Vibration API | Not supported (WebKit position: oppose) | Chrome 32 desktop/Android; Firefox no | [web-features](https://web-platform-dx.github.io/web-features-explorer/features/vibration); [firt.dev](https://firt.dev/notes/pwa-ios/) |
| DeviceOrientation/Motion | Supported with `DeviceOrientationEvent.requestPermission()`, which needs transient activation (user gesture) and a secure context | No permission call needed | [MDN](https://developer.mozilla.org/en-US/docs/Web/API/DeviceOrientationEvent/requestPermission_static); [firt.dev](https://firt.dev/notes/pwa-ios/) |
| Web Push / Notifications | Since 16.4, installed apps only; Declarative Web Push since 18.4 (no service worker needed) | Supported | [firt.dev](https://firt.dev/notes/pwa-ios/) |
| Badging API | Since 16.4, installed apps only | Supported | [firt.dev](https://firt.dev/notes/pwa-ios/) |
| Background Sync / Periodic Sync / Background Fetch | Not supported | Supported | [firt.dev](https://firt.dev/notes/pwa-ios/) |
| Web Speech synthesis | Since iOS 7 | Supported | [firt.dev](https://firt.dev/notes/pwa-ios/) |
| Web Speech recognition | Since 14.5; Safari 26.0 restricts `SpeechRecognition` to secure contexts | Supported; on-device via `processLocally` from Chrome 139 desktop | [firt.dev](https://firt.dev/notes/pwa-ios/); [WebKit 26.0](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/); [caniuse](https://caniuse.com/mdn-api_speechrecognition_processlocally) |
| On-device speech (`processLocally`) | Not supported (Safari through 27) | Chrome 139+ desktop; not Chrome Android; disabled on ChromeOS | [MDN](https://developer.mozilla.org/docs/Web/API/SpeechRecognition/processLocally); [caniuse](https://caniuse.com/mdn-api_speechrecognition_processlocally) |
| Web Audio spatial (`PannerNode`, `panningModel: "HRTF"`) | Supported (Baseline widely available since July 2015) | Supported | [MDN](https://developer.mozilla.org/en-US/docs/Web/API/PannerNode/panningModel) |
| WebRTC / getUserMedia | WebRTC since 11.0, getUserMedia since 13.0 | Supported | [firt.dev](https://firt.dev/notes/pwa-ios/) |
| MSE on iPhone | Via `ManagedMediaSource` from iOS 17.1 (Frigate docs) | MSE supported | [Frigate docs](https://docs.frigate.video/troubleshooting/go2rtc) |
| WebCodecs | Since 16.4; `AudioEncoder`/`AudioDecoder` added in Safari 26.0; 27.0 lets `VideoDecoder` override colour space | Supported | [firt.dev](https://firt.dev/notes/pwa-ios/); [WebKit 26.0](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/); [WebKit 27.0](https://webkit.org/blog/18325/webkit-features-for-safari-27-0/) |
| WebTransport | Since 26.4 | Supported | [firt.dev](https://firt.dev/notes/pwa-ios/) |
| Document Picture-in-Picture | Not supported | Chrome/Edge desktop (listed from 130); Firefox 151 (19 May 2026); not Chrome Android | [web-features](https://web-platform-dx.github.io/web-features-explorer/features/document-picture-in-picture) |
| Web Bluetooth | Not supported | Chrome 70 desktop / 56 Android; Mozilla position negative | [web-features](https://web-platform-dx.github.io/web-features-explorer/features/web-bluetooth); [firt.dev](https://firt.dev/notes/pwa-ios/) |
| Idle Detection | Not supported | Chrome 94; Mozilla negative | [web-features](https://web-platform-dx.github.io/web-features-explorer/features/idle-detection) |
| Compute Pressure | Not supported (WebKit: oppose) | Chrome/Edge 125 desktop only | [web-features](https://web-platform-dx.github.io/web-features-explorer/features/compute-pressure) |
| Window Management (multi-screen placement) | Not supported | Chrome/Edge 111 desktop only | [web-features](https://web-platform-dx.github.io/web-features-explorer/features/window-management) |
| Ambient Light Sensor, Battery, Network Information, Device Memory, WebNFC, WebHID, WebSerial | Not supported | (not researched) | [firt.dev](https://firt.dev/notes/pwa-ios/) |
| OffscreenCanvas | Safari 16.4 | Chrome 69 | [web-features](https://web-platform-dx.github.io/web-features-explorer/features/offscreen-canvas) |
| Prompt API (Gemini Nano) | Not available (Chrome for iOS unsupported) | Web: Chrome 148 desktop; extensions: Chrome 138; not Android | [Chrome docs, updated 21 Oct 2026](https://developer.chrome.com/docs/ai/prompt-api) |

**Haptics on iOS**
- The workaround library `ios-haptics` toggles a hidden `<input type="checkbox" switch>` (introduced in Safari 17.4), whose native click produces a haptic; its README states it "only works on ios 17.4 to 26.4, as apple patched it in ios 26.5" (single unsourced claim) — [ios-haptics README v3.1.1](https://unpkg.com/ios-haptics@3.1.1/README.md)
- A WebKit bug requests that switch haptics require user activation (search snippet) — [WebKit Bugzilla 285120](https://bugs.webkit.org/show_bug.cgi?id=285120)

**Home Screen web app behaviour**
- Storage is not shared between Safari and the installed app; login cookies are copied at install since 17.2; no `beforeinstallprompt`; no link capturing; manifest `display` supports `standalone` only; SVG icons since 26.0 when declared in the manifest; Service Worker static routing since 27.0 — [firt.dev](https://firt.dev/notes/pwa-ios/)
- Safari 27.2 fixed `getUserMedia()` audio failing permanently with `NotAllowedError` after a system audio reset, and transient activation being discarded so gated APIs failed on first attempt — [WebKit 27.2](https://webkit.org/blog/18515/webkit-features-for-safari-27-2/)

**Camera streams (go2rtc / Frigate)**
- Frigate prefers MSE and only attempts WebRTC when MSE fails or for two-way talk; MSE is rated "low latency", WebRTC "lowest"; MSE needs AAC/PCMA/PCMU audio, WebRTC needs Opus/PCMA/PCMU; WebRTC drops late frames rather than buffering (search snippets) — [Frigate docs](https://docs.frigate.video/troubleshooting/go2rtc); [Frigate discussion #12695](https://github.com/blakeblackshear/frigate/discussions/12695)
- Safari 27.0 added WebRTC `targetLatency`/`jitterBufferTarget`; 27.2 fixed `ManagedMediaSource` `startstreaming` on seek and a black-screen decoder invalidation bug — [WebKit 27.0](https://webkit.org/blog/18325/webkit-features-for-safari-27-0/); [WebKit 27.2](https://webkit.org/blog/18515/webkit-features-for-safari-27-2/)
- Amazon's TV guidance: do not draw video into WebGL, use the HTML video element — [Amazon Vega docs](https://developer.amazon.com/docs/vega/0.21/webview-webgl-best-practices.html)

**On-device AI**
- Prompt API hardware requirements: Windows 10/11, macOS 13+, Linux or Chromebook Plus; at least 22 GB free storage; GPU with more than 4 GB VRAM, or CPU with 16 GB RAM and 4+ cores; multimodal input (image, audio), text output; languages en, ja, es, de, fr — [Chrome docs](https://developer.chrome.com/docs/ai/prompt-api)
- Google shipped the Prompt API in Chrome 148 (5 May 2026) despite formal opposition from Mozilla, Apple, Microsoft and W3C reviewers (search snippet, secondary) — [Shopifreaks](https://www.shopifreaks.com/google-ships-chrome-prompt-api-embedding-gemini-nano-despite-formal-opposition-from-mozilla-apple-microsoft-and-w3c/)
- WebLLM (v0.2.8x) is WebGPU-only; WebNN remains behind a flag in Chrome/Edge and absent from Firefox and Safari; an iPhone 11 Pro Max (iOS 18.7) reported `maxBufferSize` about 716 MB and Safari reloaded the page during generation (search snippets, secondary blogs) — [tianpan.co](https://tianpan.co/blog/2026-04-17-browser-native-llm-inference-webgpu); [pinggy.io](https://pinggy.io/blog/run_llm_in_browser_webgpu/)

### Inferences
- An always-on wall iPad running the PWA standalone can keep the screen awake (18.4+), receive push, show badges and play spatial audio, but cannot go truly fullscreen on iPhone, cannot vibrate, and must request motion-sensor permission from a tap. Haptics on iOS 26.5+/27 should be assumed unavailable from the web.
- Voice control on iOS must use cloud-backed `SpeechRecognition` (or a server-side STT pipeline); on-device recognition and Gemini Nano are Chromium-desktop-only, so any "local LLM in the UI" concept is desktop-Chrome-only or needs a home-server model.
- For camera tiles, WebRTC from go2rtc is the lowest-latency path on all targets; MSE works on iPhone only through `ManagedMediaSource` (17.1+). Rendering video as a DOM `<video>` overlaid on, or textured into, the 3D scene should prefer the DOM route on TV-class hardware.
- Multi-monitor placement (Window Management) and Document PiP floating panels are desktop-Chromium enhancements only.

### Gaps
- Standard video Picture-in-Picture support on iOS and inside standalone mode was not researched.
- Whether `SpeechRecognition` and `getUserMedia` behave differently in iOS standalone mode than in Safari tabs is not documented in the sources read.
- The iOS 26.5 haptics patch is asserted only by the library README; not verified against Apple/WebKit notes. Behaviour on iOS 27 unverified.
- Prompt API stability: Chrome docs list "Web: Chrome 148" but one July 2026 blog still described it as origin-trial for web pages; only the docs page was opened.
- HLS-specific behaviour and measured iPhone latency for MSE versus WebRTC were not found. WebNN/WebLLM facts come from unopened secondary blogs.

---

## 8. WebXR and the "spatial web" in 2026

### Takeaway
WebXR remains Chromium- and headset-centric: Chrome (desktop/Android, Android XR), Meta Quest Browser and visionOS Safari support it, while iPhone/iPad/macOS Safari and Firefox do not; Apple's cross-device answer is the declarative `<model>` element, which reached iOS, iPadOS and macOS in Safari 27.0. A WebXR walk-through of a home is realistic only as an optional headset mode layered on a three.js scene, not as a feature for the iPhone/iPad PWA.

### Cited Findings
- WebXR Device API: Chrome 79+ (desktop and Android), Edge 79+; Firefox and Safari (macOS/iOS) "not supported" — [web-features](https://web-platform-dx.github.io/web-features-explorer/features/webxr-device)
- iOS: "WebXR: not supported, except visionOS" (notes updated 13 Oct 2026) — [firt.dev](https://firt.dev/notes/pwa-ios/)
- visionOS Safari supports WebXR `immersive-vr` with natural input (gaze-and-pinch `transient-pointer`) and optional hand tracking with a separate permission — [WebKit: Natural Input for WebXR](https://webkit.org/blog/15162/introducing-natural-input-for-webxr-in-apple-vision-pro/)
- Safari 26.2 (Dec 2025): "WebXR on visionOS now supports WebGPU" — [WebKit 26.2](https://webkit.org/blog/17640/webkit-features-for-safari-26-2/)
- Safari 27.0: WebXR `textureType: "texture-array"` for projection layers; websites can provide a visionOS immersive environment through the `<model>` element's Immersive API (replacing the Spatial Backdrop preview); `<img controls>` UI for spatial/panorama photos on visionOS — [WebKit 27.0](https://webkit.org/blog/18325/webkit-features-for-safari-27-0/)
- A developer reports a "WebXR Augmented Reality Module" feature-flag option in Safari on visionOS 26.5, i.e. AR sessions are still experimental there (search snippet) — [Apple Developer Forums, webxr tag](https://origin-devforums.apple.com/forums/tags/webxr)
- `<model>` element: shipped first on visionOS in Safari 26.0 (USDZ, `environmentmap`, `stagemode="orbit"`, JS `entityTransform`, animation control); "Now in Safari on iOS, iPadOS, and macOS" in Safari 27.0 with `<source>` fallbacks — [WebKit 26.0](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/); [WebKit 27.0](https://webkit.org/blog/18325/webkit-features-for-safari-27-0/)
- Safari on visionOS 26 also supports spatial video, Apple Immersive Video and 180°/360°/wide-FOV video including HLS — [WebKit 26.0](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/)
- Chrome on Android XR supports WebXR Device API, AR Module, Gamepads, Hit Test, Hand Input (the default input), Anchors, Depth Sensing (stereoscopic) and Light Estimation; all WebXR APIs require the 3D-mapping/camera-tracking permission; Google recommends three.js, Babylon.js, A-Frame or model-viewer — [Android Developers](https://developer.android.com/develop/xr/web)
- Meta Quest Browser supports passthrough AR, plane detection, anchors and hand tracking via WebXR (search snippet, secondary) — [vr.org](https://vr.org/articles/webxr-adoption-surge-2026-browsers-vs-apps)
- three.js: WebXR works on `WebGPURenderer` since r185; MSAA for WebXR and native XR layers in r186 — [Utsubo](https://www.utsubo.com/blog/threejs-2026-what-changed); [three.js releases](https://github.com/mrdoob/three.js/releases)
- Threlte ships `@threlte/xr` ("Components for VR and AR") — [Threlte docs](https://threlte.xyz/docs/learn/getting-started/introduction)
- WebSpatial: an open SDK that extends HTML/CSS/PWAs with spatial APIs; visionOS is "the sole spatial computing platform supported … at this stage"; apps must be PWAs and are packaged with WebSpatial Builder into a visionOS app; packaged apps cannot start a WebXR session because WKWebView on visionOS lacks WebXR (search snippets) — [WebSpatial docs](https://webspatial.dev/docs); [WebSpatial: PWA prerequisite](https://webspatial.dev/docs/development-guide/enabling-webspatial-in-web-projects/prerequisite-become-a-minimal-pwa)
- Splats in XR: Spark targets WebXR and claims compatibility with Quest and Vision Pro, with a Quest 3 budget of ≤1 M splats — [World Labs blog](https://worldlabs.ai/blog/spark-2.0); [Spark performance docs](https://sparkjs.dev/docs/performance/)

### Inferences
- "Walk through my home" in a headset is buildable today with three.js/Threlte + `@threlte/xr` on Quest, Android XR and Vision Pro (VR mode), reusing the same scene as the flat 3D view; passthrough AR is solid on Quest/Android XR but still flag-gated on visionOS. It cannot run on the iPhone/iPad PWA, where the nearest equivalents are a touch/gyro-driven first-person camera in a normal canvas, or `<model>` (USDZ) embeds on Safari 27.
- `<model>` is declarative and USDZ-only, with limited scripting; it suits showing a single object or room model with system-quality rendering, not an interactive dashboard with per-device state.
- WebSpatial is visionOS-only and requires native packaging, so it is outside a statically hosted PWA's reach.

### Gaps
- Quest Browser details come from a secondary site; Meta's own documentation was not opened. Galaxy XR-specific behaviour not verified beyond the Android XR developer page.
- visionOS 27 claims (`requestImmersive` on `<model>`) come from one secondary article and the WebKit summary; exact API not verified.
- Whether iOS 27 Safari exposes any WebXR (even flagged) is unconfirmed; firt.dev says no as of Oct 2026.
- WebXR-WebGPU binding status in Chrome was not confirmed.

---

## 9. Performance guidance (60 fps on iPad and low-power TV, render-on-demand, workers, always-on displays, lazy loading)

### Takeaway
The dominant levers are render-on-demand (Threlte's default), capping device pixel ratio, avoiding MSAA and heavy blending on mobile GPUs, handling WebGL/WebGPU context loss on iOS, and isolating all 3D code in a lazily imported chunk (about 121–192 kB gzip for three alone). TV-class browsers should get a reduced or non-3D tier: vendor guidance is under 500 draw calls, compressed textures and DOM video, on Chromium builds that are 2–4 years behind.

### Cited Findings

**Render loop**
- Threlte defaults to `renderMode='on-demand'`, re-rendering only when props change, components mount/unmount, or `invalidate()` is called; `useTask` forces per-frame invalidation unless `autoInvalidate: false`; `'always'` is "the most resource-intensive" — [Threlte docs](https://threlte.xyz/docs/learn/basics/render-modes)
- The three.js r186 splat addon re-sorts only when the camera moves past a threshold — the same on-demand principle applied to sorting — [radiancefields.com](https://radiancefields.com/three.js-merges-a-native-gaussian-splat-renderer-for-webgpu-in-r186)

**Resolution / fill rate**
- Threlte `<Canvas dpr>` defaults to `window.devicePixelRatio` and accepts a `[min, max]` clamp — [Threlte docs: Canvas](https://threlte.xyz/docs/reference/core/canvas)
- Rendering at full `devicePixelRatio` is a recurring cause of low fps on iOS; a WebKit report measured a drop from about 35 fps to about 17 fps on iPad/iPhone when DPR scaling was applied (search snippets) — [three.js forum](https://discourse.threejs.org/t/low-fps-on-ios-mobile-with-pixel-ration-set-as-window-devicepixelratio/4963); [webkit-unassigned list](https://lists.webkit.org/pipermail/webkit-unassigned/2021-September/998815.html)
- three r184 added FSR 1 and TAAU upscaling nodes (render low, upscale) — [Utsubo](https://www.utsubo.com/blog/threejs-2026-what-changed)
- For splats: keep `antialias: false` (MSAA adds significant overhead with no benefit) and question high-DPI rendering — [Spark performance docs](https://sparkjs.dev/docs/performance/)

**iOS/iPadOS stability**
- "WebGL: context lost" on iOS/iPadOS 17+ is widely reported, including after backgrounding Safari and under memory pressure; one user restored stability on an iPad Pro with `powerPreference: 'default'` and `antialias: false` (search snippets) — [three.js forum](https://discourse.threejs.org/t/three-js-broken-on-ios-17-with-context-lost/58025); [three.js forum](https://discourse.threejs.org/t/texture-is-causing-loss-of-context-in-ipados-ios-17-5-1-when-using-react-three-fiber/68643); [Apple Developer Forums](https://developer.apple.com/forums/thread/737042)
- Safari 27.0 fixed a WebGL canvas regression hiding stacked canvases, a ResizeObserver slowdown over time and IntersectionObserver slowdown with many observed elements — [WebKit 27.0](https://webkit.org/blog/18325/webkit-features-for-safari-27-0/)

**Shader/pipeline compilation jank**
- three r184 `compileAsync()` no longer blocks rendering; r186 adds `compileComputeAsync()`; r187 compiles pipelines in parallel — [Utsubo](https://www.utsubo.com/blog/threejs-2026-what-changed); [three.js releases](https://github.com/mrdoob/three.js/releases)
- Chrome 146 adds a `TRANSIENT_ATTACHMENT` texture usage that can keep render-pass data in tile memory and avoid VRAM allocation on tiled mobile GPUs — [Chrome for Developers](https://developer.chrome.com/blog/new-in-webgpu-146)

**Workers**
- OffscreenCanvas is Baseline Widely available (Chrome 69, Firefox 105, Safari 16.4) — [web-features](https://web-platform-dx.github.io/web-features-explorer/features/offscreen-canvas)
- PlayCanvas moved splat sorting from a worker to GPU compute for its WebGPU path; Spark sorts on a worker under WebGL2 — [PlayCanvas blog](https://blog.playcanvas.com/new-in-supersplat-webgpu-and-streaming-bring-huge-performance-wins); [radiancefields.com](https://radiancefields.com/spark-radix-brings-webgpu-splat-rendering-to-threejs)
- SharedArrayBuffer-based worker designs need COOP/COEP headers (example: GaussianSplats3D), which a static host must be able to set — [GaussianSplats3D README](https://github.com/mkkellogg/GaussianSplats3D)

**Low-power TV / embedded browsers**
- Amazon's guidance for TV WebViews: fewer than 500 draw calls per frame, batch/instance, smallest viable textures in compressed formats with mipmaps, lower-precision types, avoid `getError()`/`getParameter()` on the main thread, drive rendering from `requestAnimationFrame`, cull and LOD, dispose unused GL objects, and do not draw video into WebGL — [Amazon Vega docs](https://developer.amazon.com/docs/vega/0.21/webview-webgl-best-practices.html)
- TV engines: Chromium 120 on 2025 Samsung/LG sets, M130/132 on 2026 sets, M108 or older before that — [Samsung Developer](https://developer.samsung.com/smarttv/develop/specifications/web-engine-specifications.html); [LG webOS TV Developer](https://webostv.developer.lge.com/develop/specifications/web-api-and-web-engine)
- Apple HomeView (7-inch home display): short viewport (test at 448×364), voice-first plus touch, avoid fixed/sticky headers and tall modals, use semantic controls with labels, no UA sniffing — [WebKit, 13 Nov 2026](https://webkit.org/blog/18608/safari-on-apple-homeview/)

**Always-on displays**
- Screen Wake Lock works in iOS installed web apps from 18.4 — [firt.dev](https://firt.dev/notes/pwa-ios/)
- OLED guidance for 24/7 dashboards (vendor/consumer sources): hide static chrome and run fullscreen, lower brightness, use pixel shift and static-element dimming, schedule panel-care cycles off-hours; LCD monitoring panels should enable pixel-movement features where offered (search snippets) — [KTC support article](https://us.ktcplay.com/blogs/support-tips/burn-in-prevention-24-7-monitoring-displays); [Tom's Guide](https://www.tomsguide.com/tvs/oled-tvs-burn-in-from-these-common-mistakes-prevent-it-with-3-settings)

**Bundle / lazy loading**
- three minimal tree-shaken scene: about 121 kB gzip (WebGL) or 192 kB gzip (WebGPU) — [three.js PR #33419](https://github.com/mrdoob/three.js/pull/33419)
- three r186 removed top-level side effects and r187 improved tree-shaking of unused classes — [three.js releases](https://github.com/mrdoob/three.js/releases)
- Heavy runtimes for comparison: Spline about 548 kB gzip; Rive 222–648 kB Brotli; Rapier about 600 kB gzip; dotLottie WASM about 500 kB — [DepScope](https://depscope.dev/pkg/npm/@splinetool/runtime); [Rive docs](https://rive.app/docs/runtimes/runtime-sizes.md); [Needle docs](https://engine.needle.tools/docs/html.html); [LottieFiles docs](https://docs.lottiefiles.com/en/runtimes/distributions/js/v0.x/core-concepts.md)

**Reference performance numbers**
- iPhone 13 Pro Max, splats: WebGL2 38 fps at 1 M / 20 fps at 4 M; WebGPU 78 fps at 1 M / 42 fps at 4 M — [PlayCanvas blog](https://blog.playcanvas.com/new-in-supersplat-webgpu-and-streaming-bring-huge-performance-wins)

### Inferences
- Recommended tiering for this app: (a) desktop Chromium/Safari and iPad/iPhone on iOS 26+: full 3D via `three/webgpu` (WebGPU with built-in WebGL2 fallback), on-demand rendering, DPR clamped to about 1.5–2; (b) older iOS and mid devices: same code on the WebGL2 backend with post-processing and compute effects disabled; (c) TV/wall-display browsers on Chromium ≤120: CSS/DOM-only "ambient" view (view transitions and scroll-driven animations exist from Chromium 111/115; anchor positioning and `light-dark()` do not), with 3D off unless a capability probe passes.
- Keep the 3D view behind a dynamic `import()` in the route so the roughly 190 kB+ three chunk, and any 200–650 kB WASM runtime, never touches the initial bundle; preload it on idle only on capable devices. This follows from the size figures above and Vite's standard code-splitting; no Svelte-specific source was consulted for it.
- For a wall display, on-demand rendering doubles as the power/thermal strategy: an idle scene costs zero GPU frames. Add a slow, low-amplitude position drift or periodic layout shuffle for burn-in mitigation in the app itself, since the web has no pixel-shift API, and dim via CSS when the room is unoccupied (Idle Detection and Ambient Light Sensor are unavailable on iOS, so presence must come from the home-automation backend).
- Because WebGL/WebGPU contexts can be lost on iOS when backgrounded or under memory pressure, the 3D view needs a context-lost/restored handler that rebuilds or remounts the canvas; this matters more for an always-on standalone PWA than for a casual tab.

### Gaps
- No source found on `requestAnimationFrame` cadence on 120 Hz ProMotion iPads/iPhones in Safari or standalone mode (60 versus 120 fps), nor on low-power-mode throttling.
- No measured numbers for three.js scenes on Tizen/webOS hardware; TV guidance is from Amazon's Vega docs only.
- No quantified cost data for `backdrop-filter`, large blurred layers or `preserve-3d` stacks on iPad or TV GPUs.
- Burn-in guidance is from vendor/consumer articles, not display-engineering sources; nothing specific to iPad LCD/mini-LED/OLED panels used as wall displays was found.
- Thermal behaviour of an always-on iPad running continuous WebGPU was not researched.
