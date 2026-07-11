<script lang="ts">
  // Flexible sparkline: accepts a plain number[] or a history [{t,v}] series.
  let {
    data,
    color = "var(--acc)",
    height = 70,
    fill = true,
    base0 = true,
    forceMax,
  }: {
    data: number[] | { t: number; v: number }[];
    color?: string;
    height?: number;
    fill?: boolean;
    base0?: boolean;
    forceMax?: number;
  } = $props();

  const vals = $derived(
    data.map((d) => (typeof d === "number" ? d : d.v)),
  );

  const W = 280;
  const view = $derived.by(() => {
    if (vals.length < 2) return null;
    const pad = 4;
    const max = Math.max(...vals, forceMax ?? 0, 0.0001);
    const min = base0 ? 0 : Math.min(...vals);
    const rng = max - min || 1;
    const n = vals.length;
    const X = (i: number) => pad + (i * (W - 2 * pad)) / (n - 1);
    const Y = (v: number) => height - pad - ((v - min) / rng) * (height - 2 * pad);
    const line = vals.map((v, i) => `${i ? "L" : "M"}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(" ");
    const area = `M${X(0).toFixed(1)} ${height} ${vals.map((v, i) => `L${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(" ")} L${X(n - 1).toFixed(1)} ${height} Z`;
    return { line, area, lx: X(n - 1), ly: Y(vals[n - 1]) };
  });

  const uid = Math.random().toString(36).slice(2, 8);
</script>

{#if view}
  <svg viewBox="0 0 {W} {height}" preserveAspectRatio="none" style="width:100%;height:{height}px;display:block">
    <defs>
      <linearGradient id="s-{uid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color={color} stop-opacity="0.28" />
        <stop offset="100%" stop-color={color} stop-opacity="0" />
      </linearGradient>
    </defs>
    {#if fill}<path d={view.area} fill="url(#s-{uid})" />{/if}
    <path d={view.line} fill="none" stroke={color} stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
    <circle cx={view.lx} cy={view.ly} r="3.4" fill={color} stroke="#0b1017" stroke-width="2" />
  </svg>
{:else}
  <div style="height:{height}px;display:grid;place-items:center;color:var(--muted-2);font-size:11px">no data</div>
{/if}
