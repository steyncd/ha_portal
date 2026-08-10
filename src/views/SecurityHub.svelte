<script lang="ts">
  // Security — the hub board, with alarm provenance. Phase 2.1 / 3.2.
  //
  // The hero is never a bare present tense. "Armed" on its own is the state that
  // failed on 2026-08-09: the house said DISARMED and there was no way to learn
  // that a config reload had done it. So the hero always carries SINCE WHEN and
  // BY WHOM, and a transition with no actor renders amber as "unexplained"
  // rather than quietly looking normal.
  //
  // Reads input_text.alarm_last_event, written per transition by
  // feature_alarm_provenance.yaml. That entity is recorder-backed, so its own
  // history IS the log — which is why the timeline below needs no extra store.
  import { onMount } from "svelte";
  import { ha } from "../lib/store.svelte";
  import { E } from "../lib/entities";
  import { clock } from "../lib/format";
  import HubBoard, { type Stat, type Row } from "../lib/components/HubBoard.svelte";
  import Sheet from "../lib/components/Sheet.svelte";

  let { onnav }: { onnav: (id: string) => void } = $props();

  const PROV = "input_text.alarm_last_event";
  const MACHINE = "sensor.ha_last_machine_event";

  type Prov = { f: string; t: string; at: string; a: string; s: string; ar: string };

  const prov = $derived.by<Prov | null>(() => {
    const raw = ha.state(PROV);
    if (!raw || raw === "unknown" || raw === "unavailable") return null;
    try { return JSON.parse(raw) as Prov; } catch { return null; }
  });

  const homeState = $derived(ha.state(E.alarmHome) ?? "unknown");
  const beamState = $derived(ha.state(E.alarmBeamsArea) ?? "unknown");
  const armed = $derived(homeState.startsWith("armed"));

  const sinceMs = $derived.by(() => {
    const at = prov?.at ? Date.parse(prov.at) : NaN;
    return Number.isFinite(at) ? at : null;
  });

  function forWords(ms: number | null): string {
    if (ms == null) return "";
    const mins = Math.max(0, Math.round((Date.now() - ms) / 60_000));
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    return `${h}h ${mins % 60}m`;
  }

  // The source field is what HA can honestly know: the Olarm integration does
  // not expose the acting user, so a keypad or Olarm-app change can be placed
  // but not attributed.
  //
  // NAME THE PLACE, THEN THE LIMIT — and `panel` MUST LOOK NORMAL. It is normal
  // life: it is Christo at the keypad or Mandri in the Olarm app. An earlier
  // version read "the panel — keypad, remote or the Olarm app", which is
  // accurate but reads like a list of excuses and puts the least useful word
  // first. Worse, if `panel` carried any amber then within a week nobody would
  // read the hero at all, and the one state that IS alarming — `flap` — would be
  // lost in the noise.
  const actorWords = $derived.by(() => {
    if (!prov) return "no record yet";
    if (prov.s === "flap") return "with no actor";
    if (prov.s === "ui") return `by ${prov.a || "someone"}`;
    if (prov.s === "auto") return prov.a && prov.a !== "automation" ? `by ${prov.a}` : "by schedule";
    if (prov.s === "panel") return "at the panel";
    return "unattributed";
  });

  // The limit, on its own muted second line, only where there is one to state.
  const actorLimit = $derived(
    prov?.s === "panel" ? "keypad, remote or the Olarm app · not attributable to a person" : "",
  );

  // Unexplained: protection dropped and nothing a person did explains it. This
  // is the state the Security screen existed to catch and could not.
  const unexplained = $derived(
    !!prov && prov.t === "disarmed" && prov.f.startsWith("armed") && (prov.s === "flap" || !prov.a),
  );

  const hero = $derived.by(() => {
    if (!prov) {
      return {
        line: armed ? "Armed" : "Disarmed",
        sub: "No provenance recorded yet — the first transition after the restart will fill this in.",
        limit: "",
        warn: false,
      };
    }
    const since = sinceMs ? clock(sinceMs) : "?";
    // Only `flap` is alarming, and it earns the amber by naming the machine
    // event it followed — "one second after a config reload" is the sentence
    // that would have solved the August incident in a glance.
    if (unexplained) {
      const gap = machineGapSeconds();
      return {
        line: "State changed with no actor",
        sub:
          gap != null && gap < 120
            ? `${since}, ${Math.round(gap)} seconds after a config reload`
            : `${since} · nothing a person did explains this`,
        limit: "",
        warn: true,
      };
    }
    return {
      line: armed
        ? `Continuously armed for ${forWords(sinceMs)}`
        : `Disarmed for ${forWords(sinceMs)}`,
      sub: `since ${since} · ${prov.t === "disarmed" ? "disarmed" : "armed"} ${actorWords}`,
      limit: actorLimit,
      warn: false,
    };
  });

  // Seconds between the last machine event and the transition. This is brief D
  // paying off: without it "no actor" is a mystery, with it it is a diagnosis.
  function machineGapSeconds(): number | null {
    const me = ha.state(MACHINE);
    if (!me || me === "unknown" || me === "unavailable" || sinceMs == null) return null;
    const t = Date.parse(me);
    return Number.isFinite(t) ? Math.abs(sinceMs - t) / 1000 : null;
  }

  let sheet = $state<{ kind: string } | null>(null);
  // historyStates, not history: history coerces to numbers, and both of these
  // are text entities — a JSON blob and an ISO timestamp.
  let log = $state<{ t: number; s: string }[]>([]);
  let machine = $state<{ t: number; s: string }[]>([]);

  // The log is the provenance entity's own recorder history, interleaved with
  // machine events. A reload one second before an actor-less disarm should be
  // one glance, which is the whole reason brief D exists.
  onMount(async () => {
    if (ha.exists(PROV)) log = await ha.historyStates(PROV, 168);
    if (ha.exists(MACHINE)) machine = await ha.historyStates(MACHINE, 168);
  });

  type Entry = { t: number; kind: "alarm" | "machine"; text: string; warn: boolean };
  const timeline = $derived.by<Entry[]>(() => {
    const out: Entry[] = [];
    for (const e of log) {
      try {
        const p = JSON.parse(String(e.s)) as Prov;
        const who =
          p.s === "flap" ? "a reload" : p.s === "ui" ? p.a || "portal" : p.s === "auto" ? "automation" : "the panel";
        out.push({
          t: e.t,
          kind: "alarm",
          text: `${p.ar === "beams" ? "Beams" : "House"} ${p.f} → ${p.t} · ${who}`,
          warn: p.t === "disarmed" && p.f.startsWith("armed") && (p.s === "flap" || !p.a),
        });
      } catch { /* a non-JSON value is a helper that was reset; skip it */ }
    }
    for (const e of machine) {
      out.push({ t: e.t, kind: "machine", text: `Home Assistant ${String(e.s).includes("start") ? "restarted" : "reloaded"}`, warn: false });
    }
    return out.sort((a, b) => b.t - a.t).slice(0, 40);
  });

  const zonesTotal = $derived(
    Object.keys(ha.entities).filter((id) => /^binary_sensor\.helloliam_alarm_zone_\d+/.test(id) && !id.includes("bypass")).length,
  );
  const zonesOpen = $derived(
    Object.keys(ha.entities).filter(
      (id) => /^binary_sensor\.helloliam_alarm_zone_\d+/.test(id) && !id.includes("bypass") && ha.isOn(id),
    ),
  );
  const bypassed = $derived(
    Object.keys(ha.entities).filter((id) => id.includes("alarm_zone") && id.includes("bypass") && ha.isOn(id)),
  );

  const stats = $derived<Stat[]>([
    {
      key: "House",
      value: hero.line,
      units: hero.sub,
      note: hero.limit || undefined,
      warn: hero.warn,
      open: () => (sheet = { kind: "log" }),
    },
    {
      key: "Beams",
      value: beamState.startsWith("armed") ? "Armed" : beamState === "disarmed" ? "Disarmed" : beamState,
      units: "6 perimeter beams, scheduled on their own",
      note: "disarming the house never touches these",
      open: () => (sheet = { kind: "log" }),
    },
    {
      key: "Zones",
      value: `${zonesTotal - zonesOpen.length} of ${zonesTotal}`,
      units: `${zonesOpen.length} open · ${bypassed.length} bypassed`,
      note: bypassed.length ? "a bypass shows in the digest until it is cleared" : "nothing bypassed",
      warn: bypassed.length > 0,
      open: () => (sheet = { kind: "zones" }),
    },
    {
      key: "Mains",
      value: ha.isOn(E.alarmAcPower) ? "On mains" : "On battery",
      units: "the panel's own supply",
      warn: !ha.isOn(E.alarmAcPower),
    },
  ]);

  const rows = $derived<Row[]>([
    { key: "Cameras", sub: "six cameras, events and snapshots", value: "Open", tint: "var(--security)", open: () => onnav("cameras") },
    { key: "The road outside", sub: "vehicles and pedestrians counted at the sidewalk", value: "Open", tint: "var(--security)", open: () => onnav("traffic") },
    { key: "Timeline", sub: "who was where, and when", value: "Open", tint: "var(--acc)", open: () => onnav("timeline") },
    ...zonesOpen.slice(0, 4).map((id) => ({
      key: ha.name(id),
      sub: "open right now",
      value: "Open",
      tint: "var(--warn)",
      warn: true,
    })),
  ]);
</script>

<HubBoard
  hub="security"
  sub="two independently scheduled areas · every transition attributed"
  {stats}
  listTitle="What else is watching"
  {rows}
  noteTitle="Since when, and by whom"
  note="A bare 'Armed' is the state that failed in August: the house said DISARMED and there was no way to learn a config reload had done it. Every transition is now recorded with its area and its actor, and one with no actor is flagged rather than left looking normal."
  {onnav}
/>

<Sheet
  open={!!sheet}
  title={sheet?.kind === "zones" ? "Zones" : "What happened"}
  subtitle={sheet?.kind === "zones" ? `${zonesTotal} zones` : "state changes and machine events, interleaved"}
  onclose={() => (sheet = null)}
>
  {#if sheet?.kind === "log"}
    {#if timeline.length === 0}
      <p class="empty">
        Nothing recorded yet. The provenance automation writes its first entry on
        the next arm or disarm.
      </p>
    {:else}
      <div class="tl">
        {#each timeline as e (e.t + e.text)}
          <div class="ent" class:warn={e.warn} class:machine={e.kind === "machine"}>
            <span class="when">{clock(e.t)}</span>
            <span class="what">{e.text}</span>
          </div>
        {/each}
      </div>
      <p class="empty">
        Machine events sit in the same list on purpose — a reload one second
        before an actor-less disarm should be one glance, not two screens.
      </p>
    {/if}
  {:else if sheet?.kind === "zones"}
    <div class="tl">
      {#each zonesOpen as id (id)}
        <div class="ent warn"><span class="when">open</span><span class="what">{ha.name(id)}</span></div>
      {/each}
      {#each bypassed as id (id)}
        <div class="ent warn"><span class="when">bypassed</span><span class="what">{ha.name(id)}</span></div>
      {/each}
      {#if !zonesOpen.length && !bypassed.length}
        <p class="empty">All {zonesTotal} zones clear, nothing bypassed.</p>
      {/if}
    </div>
  {/if}
</Sheet>

<style>
  .tl { display: grid; gap: 2px; }
  .ent {
    display: flex;
    gap: 12px;
    padding: 9px 0;
    border-bottom: 1px solid var(--line);
    font-size: 12.5px;
    color: var(--tx);
  }
  .ent.warn { box-shadow: inset 2px 0 0 var(--warn); padding-left: 9px; color: var(--warn); }
  /* Machine events are dimmer: present for context, not the subject. */
  .ent.machine { color: var(--mut); }
  .when { flex: none; width: 58px; color: var(--mut); font-variant-numeric: tabular-nums; }
  .what { flex: 1; min-width: 0; }
  .empty { font-size: 12px; color: var(--mut); line-height: 1.55; margin: 12px 0 0; text-wrap: pretty; }
</style>
