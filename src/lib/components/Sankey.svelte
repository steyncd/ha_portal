<script lang="ts">
  // Flowy sources → home → sinks sankey. Ribbons are FILLED, curved bands whose
  // thickness is proportional to value; labels are de-collided so thin bands stay
  // readable without distorting the ribbons.
  type Node = { label: string; value: number; color: string };
  let { sources, sinks, height = 240 }: { sources: Node[]; sinks: Node[]; height?: number } = $props();

  const W = 440;
  const NW = 9; // node bar width
  const PAD = 14;
  const cx = W / 2;
  const LH = 15; // min vertical spacing between labels

  // spread label y-positions so they never overlap, staying within [top, bottom]
  function decollide(centers: number[], top: number, bottom: number): number[] {
    const ys = centers.slice();
    for (let i = 1; i < ys.length; i++) if (ys[i] < ys[i - 1] + LH) ys[i] = ys[i - 1] + LH;
    if (ys.length && ys[ys.length - 1] > bottom) ys[ys.length - 1] = bottom;
    for (let i = ys.length - 2; i >= 0; i--) if (ys[i] > ys[i + 1] - LH) ys[i] = ys[i + 1] - LH;
    if (ys.length && ys[0] < top) ys[0] = top;
    return ys;
  }

  const ribbon = (x0: number, t0: number, b0: number, x1: number, t1: number, b1: number) => {
    const xc = (x0 + x1) / 2;
    return `M${x0},${t0} C${xc},${t0} ${xc},${t1} ${x1},${t1} L${x1},${b1} C${xc},${b1} ${xc},${b0} ${x0},${b0} Z`;
  };

  const geo = $derived.by(() => {
    const src = sources.filter((s) => s.value > 0);
    const snk = sinks.filter((s) => s.value > 0);
    const rows = Math.max(src.length, snk.length, 1);
    const H = Math.max(height, rows * LH + PAD * 2);
    const usable = H - PAD * 2;
    const sumS = src.reduce((a, b) => a + b.value, 0) || 1;
    const sumK = snk.reduce((a, b) => a + b.value, 0) || 1;
    const scale = usable / Math.max(sumS, sumK);
    const GAP = 3;

    const stack = (nodes: Node[], sum: number) => {
      const totalH = sum * scale + GAP * Math.max(0, nodes.length - 1);
      let y = PAD + (usable - totalH) / 2;
      return nodes.map((n) => {
        const h = Math.max(1.5, n.value * scale);
        const o = { ...n, y, h, mid: y + h / 2 };
        y += h + GAP;
        return o;
      });
    };
    const srcN = stack(src, sumS);
    const snkN = stack(snk, sumK);

    const homeH = Math.max(sumS, sumK) * scale;
    const homeY = PAD + (usable - homeH) / 2;

    let inY = homeY + (homeH - sumS * scale) / 2;
    const linksIn = srcN.map((n) => {
      const d = ribbon(NW, n.y, n.y + n.h, cx - NW / 2, inY, inY + n.h);
      inY += n.h;
      return { d, color: n.color };
    });
    let outY = homeY + (homeH - sumK * scale) / 2;
    const linksOut = snkN.map((n) => {
      const d = ribbon(cx + NW / 2, outY, outY + n.h, W - NW, n.y, n.y + n.h);
      outY += n.h;
      return { d, color: n.color };
    });

    return {
      srcN, snkN, homeY, homeH, linksIn, linksOut, H,
      srcLabels: decollide(srcN.map((n) => n.mid), PAD + 4, H - PAD - 4),
      snkLabels: decollide(snkN.map((n) => n.mid), PAD + 4, H - PAD - 4),
    };
  });

  const fmt = (w: number) => (w >= 1000 ? `${(w / 1000).toFixed(1)}kW` : `${Math.round(w)}W`);
</script>

{#if geo.srcN.length || geo.snkN.length}
  <div class="sankey">
    <svg viewBox="0 0 {W} {geo.H}" style="width:100%;height:{geo.H}px;display:block">
      {#each geo.linksIn as l}<path d={l.d} fill={l.color} fill-opacity="0.3" />{/each}
      {#each geo.linksOut as l}<path d={l.d} fill={l.color} fill-opacity="0.3" />{/each}
      {#each geo.srcN as n}<rect x="0" y={n.y} width={NW} height={n.h} rx="2.5" fill={n.color} />{/each}
      <rect x={cx - NW / 2} y={geo.homeY} width={NW} height={geo.homeH} rx="2.5" fill="var(--acc)" />
      <text x={cx} y={geo.homeY - 6} class="lbl mid" text-anchor="middle">Home</text>
      {#each geo.snkN as n}<rect x={W - NW} y={n.y} width={NW} height={n.h} rx="2.5" fill={n.color} />{/each}
      {#each geo.srcN as n, i}<text x={NW + 7} y={geo.srcLabels[i]} class="lbl" dominant-baseline="middle">{n.label} · {fmt(n.value)}</text>{/each}
      {#each geo.snkN as n, i}<text x={W - NW - 7} y={geo.snkLabels[i]} class="lbl end" text-anchor="end" dominant-baseline="middle">{n.label} · {fmt(n.value)}</text>{/each}
    </svg>
  </div>
{:else}
  <div class="empty" style="height:{height}px">No flow data</div>
{/if}

<style>
  .sankey { width: 100%; overflow: hidden; }
  :global(.sankey text.lbl) { font-size: 10px; fill: var(--text-2); }
  :global(.sankey text.mid) { font-size: 10px; font-weight: 700; fill: var(--text); }
  .empty { display: grid; place-items: center; color: var(--muted); font-size: 12px; }
</style>
