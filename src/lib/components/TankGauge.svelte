<script lang="ts">
  let {
    pct,
    color = "var(--water)",
  }: { pct: number | null; color?: string } = $props();

  const clamped = $derived(Math.max(0, Math.min(100, pct ?? 0)));
  const H = 96;
  const fillH = $derived((clamped / 100) * (H - 6));
</script>

<div class="tank">
  <svg width="60" height={H} viewBox="0 0 60 {H}">
    <rect
      x="3"
      y="3"
      width="54"
      height={H - 6}
      rx="10"
      fill="var(--fill)"
      stroke="var(--border-strong)"
    />
    <rect
      x="3"
      y={H - 3 - fillH}
      width="54"
      height={fillH}
      rx="10"
      fill={color}
      opacity="0.85"
    />
  </svg>
  <span class="pct">{pct == null ? "—" : pct.toFixed(0)}%</span>
</div>

<style>
  .tank {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }
  .tank svg rect:last-child {
    transition: y 0.6s ease, height 0.6s ease;
  }
  .pct {
    font-size: 13px;
    font-weight: 700;
    color: var(--text);
  }
</style>
