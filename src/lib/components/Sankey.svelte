<script lang="ts">
  // Minimal sources → home → sinks sankey. Values in W; band heights are proportional.
  type Node = { label: string; value: number; color: string };
  let { sources, sinks, height = 220 }: { sources: Node[]; sinks: Node[]; height?: number } = $props();

  const W = 320;
  const NW = 12; // node bar width
  const cx = W / 2;

  const flow = $derived.by(() => {
    const src = sources.filter((s) => s.value > 0);
    const snk = sinks.filter((s) => s.value > 0);
    const sumS = src.reduce((a, b) => a + b.value, 0);
    const sumK = snk.reduce((a, b) => a + b.value, 0);
    const total = Math.max(sumS, sumK, 1);
    const pad = 6;
    const usable = height - pad * 2;
    const scale = usable / total;

    let yS = pad + (usable - sumS * scale) / 2;
    const srcN = src.map((n) => { const h = n.value * scale; const o = { ...n, y: yS, h }; yS += h; return o; });
    let yK = pad + (usable - sumK * scale) / 2;
    const snkN = snk.map((n) => { const h = n.value * scale; const o = { ...n, y: yK, h }; yK += h; return o; });

    // links: source → home (left half), home → sink (right half)
    const homeH = Math.max(sumS, sumK) * scale;
    const homeY = pad + (usable - homeH) / 2;
    let hIn = homeY;
    const linksIn = srcN.map((n) => {
      const y0 = n.y + n.h / 2, y1 = hIn + n.h / 2; hIn += n.h;
      return { d: `M${NW},${y0} C${cx * 0.6},${y0} ${cx * 0.4},${y1} ${cx - NW / 2},${y1}`, w: n.h, color: n.color };
    });
    let hOut = homeY;
    const linksOut = snkN.map((n) => {
      const y0 = hOut + n.h / 2, y1 = n.y + n.h / 2; hOut += n.h;
      return { d: `M${cx + NW / 2},${y0} C${cx * 1.4},${y0} ${cx * 1.6},${y1} ${W - NW},${y1}`, w: n.h, color: n.color };
    });
    return { srcN, snkN, homeY, homeH, linksIn, linksOut };
  });
</script>

{#if flow && (flow.srcN.length || flow.snkN.length)}
  <div class="sankey">
    <svg viewBox="0 0 {W} {height}" style="width:100%;height:{height}px;display:block">
      {#each flow.linksIn as l}<path d={l.d} fill="none" stroke={l.color} stroke-width={Math.max(1, l.w)} stroke-opacity="0.28" />{/each}
      {#each flow.linksOut as l}<path d={l.d} fill="none" stroke={l.color} stroke-width={Math.max(1, l.w)} stroke-opacity="0.28" />{/each}
      {#each flow.srcN as n}<rect x="0" y={n.y} width={NW} height={Math.max(2, n.h)} rx="3" fill={n.color} /><text x={NW + 6} y={n.y + n.h / 2} class="lbl" dominant-baseline="middle">{n.label}</text>{/each}
      <rect x={cx - NW / 2} y={flow.homeY} width={NW} height={Math.max(2, flow.homeH)} rx="3" fill="var(--acc)" />
      <text x={cx} y={flow.homeY - 5} class="lbl mid" text-anchor="middle">Home</text>
      {#each flow.snkN as n}<rect x={W - NW} y={n.y} width={NW} height={Math.max(2, n.h)} rx="3" fill={n.color} /><text x={W - NW - 6} y={n.y + n.h / 2} class="lbl end" text-anchor="end" dominant-baseline="middle">{n.label}</text>{/each}
    </svg>
  </div>
{:else}
  <div class="empty" style="height:{height}px">No flow data</div>
{/if}

<style>
  .sankey { width: 100%; }
  :global(.sankey text.lbl) { font-size: 9px; fill: var(--dim); }
  :global(.sankey text.mid) { font-size: 10px; font-weight: 700; fill: var(--text); }
  .empty { display: grid; place-items: center; color: var(--muted); font-size: 12px; }
</style>
