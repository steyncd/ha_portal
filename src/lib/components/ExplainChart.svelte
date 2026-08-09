<script lang="ts">
  // "Explain this chart" — a small button that drops a two-sentence caption
  // under any chart. Costs are controlled server-side: only the points already
  // on screen are sent, and answers are cached on a content hash so a chart
  // that updates daily costs about one model call per day for the whole house.
  import { getFunctions, httpsCallable } from "firebase/functions";
  import { app } from "../firebase";

  let {
    chartId,
    title = "",
    unit = "",
    period = "",
    points = [],
  }: {
    chartId: string;
    title?: string;
    unit?: string;
    period?: string;
    points: { t: number | string; v: number }[];
  } = $props();

  let text = $state("");
  let loading = $state(false);
  let err = $state("");

  // Thin the series before sending: 60 points is plenty to describe a shape,
  // and it keeps both the prompt and the cache key small.
  function thin<T>(arr: T[], max = 60): T[] {
    if (arr.length <= max) return arr;
    const step = arr.length / max;
    return Array.from({ length: max }, (_, i) => arr[Math.floor(i * step)]);
  }

  async function explain() {
    if (loading) return;
    loading = true;
    err = "";
    try {
      const fn = httpsCallable(getFunctions(app, "us-central1"), "explainChart");
      const res = (await fn({
        chartId,
        title,
        unit,
        period,
        points: thin(points).map((p) => ({ t: p.t, v: p.v })),
      })) as { data: { text: string } };
      text = res.data?.text ?? "";
    } catch (e) {
      err = e instanceof Error ? e.message : "Couldn't explain this chart";
    } finally {
      loading = false;
    }
  }
</script>

{#if points.length >= 2}
  <div class="ex">
    {#if text}
      <p class="out">{text}</p>
    {:else}
      <button class="btn" onclick={explain} disabled={loading}>
        {loading ? "Reading the chart…" : "✨ Explain this"}
      </button>
      {#if err}<span class="err">{err}</span>{/if}
    {/if}
  </div>
{/if}

<style>
  .ex { margin-top: 8px; }
  .btn {
    font-size: 11px; font-weight: 600; color: var(--muted);
    background: rgba(255, 255, 255, 0.05);
    padding: 4px 10px; border-radius: 8px;
  }
  .btn:hover:not(:disabled) { background: rgba(255, 255, 255, 0.1); color: var(--text-2); }
  .btn:disabled { opacity: 0.6; cursor: default; }
  .out {
    margin: 0; font-size: 11.5px; line-height: 1.5; color: var(--dim);
    border-left: 2px solid color-mix(in srgb, var(--acc) 45%, transparent);
    padding-left: 9px;
  }
  .err { font-size: 10.5px; color: var(--warning); margin-left: 8px; }
</style>
