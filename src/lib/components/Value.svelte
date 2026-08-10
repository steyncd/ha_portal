<script lang="ts">
  // Renders a Reading with its freshness treatment. Phase 1.1's "no per-view
  // code" promise lives here: views hand over a Reading, this decides how
  // certainty is expressed.
  //
  //   live  → normal.
  //   stale → desaturated to --mut, clock glyph, age in words.
  //   none  → em-dash, unit RETAINED, no layout shift.
  //
  // Deliberately never amber. Amber is reserved for "attention"; a stale
  // reading is absence of evidence, not alarm. Colour-blind-safe by
  // construction because the signal is luminance + glyph + words, not hue.
  import { ha } from "../store.svelte";
  import { ageWords, explain, type Reading } from "../freshness";

  let {
    reading,
    unit = "",
    digits,
    big = false,
    showAge = true,
  }: {
    reading: Reading<number | string | null>;
    unit?: string;
    /** Decimal places for numeric values. Omit to print as-is. */
    digits?: number;
    /** Hero-metric sizing. */
    big?: boolean;
    /** Suppress the age line where space is tight (e.g. dense tables). */
    showAge?: boolean;
  } = $props();

  /**
   * Precision by magnitude, when the caller has not said.
   *
   * `String(v)` was the old fallback and it is how the tank came out as
   * 99.13725490196078 on a dashboard: HA hands back whatever float the sensor
   * computed, and a percentage carrying fourteen decimals is not a more precise
   * reading, it is an unreadable one.
   *
   * The rule is the one people use when reading a number aloud: hundreds get no
   * decimals, ordinary values get one, and only sub-unit values get two — a
   * 0.42 kWh figure needs them, a 99% figure does not. Trailing zeros are
   * stripped so 20.0 reads as 20 rather than implying a precision we do not
   * have.
   *
   * An explicit `digits` always wins; this only decides what happens when
   * nobody chose.
   */
  function auto(v: number): string {
    if (Number.isInteger(v)) return String(v);
    const a = Math.abs(v);
    const dp = a >= 100 ? 0 : a >= 1 ? 1 : 2;
    return v.toFixed(dp).replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
  }

  const shown = $derived.by(() => {
    const v = reading.value;
    if (v == null) return "—";
    if (typeof v === "number") return digits != null ? v.toFixed(digits) : auto(v);
    return v;
  });

  const friendly = (id: string) => ha.name(id);
  const title = $derived(explain(reading, friendly));
</script>

<span class="v" class:stale={reading.state === "stale"} class:none={reading.state === "none"} class:big {title}>
  <span class="num">{shown}</span>
  {#if unit}<span class="unit">{unit}</span>{/if}
  {#if reading.state === "stale"}
    <!-- glyph + words, so hue is never the only carrier -->
    <span class="mark" aria-hidden="true">🕐</span>
    {#if showAge}<span class="age">{ageWords(reading.at)}</span>{/if}
  {/if}
</span>

<style>
  .v {
    display: inline-flex;
    align-items: baseline;
    gap: 0.14em;
    font-variant-numeric: tabular-nums;
  }
  .num { font-weight: 800; }
  .big .num { font-size: 30px; letter-spacing: -1.2px; }

  /* Brief 1.2: the unit must not inherit the parent's negative tracking —
     that's what jams it against the last digit on every hero metric. */
  .unit {
    font-weight: 400;
    color: var(--mut, var(--muted));
    letter-spacing: 0;
    margin-left: 0.14em;
    font-size: 0.62em;
  }

  /* Stale: desaturate. NOT amber. */
  .v.stale .num,
  .v.stale .unit { color: var(--mut, var(--muted)); }
  .mark { font-size: 0.62em; opacity: 0.75; margin-left: 0.2em; }
  .age {
    font-size: 0.56em;
    font-weight: 400;
    color: var(--mut, var(--muted));
    margin-left: 0.25em;
    white-space: nowrap;
  }

  /* None: em-dash, unit retained so the row doesn't reflow. */
  .v.none .num { color: var(--mut, var(--muted)); font-weight: 700; }
</style>
