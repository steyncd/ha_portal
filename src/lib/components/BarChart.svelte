<script lang="ts">
  let {
    bars,
    height = 150,
    unit = "",
    digits = 0,
  }: {
    bars: { label: string; value: number | null; color?: string }[];
    height?: number;
    unit?: string;
    digits?: number;
  } = $props();

  const max = $derived(
    Math.max(1, ...bars.map((b) => (b.value != null ? b.value : 0))),
  );
</script>

<div class="bc" style="height:{height}px">
  {#each bars as b}
    {@const v = b.value ?? 0}
    <div class="col" title="{b.label}: {b.value == null ? '—' : v.toFixed(digits) + unit}">
      <div class="track">
        <div
          class="fill"
          style="height:{(v / max) * 100}%;background:{b.color ?? 'var(--brand)'}"
        >
          <span class="v">{b.value == null ? "—" : v.toFixed(digits)}{unit}</span>
        </div>
      </div>
      <span class="lbl">{b.label}</span>
    </div>
  {/each}
</div>

<style>
  .bc {
    display: flex;
    align-items: flex-end;
    gap: 10px;
    width: 100%;
  }
  .col {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    height: 100%;
    min-width: 0;
  }
  .track {
    flex: 1;
    width: 100%;
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }
  .fill {
    width: 100%;
    max-width: 46px;
    border-radius: 8px 8px 0 0;
    position: relative;
    min-height: 3px;
    transition: height 0.6s ease;
    display: flex;
    justify-content: center;
  }
  .v {
    position: absolute;
    top: -18px;
    font-size: 11px;
    font-weight: 700;
    white-space: nowrap;
  }
  .lbl {
    margin-top: 8px;
    font-size: 10.5px;
    color: var(--text-2);
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }
</style>
