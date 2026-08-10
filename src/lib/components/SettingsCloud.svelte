<script lang="ts">
  // Settings › Cloud & AI. PLATFORM-CONCEPTS, cloud section.
  //
  // Three decisions worth recording where somebody will find them again, because
  // each one has already cost time once:
  //
  // 1. STAY ON THE GEMINI DEVELOPER API. It has a real free tier needing no
  //    payment method at all. Vertex AI has no permanent free tier and its $300
  //    credit expires in 90 days. Do not migrate.
  // 2. THE MODEL NAME BELONGS IN REMOTE CONFIG. A frigate.yml comment already
  //    records gemini-2.5-flash coming back unavailable, and the 2.5 family shuts
  //    down in October 2026. A server-controlled variable makes a deprecation a
  //    config change instead of a redeploy.
  // 3. BIGQUERY STREAMING INSERTS BILL FROM THE FIRST BYTE. Batch loading is
  //    free, warehouseSnapshot is already a nightly batch, and nobody should
  //    "improve" it into a live stream.
  import SettingRow from "./SettingRow.svelte";

  // Observed volume, from the call sites rather than guessed.
  const CALLS = [
    { k: "Anomaly nudges", n: 6, note: "every 2 hours, deterministically gated" },
    { k: "Chart captions", n: 18, note: "cached on a content hash — a redraw is free" },
    { k: "Frigate review summaries", n: 188, note: "per review event, on the box" },
    { k: "Ask-my-house", n: 0, note: "on demand only" },
  ];
  const total = CALLS.reduce((s, c) => s + c.n, 0);
</script>

<section class="grp">
  <h3 class="kicker">Model access</h3>
  <SettingRow
    label="Gemini Developer API"
    explain="A real free tier that needs no payment method — the project stays on the no-cost Spark plan, roughly a thousand requests a day. Firebase AI Logic itself is free; you pay only for model usage."
    value="Free tier"
    lock
  />
  <SettingRow
    label="Do not migrate to Vertex AI"
    explain="No permanent free tier for most features, and the $300 credit expires after 90 days. Remote access and TTS are already solved elsewhere."
    value="Ruled out"
    lock
  />
  <SettingRow
    label="Model name in Remote Config"
    explain="gemini-2.5-* already came back unavailable once, and the 2.5 family shuts down in October 2026. A server-controlled variable turns a deprecation into a config change rather than a redeploy — and A/B tests prompts with the same mechanism."
    value="To do"
    warn
  />
  <SettingRow
    label="App Check on AI Logic"
    explain="Firebase began auto-enforcing App Check for AI Logic in July 2026. If model calls start failing for no visible reason, check this first."
    value="Check"
    warn
  />
</section>

<section class="grp">
  <h3 class="kicker">Volume</h3>
  <p class="lead">
    About {total} calls a day against a free allowance near a thousand. Every one
    is cached or gated — the caching is why the caption count stays flat when you
    open the same chart twenty times.
  </p>
  {#each CALLS as c (c.k)}
    <SettingRow label={c.k} explain={c.note} value={`${c.n}/day`} />
  {/each}
</section>

<section class="grp">
  <h3 class="kicker">Analytics off the box</h3>
  <p class="lead">
    Three of these jobs are SQL, not Python, and all three would otherwise run on
    a 4th-gen i5 with no headroom. The first 1 TiB of query processing and 10 GB
    of storage per month are free, resetting monthly; three household-scale
    queries use a fraction of a percent.
  </p>
  <SettingRow label="Cadence p95 per entity" explain="02:10 → the freshness thresholds the portal is still running on defaults for" value="To do" warn />
  <SettingRow label="Appliance drift" explain="02:20 → each of 17 plugs against its own 30-day baseline, step changes only" value="To do" warn />
  <SettingRow label="Borehole cycle trend" explain="02:30 → runs per week, week over week, plus p95 run length" value="To do" warn />
  <SettingRow
    label="Never make the snapshot a stream"
    explain="Streaming inserts bill from the first byte (~$0.05/GB); batch loading from files is free. warehouseSnapshot is already a nightly batch — keep it that way."
    value="Locked"
    lock
  />
</section>

<style>
  .grp { margin-bottom: 22px; }
  .lead { font-size: 12px; color: var(--mut); line-height: 1.55; margin: 6px 0 8px; text-wrap: pretty; }
</style>
