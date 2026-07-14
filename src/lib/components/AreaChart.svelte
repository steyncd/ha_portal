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
    labelFmt,
    step = false,
  }: {
    data: { t: number; v: number }[];
    color?: string;
    height?: number;
    unit?: string;
    mini?: boolean;
    fixedMin?: number;
    fixedMax?: number;
    digits?: number;
    /** Format the hover tooltip's time label. Defaults to HH:MM (intraday). */
    labelFmt?: (t: number) => string;
    /** Step (hold-last-value) interpolation — correct for state/power sensors that
     *  hold a value until the next reading, so 0 reads as 0 and nothing is invented
     *  between points. Default false = smooth linear. */
    step?: boolean;
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
    const y = (v: number) => H - padY - ((v - vMin) / (vMax - vMin)) * (H - padY * 2);
    const xs = data.map((d) => x(d.t));
    const ys = data.map((d) => y(d.v));
    let line = `M${xs[0].toFixed(1)},${ys[0].toFixed(1)}`;
    for (let i = 1; i < data.length; i++) {
      // step-after: hold the previous value across to the next point, then step to it
      if (step) line += ` H${xs[i].toFixed(1)} V${ys[i].toFixed(1)}`;
      else line += ` L${xs[i].toFixed(1)},${ys[i].toFixed(1)}`;
    }
    const area = `${line} L${W},${height} L0,${height} Z`;
    return { line, area, tMin, tMax, vMin, vMax, x, y, lastXY: { x: x(data[data.length - 1].t), y: y(data[data.length - 1].v) } };
  });

  // ---- hover crosshair + value tooltip ----
  let hi = $state<number | null>(null);
  function onmove(e: MouseEvent) {
    if (data.length < 2 || !view) return;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    // Points are placed by TIME, not index, so map the cursor to a target time and
    // pick the nearest point — otherwise irregular/gappy series offset the marker.
    const targetT = view.tMin + frac * (view.tMax - view.tMin);
    let bi = 0;
    let bd = Infinity;
    for (let i = 0; i < data.length; i++) {
      const dd = Math.abs(data[i].t - targetT);
      if (dd < bd) { bd = dd; bi = i; }
    }
    hi = bi;
  }
  const hover = $derived.by(() => {
    if (hi == null || !view || !data[hi]) return null;
    const d = data[hi];
    const fx = (d.t - view.tMin) / (view.tMax - view.tMin || 1);
    return { d, sx: view.x(d.t), sy: view.y(d.v), frac: fx };
  });
  const hhmm = (t: number) => { const d = new Date(t); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
  const fmtLabel = $derived(labelFmt ?? hhmm);

  const uid = Math.random().toString(36).slice(2, 8);
</script>

{#if view}
  <div class="chart" style="--c:{color}" role="img" onmousemove={onmove} onmouseleave={() => (hi = null)}>
    <svg viewBox="0 0 {W} {height}" preserveAspectRatio="none" style="height:{height}px">
      <defs>
        <linearGradient id="g-{uid}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color={color} stop-opacity="0.35" />
          <stop offset="100%" stop-color={color} stop-opacity="0" />
        </linearGradient>
      </defs>
      <path d={view.area} fill="url(#g-{uid})" />
      <path d={view.line} fill="none" stroke={color} stroke-width={mini ? 2 : 2.5} vector-effect="non-scaling-stroke" />
      {#if !mini && !hover}
        <circle cx={view.lastXY.x} cy={view.lastXY.y} r="3.5" fill={color} />
      {/if}
      {#if hover}
        <line x1={hover.sx} x2={hover.sx} y1="0" y2={height} stroke="var(--c)" stroke-width="1" opacity="0.5" vector-effect="non-scaling-stroke" stroke-dasharray="3 3" />
        <circle cx={hover.sx} cy={hover.sy} r="4" fill="var(--c)" />
      {/if}
    </svg>
    {#if !mini}
      <div class="axis">
        <span>{view.vMax.toFixed(digits)}{unit}</span>
        <span>{view.vMin.toFixed(digits)}{unit}</span>
      </div>
    {/if}
    {#if hover && !mini}
      <div class="tip" style="left:{hover.frac * 100}%">
        <b>{hover.d.v.toFixed(digits)}{unit}</b><span>{fmtLabel(hover.d.t)}</span>
      </div>
    {/if}
  </div>
{:else}
  <div class="empty" style="height:{height}px">
    {data.length === 0 ? "No history" : "…"}
  </div>
{/if}

<style>
  .chart { position: relative; width: 100%; }
  svg { width: 100%; display: block; overflow: visible; }
  .axis {
    position: absolute; top: 0; right: 4px; height: 100%;
    display: flex; flex-direction: column; justify-content: space-between; align-items: flex-end;
    font-size: 10px; color: var(--muted); pointer-events: none;
  }
  .tip {
    position: absolute; top: -4px; transform: translateX(-50%);
    background: rgba(10, 14, 22, 0.92); border: 1px solid var(--line, rgba(255, 255, 255, 0.12));
    border-radius: 8px; padding: 4px 9px; font-size: 11px; white-space: nowrap;
    pointer-events: none; display: flex; flex-direction: column; align-items: center; gap: 1px;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.4);
  }
  .tip b { font-size: 12.5px; font-weight: 800; color: var(--c); }
  .tip span { font-size: 9.5px; color: var(--muted); font-variant-numeric: tabular-nums; }
  .empty { display: grid; place-items: center; color: var(--muted); font-size: 12px; width: 100%; }
</style>
