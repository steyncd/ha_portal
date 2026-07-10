<script lang="ts">
  let {
    label,
    value,
    pct,
    color = "var(--brand)",
  }: {
    label: string;
    value: string;
    pct: number | null;
    color?: string;
  } = $props();

  const w = $derived(Math.max(0, Math.min(100, pct ?? 0)));
</script>

<div class="row">
  <div class="top">
    <span class="lbl">{label}</span>
    <span class="val">{value}</span>
  </div>
  <div class="bg">
    <div class="fl" style="width:{w}%;background:{color}"></div>
  </div>
</div>

<style>
  .row {
    margin-bottom: 14px;
  }
  .row:last-child {
    margin-bottom: 0;
  }
  .top {
    display: flex;
    justify-content: space-between;
    font-size: 13px;
    margin-bottom: 7px;
  }
  .lbl {
    color: var(--text-2);
  }
  .val {
    font-weight: 700;
  }
  .bg {
    height: 9px;
    border-radius: 6px;
    background: var(--fill-strong);
    overflow: hidden;
  }
  .fl {
    height: 100%;
    border-radius: 6px;
    transition: width 0.6s ease;
  }
</style>
