<script lang="ts">
  // Diagnostics — one screen for the machinery. PLATFORM-CONCEPTS §4.
  //
  // Twelve subsystems. Two hard rules, and both are load-bearing:
  //
  // 1. RAG IS BANNED. Red-amber-green is the one ramp Christo cannot read, so
  //    status is blue (--ok) / amber (--warn) / grey (--mut), and ALWAYS with a
  //    glyph AND a word. Colour is never the only channel.
  //
  // 2. STATE THE DEPENDENCY, NOT JUST THE STATUS. "InfluxDB has no retention
  //    policy" reads as minor until the card says it feeds the cadence job the
  //    whole freshness system runs on. That `Feeds …` line is the difference
  //    between a status board and a screen that tells you what to do.
  //
  // Nothing here needs new data: it is HA's own integration state, the generated
  // dependency index, and what the portal already knows about its own cloud.
  import { ha } from "../lib/store.svelte";
  import { E } from "../lib/entities";
  import { dependentCount, groupedDependents, depsEntityCount, depsGeneratedAt } from "../lib/deps";
  import { n, since } from "../lib/format";
  import Sheet from "../lib/components/Sheet.svelte";
  import { health } from "../lib/health.svelte";
  import { onMount } from "svelte";

  let { onnav }: { onnav: (id: string) => void } = $props();

  type Health = "ok" | "care" | "idle";
  type Card = {
    id: string;
    name: string;
    /** Glyph — a second channel, so status never rests on colour. */
    glyph: string;
    health: Health;
    /** One line of fact. */
    detail: string;
    /** What depends on this. The reason the card is worth reading. */
    feeds: string;
    /** Entity ids to open the dependency sheet on. */
    keys?: string[];
  };

  const WORD: Record<Health, string> = { ok: "Healthy", care: "Needs care", idle: "Idle" };

  // ── The twelve ─────────────────────────────────────────────────────────────
  const cards = $derived.by<Card[]>(() => {
    const out: Card[] = [];
    const num = (id: string) => ha.num(id);
    const st = (id: string) => ha.state(id);

    // The machine. Added 2026-08-10, when System Monitor's sensors were enabled —
    // all 85 had been disabled since it was installed, so this house had no disk,
    // memory or CPU reading anywhere. Disk is the one that matters: InfluxDB has
    // no retention policy and keeps data back to 2021, so it grows forever, and
    // nothing was watching it.
    const disk = num("sensor.system_monitor_disk_usage");
    const diskFree = num("sensor.system_monitor_disk_free");
    const cpuTemp = num("sensor.system_monitor_processor_temperature");

    // 1 · HA core
    // The sensor holds WHEN HA started (or when the machine booted, whichever it
    // could establish), so it is turned into elapsed time here rather than
    // HA-side — a duration sensor would rewrite itself every minute.
    const uptime = since(st("sensor.home_assistant_uptime"));
    out.push({
      id: "core",
      name: "Home Assistant core",
      glyph: "✓",
      // Two independent signals: this browser's socket AND the server-side probe.
      // They disagree in the case that matters most — the portal open on a phone
      // with a working cache while the house is actually off the internet.
      health: ha.status === "connected" && health.haReachable !== false ? "ok" : "care",
      // NOT a fallback to update.home_assistant_core_update: that entity's STATE
      // is "off"/"on" for whether an update is pending, so the old fallback
      // printed the word "off" where a version belonged. The version now comes
      // from sensor.home_assistant_version (built from that entity's
      // installed_version attribute, HA-side).
      detail: [st("sensor.home_assistant_version"), uptime ? `up ${uptime}` : null]
        .filter(Boolean).join(" · ")
        || (health.haReachable === false
              ? `unreachable — ${health.data.ha?.consecutiveFails ?? 0} failed probes`
              : ha.status === "connected" ? "connected" : "reconnecting"),
      feeds: `Feeds ${depsEntityCount} referenced entities`,
    });

    // The thresholds match the HA-side warning automation (85 / 93) on purpose:
    // two places disagreeing about what "nearly full" means is how you end up
    // trusting neither.
    if (disk != null) {
      out.push({
        id: "machine",
        name: "The machine",
        glyph: "🖥️",
        // No "bad" tier exists in this view; "care" is the top severity here and
        // the HA-side notification is what escalates past 93%.
        health: disk >= 85 ? "care" : "ok",
        detail: [
          `disk ${n(disk, 0)}%`,
          diskFree != null ? `${n(diskFree, 0)} GiB free` : null,
          cpuTemp != null ? `${n(cpuTemp, 0)}°C` : null,
        ].filter(Boolean).join(" · "),
        feeds:
          disk >= 85
            ? "Everything. InfluxDB has no retention policy and holds data back to 2021, so it is the likeliest cause of the growth."
            : "Everything — the recorder, InfluxDB and every automation run on this box. InfluxDB grows without a retention policy, so this is the number that notices.",
        keys: [
          "sensor.system_monitor_disk_usage",
          "sensor.system_monitor_disk_free",
          "sensor.system_monitor_memory_use",
          "sensor.system_monitor_processor_use",
          "sensor.system_monitor_processor_temperature",
          "sensor.system_monitor_load_1_min",
        ],
      });
    }

    // 2 · Zigbee mesh — the two weak links are the whole story here.
    const weak = Object.keys(ha.entities).filter((id) => {
      if (!/_(lqi|link_quality)$/.test(id)) return false;
      const v = num(id);
      return v != null && v < 25;
    });
    out.push({
      id: "zigbee",
      name: "Zigbee mesh",
      glyph: weak.length ? "⚠" : "✓",
      health: weak.length ? "care" : "ok",
      detail: weak.length ? `${weak.length} on failing links` : "all links healthy",
      feeds: "Feeds the buttons, the room sensors and the door contacts",
      keys: weak,
    });

    // 3 · Victron / Cerbo
    const soc = num(E.batterySoc);
    out.push({
      id: "victron",
      name: "Victron / Cerbo",
      glyph: soc != null ? "✓" : "⚠",
      health: soc != null ? "ok" : "care",
      detail: soc != null ? `MQTT push · SoC ${n(soc)}%` : "no SoC reading",
      feeds: "Feeds battery, solar, grid and the reserve guard",
      keys: [E.batterySoc, "sensor.victron_ac_consumption_l1"],
    });

    // 4 · Olarm panel
    const areas = [E.alarmHome, E.alarmBeamsArea].filter((id) => ha.available(id));
    const bypassed = Object.keys(ha.entities).filter((id) => id.includes("alarm_zone") && id.includes("bypass") && ha.isOn(id));
    out.push({
      id: "olarm",
      name: "Olarm / alarm panel",
      glyph: areas.length === 2 ? "✓" : "⚠",
      health: areas.length === 2 ? "ok" : "care",
      detail: `${areas.length} of 2 areas online${bypassed.length ? ` · ${bypassed.length} bypassed` : ""}`,
      feeds: "Feeds both areas, the provenance log and the leaving check",
      keys: [E.alarmHome, E.alarmBeamsArea],
    });

    // 5 · Frigate
    const stalled = ha.isOn(E.frigateStalled);
    out.push({
      id: "frigate",
      name: "Frigate",
      glyph: stalled ? "⚠" : "✓",
      health: stalled ? "care" : "ok",
      detail: stalled ? "detection stalled" : "detecting",
      feeds: "Feeds the gate, driveway and yard alerts",
      keys: [E.frigateStalled],
    });

    // 6 · Water & pumps
    const tankLow = ha.isOn(E.tankLowAlert);
    out.push({
      id: "water",
      name: "Water & pumps",
      glyph: tankLow ? "⚠" : "✓",
      health: tankLow ? "care" : "ok",
      detail: tankLow ? "tank low" : `tank ${n(num(E.tankLevel))}%`,
      feeds: "Feeds the tank, irrigation and the leak rules",
      keys: [E.tankLevel, E.boreholePump],
    });

    // 7 · MariaDB recorder — history charts everywhere depend on it.
    out.push({
      id: "mariadb",
      name: "MariaDB recorder",
      glyph: "✓",
      health: "ok",
      detail: "external · purge nightly",
      feeds: "Feeds every history chart, the timeline and the provenance log",
    });

    // 8 · InfluxDB — the retention point IS the dependency point.
    out.push({
      id: "influx",
      name: "InfluxDB",
      glyph: ha.exists("sensor.standby_power_90d_baseline") ? "✓" : "⚠",
      health: ha.exists("sensor.standby_power_90d_baseline") ? "ok" : "care",
      detail: ha.exists("sensor.standby_power_90d_baseline")
        ? "10 baseline sensors live"
        : "baseline sensors missing",
      feeds: "Feeds the 90-day baselines and the cadence job the freshness system runs on",
      keys: ["sensor.standby_power_90d_baseline", "sensor.baseline_load_90d_baseline"],
    });

    // 9 · BigQuery warehouse
    out.push({
      id: "bigquery",
      name: "BigQuery warehouse",
      glyph: "✓",
      health: "ok",
      detail: "nightly batch at 23:55 · 29 columns",
      feeds: "Feeds Ask-my-house and the monthly review",
    });

    // 10 · Cloud Functions
    out.push({
      id: "functions",
      name: "Cloud Functions",
      glyph: "✓",
      health: "ok",
      detail: "digest 06:30 and 21:00 · interrupt sweep every 30 min",
      feeds: "Feeds the digests, the nudges and the payouts",
    });

    // 11 · Gemini
    out.push({
      id: "gemini",
      name: "Gemini",
      glyph: "✓",
      health: "ok",
      detail: "Developer API · free tier",
      feeds: "Feeds the nudges, chart captions and review summaries",
    });

    // 12 · Push & badge — idle is a legitimate state, not a fault, which is why
    // grey exists as a third status rather than folding into amber.
    out.push({
      id: "push",
      name: "Push & badge",
      glyph: "—",
      health: "idle",
      detail: "installed on this device",
      feeds: "Feeds the digest at 06:30 and 21:00",
    });

    // Cloud Monitoring incidents become cards of their own. Without this, "a
    // scheduled function has been failing for a week" has nowhere to appear —
    // which is precisely the gap this whole section exists to close.
    for (const i of health.openIncidents) {
      out.push({
        id: `inc-${i.name}`,
        name: i.name,
        glyph: "⚠",
        health: "care",
        detail: i.summary || "alert policy is open",
        feeds: i.since ? `Open since ${new Date(i.since).toLocaleString("en-ZA", { hour: "2-digit", minute: "2-digit", hour12: false })}` : "Open",
      });
    }

    return out;
  });

  const counts = $derived({
    ok: cards.filter((c) => c.health === "ok").length,
    care: cards.filter((c) => c.health === "care").length,
    idle: cards.filter((c) => c.health === "idle").length,
  });

  // The machinery half: written by healthProbe and the Cloud Monitoring webhook.
  onMount(() => health.start());

  let sheet = $state<Card | null>(null);
</script>

<div class="diag">
  <header class="dh">
    <div>
      <h1>System health</h1>
      <p class="sub">every subsystem, one screen · drill into any of them</p>
    </div>
    <!-- The tally is words plus colour, never a coloured bar. -->
    <p class="tally">
      <span class="ok">{counts.ok} healthy</span>
      {#if counts.care}<span class="care">{counts.care} need care</span>{/if}
      {#if counts.idle}<span class="idle">{counts.idle} idle</span>{/if}
    </p>
  </header>

  <div class="grid">
    {#each cards as c (c.id)}
      <button class="card {c.health}" onclick={() => (sheet = c)}>
        <span class="top">
          <span class="glyph" aria-hidden="true">{c.glyph}</span>
          <span class="name">{c.name}</span>
        </span>
        <!-- Glyph, word AND colour. Any one of the three carries it alone. -->
        <span class="word">{WORD[c.health]}</span>
        <span class="detail">{c.detail}</span>
        <span class="feeds">{c.feeds}</span>
      </button>
    {/each}
  </div>

  <p class="foot">
    Status is a glyph, a word and a colour — never colour alone — and the ramp is
    blue to amber rather than red-green, so the traffic-light convention is
    dropped deliberately. Every card names <strong>what depends on it</strong>,
    which is the sentence that tells you whether a warning matters: InfluxDB
    having no retention policy is a slow problem, but it feeds the cadence job the
    whole freshness system runs on.
  </p>
  <p class="foot dim">
    Dependencies generated from {depsEntityCount} referenced entities across the
    packages, {new Date(depsGeneratedAt).toLocaleDateString("en-ZA")}. Regenerate
    with <code>npm run deps</code> — it is never hand-maintained, because a
    dependency list that is wrong will tell you something is safe to remove when
    it is not.
  </p>
</div>

<Sheet
  open={!!sheet}
  title={sheet?.name ?? ""}
  subtitle={sheet ? WORD[sheet.health] : ""}
  onclose={() => (sheet = null)}
>
  {#if sheet}
    <p class="sdetail">{sheet.detail}</p>
    <p class="sfeeds">{sheet.feeds}</p>

    {#if sheet.keys?.length}
      {#each sheet.keys as k (k)}
        {@const groups = groupedDependents(k)}
        <section class="dep">
          <p class="dk">{k}</p>
          {#if groups.length === 0}
            <p class="dnone">
              Nothing in the config references this. Staleness here is harmless —
              which is the useful half of the answer.
            </p>
          {:else}
            <p class="dcount">{dependentCount(k)} references</p>
            {#each groups as g (g.kind)}
              <p class="dgroup"><span class="gk">{g.kind}</span> {g.files.join(" · ")}</p>
            {/each}
          {/if}
        </section>
      {/each}
    {:else}
      <p class="dnone">
        This subsystem is off-box, so its dependencies are the Functions and jobs
        named above rather than HA entities.
      </p>
    {/if}
  {/if}
</Sheet>

<style>
  .diag { display: flex; flex-direction: column; gap: 14px; }
  .dh { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
  .dh h1 { font-size: 24px; font-weight: 800; letter-spacing: -0.02em; color: var(--tx); margin: 0; }
  .sub { font-size: 12.5px; color: var(--mut); margin: 4px 0 0; }
  .tally { display: flex; gap: 12px; font-size: 12.5px; font-weight: 700; margin: 0; }
  .tally .ok { color: var(--ok); }
  .tally .care { color: var(--warn); }
  .tally .idle { color: var(--mut); }

  .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
  @media (max-width: 1100px) { .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (max-width: 700px) { .grid { grid-template-columns: minmax(0, 1fr); } }

  .card {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    text-align: left;
    gap: 0;
    padding: 15px 16px;
    border-radius: var(--r-surface);
    background: var(--s1);
    min-width: 0;
  }
  .card:hover { background: var(--s2); }
  /* Amber hairline only for care. No fills, no red, no green. */
  .card.care { box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--warn) 36%, transparent); }
  .top { display: flex; align-items: center; gap: 9px; }
  .glyph { flex: none; font-size: 14px; color: var(--ok); }
  .card.care .glyph { color: var(--warn); }
  .card.idle .glyph { color: var(--mut); }
  .name { font-size: 14.5px; font-weight: 700; color: var(--tx); }
  .word { font-size: 12.5px; font-weight: 700; color: var(--ok); margin-top: 8px; }
  .card.care .word { color: var(--warn); }
  .card.idle .word { color: var(--mut); }
  .detail { font-size: 12.5px; color: var(--tx2); margin-top: 5px; }
  /* The dependency line, separated by a rule: it is a different kind of claim
     from the status above it. */
  .feeds {
    font-size: 11.5px;
    color: var(--mut);
    margin-top: 11px;
    padding-top: 10px;
    border-top: 1px solid var(--line);
    width: 100%;
    text-wrap: pretty;
  }

  .foot { font-size: 12px; color: var(--tx2); line-height: 1.6; margin: 0; max-width: 78ch; text-wrap: pretty; }
  .foot.dim { color: var(--mut); font-size: 11.5px; }
  .foot code { font-family: ui-monospace, monospace; font-size: 11px; }

  .sdetail { font-size: 13.5px; font-weight: 700; color: var(--tx); margin: 0; }
  .sfeeds { font-size: 12.5px; color: var(--mut); margin: 6px 0 0; text-wrap: pretty; }
  .dep { margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--line); }
  .dk { font-family: ui-monospace, monospace; font-size: 11.5px; color: var(--tx2); margin: 0; word-break: break-all; }
  .dcount { font-size: 12px; font-weight: 700; color: var(--tx); margin: 6px 0 0; }
  .dgroup { font-size: 11.5px; color: var(--mut); margin: 5px 0 0; line-height: 1.5; text-wrap: pretty; }
  .gk {
    display: inline-block;
    padding: 1px 7px;
    border-radius: var(--r-pill);
    background: var(--fill);
    color: var(--tx2);
    font-weight: 700;
    margin-right: 5px;
  }
  .dnone { font-size: 12px; color: var(--mut); line-height: 1.55; margin: 10px 0 0; text-wrap: pretty; }
</style>
