<script lang="ts">
  // Multi-series overlay: filled areas and/or lines sharing one time/value scale.
  type Series = { data: { t: number; v: number }[]; color: string; label: string; fill?: boolean; dash?: string };
  // `unit` overrides the tooltip formatting (e.g. "°" for temperature). When
  // omitted, values auto-format as power (W / kW) — the default for energy charts.
  let { series, height = 150, unit }: { series: Series[]; height?: number; unit?: string } = $props();

  const W = 320;
  const padY = 10;

  const scale = $derived.by(() => {
    const all = series.flatMap((s) => s.data);
    if (all.length < 2) return null;
    const ts = all.map((d) => d.t);
    const vs = all.map((d) => d.v);
    const tMin = Math.min(...ts);
    const tMax = Math.max(...ts);
    let vMin = Math.min(0, ...vs);
    let vMax = Math.max(...vs);
    if (vMin === vMax) { vMin -= 1; vMax += 1; }
    const x = (t: number) => ((t - tMin) / (tMax - tMin || 1)) * W;
    const y = (v: number) => height - padY - ((v - vMin) / (vMax - vMin)) * (height - padY * 2);
    return { tMin, tMax, x, y, zeroY: y(0) };
  });

  const view = $derived.by(() => {
    if (!scale) return null;
    return series.map((s) => {
      if (s.data.length < 2) return { ...s, line: "", area: "" };
      const pts = s.data.map((d) => `${scale.x(d.t).toFixed(1)},${scale.y(d.v).toFixed(1)}`);
      const line = "M" + pts.join(" L");
      const area = `${line} L${W},${scale.zeroY.toFixed(1)} L0,${scale.zeroY.toFixed(1)} Z`;
      return { ...s, line, area };
    });
  });

  // ---- hover crosshair + per-series value tooltip ----
  let hx = $state<number | null>(null);
  function onmove(e: MouseEvent) {
    if (!scale) return;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    hx = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
  }
  const hover = $derived.by(() => {
    if (hx == null || !scale) return null;
    const t = scale.tMin + hx * (scale.tMax - scale.tMin);
    const pts = series
      .filter((s) => s.data.length)
      .map((s) => {
        let best = s.data[0], bd = Infinity;
        for (const d of s.data) { const dd = Math.abs(d.t - t); if (dd < bd) { bd = dd; best = d; } }
        return { label: s.label, color: s.color, v: best.v, sy: scale.y(best.v) };
      });
    return { sx: hx * W, frac: hx, t, pts };
  });
  const fmt = (v: number) =>
    unit != null
      ? `${Math.round(v * 10) / 10}${unit}`
      : Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(2)} kW` : `${Math.round(v)} W`;
  const hhmm = (t: number) => { const d = new Date(t); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };

  const uid = Math.random().toString(36).slice(2, 8);
</script>

{#if view}
  <div class="wrap">
    <div class="plot" role="img" onmousemove={onmove} onmouseleave={() => (hx = null)}>
      <svg viewBox="0 0 {W} {height}" preserveAspectRatio="none" style="height:{height}px;width:100%;display:block;overflow:visible">
        <defs>
          {#each view as s, i}
            <linearGradient id="og-{uid}-{i}" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color={s.color} stop-opacity="0.3" />
              <stop offset="100%" stop-color={s.color} stop-opacity="0" />
            </linearGradient>
          {/each}
        </defs>
        {#each view as s, i}
          {#if s.fill && s.area}<path d={s.area} fill="url(#og-{uid}-{i})" />{/if}
        {/each}
        {#each view as s}
          {#if s.line}<path d={s.line} fill="none" stroke={s.color} stroke-width={s.fill ? 2.5 : 2} vector-effect="non-scaling-stroke" stroke-dasharray={s.dash ?? ""} />{/if}
        {/each}
        {#if hover}
          <line x1={hover.sx} x2={hover.sx} y1="0" y2={height} stroke="rgba(255,255,255,.4)" stroke-width="1" vector-effect="non-scaling-stroke" stroke-dasharray="3 3" />
          {#each hover.pts as p}<circle cx={hover.sx} cy={p.sy} r="3.5" fill={p.color} />{/each}
        {/if}
      </svg>
      {#if hover}
        <div class="tip" class:right={hover.frac > 0.6} style="left:{hover.frac * 100}%">
          <div class="tipt">{hhmm(hover.t)}</div>
          {#each hover.pts as p}
            <div class="tipr"><span class="sw" style="background:{p.color}"></span><span class="tl">{p.label}</span><b>{fmt(p.v)}</b></div>
          {/each}
        </div>
      {/if}
    </div>
    <div class="lg">
      {#each series as s}<span class="li"><span class="sw" style="background:{s.color}"></span>{s.label}</span>{/each}
    </div>
  </div>
{:else}
  <div class="empty" style="height:{height}px">No history</div>
{/if}

<style>
  .wrap { width: 100%; }
  .plot { position: relative; width: 100%; }
  .lg { display: flex; flex-wrap: wrap; gap: 6px 16px; justify-content: center; margin-top: 8px; font-size: 11.5px; color: var(--dim); }
  .li { display: inline-flex; align-items: center; gap: 6px; }
  .sw { width: 9px; height: 9px; border-radius: 2px; flex-shrink: 0; }
  .tip {
    position: absolute; top: -6px; transform: translateX(-50%);
    background: rgba(10, 14, 22, 0.94); border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 9px; padding: 6px 10px; min-width: 118px; pointer-events: none;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.45); z-index: 2;
  }
  .tip.right { transform: translateX(-100%); }
  .tipt { font-size: 10px; color: var(--muted); font-weight: 700; letter-spacing: 0.4px; margin-bottom: 4px; text-align: center; font-variant-numeric: tabular-nums; }
  .tipr { display: flex; align-items: center; gap: 7px; font-size: 11.5px; padding: 1px 0; }
  .tipr .tl { color: var(--text-2); flex: 1; }
  .tipr b { font-weight: 800; font-variant-numeric: tabular-nums; }
  .empty { display: grid; place-items: center; color: var(--muted); font-size: 12px; width: 100%; }
</style>
