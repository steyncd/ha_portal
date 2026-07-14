<script lang="ts">
  import { onMount } from "svelte";
  import { ha } from "./lib/store.svelte";
  import { prefs } from "./lib/prefs.svelte";
  import { NAV, type ViewId } from "./lib/nav";
  import { E } from "./lib/entities";
  import Overview from "./views/Overview.svelte";
  import Energy from "./views/Energy.svelte";
  import PowerTrends from "./views/PowerTrends.svelte";
  import Water from "./views/Water.svelte";
  import Irrigation from "./views/Irrigation.svelte";
  import Climate from "./views/Climate.svelte";
  import Appliances from "./views/Appliances.svelte";
  import Security from "./views/Security.svelte";
  import Cameras from "./views/Cameras.svelte";
  import Traffic from "./views/Traffic.svelte";
  import Lights from "./views/Lights.svelte";
  import Reminders from "./views/Reminders.svelte";
  import System from "./views/System.svelte";
  import Me from "./views/Me.svelte";
  import Timeline from "./views/Timeline.svelte";
  import Insights from "./views/Insights.svelte";
  import Settings from "./views/Settings.svelte";
  import TV from "./views/TV.svelte";
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

  onMount(() => {
    prefs.apply();
    ha.init();
    const mq = window.matchMedia("(max-width: 820px)");
    const upd = () => (isMobile = mq.matches);
    upd();
    mq.addEventListener("change", upd);
    const onkey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); palette = true; }
      else if (e.key === "/" && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLSelectElement)) { e.preventDefault(); palette = true; }
    };
    window.addEventListener("keydown", onkey);
    return () => { mq.removeEventListener("change", upd); window.removeEventListener("keydown", onkey); };
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

{#if ha.status === "error"}
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
        <div class="user"><span class="uav">C</span>{#if !prefs.collapsed}<div class="ul"><span class="un">Christo</span><span class="ur">Admin</span></div>{/if}</div>
      </aside>
    {/if}

    <main>
      <header>
        <div class="htitle"><span class="hi">{active.icon}</span><span class="hn">{active.name}</span></div>
        <div class="hchips">
          <button class="chip arm" style="--c:{alarm.color}" onclick={() => go("security")}><span class="ad"></span>{alarm.label}</button>
          <span class="chip">🌙 {ha.attr(E.weather, "temperature") != null ? Math.round(ha.attr(E.weather, "temperature") as number) : 16}°</span>
        </div>
      </header>

      <div class="body">
        {#if view === "overview"}<Overview onnav={go} />
        {:else if view === "energy"}<Energy onnav={go} />
        {:else if view === "powertrends"}<PowerTrends />
        {:else if view === "water"}<Water />
        {:else if view === "irrigation"}<Irrigation />
        {:else if view === "climate"}<Climate />
        {:else if view === "appliances"}<Appliances />
        {:else if view === "security"}<Security />
        {:else if view === "cameras"}<Cameras />
        {:else if view === "traffic"}<Traffic />
        {:else if view === "lights"}<Lights />
        {:else if view === "reminders"}<Reminders />
        {:else if view === "system"}<System />
        {:else if view === "me"}<Me />
        {:else if view === "timeline"}<Timeline />
        {:else if view === "insights"}<Insights />
        {:else if view === "settings"}<Settings ontv={() => (tv = true)} />{/if}
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
  {#if tv}<TV onexit={() => (tv = false)} />{/if}
{/if}

<style>
  .center { min-height: 100dvh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; padding: 24px; }
  .dim { color: var(--muted); }
  .spinner { width: 32px; height: 32px; border: 3px solid rgba(255, 255, 255, 0.12); border-top-color: var(--acc); border-radius: 50%; animation: spin 0.8s linear infinite; }
  .panel { background: rgba(20, 26, 36, 0.9); border-radius: 20px; padding: 24px; max-width: 440px; text-align: center; box-shadow: inset 0 0 0 1px var(--error); }
  .panel p { color: var(--text-2); font-size: 14px; }
  .panel button { margin-top: 8px; background: var(--grad); color: #0b1017; border-radius: 12px; padding: 10px 20px; font-weight: 700; }

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
  .hchips { display: flex; align-items: center; gap: 9px; }
  .chip { display: inline-flex; align-items: center; gap: 7px; padding: 7px 13px; border-radius: 999px; background: rgba(255, 255, 255, 0.05); font-size: 12px; font-weight: 600; color: var(--text-2); }
  .chip.arm { background: color-mix(in srgb, var(--c) 14%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--c) 40%, transparent); color: var(--text); }
  .ad { width: 7px; height: 7px; border-radius: 50%; background: var(--c); box-shadow: 0 0 8px var(--c); }
  .body { flex: 1; padding: 20px; padding-bottom: 40px; }

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
