<script lang="ts">
  // The Home quick surface — the portal's front door (default landing).
  //
  // Design follows the market/UX research: NOT a "quick vs advanced" mode toggle
  // (modes halve discoverability and cause mode errors — NN/g), but a favourites-
  // first glance surface with the dense "Dashboard" one tap away. Every commercial
  // system (Apple/Google Home, Control4, Savant, Crestron, Homey) converged on
  // this: open on scenes + most-used, tap fires the common action, drill down for
  // detail. The "Suggested for now" strip is the adaptive intelligence layer
  // (frecency over the user's own portal taps — see suggest.ts / actionLog).
  import { ha } from "../lib/store.svelte";
  import { prefs } from "../lib/prefs.svelte";
  import { toast } from "../lib/toast.svelte";
  import { lightSheet } from "../lib/lightSheet.svelte";
  import { E, ALL_LIGHTS } from "../lib/entities";
  import { greeting, sastHour, dateMedium, n, power } from "../lib/format";
  import { actionById, fireAction, suggestions, topViews } from "../lib/suggest";
  import { actionLog, bucketFor, BUCKET_LABEL } from "../lib/actionLog.svelte";
  import { computeAttention } from "../lib/attention";
  import { stable, sig } from "../lib/stable";
  import NeedsAttention from "../lib/components/NeedsAttention.svelte";
  import Nudges from "../lib/components/Nudges.svelte";
  import RoomScenes from "../lib/components/RoomScenes.svelte";
  import Icon from "../lib/components/Icon.svelte";

  let { onnav }: { onnav: (id: string) => void } = $props();

  const now = new Date();
  const attnMemo = stable<ReturnType<typeof computeAttention>>();
  const attention = $derived.by(() => {
    const items = computeAttention();
    return attnMemo(items, sig(items, "key", "sev", "title"));
  });

  // ── Trust badge: live/local-first resilience signal (Hubitat pattern) ───────
  const live = $derived(ha.status === "connected");

  // ── Security hero ───────────────────────────────────────────────────────────
  const alarmState = $derived(ha.state(E.alarmMain) ?? "—");
  const armed = $derived(alarmState.startsWith("armed"));
  const triggered = $derived(alarmState === "triggered");
  function toggleAlarm() {
    if (armed || triggered) fireAction("disarm", { record: true });
    else fireAction("armaway", { record: true });
  }

  // ── Announce toggle (scene-triggered TTS — Control4 pattern) ────────────────
  let speak = $state(localStorage.getItem("ha_portal_home_speak") === "1");
  function toggleSpeak() { speak = !speak; localStorage.setItem("ha_portal_home_speak", speak ? "1" : "0"); }

  // ── Scenes row (named by intent) with run→check feedback (Crestron pattern) ──
  const SCENE_IDS = ["eveningin", "goodnight", "morning", "away", "movie"];
  const scenes = $derived(SCENE_IDS.map(actionById).filter((a): a is NonNullable<typeof a> => !!a));
  let fired = $state<string | null>(null);
  let firedTimer: ReturnType<typeof setTimeout> | undefined;
  function runScene(id: string) {
    fireAction(id, { announce: speak });
    fired = id;
    clearTimeout(firedTimer);
    firedTimer = setTimeout(() => (fired = null), 1300);
  }

  // ── Suggested for now (adaptive) ────────────────────────────────────────────
  // Re-ranks only when tap history or the time bucket changes — never on every
  // live entity tick — so the strip stays stable (no jitter). `active()` reads
  // live state for on/off styling only.
  let bucketTick = $state(bucketFor(now));
  const suggested = $derived.by(() => {
    void actionLog.events; void bucketTick; void prefs.favourites; void prefs.hiddenSuggestions;
    return suggestions(6);
  });
  const learnedYet = $derived(actionLog.total >= 6);
  const jumps = $derived.by(() => { void actionLog.events; return topViews(5); });
  let menuId = $state<string | null>(null);

  function pin(id: string) {
    if (!prefs.favourites.includes(id)) prefs.favourites = [...prefs.favourites, id];
    prefs.hiddenSuggestions = prefs.hiddenSuggestions.filter((x) => x !== id);
    prefs.save();
    menuId = null;
    toast.show("Pinned to favourites");
  }
  function hide(id: string) {
    if (!prefs.hiddenSuggestions.includes(id)) prefs.hiddenSuggestions = [...prefs.hiddenSuggestions, id];
    prefs.save();
    menuId = null;
    toast.show("Hidden — won't suggest this");
  }
  // Long-press opens the pin/hide menu on touch; the ⋯ button is the visible
  // fallback the research insists gestures must always have.
  let pressTimer: ReturnType<typeof setTimeout> | undefined;
  function pressStart(id: string) { pressTimer = setTimeout(() => (menuId = id), 480); }
  function pressEnd() { clearTimeout(pressTimer); }

  // ── Pinned favourites (stable zone — never reordered by the algorithm) ───────
  const pinned = $derived(prefs.favourites.map(actionById).filter((a): a is NonNullable<typeof a> => !!a));

  // ── Quick controls ──────────────────────────────────────────────────────────
  const controls = ["poolpump", "borehole", "waterpump", "heater", "outdoor"].map(actionById).filter((a): a is NonNullable<typeof a> => !!a);
  const litCount = $derived(ALL_LIGHTS.filter((id) => ha.isOn(id)).length);

  const QUICK_LIGHTS = [
    { id: "switch.kitchen_lights", label: "Kitchen", icon: "🍳" },
    { id: "switch.living_room_lamp", label: "Living Room", icon: "🛋️" },
    { id: "switch.main_bedroom_lamp", label: "Bedroom", icon: "🛏️" },
    { id: "light.study_lamp", label: "Study", icon: "📚" },
  ];

  // compact glance stats
  const soc = $derived(ha.num(E.batterySoc));
  const pv = $derived(ha.num(E.pvPower));

  function fire(id: string) { fireAction(id, { record: true }); }
</script>

<!-- Header -->
<div class="head">
  <div class="htext">
    <h1>{greeting(sastHour(now))}, Christo</h1>
    <p>{dateMedium(now)} · {attention.length ? `${attention.length} thing${attention.length > 1 ? "s" : ""} need${attention.length > 1 ? "" : "s"} you` : "all calm"}</p>
  </div>
  <div class="hactions">
    <span class="trust" class:ok={live} title={live ? "Connected to your self-hosted Home Assistant" : "Reconnecting…"}>
      <span class="tdot"></span>{live ? "Live" : "Reconnecting"}
    </span>
    <button class="hbtn" onclick={() => onnav("__palette")}><span>⌘</span> Search</button>
    <button class="hbtn ghost" onclick={() => onnav("overview")}><Icon name="layout" size={15} /> Dashboard</button>
  </div>
</div>

<Nudges {onnav} />

<NeedsAttention items={attention} {onnav} />

<!-- Security hero -->
<button
  class="hero"
  class:armed
  class:triggered
  onclick={toggleAlarm}
>
  <span class="hglow"></span>
  <span class="hicon">{triggered ? "🚨" : armed ? "🛡️" : "🔓"}</span>
  <div class="hbody">
    <div class="hlabel">{triggered ? "Alarm triggered" : armed ? "House armed" : "House disarmed"}</div>
    <div class="hsub">{triggered ? "Tap to disarm" : armed ? `${alarmState.replace("armed_", "armed ")} · tap to disarm` : "Tap to arm away"}</div>
  </div>
  <span class="haction">{armed || triggered ? "Disarm" : "Arm"}</span>
</button>

<!-- Glance ribbon -->
<div class="ribbon">
  <button class="rib" onclick={() => onnav("energy")}>
    <span class="ri">🔋</span><span class="rv">{n(soc)}%</span><span class="rl">battery</span>
  </button>
  <button class="rib" onclick={() => onnav("energy")}>
    <span class="ri">☀️</span><span class="rv">{power(pv).val}<small>{power(pv).unit}</small></span><span class="rl">solar now</span>
  </button>
  <button class="rib" onclick={() => onnav("water")}>
    <span class="ri">💧</span><span class="rv">{n(ha.num(E.tankLevel))}%</span><span class="rl">tank</span>
  </button>
  <button class="rib" onclick={() => onnav("lights")}>
    <span class="ri">💡</span><span class="rv">{litCount}</span><span class="rl">lights on</span>
  </button>
</div>

<!-- Scenes -->
<section class="sec">
  <div class="sh">
    <span class="st">Scenes</span>
    <button class="speak" class:on={speak} onclick={toggleSpeak} title="Announce scenes over the speakers">{speak ? "🔊" : "🔇"} Announce</button>
  </div>
  <div class="scenes">
    {#each scenes as s (s.id)}
      <button class="scene" class:done={fired === s.id} onclick={() => runScene(s.id)}>
        <span class="sic">{fired === s.id ? "✓" : s.icon}</span>
        <span class="sname">{s.label}</span>
      </button>
    {/each}
  </div>
</section>

<!-- Suggested for now -->
<section class="sec">
  <div class="sh">
    <span class="st">Suggested for now</span>
    <span class="scap">{learnedYet ? `learning from what you do ${BUCKET_LABEL[bucketTick]}` : "starting from sensible defaults"}</span>
  </div>
  <div class="sgrid">
    {#each suggested as { action, learned } (action.id)}
      <div class="scell">
        <button
          class="tile"
          class:on={action.active?.()}
          onclick={() => fire(action.id)}
          onpointerdown={() => pressStart(action.id)}
          onpointerup={pressEnd}
          onpointerleave={pressEnd}
        >
          <span class="tic">{action.icon}</span>
          <span class="tname">{action.label}</span>
          {#if action.active?.()}<span class="tstate">On</span>{:else if learned}<span class="tstate dim">used {actionLog.count(action.id)}×</span>{/if}
        </button>
        <button class="dots" onclick={() => (menuId = menuId === action.id ? null : action.id)} aria-label="options">⋯</button>
        {#if menuId === action.id}
          <div class="menu" role="menu">
            <button onclick={() => pin(action.id)}>📌 Pin to favourites</button>
            <button onclick={() => hide(action.id)}>🚫 Not useful</button>
          </div>
        {/if}
      </div>
    {/each}
  </div>
</section>

<!-- Favourites (pinned, stable) -->
{#if pinned.length}
  <section class="sec">
    <div class="sh"><span class="st">Favourites</span><button class="link" onclick={() => onnav("overview")}>Edit on Dashboard →</button></div>
    <div class="sgrid">
      {#each pinned as p (p.id)}
        <div class="scell">
          <button class="tile" class:on={p.active?.()} onclick={() => fire(p.id)}>
            <span class="tic">{p.icon}</span>
            <span class="tname">{p.label}</span>
            {#if p.active?.()}<span class="tstate">On</span>{/if}
          </button>
        </div>
      {/each}
    </div>
  </section>
{/if}

<!-- Quick controls + lights -->
<div class="cols">
  <section class="sec card">
    <div class="sh"><span class="st">Pumps &amp; heater</span></div>
    <div class="ctrls">
      {#each controls as c (c.id)}
        <button class="ctrl" class:on={c.active?.()} onclick={() => fire(c.id)}>
          <span class="cic">{c.icon}</span>
          <span class="cname">{c.label}</span>
          <span class="cstate">{c.active?.() ? "On" : "Off"}</span>
        </button>
      {/each}
    </div>
  </section>

  <section class="sec card">
    <div class="sh">
      <span class="st">Lights</span>
      <div class="lhact">
        <button class="link" onclick={() => { fire("lightsoff"); }}>All off</button>
        <button class="link" onclick={() => onnav("lights")}>All →</button>
      </div>
    </div>
    <div class="ctrls">
      {#each QUICK_LIGHTS as l (l.id)}
        <div class="ltile" class:on={ha.isOn(l.id)}>
          <button class="ltap" onclick={() => ha.toggle(l.id)}>
            <span class="cic">{l.icon}</span>
            <span class="cname">{l.label}</span>
            <span class="cstate">{ha.isOn(l.id) ? "On" : "Off"}</span>
          </button>
          <button class="tune" onclick={() => lightSheet.open(l.id, l.label)} aria-label="brightness">⋯</button>
        </div>
      {/each}
    </div>
  </section>
</div>

<!-- Room-aware scenes -->
<section class="sec">
  <RoomScenes />
</section>

<!-- Jump to — ranked by the views you actually open most -->
<section class="sec">
  <div class="sh">
    <span class="st">Jump to</span>
    <span class="scap">{jumps.some((j) => j.learned) ? "your most-used pages" : "popular pages"}</span>
  </div>
  <div class="jumps">
    {#each jumps as j (j.id)}
      <button class="jump" onclick={() => onnav(j.id)}><Icon name={j.ic} size={16} /> {j.name}</button>
    {/each}
    <button class="jump ghost" onclick={() => onnav("usage")}><Icon name="trending" size={16} /> Usage</button>
  </div>
</section>

<style>
  .head { display: flex; align-items: flex-end; justify-content: space-between; gap: 14px; margin-bottom: 16px; flex-wrap: wrap; }
  h1 { margin: 0; font-size: 27px; font-weight: 800; letter-spacing: -0.7px; background: var(--title-grad); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .htext p { margin: 5px 0 0; color: var(--dim); font-size: 13px; }
  .hactions { display: flex; align-items: center; gap: 9px; }
  .trust { display: inline-flex; align-items: center; gap: 7px; padding: 7px 12px; border-radius: 999px; font-size: 11.5px; font-weight: 700; color: var(--warning); background: color-mix(in srgb, var(--warning) 12%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--warning) 32%, transparent); }
  .trust.ok { color: var(--success); background: color-mix(in srgb, var(--success) 12%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--success) 30%, transparent); }
  .tdot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; box-shadow: 0 0 8px currentColor; }
  .hbtn { display: inline-flex; align-items: center; gap: 7px; padding: 9px 13px; border-radius: 11px; background: rgba(255,255,255,0.05); color: var(--text-2); font-size: 12.5px; font-weight: 600; }
  .hbtn:hover { background: rgba(255,255,255,0.09); color: var(--text); }
  .hbtn.ghost { background: var(--soft); color: var(--acc); box-shadow: inset 0 0 0 1px var(--line); }

  /* Security hero */
  .hero { position: relative; overflow: hidden; display: flex; align-items: center; gap: 16px; width: 100%; text-align: left; padding: 20px; border-radius: 18px; margin-bottom: 14px; background: rgba(255,255,255,0.045); box-shadow: inset 0 0 0 1px var(--line); transition: transform 0.12s, box-shadow 0.15s; }
  .hero:hover { transform: translateY(-1px); }
  .hero:active { transform: scale(0.995); }
  .hero.armed { background: color-mix(in srgb, var(--success) 13%, transparent); box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--success) 42%, transparent); }
  .hero.triggered { background: color-mix(in srgb, var(--error) 16%, transparent); box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--error) 55%, transparent); animation: pulse 1.1s ease-in-out infinite; }
  .hglow { position: absolute; inset: 0; pointer-events: none; }
  .hicon { font-size: 30px; line-height: 1; flex-shrink: 0; }
  .hbody { flex: 1; min-width: 0; }
  .hlabel { font-size: 17px; font-weight: 800; letter-spacing: -0.3px; }
  .hsub { font-size: 12.5px; color: var(--dim); margin-top: 2px; text-transform: capitalize; }
  .haction { flex-shrink: 0; padding: 10px 18px; border-radius: 12px; font-size: 13px; font-weight: 800; background: var(--grad); color: #06121b; }
  @keyframes pulse { 0%,100% { box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--error) 55%, transparent); } 50% { box-shadow: inset 0 0 0 2.5px var(--error); } }

  /* Glance ribbon */
  .ribbon { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 18px; }
  .rib { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 13px 8px; border-radius: 14px; background: rgba(255,255,255,0.04); }
  .rib:hover { background: rgba(255,255,255,0.075); }
  .ri { font-size: 18px; }
  .rv { font-size: 17px; font-weight: 800; letter-spacing: -0.4px; }
  .rv small { font-size: 10px; color: var(--dim); font-weight: 600; margin-left: 1px; }
  .rl { font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }

  .sec { margin-bottom: 18px; }
  .sec.card { padding: 16px; border-radius: 16px; background: rgba(255,255,255,0.03); box-shadow: inset 0 0 0 1px var(--line); }
  .sh { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin-bottom: 11px; }
  .st { font-size: 11px; font-weight: 700; letter-spacing: 0.09em; text-transform: uppercase; color: var(--muted); }
  .scap { font-size: 11px; color: var(--muted-2); font-style: italic; }
  .link { font-size: 11.5px; font-weight: 600; color: var(--acc2, var(--acc)); }
  .link:hover { color: var(--acc); }
  .speak { font-size: 11px; font-weight: 600; color: var(--muted); background: rgba(255,255,255,0.05); border-radius: 9px; padding: 5px 10px; }
  .speak.on { background: var(--soft); color: var(--acc); }

  /* Scenes */
  .scenes { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; }
  @media (max-width: 720px) { .scenes { grid-template-columns: repeat(3, 1fr); } }
  .scene { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 18px 8px; border-radius: 16px; background: rgba(255,255,255,0.05); box-shadow: inset 0 1px 0 rgba(255,255,255,0.06); transition: transform 0.12s, background 0.15s; min-height: 92px; }
  .scene:hover { background: rgba(255,255,255,0.09); transform: translateY(-1px); }
  .scene:active { transform: scale(0.97); }
  .scene.done { background: color-mix(in srgb, var(--success) 20%, transparent); box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--success) 50%, transparent); }
  .sic { font-size: 25px; line-height: 1; }
  .scene.done .sic { color: var(--success); }
  .sname { font-size: 12px; font-weight: 700; }

  /* Suggested + favourites grid */
  .sgrid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; }
  @media (max-width: 1000px) { .sgrid { grid-template-columns: repeat(4, 1fr); } }
  @media (max-width: 560px) { .sgrid { grid-template-columns: repeat(3, 1fr); } }
  .scell { position: relative; }
  .tile { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; width: 100%; padding: 15px 8px; border-radius: 15px; background: rgba(255,255,255,0.045); box-shadow: inset 0 1px 0 rgba(255,255,255,0.06); transition: transform 0.12s, background 0.15s; min-height: 88px; }
  .tile:hover { background: rgba(255,255,255,0.08); transform: translateY(-1px); }
  .tile:active { transform: scale(0.97); }
  .tile.on { background: color-mix(in srgb, var(--acc) 16%, transparent); box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--acc) 42%, transparent); }
  .tic { font-size: 22px; line-height: 1; }
  .tname { font-size: 11.5px; font-weight: 600; text-align: center; }
  .tstate { font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--acc); }
  .tstate.dim { color: var(--muted-2); text-transform: none; letter-spacing: 0; }
  .dots { position: absolute; top: 5px; right: 5px; width: 22px; height: 22px; border-radius: 7px; color: var(--muted-2); font-size: 13px; opacity: 0; transition: opacity 0.12s; }
  .scell:hover .dots { opacity: 1; }
  .dots:hover { background: rgba(255,255,255,0.12); color: var(--text); }
  .menu { position: absolute; top: 30px; right: 4px; z-index: 20; display: flex; flex-direction: column; gap: 2px; padding: 5px; border-radius: 11px; background: rgba(16,22,31,0.99); box-shadow: 0 20px 50px -18px rgba(0,0,0,0.85), inset 0 0 0 1px var(--line); animation: ppop 0.15s ease; }
  .menu button { text-align: left; white-space: nowrap; font-size: 12px; font-weight: 600; padding: 8px 12px; border-radius: 8px; color: var(--text-2); }
  .menu button:hover { background: rgba(255,255,255,0.08); color: var(--text); }

  /* Two-column controls */
  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 18px; }
  @media (max-width: 720px) { .cols { grid-template-columns: 1fr; } }
  .ctrls { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; }
  .ctrl, .ltile { position: relative; display: flex; align-items: center; gap: 10px; padding: 12px; border-radius: 13px; background: rgba(255,255,255,0.045); text-align: left; }
  .ctrl:hover { background: rgba(255,255,255,0.08); }
  .ctrl.on, .ltile.on { background: var(--soft); box-shadow: inset 0 0 0 1.5px var(--line); }
  .ltile.on { background: color-mix(in srgb, var(--warning) 14%, transparent); box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--warning) 42%, transparent); }
  .ltap { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; text-align: left; }
  .cic { font-size: 17px; flex-shrink: 0; }
  .cname { flex: 1; min-width: 0; font-size: 12.5px; font-weight: 600; }
  .cstate { font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
  .ctrl.on .cstate { color: var(--acc); }
  .tune { position: absolute; top: 8px; right: 8px; width: 24px; height: 24px; border-radius: 7px; background: rgba(255,255,255,0.09); color: #dbe6f0; font-size: 13px; }
  .tune:hover { background: rgba(255,255,255,0.18); }
  .lhact { display: flex; gap: 12px; }

  .jumps { display: flex; flex-wrap: wrap; gap: 9px; }
  .jump { display: inline-flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 12px; background: rgba(255,255,255,0.045); font-size: 12.5px; font-weight: 600; color: var(--text-2); }
  .jump:hover { background: rgba(255,255,255,0.09); color: var(--text); }
  .jump.ghost { background: transparent; box-shadow: inset 0 0 0 1px var(--line); color: var(--muted); }
  .jump.ghost:hover { background: rgba(255,255,255,0.05); color: var(--text-2); }
</style>
