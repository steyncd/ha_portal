<script lang="ts">
  let {
    pct,
    color = "var(--brand)",
    size = 92,
    stroke = 8,
    label = "",
  }: {
    pct: number | null;
    color?: string;
    size?: number;
    stroke?: number;
    label?: string;
  } = $props();

  const r = $derived((size - stroke) / 2);
  const circ = $derived(2 * Math.PI * r);
  const clamped = $derived(Math.max(0, Math.min(100, pct ?? 0)));
  const offset = $derived(circ * (1 - clamped / 100));
</script>

<svg width={size} height={size} viewBox="0 0 {size} {size}" class="ring">
  <circle
    cx={size / 2}
    cy={size / 2}
    {r}
    fill="none"
    stroke="var(--fill-strong)"
    stroke-width={stroke}
  />
  <circle
    cx={size / 2}
    cy={size / 2}
    {r}
    fill="none"
    stroke={color}
    stroke-width={stroke}
    stroke-linecap="round"
    stroke-dasharray={circ}
    stroke-dashoffset={offset}
    transform="rotate(-90 {size / 2} {size / 2})"
  />
  <text x="50%" y="48%" class="val" fill="var(--text)">
    {pct == null ? "—" : Math.round(pct)}<tspan class="pct">%</tspan>
  </text>
  {#if label}
    <text x="50%" y="66%" class="lbl" fill="var(--muted)">{label}</text>
  {/if}
</svg>

<style>
  .ring circle {
    transition: stroke-dashoffset 0.6s ease;
  }
  .val {
    font-size: 22px;
    font-weight: 700;
    text-anchor: middle;
    dominant-baseline: middle;
  }
  .pct {
    font-size: 12px;
    fill: var(--text-2);
  }
  .lbl {
    font-size: 8.5px;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
    text-anchor: middle;
  }
</style>
