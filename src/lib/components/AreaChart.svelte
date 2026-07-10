<script lang="ts">
  let {
    data,
    color = "var(--brand)",
    height = 140,
    unit = "",
    mini = false,
    fixedMin,
    fixedMax,
    digits = 0,
  }: {
    data: { t: number; v: number }[];
    color?: string;
    height?: number;
    unit?: string;
    mini?: boolean;
    fixedMin?: number;
    fixedMax?: number;
    digits?: number;
  } = $props();

  const W = 320;
  const padY = $derived(mini ? 4 : 10);

  const view = $derived.by(() => {
    if (data.length < 2) return null;
    const ts = data.map((d) => d.t);
    const vs = data.map((d) => d.v);
    const tMin = Math.min(...ts);
    const tMax = Math.max(...ts);
    let vMin = fixedMin ?? Math.min(...vs);
    let vMax = fixedMax ?? Math.max(...vs);
    if (vMin === vMax) {
      vMin -= 1;
      vMax += 1;
    }
    const H = height;
    const x = (t: number) => ((t - tMin) / (tMax - tMin)) * W;
    const y = (v: number) =>
      H - padY - ((v - vMin) / (vMax - vMin)) * (H - padY * 2);
    const pts = data.map((d) => `${x(d.t).toFixed(1)},${y(d.v).toFixed(1)}`);
    const line = "M" + pts.join(" L");
    const area = `${line} L${W},${height} L0,${height} Z`;
    return {
      line,
      area,
      last: data[data.length - 1],
      lastXY: { x: x(data[data.length - 1].t), y: y(data[data.length - 1].v) },
      vMin,
      vMax,
    };
  });

  const uid = Math.random().toString(36).slice(2, 8);
</script>

{#if view}
  <div class="chart" style="--c:{color}">
    <svg viewBox="0 0 {W} {height}" preserveAspectRatio="none" style="height:{height}px">
      <defs>
        <linearGradient id="g-{uid}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color={color} stop-opacity="0.35" />
          <stop offset="100%" stop-color={color} stop-opacity="0" />
        </linearGradient>
      </defs>
      <path d={view.area} fill="url(#g-{uid})" />
      <path d={view.line} fill="none" stroke={color} stroke-width={mini ? 2 : 2.5} vector-effect="non-scaling-stroke" />
      {#if !mini}
        <circle cx={view.lastXY.x} cy={view.lastXY.y} r="3.5" fill={color} />
      {/if}
    </svg>
    {#if !mini}
      <div class="axis">
        <span>{view.vMax.toFixed(digits)}{unit}</span>
        <span>{view.vMin.toFixed(digits)}{unit}</span>
      </div>
    {/if}
  </div>
{:else}
  <div class="empty" style="height:{height}px">
    {data.length === 0 ? "No history" : "…"}
  </div>
{/if}

<style>
  .chart {
    position: relative;
    width: 100%;
  }
  svg {
    width: 100%;
    display: block;
    overflow: visible;
  }
  .axis {
    position: absolute;
    top: 0;
    right: 4px;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: flex-end;
    font-size: 10px;
    color: var(--muted);
    pointer-events: none;
  }
  .empty {
    display: grid;
    place-items: center;
    color: var(--muted);
    font-size: 12px;
    width: 100%;
  }
</style>
