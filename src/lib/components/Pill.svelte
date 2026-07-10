<script lang="ts">
  let {
    label,
    color = "var(--brand)",
  }: { label: string; color?: string } = $props();
</script>

<span class="pill" style="--c:{color}">
  <span class="dot"></span>
  {label}
</span>

<style>
  .pill {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 6px 12px;
    border-radius: var(--r-pill);
    font-size: 11.5px;
    font-weight: 600;
    color: var(--c);
    background: color-mix(in srgb, var(--c) 12%, transparent);
    white-space: nowrap;
  }
  .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--c);
  }
</style>
