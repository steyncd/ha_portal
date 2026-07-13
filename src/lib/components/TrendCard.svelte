<script lang="ts">
  import type { Trend } from "../trends";

  let { trend }: { trend: Trend } = $props();

  const W = 300;
  const H = 60;

  // map the series into an SVG polyline + a baseline reference line
  const geo = $derived.by(() => {
    const s = trend.series;
    const vals = s.map((p) => p.v).concat(trend.baseline);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const span = max - min || 1;
    const x = (i: number) => (s.length < 2 ? 0 : (i / (s.length - 1)) * W);
    const y = (v: number) => H - 6 - ((v - min) / span) * (H - 12);
    const pts = s.map((p, i) => `${x(i).toFixed(1)},${y(p.v).toFixed(1)}`);
    const line = pts.join(" ");
    const area = `0,${H} ${line} ${W},${H}`;
    return { line, area, baseY: y(trend.baseline).toFixed(1), lastX: x(s.length - 1), lastY: y(s[s.length - 1].v) };
  });

  const color = $derived(trend.good === false ? "var(--warning)" : trend.good === true ? "var(--success)" : "var(--acc)");
  const arrow = $derived(trend.direction === "up" ? "▲" : trend.direction === "down" ? "▼" : "▬");
</script>

<div class="tc" style="--tc:{color}">
  <div class="top">
    <span class="lbl">{trend.def.label}</span>
    <span class="chip">{arrow} {trend.direction === "flat" ? "steady" : `${trend.deltaPct >= 0 ? "+" : ""}${trend.deltaPct.toFixed(0)}%`}</span>
  </div>
  <svg viewBox="0 0 {W} {H}" preserveAspectRatio="none" class="spark">
    <polygon points={geo.area} fill="var(--tc)" opacity="0.1" />
    <line x1="0" y1={geo.baseY} x2={W} y2={geo.baseY} stroke="var(--muted)" stroke-width="1" stroke-dasharray="3 4" opacity="0.6" />
    <polyline points={geo.line} fill="none" stroke="var(--tc)" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
    <circle cx={geo.lastX} cy={geo.lastY} r="3" fill="var(--tc)" />
  </svg>
  <div class="detail">{trend.detail}</div>
</div>

<style>
  .tc { padding: 15px 16px; border-radius: 15px; background: rgba(255, 255, 255, 0.035); box-shadow: inset 0 0 0 1px var(--line); display: flex; flex-direction: column; gap: 9px; }
  .top { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .lbl { font-size: 12.5px; font-weight: 700; color: var(--text); }
  .chip { font-size: 11px; font-weight: 800; color: var(--tc); background: color-mix(in srgb, var(--tc) 15%, transparent); padding: 3px 8px; border-radius: 999px; white-space: nowrap; }
  .spark { width: 100%; height: 46px; display: block; }
  .detail { font-size: 11.5px; color: var(--muted); line-height: 1.45; }
</style>
