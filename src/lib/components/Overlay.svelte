<script lang="ts">
  // Multi-series overlay: filled areas and/or lines sharing one time/value scale.
  type Series = { data: { t: number; v: number }[]; color: string; label: string; fill?: boolean; dash?: string };
  let { series, height = 150 }: { series: Series[]; height?: number } = $props();

  const W = 320;
  const padY = 10;

  const view = $derived.by(() => {
    const all = series.flatMap((s) => s.data);
    if (all.length < 2) return null;
    const ts = all.map((d) => d.t);
    const vs = all.map((d) => d.v);
    const tMin = Math.min(...ts);
    const tMax = Math.max(...ts);
    let vMin = Math.min(0, ...vs);
    let vMax = Math.max(...vs);
    if (vMin === vMax) { vMin -= 1; vMax += 1; }
    const x = (t: number) => ((t - tMin) / (tMax - tMin)) * W;
    const y = (v: number) => height - padY - ((v - vMin) / (vMax - vMin)) * (height - padY * 2);
    const zeroY = y(0);
    return series.map((s) => {
      if (s.data.length < 2) return { ...s, line: "", area: "" };
      const pts = s.data.map((d) => `${x(d.t).toFixed(1)},${y(d.v).toFixed(1)}`);
      const line = "M" + pts.join(" L");
      const area = `${line} L${W},${zeroY.toFixed(1)} L0,${zeroY.toFixed(1)} Z`;
      return { ...s, line, area };
    });
  });

  const uid = Math.random().toString(36).slice(2, 8);
</script>

{#if view}
  <div>
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
    </svg>
    <div class="lg">
      {#each series as s}<span class="li"><span class="sw" style="background:{s.color}"></span>{s.label}</span>{/each}
    </div>
  </div>
{:else}
  <div class="empty" style="height:{height}px">No history</div>
{/if}

<style>
  .lg { display: flex; flex-wrap: wrap; gap: 6px 16px; justify-content: center; margin-top: 8px; font-size: 11.5px; color: var(--dim); }
  .li { display: inline-flex; align-items: center; gap: 6px; }
  .sw { width: 9px; height: 9px; border-radius: 2px; }
  .empty { display: grid; place-items: center; color: var(--muted); font-size: 12px; width: 100%; }
</style>
