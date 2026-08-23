<script lang="ts">
  // The gate, on the Security screen — where a gate belongs.
  //
  // ORDER FOLLOWS THE GLANCE. Research on dashboard design is consistent that a
  // reader should understand the state in about three seconds, with the
  // safety-critical thing first and detail last. So: posture, then controls,
  // then health, then usage, then the camera's report card. Nothing about the
  // ESPHome build number competes with "is the gate open".
  //
  // FRICTION IS MATCHED TO BLAST RADIUS, which is the useful phrasing from the
  // destructive-action literature. Opening a gate lets anything in and cannot be
  // un-opened once someone has walked through, so Open asks twice and takes the
  // amber. Close and Stop are single-tap: both INCREASE safety, and a
  // confirmation on Stop would be actively dangerous when a leaf is closing on
  // something. The buttons are also separated and differently coloured, because
  // consequential and benign controls sitting adjacent and identical is how
  // mis-taps happen.
  import { ha } from "../store.svelte";
  import { GATE, posture, POSTURE_WORD, accuracyWords } from "../gate";
  import { n, since } from "../format";
  import { toast } from "../toast.svelte";

  const on = (id: string) => ha.isOn(id);
  const num = (id: string) => (ha.available(id) ? ha.num(id) : null);

  const closed = $derived(on(GATE.closedContact));
  const opened = $derived(on(GATE.openContact));
  const moving = $derived(on(GATE.moving));
  const post = $derived(posture(closed, opened, moving));
  const word = $derived(POSTURE_WORD[post]);

  // The controller's own word, kept alongside ours. When they disagree that is
  // itself information — it means the reeds and the state machine have drifted.
  const ctrlState = $derived(ha.state(GATE.state) ?? "—");

  const locks = $derived(on(GATE.locks));
  const tamper = $derived(on(GATE.tamper));
  const battLow = $derived(on(GATE.batteryLow));
  const volts = $derived(num(GATE.battery));
  const lockVolts = $derived(num(GATE.lockFeed));
  const wifi = $derived(num(GATE.wifi));
  const up = $derived(num(GATE.uptime));

  const opens = $derived(num(GATE.opensToday));
  const openHrs = $derived(num(GATE.openTimeToday));
  const cycles = $derived(num(GATE.cycles));
  const serviceAt = $derived(num(GATE.serviceAt));
  const servicePct = $derived(
    cycles != null && serviceAt != null && serviceAt > 0
      ? Math.min(100, (cycles / serviceAt) * 100)
      : null,
  );

  const camPct = $derived(num(GATE.camAccuracy));
  const camChecks = $derived(num(GATE.camChecks));
  const camWords = $derived(accuracyWords(camPct, camChecks));
  const falseClosed = $derived(num(GATE.camFalseClosed));
  const falseOpen = $derived(num(GATE.camFalseOpen));
  const verdict = $derived(ha.state(GATE.camVerdict) ?? "");

  const colour = $derived(
    post === "closed" ? "var(--success)"
    : post === "moving" ? "var(--acc)"
    : "var(--warning)",
  );

  // Two-tap confirm, on Open only. Four seconds is long enough to mean it and
  // short enough that a forgotten armed button cannot fire later.
  let armed = $state(false);
  let timer: ReturnType<typeof setTimeout>;
  function tapOpen() {
    if (armed) {
      clearTimeout(timer);
      armed = false;
      ha.cover(GATE.cover, true);
      toast.show("Opening the gate");
      return;
    }
    armed = true;
    clearTimeout(timer);
    timer = setTimeout(() => (armed = false), 4000);
  }
</script>

<div class="card pad gate">
  <div class="rh">
    <span class="an">🚧 Gate</span>
    <span class="sub">reed-confirmed · controller says {ctrlState}</span>
  </div>

  <div class="tr">
    <div class="big" style="color:{colour}">{word}</div>
    <div class="pill" style="background:color-mix(in srgb,{colour} 15%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,{colour} 32%,transparent)">
      <span class="pd" style="background:{colour};box-shadow:0 0 8px {colour}"></span>
      {closed ? "closed reed made" : opened ? "open reed made" : "no reed made"}
    </div>
  </div>

  <!-- Open is separated from the safe pair AND coloured differently: adjacent,
       identical-looking controls with very different consequences is the classic
       mis-tap. -->
  <div class="acts">
    <button class="danger" class:armed onclick={tapOpen}>
      {armed ? "Tap again to open" : "Open the gate"}
    </button>
    <span class="gap"></span>
    <button onclick={() => { ha.cover(GATE.cover, false); toast.show("Closing the gate"); }}>Close</button>
    <button onclick={() => { ha.coverStop(GATE.cover); toast.show("Gate stopped"); }}>Stop</button>
  </div>

  {#if post === "partway"}
    <div class="warnbox">
      Neither reed is made and the gate is not moving — it is stopped somewhere in
      between, which is wide enough to walk through. Close it, or Stop then Close
      if it is jammed.
    </div>
  {:else if post === "unknown"}
    <div class="warnbox">
      Both reeds report made, which is electrically impossible — one is stuck or
      shorted. Trust the camera and your eyes until it is checked, not this card.
    </div>
  {/if}

  <!-- Health. Only the rows that are WRONG take colour, so a healthy gate is a
       quiet gate and the one bad row cannot be missed. -->
  <div class="rows">
    <div class="row" class:bad={!locks && closed}>
      <span class="k">Locks</span>
      <span class="v">{locks ? "engaged" : closed ? "DROPPED while shut" : "released"}</span>
    </div>
    <div class="row" class:bad={tamper}>
      <span class="k">Tamper</span>
      <span class="v">{tamper ? "gate disturbed while locked" : "quiet"}</span>
    </div>
    <div class="row" class:bad={battLow}>
      <span class="k">Battery</span>
      <span class="v">
        {volts != null ? `${n(volts, 1)} V` : "—"}{#if battLow} · LOW{/if}{#if lockVolts != null} · locks {n(lockVolts, 1)} V{/if}
      </span>
    </div>
    <div class="row">
      <span class="k">Controller</span>
      <span class="v">
        {wifi != null ? `${n(wifi, 0)} dBm` : "—"}{#if up != null} · up {since(new Date(Date.now() - up * 1000).toISOString()) ?? "—"}{/if}
      </span>
    </div>
  </div>

  <div class="hr"></div>

  <div class="lb">Today</div>
  <div class="chips">
    <span class="chip"><span class="ck">Opens</span><span class="cv">{opens != null ? n(opens, 0) : "—"}</span></span>
    <span class="chip"><span class="ck">Open for</span><span class="cv">{openHrs != null ? `${n(openHrs, 1)} h` : "—"}</span></span>
    {#if ha.isOn(GATE.recentlyOpened)}<span class="chip warnchip"><span class="ck">Recently opened</span><span class="cv">yes</span></span>{/if}
  </div>

  {#if servicePct != null}
    <div class="rh" style="margin:16px 0 6px">
      <span class="lb">Service</span>
      <span class="sub">{n(cycles, 0)} of {n(serviceAt, 0)} cycles</span>
    </div>
    <div class="bar"><span style="width:{Math.max(1, servicePct)}%"></span></div>
    <div class="note">
      {#if (cycles ?? 0) < 50}
        The lifetime counter started on 23 August, so this is not the gate's real
        age — it counts from the day the controller was fitted.
      {:else}
        Counted by the controller since it was fitted.
      {/if}
    </div>
  {/if}

  <div class="hr"></div>

  <!-- The camera is a student, not a source. Percentage never appears without
       its sample size. -->
  <div class="rh">
    <span class="lb">Camera, graded against the reed</span>
    <span class="sub">{ha.isOn(GATE.camGrading) ? "grading on" : "grading off"}</span>
  </div>
  <div class="chips" style="margin-top:9px">
    <span class="chip"><span class="ck">Agreement</span><span class="cv">{camWords}</span></span>
    {#if falseClosed}<span class="chip warnchip"><span class="ck">Called closed while open</span><span class="cv">{n(falseClosed, 0)}</span></span>{/if}
    {#if falseOpen}<span class="chip warnchip"><span class="ck">Called open while shut</span><span class="cv">{n(falseOpen, 0)}</span></span>{/if}
  </div>
  {#if verdict}<div class="note mono">{verdict}</div>{/if}
  <div class="note">
    The reeds decide; the camera is only scored. A wrong call here changes nothing
    about the gate — it just adds a labelled frame to the training set.
  </div>
</div>

<style>
  .gate .an { font-size: 14px; font-weight: 800; color: var(--text); }
  .tr { display: flex; align-items: center; gap: 12px; margin: 12px 0 4px; flex-wrap: wrap; }
  .big { font-size: 30px; font-weight: 800; letter-spacing: -0.5px; }
  .pill { display: inline-flex; align-items: center; gap: 7px; padding: 5px 11px; border-radius: 999px; font-size: 11.5px; font-weight: 700; color: var(--text-2); }
  .pd { width: 7px; height: 7px; border-radius: 50%; }
  .acts { display: flex; align-items: center; gap: 8px; margin: 14px 0 2px; flex-wrap: wrap; }
  .acts .gap { flex: 1 1 22px; min-width: 22px; }
  .acts button {
    padding: 10px 16px; border-radius: var(--r-control, 10px);
    background: rgba(255, 255, 255, 0.08); color: var(--text);
    font-size: 13px; font-weight: 700; min-height: 44px;
  }
  .acts button:hover { background: rgba(255, 255, 255, 0.14); }
  .acts .danger { background: color-mix(in srgb, var(--warning) 22%, transparent); color: var(--text); }
  .acts .danger.armed { background: var(--warning); color: #10131a; }
  .warnbox {
    margin-top: 12px; padding: 10px 12px; border-radius: 10px; font-size: 12px; line-height: 1.5;
    color: var(--warning); background: color-mix(in srgb, var(--warning) 11%, transparent);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--warning) 30%, transparent);
    text-wrap: pretty;
  }
  .rows { display: grid; gap: 1px; margin-top: 14px; }
  .row { display: flex; justify-content: space-between; gap: 12px; padding: 8px 0; border-bottom: 1px solid var(--line, rgba(255,255,255,0.06)); font-size: 12.5px; }
  .row:last-child { border-bottom: 0; }
  .row .k { color: var(--text-3); font-weight: 600; }
  .row .v { color: var(--text); font-weight: 700; text-align: right; }
  .row.bad .v { color: var(--warning); }
  .hr { height: 1px; background: var(--line, rgba(255,255,255,0.07)); margin: 16px 0 12px; }
  .lb { font-size: 11px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: var(--acc); }
  .chips { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 9px; }
  .chip { display: inline-flex; gap: 7px; align-items: baseline; padding: 6px 10px; border-radius: 9px; background: rgba(255, 255, 255, 0.05); font-size: 11.5px; }
  .chip .ck { color: var(--text-3); }
  .chip .cv { color: var(--text); font-weight: 700; }
  .warnchip { background: color-mix(in srgb, var(--warning) 13%, transparent); }
  .bar { height: 7px; border-radius: 999px; background: rgba(255, 255, 255, 0.08); overflow: hidden; }
  .bar span { display: block; height: 100%; background: var(--acc); }
  .note { font-size: 11.5px; color: var(--text-3); line-height: 1.5; margin-top: 9px; text-wrap: pretty; }
  .mono { font-family: ui-monospace, monospace; font-size: 11px; }
</style>
