<script lang="ts">
  import { onMount } from "svelte";
  import { ha } from "./lib/store.svelte";
  import { authStore } from "./lib/auth.svelte";
  import { prefs } from "./lib/prefs.svelte";
  import { NAV, type ViewId } from "./lib/nav";
  import { E, ALL_LIGHTS } from "./lib/entities";
  import { ui } from "./lib/ui.svelte";
  import { toast } from "./lib/toast.svelte";
  // Views are lazy-loaded (dynamic import) so only the active view's code ships in
  // the initial parse — Vite emits one chunk per view. Keeps first paint light on
  // low-power devices (TV/phone) where parsing the whole app up front was costly.
  import type { Component } from "svelte";
  const VIEWS: Record<string, () => Promise<{ default: Component<any> }>> = {
    overview: () => import("./views/Overview.svelte"),
    energy: () => import("./views/Energy.svelte"),
    powertrends: () => import("./views/PowerTrends.svelte"),
    water: () => import("./views/Water.svelte"),
    irrigation: () => import("./views/Irrigation.svelte"),
    climate: () => import("./views/Rooms.svelte"),
    appliances: () => import("./views/Appliances.svelte"),
    security: () => import("./views/Security.svelte"),
    cameras: () => import("./views/Cameras.svelte"),
    traffic: () => import("./views/Traffic.svelte"),
    lights: () => import("./views/Lights.svelte"),
    reminders: () => import("./views/Reminders.svelte"),
    system: () => import("./views/System.svelte"),
    me: () => import("./views/Me.svelte"),
    vitality: () => import("./views/Vitality.svelte"),
    timeline: () => import("./views/Timeline.svelte"),
    insights: () => import("./views/Insights.svelte"),
    settings: () => import("./views/Settings.svelte"),
  };
  // Per-view props (most take none).
  const viewProps = (id: string): Record<string, unknown> => {
    if (id === "overview" || id === "energy" || id === "powertrends" || id === "insights") return { onnav: go };
    if (id === "settings") return { ontv: () => (tv = true) };
    return {};
  };
  import CommandPalette from "./lib/components/CommandPalette.svelte";
  import LightSheet from "./lib/components/LightSheet.svelte";
  import Toast from "./lib/components/Toast.svelte";

  let view = $state<ViewId>("overview");
  let palette = $state(false);
  // ?tv=1 (or #tv) boots straight into the always-on TV Overview — for wall displays.
  let tv = $state(
    new URLSearchParams(location.search).get("tv") === "1" || location.hash === "#tv",
  );
  let moreOpen = $state(false);
  let isMobile = $state(false);
  let now = $state(new Date());
  // ?mock=1 runs the whole UI offline with no HA — and no auth gate, for visual QA.
  const mockMode =
    new URLSearchParams(location.search).get("mock") === "1" ||
    import.meta.env.VITE_MOCK === "1";

  onMount(() => {
    prefs.apply();
    authStore.init();
    const mq = window.matchMedia("(max-width: 820px)");
    const upd = () => (isMobile = mq.matches);
    upd();
    mq.addEventListener("change", upd);
    const onkey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); palette = true; }
      else if (e.key === "/" && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLSelectElement)) { e.preventDefault(); palette = true; }
    };
    window.addEventListener("keydown", onkey);
    const tick = setInterval(() => (now = new Date()), 30_000);
    return () => { mq.removeEventListener("change", upd); window.removeEventListener("keydown", onkey); clearInterval(tick); };
  });

  // Live clock/date + day-night weather icon for the top bar.
  const clock = $derived(now.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", hour12: false }));
  const dateStr = $derived(now.toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" }));
  const tempIcon = $derived(
    ha.exists("sun.sun") ? (ha.state("sun.sun") === "above_horizon" ? "☀️" : "🌙") : now.getHours() >= 6 && now.getHours() < 19 ? "☀️" : "🌙",
  );
  const weatherTemp = $derived(ha.attr(E.weather, "temperature") != null ? Math.round(ha.attr(E.weather, "temperature") as number) : null);

  // Per-page primary action for the top bar (only where it applies).
  const hAct = $derived.by(() => {
    switch (view) {
      case "overview":
        return { icon: "✦", label: ui.overviewCustomize ? "Done" : "Customize", run: () => (ui.overviewCustomize = !ui.overviewCustomize) };
      case "security": {
        const armed = (ha.state(E.alarmHome) ?? "").startsWith("armed");
        return { icon: armed ? "🔓" : "🔒", label: armed ? "Disarm" : "Arm", run: () => (armed ? ha.disarm(E.alarmHome) : ha.armAway(E.alarmHome)) };
      }
      case "lights":
        return { icon: "🌑", label: "All off", run: () => { ha.turnOff(ALL_LIGHTS); toast.show("All lights off"); } };
      case "irrigation":
        return { icon: "⏹", label: "Stop all", run: () => { ha.script(E.irrStopAll); toast.show("Stopping irrigation"); } };
      case "reminders":
        return { icon: "＋", label: "New reminder", run: () => ui.newReminderTick++ };
      default:
        return null;
    }
  });

  // Connect to Home Assistant only once the user is signed in and authorised.
  $effect(() => {
    if ((mockMode || authStore.status === "ready") && ha.status !== "connected") ha.init();
  });

  const visible = (id: ViewId) => ["overview", "security", "settings"].includes(id) || prefs.viewsOn[id];
  const shown = $derived(NAV.filter((nav) => visible(nav.id)));
  const active = $derived(NAV.find((nav) => nav.id === view)!);

  const groups: { title: string; key: "Systems" | "Safety" | "House" }[] = [
    { title: "Systems", key: "Systems" }, { title: "Safety", key: "Safety" }, { title: "House", key: "House" },
  ];

  // Alarm chip
  const alarm = $derived.by(() => {
    const s = ha.state(E.alarmMain);
    if (s?.startsWith("armed")) return { label: "Armed", color: "var(--success)" };
    if (s === "triggered") return { label: "Alarm", color: "var(--error)" };
    return { label: "Disarmed", color: "var(--warning)" };
  });

  const mobileTabs = ["overview", "energy", "water", "security"] as ViewId[];
  function go(id: string) {
    if (id === "__palette") { palette = true; return; }
    view = id as ViewId; palette = false; moreOpen = false;
  }
</script>

{#if !mockMode && authStore.status === "loading"}
  <div class="center"><div class="spinner"></div><p class="dim">Signing in…</p></div>
{:else if !mockMode && authStore.status === "signedout"}
  <div class="center">
    <div class="bg"></div><div class="orb o1"></div><div class="orb o2"></div>
    <div class="login">
      <span class="llogo">🏠</span>
      <h1>Steyn Home</h1>
      <p class="dim">Sign in to continue</p>
      <button class="gbtn" onclick={() => authStore.signIn()}>Continue with Google</button>
      {#if authStore.error}<p class="err">{authStore.error}</p>{/if}
    </div>
  </div>
{:else if !mockMode && authStore.status === "denied"}
  <div class="center">
    <div class="panel">
      <strong>Not authorised</strong>
      <p>{authStore.user?.email} isn't on the allow-list for this dashboard.</p>
      <button onclick={() => authStore.signOut()}>Sign out</button>
    </div>
  </div>
{:else if ha.status === "error"}
  <div class="center"><div class="panel"><strong>Couldn't connect to Home Assistant</strong><p>{ha.error}</p><button onclick={() => location.reload()}>Retry</button></div></div>
{:else if ha.status === "connecting"}
  <div class="center"><div class="spinner"></div><p class="dim">Connecting to Home Assistant…</p></div>
{:else}
  <!-- aurora backdrop -->
  <div class="bg"></div>
  <div class="orb o1"></div>
  <div class="orb o2"></div>

  <div class="shell">
    {#if !isMobile}
      <aside class:collapsed={prefs.collapsed}>
        <div class="brand">
          <span class="logo" aria-label="Steyn Home">
            <svg viewBox="0 0 72 72" width="100%" height="100%" fill="none" aria-hidden="true">
              <path d="M20 34 L36 21 L52 34 V52 a2 2 0 0 1-2 2 H22 a2 2 0 0 1-2-2 Z" stroke="#0b1220" stroke-width="4" stroke-linejoin="round"/>
              <path d="M25 45 h6 l3 -7 l4 12 l3 -5 h6" stroke="#0b1220" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </span>
          {#if !prefs.collapsed}<span class="bn">Steyn Home</span>{/if}
          <button class="clp" onclick={() => { prefs.collapsed = !prefs.collapsed; prefs.save(); }}>{prefs.collapsed ? "»" : "«"}</button>
        </div>
        <button class="nav" class:active={view === "overview"} onclick={() => go("overview")}><span class="ni">🏠</span>{#if !prefs.collapsed}<span class="nn">Overview</span>{/if}</button>
        {#each groups as g}
          {@const items = shown.filter((s) => s.group === g.key)}
          {#if items.length}
            {#if !prefs.collapsed}<div class="grp">{g.title}</div>{:else}<div class="grpline"></div>{/if}
            {#each items as it}
              <button class="nav" class:active={view === it.id} onclick={() => go(it.id)}><span class="ni">{it.icon}</span>{#if !prefs.collapsed}<span class="nn">{it.name}</span>{/if}</button>
            {/each}
          {/if}
        {/each}
        <button class="user" onclick={() => authStore.signOut()} title="Sign out">
          <span class="uav">{(authStore.user?.displayName ?? authStore.user?.email ?? "C").charAt(0).toUpperCase()}</span>
          {#if !prefs.collapsed}<div class="ul"><span class="un">{authStore.user?.displayName ?? "Signed in"}</span><span class="ur">Sign out</span></div>{/if}
        </button>
      </aside>
    {/if}

    <main>
      <header>
        <div class="htitle"><span class="hi">{active.icon}</span><span class="hn">{active.name}</span></div>
        <div class="hchips">
          <button class="chip srch" onclick={() => (palette = true)} title="Search & commands">🔍 Search<span class="kbd">⌘K</span></button>
          {#if hAct}<button class="chip hact" onclick={hAct.run}>{hAct.icon} {hAct.label}</button>{/if}
          <button class="chip arm" style="--c:{alarm.color}" onclick={() => go("security")}><span class="ad"></span>{alarm.label}</button>
          <span class="chip">{tempIcon} {weatherTemp != null ? weatherTemp + "°" : "—"}</span>
          <div class="clockcol"><span class="ck">{clock}</span><span class="cd">{dateStr}</span></div>
        </div>
      </header>

      <div class="body">
        {#key view}
          {#await VIEWS[view]()}
            <div class="vload"><div class="spinner"></div></div>
          {:then mod}
            {@const Cmp = mod.default}
            <Cmp {...viewProps(view)} />
          {:catch e}
            <div class="panel"><strong>Couldn't load this view</strong><p>{e.message}</p></div>
          {/await}
        {/key}
      </div>
    </main>
  </div>

  {#if isMobile}
    {#if moreOpen}
      <div class="msheet-scrim" onclick={() => (moreOpen = false)} role="presentation"></div>
      <div class="msheet">
        <div class="grab"></div>
        <div class="mgrid">
          {#each shown.filter((s) => !mobileTabs.includes(s.id)) as it}
            <button class="mitem" onclick={() => go(it.id)}><span>{it.icon}</span>{it.name}</button>
          {/each}
        </div>
      </div>
    {/if}
    <nav class="mnav">
      {#each mobileTabs as id}
        {@const it = NAV.find((n) => n.id === id)!}
        <button class:on={view === id} onclick={() => go(id)}><span class="mi">{it.icon}</span><span class="ml">{it.name}</span></button>
      {/each}
      <button class:on={moreOpen} onclick={() => (moreOpen = !moreOpen)}><span class="mi">⋯</span><span class="ml">More</span></button>
    </nav>
  {/if}

  <CommandPalette open={palette} onnav={go} onclose={() => (palette = false)} />
  <LightSheet />
  <Toast />
  {#if tv}
    {#await import("./views/TV.svelte") then mod}
      {@const TVView = mod.default}
      <TVView onexit={() => (tv = false)} />
    {/await}
  {/if}
{/if}

<style>
  .center { min-height: 100dvh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; padding: 24px; }
  .dim { color: var(--muted); }
  .spinner { width: 32px; height: 32px; border: 3px solid rgba(255, 255, 255, 0.12); border-top-color: var(--acc); border-radius: 50%; animation: spin 0.8s linear infinite; }
  .panel { background: rgba(20, 26, 36, 0.9); border-radius: 20px; padding: 24px; max-width: 440px; text-align: center; box-shadow: inset 0 0 0 1px var(--error); }
  .panel p { color: var(--text-2); font-size: 14px; }
  .panel button { margin-top: 8px; background: var(--grad); color: #0b1017; border-radius: 12px; padding: 10px 20px; font-weight: 700; }
  .err { color: var(--error); font-size: 12.5px; margin-top: 4px; }

  .login { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; gap: 8px; background: rgba(20, 26, 36, 0.72); backdrop-filter: var(--glass-blur); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 24px; padding: 40px 44px; box-shadow: 0 30px 80px -30px rgba(0,0,0,0.7); }
  .llogo { font-size: 42px; }
  .login h1 { font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
  .gbtn { margin-top: 14px; background: #fff; color: #1f1f1f; border-radius: 12px; padding: 12px 26px; font-weight: 700; font-size: 14px; box-shadow: 0 6px 20px -8px rgba(0,0,0,0.5); }
  .gbtn:hover { transform: translateY(-1px); }

  .bg { position: fixed; inset: 0; z-index: 0; background: var(--aurora); pointer-events: none; }
  .orb { position: fixed; z-index: 0; border-radius: 50%; filter: blur(90px); pointer-events: none; }
  .o1 { width: 44vw; height: 44vw; top: -14vw; left: -8vw; opacity: 0.5; background: radial-gradient(circle, var(--acc), transparent 70%); animation: drift1 26s ease-in-out infinite alternate; }
  .o2 { width: 38vw; height: 38vw; bottom: -14vw; right: -6vw; opacity: 0.4; background: radial-gradient(circle, var(--acc2), transparent 70%); animation: drift2 32s ease-in-out infinite alternate; }

  .shell { position: relative; z-index: 1; display: flex; min-height: 100vh; }
  aside { width: 210px; flex-shrink: 0; position: sticky; top: 0; height: 100vh; border-right: 1px solid rgba(255, 255, 255, 0.07); background: rgba(255, 255, 255, 0.02); backdrop-filter: var(--glass-blur); padding: 16px 13px; display: flex; flex-direction: column; gap: 2px; transition: width 0.22s; overflow-y: auto; }
  aside.collapsed { width: 66px; }
  .brand { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; padding: 0 3px; }
  .logo { width: 30px; height: 30px; flex-shrink: 0; border-radius: 9px; background: var(--grad); display: grid; place-items: center; font-size: 15px; color: #07131c; }
  .bn { font-size: 14.5px; font-weight: 700; flex: 1; white-space: nowrap; }
  .clp { width: 26px; height: 26px; flex-shrink: 0; border-radius: 8px; background: rgba(255, 255, 255, 0.06); color: #b6c5d6; font-size: 13px; margin-left: auto; }
  .nav { position: relative; display: flex; align-items: center; gap: 12px; padding: 10px 13px; border-radius: 11px; width: 100%; text-align: left; }
  aside.collapsed .nav { justify-content: center; padding: 11px 0; }
  .nav:hover { background: rgba(255, 255, 255, 0.04); }
  .nav.active { background: var(--soft); box-shadow: inset 0 0 0 1px var(--line); }
  .ni { font-size: 17px; width: 20px; text-align: center; }
  .nn { font-size: 13.5px; font-weight: 600; color: #eef4fc; white-space: nowrap; }
  .grp { font-size: 9.5px; font-weight: 700; letter-spacing: 1.3px; text-transform: uppercase; color: var(--muted-2); padding: 0 13px; margin: 13px 0 5px; }
  .grpline { height: 1px; background: rgba(255, 255, 255, 0.07); margin: 10px 6px; }
  .user { margin-top: auto; padding-top: 12px; display: flex; align-items: center; gap: 10px; }
  .uav { width: 32px; height: 32px; flex-shrink: 0; border-radius: 50%; background: var(--grad); display: grid; place-items: center; font-size: 13px; font-weight: 700; color: #07131c; }
  .ul { display: flex; flex-direction: column; line-height: 1.2; }
  .un { font-size: 12.5px; font-weight: 600; }
  .ur { font-size: 10.5px; color: var(--muted); }

  main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  header { position: sticky; top: 0; z-index: 5; display: flex; align-items: center; gap: 12px; padding: 13px 20px; background: rgba(7, 11, 17, 0.72); backdrop-filter: var(--glass-blur); border-bottom: 1px solid rgba(255, 255, 255, 0.06); }
  .htitle { display: flex; align-items: center; gap: 11px; flex: 1; min-width: 0; }
  .hi { font-size: 20px; }
  .hn { font-size: 17px; font-weight: 700; letter-spacing: -0.3px; }
  .hchips { display: flex; align-items: center; gap: 12px 10px; flex-wrap: wrap; justify-content: flex-end; }
  .chip.srch, .chip.hact { border: none; cursor: pointer; }
  .chip.srch:hover, .chip.hact:hover { background: rgba(255, 255, 255, 0.09); color: var(--text); }
  .kbd { font-size: 10px; font-weight: 700; color: var(--muted-2); background: rgba(255, 255, 255, 0.07); padding: 2px 6px; border-radius: 6px; }
  .chip.hact { background: var(--soft); box-shadow: inset 0 0 0 1px var(--line); color: var(--text); font-weight: 700; }
  .chip.arm { cursor: pointer; }
  .clockcol { display: flex; flex-direction: column; align-items: flex-end; line-height: 1.15; padding-left: 3px; }
  .clockcol .ck { font-size: 13px; font-weight: 700; color: #eef4fc; font-variant-numeric: tabular-nums; }
  .clockcol .cd { font-size: 10px; color: var(--muted-2); }
  @media (max-width: 640px) { .chip.srch .kbd { display: none; } .clockcol { display: none; } }
  .chip { display: inline-flex; align-items: center; gap: 7px; padding: 7px 13px; border-radius: 999px; background: rgba(255, 255, 255, 0.05); font-size: 12px; font-weight: 600; color: var(--text-2); }
  .chip.arm { background: color-mix(in srgb, var(--c) 14%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--c) 40%, transparent); color: var(--text); }
  .ad { width: 7px; height: 7px; border-radius: 50%; background: var(--c); box-shadow: 0 0 8px var(--c); }
  .body { flex: 1; padding: 20px; padding-bottom: 40px; }
  .vload { min-height: 60dvh; display: grid; place-items: center; }

  .mnav { position: fixed; left: 0; right: 0; bottom: 0; z-index: 21; display: flex; padding: 7px 4px calc(7px + env(safe-area-inset-bottom)); background: rgba(7, 11, 17, 0.92); backdrop-filter: blur(18px); border-top: 1px solid rgba(255, 255, 255, 0.08); }
  .mnav button { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 6px 0; min-height: 46px; color: var(--muted-2); }
  .mnav button.on { color: var(--acc); }
  .mi { font-size: 20px; }
  .ml { font-size: 10px; font-weight: 600; }
  .msheet-scrim { position: fixed; inset: 0; z-index: 19; background: rgba(0, 0, 0, 0.5); }
  .msheet { position: fixed; left: 0; right: 0; bottom: calc(60px + env(safe-area-inset-bottom)); z-index: 20; padding: 16px 16px 20px; background: rgba(10, 15, 22, 0.97); backdrop-filter: blur(20px); border-top: 1px solid rgba(255, 255, 255, 0.12); border-radius: 22px 22px 0 0; animation: ppop 0.18s ease; max-height: calc(100dvh - 76px - env(safe-area-inset-bottom)); overflow-y: auto; overscroll-behavior: contain; }
  .grab { width: 38px; height: 4px; border-radius: 2px; background: rgba(255, 255, 255, 0.2); margin: 0 auto 14px; }
  .mgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; }
  .mitem { display: flex; align-items: center; gap: 10px; padding: 13px; border-radius: 13px; background: rgba(255, 255, 255, 0.05); font-size: 12.5px; font-weight: 600; text-align: left; }
  @media (max-width: 820px) {
    .body { padding-bottom: calc(80px + env(safe-area-inset-bottom)); }
  }
</style>
