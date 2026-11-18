<script lang="ts">
  // House model — the plan, in three dimensions, with a layer per question.
  //
  // This is the first cut of concept 1 from the November 2026 concept board. It
  // draws the living level from the SAME rectangles the flat plan uses (plan.ts)
  // and reads everything through the store's ordinary readers, which is what
  // makes two things true without any code here:
  //   · the time machine rewinds it, sun included (the sun is computed from the
  //     moment on screen, not read from a live attribute);
  //   · mock mode works.
  //
  // What it deliberately does NOT do yet: the level below (garage, store room,
  // laundry), the 25 zones with no settled position, cameras, energy and water
  // flows. The unplaced zones are listed under the model rather than left out —
  // a zone you cannot see is a zone you cannot check.
  import { onMount, untrack } from "svelte";
  import { ha } from "../lib/store.svelte";
  import { prefs } from "../lib/prefs.svelte";
  import { authStore } from "../lib/auth.svelte";
  import { timeMachine } from "../lib/timeMachine.svelte";
  import { toast } from "../lib/toast.svelte";
  import { actionLog } from "../lib/actionLog.svelte";
  import { lightSheet } from "../lib/lightSheet.svelte";
  import { n, power } from "../lib/format";
  import { comfortBand, type ComfortBand } from "../lib/fn";
  import { stable } from "../lib/stable";
  import { E } from "../lib/entities";
  import { GATE, posture, POSTURE_WORD } from "../lib/gate";
  import { PLAN, type Dev, type PlanRoom } from "../lib/plan";
  import { ROOM_SCENES, SCENE_ROOMS } from "../lib/rooms";
  import { deriveZones, type Zone } from "../lib/zones";
  import { GARAGE_UNDER, SITE, SITE_LAT, SITE_LON, YARD_RING, bearingToPlanTurn, enToPlan, placeZones, roomRects, slotPosition, streetLabelPoint, sunVector } from "../lib/spatial";
  import { sunAt } from "../lib/sun";
  import { createHouseModel, type Frame, type Framing, type HouseModel, type Palette } from "../lib/model/scene";
  import Failed from "../lib/components/Failed.svelte";

  let { onnav }: { onnav: (id: string) => void } = $props();

  type Layer = "comfort" | "power" | "security";
  type ZoneState = "clear" | "open" | "bypassed";

  const RECTS = roomRects();
  const RECT = new Map(RECTS.map((r) => [r.id, r]));
  const SITE_ITEMS = SITE.map((s) => ({ id: s.id, kind: s.kind, label: s.label, ...enToPlan(s.e, s.n), turn: s.bearing == null ? 0 : bearingToPlanTurn(s.bearing) }));
  const YARD_PLAN = YARD_RING.map((c) => enToPlan(c.e, c.n));
  const STREET = (() => { const p = streetLabelPoint(); return enToPlan(p.e, p.n); })();

  let layer = $state<Layer>("comfort");
  let selId = $state("kitchen");
  const sel = $derived(PLAN.find((r) => r.id === selId) ?? PLAN[0]);

  // Guests never get the security layer — same line the rest of the app draws.
  const guest = $derived(prefs.guest || authStore.isGuest);
  $effect(() => { if (guest && layer === "security") layer = "comfort"; });

  // ── Colours, resolved from the theme tokens ───────────────────────────────
  // The scene cannot read CSS variables, so they are resolved here and re-read
  // when the theme changes. Lamp light is the one literal: it is light, not a
  // status, and a warm white reads as a lamp on all nine themes.
  const LAMP = "#ffdcae";
  function readTokens() {
    const cs = getComputedStyle(document.documentElement);
    const g = (k: string) => cs.getPropertyValue(k).trim();
    const pal: Palette = {
      ground: g("--bg"), floor: g("--s2"), tx: g("--tx"), mut: g("--mut"), acc: g("--acc"),
      ok: g("--ok"), warn: g("--warn"), water: g("--water"), glow: LAMP,
    };
    return { pal, heat: [1, 2, 3, 4, 5].map((i) => g(`--heat-${i}`)) };
  }
  let tokens = $state.raw(readTokens());
  $effect(() => { void prefs.theme; tokens = readTokens(); });

  const BAND_IX: Record<ComfortBand, number> = { cold: 0, cool: 1, comfortable: 2, warm: 3, hot: 4 };
  const BAND_WORD: Record<ComfortBand, string> = { cold: "Cold", cool: "Cool", comfortable: "Comfortable", warm: "Warm", hot: "Hot" };
  const HEAT_LEGEND = ["<14°", "14–17°", "17–21°", "22–25°", ">25°"];

  // ── The sun, from the moment on screen ────────────────────────────────────
  let tick = $state(Date.now());
  const at = $derived(timeMachine.active ? timeMachine.at : tick);
  const sunPos = $derived(sunAt(at, SITE_LAT, SITE_LON));
  const sunWord = $derived(
    sunPos.elevation > 6 ? `sun ${Math.round(sunPos.elevation)}° up` : sunPos.elevation > -6 ? "sun on the horizon" : "sun down",
  );

  // ── Zones ─────────────────────────────────────────────────────────────────
  // Re-derived only when the NUMBER of entities changes. The id set is fixed
  // between restarts, and running four regexes over ~5,000 ids every 300 ms tick
  // would be the render-loop mistake stable.ts was written about.
  const entityCount = $derived(Object.keys(ha.entities).length);
  const zones = $derived.by(() => { void entityCount; return deriveZones(Object.keys(untrack(() => ha.entities))); });
  const placement = $derived(placeZones(zones));
  const zoneState = (z: Zone): ZoneState => (ha.isOn(z.bypass) ? "bypassed" : ha.isOn(z.id) ? "open" : "clear");
  const zoneWord = (z: Zone): string => {
    const st = zoneState(z);
    return st === "bypassed" ? (ha.isOn(z.id) ? "Bypassed · open" : "Bypassed") : st === "open" ? "Open" : "Clear";
  };
  const roomZones = (id: string) => placement.placed.filter((p) => p.room === id).map((p) => p.zone);

  // ── Room readings ─────────────────────────────────────────────────────────
  const devs = (r: PlanRoom): Dev[] => [...(r.lights ?? []), ...(r.appliances ?? [])];
  const firstTemp = (r: PlanRoom) => (r.temps?.[0] ? ha.num(r.temps[0].id) : null);
  const watts = (r: PlanRoom) => devs(r).reduce((s, d) => s + (d.power && ha.isOn(d.id) ? (ha.num(d.power) ?? 0) : 0), 0);
  const lightsOn = (r: PlanRoom) => (r.lights ?? []).filter((l) => ha.isOn(l.id)).length;
  const occupied = (r: PlanRoom) => (r.occ ? ha.isOn(r.occ) : false);
  const pw = (w: number | null) => { const p = power(w); return `${p.val} ${p.unit}`; };

  // ── The frame handed to the scene ─────────────────────────────────────────
  // Rebuilt on every store tick, but only HANDED OVER when its content changed:
  // the memo returns the previous object while the signature is the same, so a
  // quiet house draws nothing.
  const memo = stable<Frame>();
  const frame = $derived.by(() => {
    const { pal, heat } = tokens;
    const rooms = PLAN.map((r) => {
      const glow = r.lights?.length ? lightsOn(r) / r.lights.length : 0;
      const occ = occupied(r);
      if (layer === "comfort") {
        const t = firstTemp(r);
        const band = comfortBand(t);
        return { id: r.id, tint: band ? heat[BAND_IX[band]] : null, strength: band ? 0.6 : 0, glow, occupied: false, sub: t != null ? `${n(t, 1)}°` : "", alert: false };
      }
      if (layer === "power") {
        const w = watts(r);
        return {
          id: r.id,
          tint: w > 0 ? pal.warn : occ ? pal.ok : null,
          // 0–600 W is a scale, not a threshold — the same mapping the flat plan uses.
          strength: w > 0 ? 0.18 + (Math.min(w, 600) / 600) * 0.5 : occ ? 0.3 : 0,
          glow, occupied: occ, sub: w > 0 ? pw(w) : occ ? "occupied" : "", alert: false,
        };
      }
      const open = roomZones(r.id).filter((z) => zoneState(z) === "open").length;
      return { id: r.id, tint: open ? pal.warn : null, strength: open ? 0.5 : 0, glow, occupied: occ, sub: open ? `${open} open` : "", alert: open > 0 };
    });

    const markers = layer !== "security" ? [] : placement.placed.flatMap((p) => {
      const rect = RECT.get(p.room);
      if (!rect) return [];
      const st = zoneState(p.zone);
      return [{ key: p.zone.n, ...slotPosition(rect, p.slot, p.of), state: st, text: st === "clear" ? "" : `${p.zone.label} · ${zoneWord(p.zone).toLowerCase()}` }];
    });

    const site = SITE.map((s) => {
      if (s.kind === "tank") {
        const lvl = ha.num(E.tankLevel);
        return { id: s.id, sub: lvl != null ? `${n(lvl)}%` : "", level: lvl != null ? lvl / 100 : null, alert: false };
      }
      if (s.kind === "gate" && ha.exists(GATE.closedContact)) {
        const p = posture(ha.isOn(GATE.closedContact), ha.isOn(GATE.openContact), ha.isOn(GATE.moving));
        return { id: s.id, sub: POSTURE_WORD[p].toLowerCase(), level: null, alert: p !== "closed" };
      }
      if (s.kind === "pool") {
        const w = ha.num(E.poolPumpPower);
        // 40 W is the PUMPS threshold in entities.ts: above it the pump is moving water.
        return { id: s.id, sub: w == null ? "" : w > 40 ? "pump running" : "pump idle", level: null, alert: false };
      }
      return { id: s.id, sub: "", level: null, alert: false };
    });

    const f: Frame = { palette: pal, sun: sunVector(sunPos.azimuth, sunPos.elevation), selected: selId, rooms, markers, site };
    return memo(f, JSON.stringify(f));
  });

  // ── Mount ─────────────────────────────────────────────────────────────────
  let canvas = $state<HTMLCanvasElement>();
  let labelLayer = $state<HTMLDivElement>();
  let model = $state.raw<HouseModel | null>(null);
  let failed = $state("");
  // Which fit the view holds. The scene clears it the moment the camera is moved
  // by hand, so the pressed button never claims a framing that is no longer true.
  let framing = $state<Framing | null>("house");

  onMount(() => {
    let m: HouseModel | null = null;
    try {
      if (!canvas || !labelLayer) throw new Error("no canvas");
      m = createHouseModel(canvas, labelLayer, { rooms: RECTS, site: SITE_ITEMS, garage: GARAGE_UNDER, yard: YARD_PLAN, street: STREET }, (id) => (selId = id), (f) => (framing = f));
      model = m;
    } catch (e) {
      // No WebGL (an old device, or a context the browser refused). The flat
      // plan carries the same data, so the fallback is a link, not a dead end.
      failed = e instanceof Error ? e.message : String(e);
    }
    const iv = setInterval(() => (tick = Date.now()), 60_000);
    return () => { clearInterval(iv); m?.dispose(); };
  });
  $effect(() => { model?.set(frame); });

  // ── Selected room ─────────────────────────────────────────────────────────
  const selTemp = $derived(firstTemp(sel));
  const selBand = $derived(comfortBand(selTemp));
  const selHum = $derived(sel.hum ? ha.num(sel.hum) : null);
  const selWatts = $derived(watts(sel));
  const selOcc = $derived(sel.occ ? ha.isOn(sel.occ) : null);
  const selZones = $derived(roomZones(sel.id));
  const sceneRoom = $derived(sel.scene ? SCENE_ROOMS.find((s) => s.key === sel.scene) : undefined);
  const sceneLit = $derived(sceneRoom ? sceneRoom.lights.filter((id) => ha.isOn(id)).length : 0);

  function runScene(key: "bright" | "relax" | "off") {
    if (!sel.scene || !sceneRoom) return;
    // The store refuses writes while rewound. Say so, instead of a toast that
    // claims the lights changed.
    if (timeMachine.active) { toast.show("Viewing the past — nothing was switched"); return; }
    ha.roomScene(sel.scene, key);
    actionLog.record(`room:${key}`);
    toast.show(`${sceneRoom.label} · ${key}`);
  }

  const unplaced = $derived.by(() => {
    const rank: Record<ZoneState, number> = { open: 0, bypassed: 1, clear: 2 };
    return placement.unplaced
      .map((z) => ({ z, st: zoneState(z), word: zoneWord(z) }))
      .sort((a, b) => rank[a.st] - rank[b.st] || a.z.n.localeCompare(b.z.n));
  });
  const unplacedOpen = $derived(unplaced.filter((u) => u.st === "open").length);
</script>

{#snippet devtile(d: Dev)}
  {@const on = ha.isOn(d.id)}
  {@const w = d.power ? ha.num(d.power) : null}
  <div class="ltile" class:on>
    <div class="ltap" role="button" tabindex="0" onclick={() => ha.toggle(d.id, d.label)} onkeydown={(e) => { if (e.key === "Enter") ha.toggle(d.id, d.label); }}>
      <span class="li">{d.icon}</span>
      <span class="ll">
        <span class="ln">{d.label}</span>
        <span class="ls">{on ? "On" : "Off"}{d.power ? ` · ${pw(w)}` : ""}</span>
      </span>
    </div>
    {#if d.id.startsWith("light.")}<button class="tune" onclick={() => lightSheet.open(d.id, d.label)} aria-label="Brightness and colour for {d.label}">⋯</button>{/if}
  </div>
{/snippet}

<div class="grid">
  <div class="card pad">
    <div class="rh">
      <span class="lb">302 Wyoming · drag to turn, tap a room</span>
      <span class="ovl" role="group" aria-label="Model layer">
        <button class="ob" class:on={layer === "comfort"} onclick={() => (layer = "comfort")}>Comfort</button>
        <button class="ob" class:on={layer === "power"} onclick={() => (layer = "power")}>Power &amp; people</button>
        {#if !guest}<button class="ob" class:on={layer === "security"} onclick={() => (layer = "security")}>Security</button>{/if}
      </span>
      <span class="sub">{timeMachine.active ? timeMachine.label : "Live"} · {sunWord}</span>
    </div>

    {#if failed}
      <Failed what="Couldn't start the 3D model" detail={failed} />
      <button class="link" onclick={() => onnav("roomsdetail")}>Open the flat floor plan instead</button>
    {/if}
    <div class="stage" class:gone={!!failed}>
      <canvas bind:this={canvas} aria-label="3D model of the house. Use the room buttons below to select a room."></canvas>
      <div class="labels" bind:this={labelLayer} aria-hidden="true"></div>
      <!-- Buttons, because pinch and Ctrl-scroll are invisible: nobody finds a
           zoom they have to already know about. House and Yard are fits, not
           zoom levels — each frames its subject from whatever angle you are at. -->
      <div class="cam" role="group" aria-label="Model view">
        <button class="cb" class:on={framing === "house"} aria-pressed={framing === "house"} onclick={() => model?.frame("house")} title="Fit the house in view">House</button>
        <button class="cb" class:on={framing === "yard"} aria-pressed={framing === "yard"} onclick={() => model?.frame("yard")} title="Fit the whole yard in view">Yard</button>
        <span class="csep" aria-hidden="true"></span>
        <button class="cb sq" onclick={() => model?.zoom(1.25)} aria-label="Zoom out" title="Zoom out">−</button>
        <button class="cb sq" onclick={() => model?.zoom(0.8)} aria-label="Zoom in" title="Zoom in">+</button>
      </div>
    </div>

    <!-- The legend swaps with the layer, for the reason the flat plan gives: a
         legend describing a scale the drawing is no longer using is worse than
         none. Shapes are drawn, not just named — colour is never the only cue. -->
    <div class="legend">
      {#if layer === "comfort"}
        <span class="ramp">
          <span class="ll2">Cool</span>
          {#each tokens.heat as c, i}<span class="lc" style="background:{c}" title={HEAT_LEGEND[i]}></span>{/each}
          <span class="ll2">Warm</span>
        </span>
      {:else if layer === "power"}
        <span class="lg2"><span class="lcd" style="background:color-mix(in srgb, var(--warn) 55%, transparent)"></span>Drawing power, deeper is more</span>
        <span class="lg2"><svg viewBox="0 0 14 14" width="13" height="13" aria-hidden="true"><circle cx="7" cy="7" r="4.6" fill="none" stroke="var(--ok)" stroke-width="2.2" /></svg>Occupied</span>
      {:else}
        <span class="lg2"><svg viewBox="0 0 14 14" width="13" height="13" aria-hidden="true"><rect x="5" y="3" width="4" height="9" rx="1.5" fill="var(--mut)" /></svg>Zone, clear</span>
        <span class="lg2"><svg viewBox="0 0 14 14" width="13" height="13" aria-hidden="true"><rect x="3.5" y="0.5" width="7" height="13" rx="2" fill="var(--warn)" /></svg>Open</span>
        <span class="lg2"><svg viewBox="0 0 14 14" width="13" height="13" aria-hidden="true"><rect x="5" y="9" width="4" height="3.5" rx="1" fill="var(--mut)" opacity=".6" /></svg>Bypassed</span>
        <span class="lg2"><svg viewBox="0 0 14 14" width="13" height="13" aria-hidden="true"><circle cx="7" cy="7" r="4.6" fill="none" stroke="var(--ok)" stroke-width="2.2" /></svg>Occupied</span>
      {/if}
      <span class="lg2"><span class="lcd" style="background:{LAMP}"></span>Lights on</span>
    </div>

    <div class="rooms" role="group" aria-label="Rooms">
      {#each PLAN as r (r.id)}
        <button class="rc" class:on={selId === r.id} aria-pressed={selId === r.id} onclick={() => (selId = r.id)}>{r.label}</button>
      {/each}
    </div>

    <div class="note">
      The living level, with the walls cut low so you can see in. The sun and its shadows follow the
      clock on screen. The plan's bearing, the yard's outline and where the pool, gate, carport and
      JoJo sit were read off an aerial photo, so treat them as right to within a few metres.
    </div>
  </div>

  <div class="card pad">
    <div class="ah">
      <span class="an">{sel.label}{#if selOcc != null}<span class="occ" class:oon={selOcc}>{selOcc ? "occupied" : "empty"}</span>{/if}</span>
      <span class="sub">{selWatts > 0 ? `⚡ ${pw(selWatts)}` : ""}{selWatts > 0 && selHum != null ? " · " : ""}{selHum != null ? `${n(selHum)}% RH` : ""}</span>
    </div>

    {#if sel.temps?.length}
      <div class="tr">
        <div class="bigt">{n(selTemp, 1)}{#if selTemp != null}<span class="deg">°</span>{/if}</div>
        <div class="pill">
          {#if selBand}<span class="pd" style="background:{tokens.heat[BAND_IX[selBand]]}"></span>{BAND_WORD[selBand]}{:else}No reading{/if}
        </div>
      </div>
    {/if}

    {#if sceneRoom}
      <div class="hr"></div>
      <div class="sh"><span class="lbl">Scene</span><span class="sub">{sceneRoom.label} · {sceneLit} of {sceneRoom.lights.length} on</span></div>
      <div class="verbs">
        {#each ROOM_SCENES as s (s.key)}
          <button class="verb" onclick={() => runScene(s.key)}><span>{s.icon}</span>{s.label}</button>
        {/each}
      </div>
    {/if}

    {#if sel.lights?.length}
      <div class="hr"></div>
      <div class="lbl">Lights</div>
      <div class="lgrid">{#each sel.lights as d (d.id)}{@render devtile(d)}{/each}</div>
    {/if}

    {#if sel.appliances?.length}
      <div class="hr"></div>
      <div class="lbl">Appliances</div>
      <div class="lgrid">{#each sel.appliances as d (d.id)}{@render devtile(d)}{/each}</div>
    {/if}

    {#if !guest && selZones.length}
      <div class="hr"></div>
      <div class="lbl">Alarm zones here</div>
      <div class="zlist">
        {#each selZones as z (z.n)}
          {@const st = zoneState(z)}
          <div class="zrow" data-st={st}><span class="zn">{z.n}</span><span class="zl">{z.label}</span><span class="zs">{zoneWord(z)}</span></div>
        {/each}
      </div>
    {/if}

    {#if !sel.temps?.length && !sel.lights?.length && !sel.appliances?.length && !selZones.length}
      <div class="none">No sensors or controls in this room.</div>
    {/if}
  </div>

  {#if layer === "security" && !guest}
    <div class="card pad wide">
      <div class="rh">
        <span class="lb">Not on the model yet · {unplaced.length} of {zones.length} zones</span>
        <span class="sub">{unplacedOpen ? `${unplacedOpen} open` : "none open"} · {placement.placed.length} placed</span>
      </div>
      <div class="ugrid">
        {#each unplaced as u (u.z.n)}
          <div class="zrow" data-st={u.st}><span class="zn">{u.z.n}</span><span class="zl">{u.z.label}</span><span class="zs">{u.word}</span></div>
        {/each}
      </div>
      <div class="note">
        These zones are live here, they just have no settled position: the beams and the garage need the
        yard and the level below drawn, and "Lounge", "Kids Room" and "Front Door" need a room named for
        them in <code>spatial.ts</code>. Arming and bypass stay on the Security page.
        <button class="link inl" onclick={() => onnav("security")}>Open Security</button>
      </div>
    </div>
  {/if}
</div>

<style>
  .grid { display: grid; grid-template-columns: 1.55fr 1fr; gap: var(--gap-section); align-items: start; }
  @media (max-width: 980px) { .grid { grid-template-columns: 1fr; } }
  .wide { grid-column: 1 / -1; }
  .rh { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 8px 12px; margin-bottom: 12px; }
  .lb { font-size: 13px; font-weight: 700; color: var(--tx2); min-width: 0; }
  .sub { font-size: 12px; color: var(--tx2); font-variant-numeric: tabular-nums; }
  .ovl { display: inline-flex; gap: 2px; padding: 2px; border-radius: var(--r-control); background: var(--fill); }
  .ob { padding: 6px 11px; border-radius: 8px; font-size: 11.5px; font-weight: 700; color: var(--mut); background: none; min-height: 32px; }
  .ob.on { background: var(--fill-strong); color: var(--tx); }

  /* The stage is the card's own surface with a hairline: the model's ground
     plate is --bg, one step darker, so the house sits ON something. */
  .stage { position: relative; width: 100%; aspect-ratio: 16 / 10; max-height: 68vh; min-height: 280px; border-radius: var(--r-inner); overflow: hidden; background: color-mix(in srgb, var(--bg) 55%, var(--s1)); box-shadow: inset 0 0 0 1px var(--line); }
  .stage.gone { display: none; }
  @media (max-width: 640px) { .stage { aspect-ratio: 1 / 1; } }
  canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; cursor: grab; }
  canvas:active { cursor: grabbing; }
  .labels { position: absolute; inset: 0; pointer-events: none; overflow: hidden; container-type: inline-size; }
  .labels :global(.hm-l) { position: absolute; left: 0; top: 0; display: flex; flex-direction: column; align-items: center; gap: 1px; white-space: nowrap; font-size: 10.5px; line-height: 1.15; color: var(--tx); text-shadow: 0 1px 3px rgba(5, 9, 15, 0.95), 0 0 2px rgba(5, 9, 15, 0.9); will-change: transform; }
  .labels :global(.hm-l b) { font-weight: 700; }
  .labels :global(.hm-l i) { font-style: normal; font-weight: 700; color: var(--tx2); font-variant-numeric: tabular-nums; }
  .labels :global(.hm-l i:empty) { display: none; }
  .labels :global(.hm-l[data-alert="1"] i) { color: var(--warn); }
  .labels :global(.hm-l[data-kind="site"] b) { color: var(--tx2); }
  .labels :global(.hm-l[data-kind="note"]) { color: var(--mut); font-size: 9.5px; font-weight: 600; }
  .labels :global(.hm-l[data-kind="zone"]) { padding: 3px 8px; border-radius: var(--r-pill); background: rgba(18, 20, 23, 0.86); box-shadow: inset 0 0 0 1px var(--line); font-weight: 700; text-shadow: none; }
  .labels :global(.hm-l[data-kind="zone"][data-state="open"]) { box-shadow: inset 0 0 0 1px var(--warn); }
  /* Set by the scene from the zoom level: readings go first, then room names. */
  /* data-far is written by the scene, not the template, so the attribute has to
     be :global or Svelte prunes these rules as unused and they silently do nothing. */
  .labels:global([data-far="1"]) :global(.hm-l[data-kind="room"] i), .labels:global([data-far="1"]) :global(.hm-l[data-kind="note"]) { display: none; }
  .labels:global([data-far="1"]) :global(.hm-l[data-kind="room"]) { font-size: 9.5px; }
  .labels:global([data-far="2"]) :global(.hm-l[data-kind="room"]), .labels:global([data-far="2"]) :global(.hm-l[data-kind="note"]) { display: none; }
  /* Solid, not glass: blur is for modals only, and these sit over a moving model. */
  .cam { position: absolute; top: 8px; right: 8px; display: flex; align-items: center; gap: 2px; padding: 3px; border-radius: var(--r-control); background: var(--s1); box-shadow: inset 0 0 0 1px var(--line), var(--shadow); }
  .cb { min-height: 32px; padding: 0 11px; border-radius: 7px; font-size: 11.5px; font-weight: 700; color: var(--mut); background: none; }
  .cb:hover { color: var(--tx); background: var(--fill); }
  .cb.on { background: var(--fill-strong); color: var(--tx); }
  .cb.sq { width: 32px; padding: 0; font-size: 17px; line-height: 1; color: var(--tx2); }
  .csep { width: 1px; height: 18px; margin: 0 3px; background: var(--line); }
  @media (max-width: 640px) { .cb { min-height: 36px; } .cb.sq { width: 36px; } }
  @container (max-width: 520px) {
    .labels :global(.hm-l[data-kind="room"] i), .labels :global(.hm-l[data-kind="note"]) { display: none; }
    .labels :global(.hm-l) { font-size: 9.5px; }
  }

  .legend { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 6px 16px; margin-top: 12px; }
  .ramp { display: inline-flex; align-items: center; gap: 5px; }
  .lc { width: 26px; height: 9px; border-radius: 2px; }
  .ll2 { font-size: 10.5px; color: var(--mut); }
  .lg2 { display: inline-flex; align-items: center; gap: 6px; font-size: 10.5px; color: var(--mut); }
  .lcd { width: 10px; height: 10px; border-radius: 3px; flex: none; }
  .rooms { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 14px; }
  .rc { padding: 6px 11px; min-height: 32px; border-radius: var(--r-pill); background: var(--fill); font-size: 11.5px; font-weight: 700; color: var(--tx2); }
  .rc.on { background: var(--wash); box-shadow: inset 0 0 0 1px var(--acc); color: var(--tx); }
  .note { font-size: 11.5px; color: var(--mut); margin-top: 12px; line-height: 1.5; text-wrap: pretty; }
  .note code { font-size: 11px; color: var(--tx2); }
  .link { margin-top: 10px; font-size: 12px; font-weight: 700; color: var(--ok); text-decoration: underline; text-underline-offset: 3px; background: none; }
  .link.inl { margin: 0 0 0 6px; }

  .ah { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 14px; gap: 10px; flex-wrap: wrap; }
  .an { font-size: 18px; font-weight: 700; }
  .occ { font-size: 10px; font-weight: 700; margin-left: 9px; padding: 3px 8px; border-radius: var(--r-pill); background: var(--fill); color: var(--mut); vertical-align: middle; }
  .occ.oon { background: color-mix(in srgb, var(--ok) 18%, transparent); color: var(--ok); }
  .tr { display: flex; align-items: flex-end; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
  .bigt { font-size: 56px; font-weight: 800; letter-spacing: -2.5px; line-height: 0.9; font-variant-numeric: tabular-nums; }
  .deg { font-size: 24px; color: var(--tx2); }
  .pill { display: flex; align-items: center; gap: 9px; padding: 8px 14px; border-radius: var(--r-pill); font-size: 13px; font-weight: 700; background: var(--fill); }
  .pd { width: 9px; height: 9px; border-radius: 50%; }
  .hr { height: 1px; background: var(--line); margin: 16px 0; }
  .lbl { font-size: 13px; font-weight: 700; color: var(--tx2); margin-bottom: 11px; }
  .sh { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; flex-wrap: wrap; }
  .verbs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .verb { display: flex; align-items: center; justify-content: center; gap: 7px; min-height: 44px; border-radius: var(--r-control); background: var(--fill); font-size: 12.5px; font-weight: 700; color: var(--tx); }
  .verb:hover { background: var(--fill-strong); }
  .lgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .ltile { display: flex; align-items: center; padding: 13px; border-radius: var(--r-inner); background: var(--fill); }
  .ltile.on { background: color-mix(in srgb, var(--warn) 14%, transparent); box-shadow: inset 0 0 0 1.5px var(--warn); }
  .ltap { display: flex; align-items: center; gap: 11px; cursor: pointer; flex: 1; min-width: 0; }
  .li { font-size: 18px; }
  .ll { display: flex; flex-direction: column; line-height: 1.3; min-width: 0; }
  .ln { font-size: 12.5px; font-weight: 600; }
  .ls { font-size: 11px; color: var(--tx2); font-variant-numeric: tabular-nums; }
  .tune { width: 30px; height: 30px; border-radius: 8px; background: var(--fill-strong); font-size: 14px; flex-shrink: 0; }
  @media (max-width: 640px) { .tune { width: 36px; height: 36px; font-size: 16px; } }
  .none { padding: 15px; border-radius: var(--r-inner); background: var(--fill); font-size: 12.5px; color: var(--mut); }

  .zlist { display: grid; gap: 6px; }
  .ugrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 6px; }
  .zrow { display: flex; align-items: baseline; gap: 9px; padding: 9px 12px; border-radius: var(--r-control); background: var(--fill); font-size: 12.5px; }
  .zn { font-size: 11px; font-weight: 700; color: var(--mut); font-variant-numeric: tabular-nums; }
  .zl { flex: 1; min-width: 0; font-weight: 600; }
  .zs { font-size: 11.5px; font-weight: 700; color: var(--mut); }
  .zrow[data-st="open"] { box-shadow: inset 0 0 0 1.5px var(--warn); }
  .zrow[data-st="open"] .zs { color: var(--warn); }
  .zrow[data-st="bypassed"] .zl { color: var(--mut); }
</style>
