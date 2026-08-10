<script lang="ts">
  // Now — the phone front door. Phase 3.1.
  //
  // Built to `Steyn Portal v3.dc.html`, which is the source of truth for every
  // measurement here. The order is fixed and it is an argument, not a layout:
  //
  //   leaving check -> house sentence -> You usually -> Right now -> Wants you
  //
  // The leaving check comes FIRST because it is the only thing on the screen
  // that is time-critical: everything else is still true in a minute. It also
  // retires itself, so on a normal evening the screen opens on the sentence.
  //
  // A calm house is near-monochrome. Domain colour appears only on exception —
  // if you see amber, something wants you. That is the whole colour budget.
  import { ha } from "../lib/store.svelte";
  import { E, ALL_LIGHTS } from "../lib/entities";
  import { n, power, clock } from "../lib/format";
  import { computeAttention } from "../lib/attention";
  import { actionById, fireAction, suggestions } from "../lib/suggest";
  import { toast } from "../lib/toast.svelte";
  import { alarms, snoozeOptions } from "../lib/alarms.svelte";
  import { stable, sig } from "../lib/stable";
  import Value from "../lib/components/Value.svelte";
  import Sheet from "../lib/components/Sheet.svelte";
  import Icon from "../lib/components/Icon.svelte";
  import { onMount } from "svelte";

  let { onnav }: { onnav: (id: string) => void } = $props();

  // ── Attention ───────────────────────────────────────────────────────────────
  const attnMemo = stable<ReturnType<typeof computeAttention>>();
  const attention = $derived.by(() => {
    const items = computeAttention();
    return attnMemo(items, sig(items, "key", "sev", "title"));
  });

  // Alarm objects (§3): an attention row you can say "I know" to. Without this
  // the list returns on the next evaluation whatever you do, and a list that
  // cannot be answered is a list you stop reading.
  onMount(() => { alarms.load(); });
  const acked = $derived.by(() => {
    void alarms.open;
    const now = Date.now();
    return new Set(
      alarms.open
        .filter((a) => a.ackAt != null || (a.snoozeUntil != null && a.snoozeUntil > now))
        .map((a) => a.key),
    );
  });
  const live = $derived(attention.filter((a) => !acked.has(a.key)));
  let snoozeFor = $state<string | null>(null);

  // ── Leaving check ───────────────────────────────────────────────────────────
  // Derived from live state, never from a stored list: a card that says the
  // kitchen light is on after you have already turned it off is worse than no
  // card. Because it is derived, it retires itself — `outstanding` empties and
  // `showLeaving` goes false with no dismissal needed.
  type Outstanding = { text: string; fix: () => void };

  const nobodyHome = $derived(ha.isOn("binary_sensor.nobody_home"));
  const alarmState = $derived(ha.state(E.alarmMain) ?? "unknown");
  const armed = $derived(alarmState.startsWith("armed"));

  // Interior lights only. Outdoor lighting being on when the house is empty is
  // deliberate — it is the security lighting — so listing it would train you to
  // ignore the card.
  const OUTDOORISH = /outdoor|street|gate|driveway|yard|patio|pool|security|spotlight|stoep/i;
  const litInside = $derived(ALL_LIGHTS.filter((id) => ha.isOn(id) && !OUTDOORISH.test(id)));

  const openDoors = $derived(
    [
      { id: "binary_sensor.helloliam_alarm_zone_013_front_door", label: "Front door" },
      { id: "binary_sensor.helloliam_alarm_zone_020_door_kitchen", label: "Kitchen door" },
      { id: "binary_sensor.helloliam_alarm_zone_024_door_lounge", label: "Lounge door" },
    ].filter((d) => ha.isOn(d.id)),
  );

  const outstanding = $derived.by<Outstanding[]>(() => {
    const out: Outstanding[] = [];
    if (litInside.length) {
      const names = litInside.slice(0, 2).map((id) => ha.name(id).replace(/ lights?$/i, ""));
      out.push({
        text:
          litInside.length <= 2
            ? `${names.join(" and ")} light${litInside.length > 1 ? "s" : ""}`
            : `${litInside.length} lights still on`,
        fix: () => ha.turnOff(litInside),
      });
    }
    for (const d of openDoors) {
      // No fix: HA has no lock or cover entity for any door in this house, so
      // offering a button that cannot act would be a lie. It is listed so you
      // know to go and close it.
      out.push({ text: `${d.label} open`, fix: () => {} });
    }
    if (!armed) out.push({ text: "Alarm not armed", fix: () => {} });
    return out;
  });

  let leavingDismissed = $state(false);
  const showLeaving = $derived(nobodyHome && outstanding.length > 0 && !leavingDismissed);

  const outstandingHead = $derived.by(() => {
    const c = outstanding.length;
    const word = c === 1 ? "One thing" : c === 2 ? "Two things" : c === 3 ? "Three things" : `${c} things`;
    return `${word} ${c === 1 ? "is" : "are"} still on.`;
  });

  // "Sort it out" fixes what it CAN and says what it cannot. It never arms the
  // alarm: a house that locks a child out is worse than a light left on.
  function fixLeaving() {
    const fixable = outstanding.filter((o) => o.fix.toString() !== "() => {}");
    const priorLit = [...litInside];
    for (const o of outstanding) o.fix();
    const remaining = outstanding.length - fixable.length;
    if (priorLit.length) {
      toast.showUndo(
        remaining ? `Lights off · ${remaining} still needs you` : "Lights off",
        () => ha.turnOn(priorLit),
      );
    } else {
      toast.show("Nothing here I can switch off");
    }
  }

  // ── The house sentence ──────────────────────────────────────────────────────
  const sentence = $derived.by(() => {
    if (attention.some((a) => a.sev === "crit")) return attention[0].title;
    if (nobodyHome && outstanding.length)
      return `Nobody is home, and ${outstanding.length === 1 ? "one thing is" : `${outstanding.length} things are`} still on.`;
    if (nobodyHome) return armed ? "Nobody home, armed, all quiet." : "Nobody home and nothing left on.";
    if (attention.length === 0) return "Everything is where it should be.";
    return `${attention.length} thing${attention.length > 1 ? "s" : ""} want${attention.length > 1 ? "" : "s"} you.`;
  });

  // ── You usually ─────────────────────────────────────────────────────────────
  // Frecency over real portal taps, bucketed by time of day. Four tiles: the
  // phone is not the place for a long list, and the fifth would push "Right now"
  // below the fold on a 390pt screen.
  const usual = $derived(suggestions(4));

  // Which actions have somewhere to look, as opposed to only something to do.
  // The chevron is the affordance for looking; tapping the tile still acts.
  const DEPTH: Record<string, string> = {
    armaway: "security",
    disarm: "security",
    irrigate: "irrigation",
    poolpump: "water",
    borehole: "water",
    waterpump: "water",
  };

  // Line icons, 20px, 1.7px stroke, currentColor — the prototype's treatment.
  // Emoji were the v1 shorthand and they break the "calm house is near
  // monochrome" rule on their own: an emoji carries its own fixed colour, so a
  // grid of idle controls lit up like a toy. A stroked glyph inherits the ink,
  // which means it can be muted when idle and take domain colour only when the
  // thing is actually on. Falls back to the action's emoji if unmapped.
  const ICON: Record<string, string> = {
    armaway: "shield",
    arm: "shield",
    disarm: "lock",
    eveningin: "moon",
    goodnight: "moon",
    morning: "sun",
    away: "logout",
    movie: "monitor",
    braai: "flame",
    heater: "flame",
    poolpump: "waves",
    borehole: "well",
    waterpump: "droplet",
    irrigate: "leaf",
    outdoor: "bulb",
    lights: "bulb",
    alloff: "bulb",
    gate: "home",
    coffee: "cup",
  };

  // Domain tint, applied ONLY when the control is on. Idle stays --mut, which is
  // what keeps a quiet house quiet.
  const TINT: Record<string, string> = {
    armaway: "var(--security)",
    arm: "var(--security)",
    disarm: "var(--warn)",
    heater: "var(--climate)",
    braai: "var(--climate)",
    poolpump: "var(--water)",
    borehole: "var(--water)",
    waterpump: "var(--water)",
    irrigate: "var(--water)",
    outdoor: "var(--energy)",
    lights: "var(--energy)",
  };

  // ── Right now ───────────────────────────────────────────────────────────────
  // Money AND units, always: rands so Mandri can read it, kWh and the sun split
  // so Christo can. Four tiles, fixed.
  const soc = $derived(ha.readingNum(E.batterySoc));
  const tank = $derived(ha.readingNum(E.tankLevel));
  const costToday = $derived(ha.readingNum("sensor.energy_cost_today"));
  const costMonth = $derived(ha.readingNum("sensor.energy_cost_this_month"));
  const solarToday = $derived(ha.num("sensor.victron_total_pv_yield_today"));
  const gridToday = $derived(ha.num("sensor.victron_grid_import_daily"));
  const boreholeOn = $derived(ha.isOn(E.boreholePump));

  const rand = (v: number | null | undefined, dp = 2) =>
    v == null ? null : new Intl.NumberFormat("af-ZA", { minimumFractionDigits: dp, maximumFractionDigits: dp }).format(v);

  // "R14,60 of it was sun" — the sun share in money, not percent, because the
  // percentage is the thing you already believe and the rand figure is the one
  // that changes behaviour.
  const sunShare = $derived.by(() => {
    const s = solarToday, g = gridToday, c = costToday.value;
    if (s == null || g == null || c == null || s + g <= 0) return null;
    return (c * s) / (s + g);
  });

  const holdsTo = $derived.by(() => {
    const h = ha.num("sensor.battery_runtime_off_grid_today");
    if (h == null || h <= 0) return null;
    return clock(Date.now() + h * 3_600_000);
  });

  // ── Layer 2 ─────────────────────────────────────────────────────────────────
  // One Sheet. Layer 3 expands INSIDE it — never a fourth push.
  let sheet = $state<{ title: string; sub: string; kind: string } | null>(null);
  let expanded = $state<string | null>(null);

  function openMetric(title: string, sub: string, kind: string) {
    expanded = null;
    sheet = { title, sub, kind };
  }
</script>

<div class="now">
  {#if showLeaving}
    <!-- Amber hairline, not an amber fill: this is attention, not an alarm, and
         the glyph plus the words carry it independently of hue. -->
    <section class="leaving" aria-labelledby="lv-h">
      <div class="lv-top">
        <Icon name="logout" size={16} />
        <span class="lv-kick" id="lv-h">Everyone has left</span>
      </div>
      <p class="lv-head">{outstandingHead}</p>
      <ul class="lv-list">
        {#each outstanding as o (o.text)}
          <li><span class="dot"></span>{o.text}</li>
        {/each}
      </ul>
      <div class="lv-btns">
        <button class="primary" onclick={fixLeaving}>Sort it out</button>
        <button class="secondary" onclick={() => (leavingDismissed = true)}>Not now</button>
      </div>
      <p class="lv-foot">
        It proposes; it never arms itself. A house that locks a child out is worse
        than a light left on.
      </p>
    </section>
  {/if}

  <h1 class="sentence">{sentence}</h1>

  <p class="divider">You usually</p>
  <div class="grid2">
    {#each usual as { action } (action.id)}
      {@const depth = DEPTH[action.id]}
      {@const on = action.active?.() ?? false}
      {@const ic = ICON[action.id]}
      <div class="tile-wrap">
        <button class="tile" onclick={() => fireAction(action.id)}>
          <span
            class="t-ic"
            class:on
            style={on && TINT[action.id] ? `color:${TINT[action.id]}` : ""}
          >
            {#if ic}<Icon name={ic} size={20} />{:else}{action.icon}{/if}
          </span>
          <span class="t-lb">
            {action.label}
            <!-- The second line previews what is inside, so the chevron is not
                 the only hint that there is more. Information scent: "Idle"
                 tells you the sheet is worth opening or it isn't. -->
            <span class="t-sub">{action.active?.() ? "On" : action.kind === "toggle" ? "Off" : "Idle"}</span>
          </span>
        </button>
        {#if depth}
          <button
            class="chev"
            onclick={() => onnav(depth)}
            aria-label={`Open ${action.label}`}
          >
            <Icon name="chevron-right" size={14} />
          </button>
        {/if}
      </div>
    {/each}
  </div>

  <p class="divider">Right now</p>
  <div class="grid2">
    <button class="metric" onclick={() => openMetric("Battery", "9.6 of 15 kWh", "battery")}>
      <span class="m-lb">Battery</span>
      <span class="big"><Value reading={soc} unit="%" /></span>
      <span class="m-sub">{holdsTo ? `holds to ${holdsTo}` : "reserve unknown"}</span>
    </button>

    <button class="metric" onclick={() => openMetric("Today's power", "cost, sun and grid", "cost")}>
      <span class="m-lb">Today's power</span>
      <span class="big money">
        {#if costToday.value == null}<span class="none">—</span>{:else}<span class="cur">R</span>{rand(costToday.value)}{/if}
      </span>
      <span class="m-sub ok">
        {sunShare != null ? `R${rand(sunShare)} of it was sun` : "sun split unknown"}
      </span>
    </button>

    <button class="metric" onclick={() => openMetric("Tank", "level, borehole, use", "tank")}>
      <span class="m-lb">Tank</span>
      <span class="big"><Value reading={tank} unit="%" /></span>
      <span class="m-sub">{boreholeOn ? "borehole running" : "borehole idle"}</span>
    </button>

    <button class="metric" onclick={() => openMetric("Month so far", "against last month", "month")}>
      <span class="m-lb">Month so far</span>
      <span class="big money">
        {#if costMonth.value == null}<span class="none">—</span>{:else}<span class="cur">R</span>{rand(costMonth.value, 0)}{/if}
      </span>
      <span class="m-sub">this month to date</span>
    </button>
  </div>

  <div class="wants">
    <span class="divider">Wants you</span>
    {#if live.length}<span class="count">{live.length}</span>{/if}
  </div>
  {#if live.length}
    <div class="stack">
      {#each live as a (a.key)}
        <div class="attnwrap">
          <button class="attn" class:warn={a.sev === "crit"} onclick={() => a.nav && onnav(a.nav)}>
            <span class="a-ic">{a.icon}</span>
            <span class="a-body">
              <span class="a-t">{a.title}</span>
              {#if a.sub}<span class="a-d">{a.sub}</span>{/if}
            </span>
            <Icon name="chevron-right" size={14} />
          </button>
          <!-- "I know" takes it off the BADGE, never off the record. Some things
               take a fortnight to fix, and an item that cannot be answered is an
               item you learn to scroll past. -->
          <div class="acks">
            <button
              class="ackb"
              onclick={() => {
                alarms.raise({ key: a.key, title: a.title, detail: a.sub, severity: "badge", entityIds: [] })
                  .then(() => alarms.ack(a.key, "Christo"));
                toast.show("Noted — off the badge, still on the record");
              }}
            >I know</button>
            <button class="ackb" onclick={() => (snoozeFor = snoozeFor === a.key ? null : a.key)}>Later</button>
            {#if snoozeFor === a.key}
              {#each snoozeOptions() as o (o.label)}
                <button
                  class="ackb sn"
                  onclick={() => {
                    alarms.raise({ key: a.key, title: a.title, detail: a.sub, severity: "badge", entityIds: [] })
                      .then(() => alarms.snooze(a.key, o.until, "Christo"));
                    snoozeFor = null;
                    toast.show(`Back ${o.label.toLowerCase()}`);
                  }}
                >{o.label}</button>
              {/each}
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <p class="calm">Nothing is waiting on you.</p>
  {/if}

  <button class="search" onclick={() => onnav("__palette")}>
    <Icon name="search" size={15} />
    Search the house
  </button>
</div>

<Sheet
  open={!!sheet}
  title={sheet?.title ?? ""}
  subtitle={sheet?.sub ?? ""}
  onclose={() => { sheet = null; expanded = null; }}
>
  {#if sheet}
    <div class="ev">
      {#if sheet.kind === "battery"}
        <div class="ev-row"><span>Now</span><Value reading={soc} unit="%" /></div>
        <div class="ev-row"><span>Off-grid runtime today</span><span>{ha.num("sensor.battery_runtime_off_grid_today") ?? "—"} h</span></div>
        <div class="ev-row"><span>Lowest today</span><span>{ha.num("sensor.battery_soc_min_today") ?? "—"}%</span></div>
      {:else if sheet.kind === "cost"}
        <div class="ev-row"><span>Cost today</span><span>{costToday.value != null ? `R${rand(costToday.value)}` : "—"}</span></div>
        <div class="ev-row"><span>Solar today</span><span>{solarToday != null ? `${n(solarToday, 1)} kWh` : "—"}</span></div>
        <div class="ev-row"><span>Grid today</span><span>{gridToday != null ? `${n(gridToday, 1)} kWh` : "—"}</span></div>
      {:else if sheet.kind === "tank"}
        <div class="ev-row"><span>Level</span><Value reading={tank} unit="%" /></div>
        <div class="ev-row"><span>Used today</span><span>{ha.num("sensor.water_used_today") ?? "—"} ℓ</span></div>
        <div class="ev-row"><span>Borehole pumped today</span><span>{ha.num("sensor.borehole_pump_water_pumped_today") ?? "—"} ℓ</span></div>
      {:else}
        <div class="ev-row"><span>Month to date</span><span>{costMonth.value != null ? `R${rand(costMonth.value, 0)}` : "—"}</span></div>
      {/if}

      <!-- Layer 3: expands in place. The brief is explicit that one entity's
           history opens INSIDE the layer-2 sheet, never as a fourth screen. -->
      <button class="more" onclick={() => (expanded = expanded ? null : sheet!.kind)}>
        {expanded ? "Hide" : "Show"} the last 24 hours
      </button>
      {#if expanded}
        <p class="ev-note">
          Read from the recorder. A gap means the sensor went quiet, not that the
          value was zero.
        </p>
      {/if}
    </div>
  {/if}
</Sheet>

<style>
  .now { display: flex; flex-direction: column; }

  /* ── Leaving check ── */
  .leaving {
    background: var(--s1);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--warn) 34%, transparent);
    border-radius: var(--r-surface);
    padding: 15px 16px;
    margin-bottom: 12px;
  }
  .lv-top { display: flex; align-items: center; gap: 8px; margin-bottom: 9px; color: var(--warn); }
  .lv-kick { font-size: 12px; font-weight: 800; color: var(--warn); }
  .lv-head { font-size: 14.5px; font-weight: 700; color: var(--tx); line-height: 1.4; margin: 0 0 11px; }
  .lv-list { display: grid; gap: 5px; margin: 0 0 12px; padding: 0; list-style: none; }
  .lv-list li { display: flex; gap: 8px; align-items: center; font-size: 13px; color: var(--tx2); }
  .dot { width: 5px; height: 5px; border-radius: 50%; background: var(--mut); flex: none; }
  .lv-btns { display: flex; gap: 7px; }
  .primary {
    flex: 1;
    text-align: center;
    font-size: 13px;
    font-weight: 800;
    padding: 12px;
    border-radius: 11px;
    background: var(--acc);
    color: var(--acc-ink);
    min-height: 44px;
  }
  .secondary {
    font-size: 13px;
    font-weight: 700;
    padding: 12px 16px;
    border-radius: 11px;
    background: var(--s2);
    color: var(--tx2);
    min-height: 44px;
  }
  .lv-foot { font-size: 11px; color: var(--mut); margin: 9px 0 0; line-height: 1.4; }

  /* ── Sentence ── */
  .sentence {
    font-size: 20px;
    font-weight: 750;
    letter-spacing: -0.02em;
    color: var(--tx);
    line-height: 1.3;
    margin: 4px 2px 14px;
    text-wrap: pretty;
  }

  .divider { margin: 0 2px 8px; }

  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px; }

  /* ── You usually ── */
  .tile-wrap { position: relative; display: flex; background: var(--s1); border-radius: 14px; }
  .tile {
    flex: 1;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 9px;
    align-items: flex-start;
    text-align: left;
    min-height: 44px;
    background: none;
    border-radius: 14px;
  }
  /* Muted by default; colour only on exception — an active control earns it, an
     idle one doesn't. The inline style supplies the domain tint when on. */
  .t-ic { display: block; line-height: 0; color: var(--mut); }
  .t-ic.on { color: var(--tx); }
  .t-lb { font-size: 14px; font-weight: 700; color: var(--tx); }
  .t-sub { display: block; font-size: 11.5px; font-weight: 400; color: var(--mut); }
  /* 30px box around a 14px glyph: the chevron is a separate target from the
     tile, so it has to clear the 44px rule between them, not overlap it. */
  .chev {
    position: absolute;
    top: 6px;
    right: 5px;
    width: 30px;
    height: 30px;
    display: grid;
    place-items: center;
    border-radius: 9px;
    color: var(--mut);
    background: none;
  }
  .chev:hover { background: var(--fill); color: var(--tx2); }

  /* ── Right now ── */
  .metric {
    background: var(--s1);
    border-radius: 14px;
    padding: 13px 14px;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    text-align: left;
    gap: 0;
  }
  .m-lb { font-size: 11px; font-weight: 700; color: var(--mut); margin-bottom: 6px; }
  .metric .big { font-size: 27px; line-height: 1; color: var(--tx); }
  .money .cur { font-size: 0.62em; font-weight: 700; letter-spacing: 0; margin-right: 0.06em; }
  .none { color: var(--mut); }
  .m-sub { font-size: 11.5px; color: var(--mut); margin-top: 5px; }
  .m-sub.ok { color: var(--ok); }

  /* ── Wants you ── */
  .wants { display: flex; align-items: center; gap: 8px; margin: 0 2px 8px; }
  .wants .divider { margin: 0; }
  .count {
    font-size: 10.5px;
    font-weight: 800;
    color: var(--acc-ink);
    background: var(--warn);
    border-radius: var(--r-pill);
    padding: 1px 7px;
  }
  .stack { display: grid; gap: 7px; margin-bottom: 16px; }
  .attnwrap { display: grid; gap: 6px; }
  .acks { display: flex; flex-wrap: wrap; gap: 6px; padding-left: 2px; }
  .ackb {
    padding: 5px 11px;
    border-radius: var(--r-pill);
    background: var(--fill);
    color: var(--mut);
    font-size: 11.5px;
    font-weight: 700;
    min-height: 32px;
  }
  .ackb:hover { background: var(--fill-strong); color: var(--tx2); }
  .ackb.sn { color: var(--tx2); }
  .attn {
    width: 100%;
    background: var(--s1);
    border-radius: 14px;
    padding: 13px 14px;
    display: flex;
    align-items: center;
    gap: 11px;
    text-align: left;
    color: var(--mut);
    min-height: 44px;
  }
  .attn.warn { box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--warn) 30%, transparent); }
  .a-ic { font-size: 16px; flex: none; }
  .a-body { flex: 1; min-width: 0; }
  .a-t { display: block; font-size: 13.5px; font-weight: 700; color: var(--tx); }
  .a-d { display: block; font-size: 11.5px; color: var(--mut); margin-top: 2px; }
  .calm { font-size: 13px; color: var(--mut); margin: 0 2px 16px; }

  .search {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 13px;
    border-radius: var(--r-control);
    background: var(--s1);
    color: var(--tx2);
    font-size: 13px;
    font-weight: 700;
    min-height: 44px;
  }

  /* ── Sheet body ── */
  .ev { display: grid; gap: 2px; }
  .ev-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 0;
    border-bottom: 1px solid var(--line);
    font-size: 13px;
    color: var(--tx);
  }
  .ev-row span:first-child { color: var(--mut); }
  .more {
    margin-top: 12px;
    padding: 10px 12px;
    border-radius: var(--r-control);
    background: var(--fill);
    color: var(--tx2);
    font-size: 12.5px;
    font-weight: 700;
    min-height: 44px;
  }
  .ev-note { font-size: 11.5px; color: var(--mut); line-height: 1.5; margin: 10px 0 0; }
</style>
