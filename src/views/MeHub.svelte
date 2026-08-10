<script lang="ts">
  // Me — the hub board. Phase 3.2, fold map per Design's answer §B.
  //
  // Vitality moved here from Rooms: health is owner-only and Rooms is not. That
  // is the whole reason it could not stay where it was — a view folded into a hub
  // inherits that hub's audience, and Rooms is a screen Mandri and a house-sitter
  // both see.
  //
  // OWNER-ONLY, ENFORCED. The rule from the handover is that a role which only
  // hides views is tidiness rather than security, so this checks authStore and
  // says so plainly rather than rendering an empty board. Real enforcement is in
  // firestore.rules; this is the honest front of it.
  import { ha } from "../lib/store.svelte";
  import { authStore } from "../lib/auth.svelte";
  import { n } from "../lib/format";
  import { mean } from "../lib/fn";
  import HubBoard, { type Stat, type Row } from "../lib/components/HubBoard.svelte";
  import Skeleton from "../lib/components/Skeleton.svelte";

  let { onnav }: { onnav: (id: string) => void } = $props();

  const readiness = $derived(ha.readingNum("sensor.oura_readiness_score"));
  const sleepScore = $derived(ha.readingNum("sensor.oura_sleep_score"));
  const hrv = $derived(ha.num("sensor.oura_average_sleep_hrv"));
  const restingHr = $derived(ha.num("sensor.oura_lowest_sleep_heart_rate"));
  const deep = $derived(ha.num("sensor.oura_deep_sleep_duration"));
  const rem = $derived(ha.num("sensor.oura_rem_sleep_duration"));
  const steps = $derived(ha.num("sensor.oura_steps"));
  const kcal = $derived(ha.num("sensor.oura_active_calories"));

  // Minutes to "3h 10m" — an Oura duration in raw seconds is unreadable.
  const dur = (v: number | null) => {
    if (v == null) return null;
    const mins = v > 1000 ? Math.round(v / 60) : Math.round(v);
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  const stats = $derived<Stat[]>([
    {
      key: "Readiness",
      reading: readiness,
      units: [restingHr != null ? `resting HR ${n(restingHr)}` : null, hrv != null ? `HRV ${n(hrv)} ms` : null]
        .filter(Boolean).join(" · ") || undefined,
      note: readiness.value != null && (readiness.value as number) < 70 ? "take it easy today" : undefined,
      warn: readiness.value != null && (readiness.value as number) < 70,
    },
    {
      key: "Sleep",
      reading: sleepScore,
      units: [dur(deep) ? `${dur(deep)} deep` : null, dur(rem) ? `${dur(rem)} REM` : null]
        .filter(Boolean).join(" · ") || undefined,
    },
    {
      key: "Movement",
      value: steps != null ? n(steps) : "—",
      units: kcal != null ? `${n(kcal)} kcal active` : undefined,
      note: "steps today",
    },
    {
      key: "Focus",
      value: ha.state("sensor.focus_state") ?? "—",
      units: "the desk, and what is on it",
      open: () => onnav("focus"),
    },
  ]);

  const rows = $derived<Row[]>([
    { key: "Health detail", sub: "sleep stages, HRV and the readiness history", value: "Open", tint: "var(--health)", open: () => onnav("medetail") },
    { key: "Focus & desk", sub: "the work PC, displays and the focus state", value: "Open", tint: "var(--health)", open: () => onnav("focus") },
    { key: "Vitality", sub: "the longer arc — trends rather than today", value: "Open", tint: "var(--health)", open: () => onnav("vitality") },
    { key: "Usage", sub: "what you actually used in the portal", value: "Open", tint: "var(--acc)", open: () => onnav("usage") },
    { key: "Insights", sub: "90-day baselines against the last 7 days", value: "Open", tint: "var(--acc)", open: () => onnav("insights") },
  ]);
</script>

{#if authStore.status === "loading"}
  <Skeleton variant="card" height={220} />
{:else if !authStore.isOwner}
  <!-- Named, not hidden. A blank screen reads as a bug; this reads as a rule. -->
  <div class="denied">
    <p class="dt">This one is owner-only</p>
    <p class="dd">
      Health, sleep and location are not shared with members, guests or visitor
      passes — and not because the view is hidden. The rule is enforced in
      <code>firestore.rules</code> and in what the export contains, so hiding the
      nav item would only be tidiness.
    </p>
  </div>
{:else}
  <HubBoard
    hub="me"
    scopes={["Health", "Focus", "Usage", "Insights"]}
    sub="owner-only · excluded from the family export"
    {stats}
    listTitle="The detail"
    {rows}
    noteTitle="Why Vitality moved here"
    note="Health is owner-only and Rooms is not. A view folded into a hub inherits that hub's audience, and Rooms is a screen Mandri and a house-sitter both see — so Vitality could not stay there whatever the topic looked like."
    {onnav}
  />
{/if}

<style>
  .denied { background: var(--s1); border-radius: var(--r-surface); padding: 18px 20px; max-width: 62ch; }
  .dt { font-size: 15px; font-weight: 700; color: var(--tx); margin: 0; }
  .dd { font-size: 12.5px; color: var(--mut); line-height: 1.6; margin: 8px 0 0; text-wrap: pretty; }
  .dd code { font-family: ui-monospace, monospace; font-size: 11px; color: var(--tx2); }
</style>
